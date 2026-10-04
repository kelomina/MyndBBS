import http from 'node:http'
import { isIP } from 'node:net'
import { createHmac, randomUUID } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
  rename,
  mkdtemp,
  lstat,
} from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  ID,
  VERSION,
  sha256,
  tokenMatches,
  safeRequestPath,
  routeMatches,
  authAllowed,
  isObject,
} from './plugin-v2.mjs'
import { verifyArchive, extractVerifiedFiles } from './plugin-archive.mjs'

const exec = promisify(execFile)
const LIMIT = 30 * 1024 * 1024
const UI_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
const errorCode = (e) =>
  e instanceof Error && /^ERR_[A-Z_]+$/.test(e.message) ? e.message : 'ERR_PLUGIN_CONTROL_FAILED'
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
function appliedVerificationPolicy(config) {
  const surfaces = ['registration', 'post', 'comment', 'friendRequest']
  if (
    (config.enabled !== undefined && typeof config.enabled !== 'boolean') ||
    (config.surfaces !== undefined &&
      (!isObject(config.surfaces) ||
        Object.keys(config.surfaces).some((key) => !surfaces.includes(key))))
  )
    throw new Error('ERR_INVALID_PLUGIN_CONFIG')
  const policy = { enabled: config.enabled ?? true, surfaces: {} }
  for (const purpose of surfaces) {
    const value = config.surfaces?.[purpose]
    if (value !== undefined && typeof value !== 'boolean')
      throw new Error('ERR_INVALID_PLUGIN_CONFIG')
    policy.surfaces[purpose] = value ?? true
  }
  return policy
}
async function body(req, limit = LIMIT) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('ERR_PLUGIN_REQUEST_TOO_LARGE')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new Error('ERR_INVALID_JSON')
  }
}
async function exists(file) {
  try {
    await lstat(file)
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
}
async function atomicJson(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp'
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
  try {
    await rename(temporary, file)
  } finally {
    await rm(temporary, { force: true })
  }
}
export class DockerPluginRuntime {
  constructor({
    root,
    dockerRoot,
    trustKeysFile,
    dockerTrustKeysFile,
    network,
    image,
    docker = (args) => exec('docker', args, { maxBuffer: 1024 * 1024, timeout: 15000 }),
  }) {
    Object.assign(this, {
      root,
      dockerRoot,
      trustKeysFile,
      dockerTrustKeysFile,
      network,
      image,
      docker,
    })
  }
  async start({ name, pluginId, version, release, digest, config, eventToken, proxyToken }) {
    const source = path.join(this.dockerRoot, path.relative(this.root, release))
    await this.docker([
      'run',
      '-d',
      '--name',
      name,
      '--label',
      'myndbbs.plugin=' + pluginId,
      '--label',
      'myndbbs.version=' + version,
      '--network',
      this.network,
      '--restart',
      'unless-stopped',
      '--read-only',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--pids-limit=64',
      '--memory=256m',
      '--memory-swap=256m',
      '--cpus=1',
      '--user=1000:1000',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=16m',
      '-e',
      'NODE_ENV=production',
      '-e',
      'PLUGIN_ROOT=/plugins',
      '-e',
      'PORT=3500',
      '-e',
      'PLUGIN_ARTIFACT_SHA256=' + digest,
      '-e',
      'PLUGIN_EVENT_TOKEN=' + eventToken,
      '-e',
      'PLUGIN_PROXY_TOKEN=' + proxyToken,
      '-e',
      'PLUGIN_CONFIG_JSON=' + JSON.stringify(config),
      '-e',
      'PLUGIN_TRUST_KEYS_FILE=/run/secrets/plugin-trust-keys',
      '--mount',
      'type=bind,src=' + source + ',dst=/plugins/current,readonly',
      '--mount',
      'type=bind,src=' + this.dockerTrustKeysFile + ',dst=/run/secrets/plugin-trust-keys,readonly',
      this.image,
    ])
  }
  async endpoint(name) {
    // Resolve through the daemon, not container DNS. Aborted getaddrinfo calls for
    // a crash-looping candidate can exhaust Node's DNS worker pool and make a
    // healthy previous instance appear unavailable immediately after rollback.
    // Re-inspect every request: do not reuse an IP after a container is replaced.
    const result = await this.docker([
      'inspect',
      '--format',
      '{"running":{{json .State.Running}},"networks":{{json .NetworkSettings.Networks}}}',
      name,
    ])
    let state
    try {
      state = JSON.parse(result.stdout)
    } catch {
      throw new Error('ERR_PLUGIN_HOST_UNAVAILABLE')
    }
    const networks = state?.networks
    const address = networks?.[this.network]?.IPAddress
    if (
      !state?.running ||
      !isObject(networks) ||
      Object.keys(networks).length !== 1 ||
      typeof address !== 'string' ||
      isIP(address) !== 4
    )
      throw new Error('ERR_PLUGIN_HOST_UNAVAILABLE')
    return 'http://' + address + ':3500'
  }
  async health(name) {
    const response = await fetch((await this.endpoint(name)) + '/healthz', {
      signal: AbortSignal.timeout(1500),
      redirect: 'error',
    })
    const data = await response.json()
    return { healthy: response.ok && data.status === 'ok', version: data.version }
  }
  async stop(name) {
    // docker rm -f also stops the process. Failure is not reported as a successful deactivation.
    try {
      await this.docker(['rm', '-f', name])
    } catch (error) {
      if (!/No such container/i.test(String(error.stderr || '')))
        throw new Error('ERR_PLUGIN_STOP_FAILED')
    }
  }
  async request(name, pathname, init) {
    return fetch((await this.endpoint(name)) + pathname, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    })
  }
}
export class PluginControl {
  constructor({ root, trustKeysFile, runtimeSecret, runtime, attempts = 20, interval = 250 }) {
    this.root = path.resolve(root)
    Object.assign(this, { trustKeysFile, runtimeSecret, runtime, attempts, interval })
    this.locks = new Map()
  }
  pluginPath(id) {
    if (!ID.test(id)) throw new Error('ERR_INVALID_PLUGIN_ID')
    return path.join(this.root, id)
  }
  releasePath(id, version, section = 'releases') {
    if (typeof version !== 'string' || !VERSION.test(version))
      throw new Error('ERR_INVALID_PLUGIN_VERSION')
    return path.join(this.pluginPath(id), section, version)
  }
  async exclusive(id, fn) {
    if (this.locks.has(id)) throw new Error('ERR_PLUGIN_OPERATION_IN_PROGRESS')
    this.locks.set(id, true)
    try {
      return await fn()
    } finally {
      this.locks.delete(id)
    }
  }
  token(id, generation, purpose) {
    return createHmac('sha256', this.runtimeSecret)
      .update(id + ':' + generation + ':' + purpose)
      .digest('hex')
  }
  async state(id) {
    try {
      return JSON.parse(await readFile(path.join(this.pluginPath(id), 'state.json'), 'utf8'))
    } catch (e) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }
  async verifyDirectory(directory) {
    const [archive, signature, trust] = await Promise.all([
      readFile(path.join(directory, 'release.tar.gz')),
      readFile(path.join(directory, 'manifest.sig')),
      readFile(this.trustKeysFile, 'utf8'),
    ])
    const verified = verifyArchive(archive, signature, JSON.parse(trust))
    // Do not trust entry-only hashes: imported modules and UI assets are signed by
    // the archive hash as well. Recheck all files before any candidate is started.
    const allowed = new Set([
      ...verified.files.keys(),
      'release.tar.gz',
      'manifest.sig',
      '.artifact-sha256',
      '.approved.json',
    ])
    const scan = async (dir, prefix = '') => {
      for (const item of await readdir(dir, { withFileTypes: true })) {
        const name = prefix + item.name
        const full = path.join(dir, item.name)
        const stat = await lstat(full)
        if (stat.isSymbolicLink() || (!stat.isDirectory() && (!stat.isFile() || stat.nlink > 1)))
          throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
        if (stat.isDirectory()) await scan(full, name + '/')
        else if (!allowed.has(name)) throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
      }
    }
    await scan(directory)
    for (const [name, content] of verified.files)
      if (sha256(await readFile(path.join(directory, name))) !== sha256(content))
        throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
    return verified
  }
  async stage(archive, signature) {
    const trust = JSON.parse(await readFile(this.trustKeysFile, 'utf8'))
    const verified = verifyArchive(archive, signature, trust)
    const { id, version } = verified.manifest
    return this.exclusive(id, async () => {
      const dest = this.releasePath(id, version, 'quarantine')
      const release = this.releasePath(id, version)
      for (const existing of [dest, release])
        if (await exists(existing)) {
          const old = await this.verifyDirectory(existing)
          if (old.artifactSha256 !== verified.artifactSha256)
            throw new Error('ERR_PLUGIN_RELEASE_EXISTS')
          return {
            pluginId: id,
            version,
            manifest: old.manifest,
            artifactSha256: old.artifactSha256,
          }
        }
      await mkdir(path.dirname(dest), { recursive: true, mode: 0o755 })
      const temp = await mkdtemp(path.join(path.dirname(dest), '.stage-'))
      try {
        await extractVerifiedFiles(verified, temp)
        await writeFile(path.join(temp, 'release.tar.gz'), archive, { mode: 0o644 })
        await writeFile(path.join(temp, 'manifest.sig'), signature, { mode: 0o644 })
        await writeFile(path.join(temp, '.artifact-sha256'), verified.artifactSha256, {
          mode: 0o644,
        })
        // mkdtemp is private until validation completes; node user needs traverse at runtime.
        const { chmod } = await import('node:fs/promises')
        await chmod(temp, 0o755)
        await rename(temp, dest)
      } finally {
        await rm(temp, { recursive: true, force: true })
      }
      return {
        pluginId: id,
        version,
        manifest: verified.manifest,
        artifactSha256: verified.artifactSha256,
      }
    })
  }
  async approve(id, version, artifactSha256) {
    return this.exclusive(id, async () => {
      const quarantine = this.releasePath(id, version, 'quarantine')
      const release = this.releasePath(id, version)
      const source = (await exists(release)) ? release : quarantine
      const verified = await this.verifyDirectory(source)
      if (
        verified.artifactSha256 !== artifactSha256 ||
        verified.manifest.id !== id ||
        verified.manifest.version !== version
      )
        throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
      await atomicJson(path.join(source, '.approved.json'), {
        artifactSha256,
        approvedAt: new Date().toISOString(),
      })
      if (source !== release) {
        await mkdir(path.dirname(release), { recursive: true })
        await rename(source, release)
      }
      return { pluginId: id, version, approved: true }
    })
  }
  async currentLink(id, version) {
    const current = path.join(this.pluginPath(id), 'current')
    const next = current + '.' + randomUUID()
    await symlink(
      process.platform === 'win32' ? this.releasePath(id, version) : path.join('releases', version),
      next,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    if (process.platform === 'win32') await rm(current, { force: true })
    try {
      await rename(next, current)
    } finally {
      await rm(next, { force: true })
    }
  }
  async activate(id, version, config = {}, artifactSha256) {
    return this.exclusive(id, async () => {
      const release = this.releasePath(id, version)
      const verified = await this.verifyDirectory(release)
      const approval = JSON.parse(
        await readFile(path.join(release, '.approved.json'), 'utf8').catch(() => {
          throw new Error('ERR_PLUGIN_RELEASE_NOT_APPROVED')
        }),
      )
      if (
        approval.artifactSha256 !== verified.artifactSha256 ||
        (artifactSha256 && artifactSha256 !== verified.artifactSha256) ||
        verified.manifest.id !== id ||
        verified.manifest.version !== version
      )
        throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
      if (!isObject(config) || Buffer.byteLength(JSON.stringify(config)) > 65536)
        throw new Error('ERR_INVALID_PLUGIN_CONFIG')
      const verificationPolicy = verified.manifest.capabilities.humanVerification
        ? appliedVerificationPolicy(config)
        : undefined
      const previous = await this.state(id)
      const generation = randomUUID()
      const name =
        'myndbbs-plugin-' +
        id.slice(0, 24) +
        '-' +
        sha256(id).slice(0, 8) +
        '-' +
        generation.slice(0, 8)
      try {
        await this.runtime.start({
          name,
          pluginId: id,
          version,
          release,
          digest: verified.artifactSha256,
          config,
          eventToken: this.token(id, generation, 'event'),
          proxyToken: this.token(id, generation, 'proxy'),
        })
        let ready = false
        for (let i = 0; i < this.attempts; i++) {
          try {
            const result = await this.runtime.health(name)
            if (result.healthy && result.version === version) {
              ready = true
              break
            }
          } catch {}
          await new Promise((resolve) => setTimeout(resolve, this.interval))
        }
        if (!ready) throw new Error('ERR_PLUGIN_START_FAILED')
        const state = {
          pluginId: id,
          version,
          container: name,
          generation,
          // Persist only the neutral policy actually supplied to this generation.
          // Saving an editable DB config must not change live authorization before reload.
          ...(verificationPolicy ? { verificationPolicy } : {}),
          state: 'ACTIVE',
          healthy: true,
        }
        // The atomic state pointer is the ONLY live routing source. The backend
        // never resolves docker DNS or imports current code itself.
        await this.currentLink(id, version)
        await atomicJson(path.join(this.pluginPath(id), 'state.json'), state)
      } catch (error) {
        await this.runtime.stop(name).catch(() => undefined)
        if (previous?.version) await this.currentLink(id, previous.version).catch(() => undefined)
        else
          await rm(path.join(this.pluginPath(id), 'current'), { force: true }).catch(
            () => undefined,
          )
        throw error
      }
      if (previous?.container) await this.runtime.stop(previous.container).catch(() => undefined)
      return { pluginId: id, version, state: 'ACTIVE', healthy: true }
    })
  }
  async reload(id, config = {}) {
    const state = await this.state(id)
    if (!state?.container || state.state !== 'ACTIVE') throw new Error('ERR_PLUGIN_NOT_ACTIVE')
    return this.activate(id, state.version, config)
  }
  async deactivate(id) {
    return this.exclusive(id, async () => {
      const state = await this.state(id)
      if (state?.container) await this.runtime.stop(state.container)
      const stopped = { pluginId: id, version: state?.version, state: 'DISABLED', healthy: false }
      await mkdir(this.pluginPath(id), { recursive: true })
      await atomicJson(path.join(this.pluginPath(id), 'state.json'), stopped)
      await rm(path.join(this.pluginPath(id), 'current'), { force: true })
      return stopped
    })
  }
  async remove(id) {
    return this.exclusive(id, async () => {
      const state = await this.state(id)
      if (state?.container || state?.state === 'ACTIVE')
        throw new Error('ERR_PLUGIN_MUST_BE_DISABLED')
      const target = this.pluginPath(id)
      if (!target.startsWith(this.root + path.sep)) throw new Error('ERR_INVALID_PLUGIN_ID')
      await rm(target, { recursive: true, force: true })
      return { pluginId: id, state: 'DELETED', healthy: false }
    })
  }
  async health(id) {
    const state = await this.state(id)
    if (!state?.container || state.state !== 'ACTIVE')
      return { pluginId: id, version: state?.version, state: 'DISABLED', healthy: false }
    try {
      const result = await this.runtime.health(state.container)
      return {
        pluginId: id,
        version: state.version,
        state: result.healthy ? 'ACTIVE' : 'UNHEALTHY',
        healthy: result.healthy,
        ...(!result.healthy ? { lastError: 'ERR_PLUGIN_HOST_UNHEALTHY' } : {}),
      }
    } catch {
      return {
        pluginId: id,
        version: state.version,
        state: 'UNHEALTHY',
        healthy: false,
        lastError: 'ERR_PLUGIN_HOST_UNAVAILABLE',
      }
    }
  }
  async activeManifest(id) {
    const state = await this.state(id)
    if (!state?.container || state.state !== 'ACTIVE') throw new Error('ERR_PLUGIN_NOT_ACTIVE')
    const manifest = JSON.parse(
      await readFile(path.join(this.releasePath(id, state.version), 'manifest.json'), 'utf8'),
    )
    return { state, manifest }
  }
  async events(id, event) {
    const { state, manifest } = await this.activeManifest(id)
    if (
      !manifest.capabilities.events.some(
        (e) => e.name === event?.eventName && e.version === event?.schemaVersion,
      )
    )
      throw new Error('ERR_PLUGIN_EVENT_NOT_DECLARED')
    const response = await this.runtime.request(state.container, '/__events', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-plugin-event-token': this.token(id, state.generation, 'event'),
      },
      body: JSON.stringify(event),
    })
    if (!response.ok) throw new Error('ERR_PLUGIN_EVENT_DELIVERY_FAILED')
  }
  async verificationSnapshot(id) {
    const { state, manifest } = await this.activeManifest(id)
    if (
      manifest.id !== id ||
      manifest.version !== state.version ||
      manifest.capabilities.humanVerification?.apiVersion !== 1
    )
      throw new Error('ERR_PLUGIN_VERIFICATION_NOT_DECLARED')
    const release = this.releasePath(id, state.version)
    const approval = JSON.parse(await readFile(path.join(release, '.approved.json'), 'utf8'))
    const artifactSha256 = (await readFile(path.join(release, '.artifact-sha256'), 'utf8')).trim()
    if (
      !/^[a-f0-9]{64}$/.test(artifactSha256) ||
      approval.artifactSha256 !== artifactSha256 ||
      !approval.approvedAt
    )
      throw new Error('ERR_PLUGIN_RELEASE_NOT_APPROVED')
    if (!(await this.runtime.health(state.container)).healthy)
      throw new Error('ERR_PLUGIN_HOST_UNHEALTHY')
    if (!isObject(state.verificationPolicy))
      throw new Error('ERR_PLUGIN_VERIFICATION_POLICY_MISSING')
    const snapshot = {
      providerId: id,
      version: state.version,
      generation: state.generation,
      artifactSha256,
      manifest,
      policy: state.verificationPolicy,
      healthy: true,
    }
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 32 * 1024)
      throw new Error('ERR_PLUGIN_RESPONSE_TOO_LARGE')
    return { state, snapshot }
  }
  async humanVerificationInfo(id) {
    return this.exclusive(id, async () => (await this.verificationSnapshot(id)).snapshot)
  }
  async humanVerification(id, input) {
    if (
      !isObject(input) ||
      Object.keys(input).some(
        (k) => !['operation', 'purpose', 'input', 'expectedGeneration'].includes(k),
      ) ||
      !['issue', 'verify', 'ui'].includes(input.operation) ||
      !isObject(input.input) ||
      Buffer.byteLength(JSON.stringify(input)) > 32 * 1024 ||
      typeof input.expectedGeneration !== 'string'
    )
      throw new Error('ERR_INVALID_PLUGIN_VERIFICATION_REQUEST')
    if (
      input.operation !== 'ui' &&
      !['registration', 'post', 'comment', 'friendRequest', 'rateLimitUnlock'].includes(
        input.purpose,
      )
    )
      throw new Error('ERR_INVALID_PLUGIN_VERIFICATION_REQUEST')
    return this.exclusive(id, async () => {
      const { state, snapshot } = await this.verificationSnapshot(id)
      if (state.generation !== input.expectedGeneration)
        throw new Error('ERR_PLUGIN_GENERATION_MISMATCH')
      const response = await this.runtime.request(state.container, '/__human-verification', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-plugin-proxy-token': this.token(id, state.generation, 'proxy'),
        },
        body: JSON.stringify({
          operation: input.operation,
          ...(input.operation !== 'ui' ? { purpose: input.purpose } : {}),
          input: input.input,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok || !response.body) throw new Error('ERR_PLUGIN_VERIFICATION_FAILED')
      const limit = input.operation === 'ui' ? 512 * 1024 + 4096 : 32 * 1024
      const chunks = []
      let size = 0
      for await (const chunk of response.body) {
        size += chunk.length
        if (size > limit) throw new Error('ERR_PLUGIN_RESPONSE_TOO_LARGE')
        chunks.push(Buffer.from(chunk))
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (
        !isObject(result) ||
        (input.operation === 'ui' &&
          (typeof result.html !== 'string' || Buffer.byteLength(result.html) > 256 * 1024))
      )
        throw new Error('ERR_INVALID_PLUGIN_VERIFICATION_RESPONSE')
      return { snapshot, result }
    })
  }
  async proxy(id, input) {
    const { state, manifest } = await this.activeManifest(id)
    if (!safeRequestPath(input.path) || !isObject(input.user) || typeof input.user.id !== 'string')
      throw new Error('ERR_INVALID_PLUGIN_PATH')
    const pathname = input.path.split('?')[0]
    const ui =
      pathname.startsWith('/__ui/') &&
      ['GET', 'HEAD'].includes(input.method) &&
      manifest.capabilities.ui.some((u) => u.path === pathname.slice(6))
    const route = manifest.capabilities.routes.find(
      (r) => r.methods.includes(input.method) && routeMatches(r.path, pathname),
    )
    if (
      (pathname.startsWith('/__') && !ui) ||
      (ui
        ? !authAllowed(input.user.role, 'admin')
        : !route || !authAllowed(input.user.role, route.auth))
    )
      throw new Error('ERR_PLUGIN_ROUTE_NOT_DECLARED')
    const headers = {
      'x-plugin-proxy-token': this.token(id, state.generation, 'proxy'),
      'x-mynd-user-id': input.user.id,
      'x-mynd-role': input.user.role,
      'x-mynd-authenticated': 'true',
      'x-mynd-auth-context-version': '2',
      'content-type': 'application/json',
    }
    const init = { method: input.method, headers }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(input.method) && input.body !== undefined)
      init.body = JSON.stringify(input.body)
    if (init.body && Buffer.byteLength(init.body) > 1024 * 1024)
      throw new Error('ERR_PLUGIN_REQUEST_TOO_LARGE')
    const result = await this.runtime.request(state.container, input.path, init)
    let bytes = 0
    const parts = []
    for await (const part of result.body || []) {
      bytes += part.length
      if (bytes > 1024 * 1024) throw new Error('ERR_PLUGIN_RESPONSE_TOO_LARGE')
      parts.push(part)
    }
    return {
      status: result.status,
      contentType: ui ? 'text/html; charset=utf-8' : 'application/json',
      bodyBase64: Buffer.concat(parts).toString('base64'),
      ...(ui ? { csp: UI_CSP } : {}),
    }
  }
}
export function createControlServer(control, token) {
  if (typeof token !== 'string' || token.length < 32)
    throw new Error('ERR_PLUGIN_CONTROL_TOKEN_MISSING')
  return http.createServer(async (req, res) => {
    if (!tokenMatches(req.headers['x-plugin-control-token'], token)) {
      json(res, 404, { error: 'ERR_NOT_FOUND' })
      return
    }
    try {
      const parts = (req.url || '').split('/')
      if (req.method === 'POST' && req.url === '/v1/plugins/stage') {
        const data = await body(req)
        if (
          typeof data.archiveBase64 !== 'string' ||
          typeof data.signatureBase64 !== 'string' ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(data.signatureBase64)
        )
          throw new Error('ERR_INVALID_PLUGIN_ARTIFACT')
        json(
          res,
          201,
          await control.stage(
            Buffer.from(data.archiveBase64, 'base64'),
            Buffer.from(data.signatureBase64, 'base64'),
          ),
        )
        return
      }
      if (parts.length !== 5 || parts[1] !== 'v1' || parts[2] !== 'plugins' || !ID.test(parts[3])) {
        json(res, 404, { error: 'ERR_NOT_FOUND' })
        return
      }
      const id = parts[3]
      const action = parts[4]
      if (req.method === 'GET' && action === 'human-verification') {
        json(res, 200, await control.humanVerificationInfo(id))
        return
      }
      if (req.method === 'GET' && action === 'health') {
        json(res, 200, await control.health(id))
        return
      }
      if (req.method === 'GET' && action === 'manifest') {
        json(res, 200, (await control.activeManifest(id)).manifest)
        return
      }
      if (req.method !== 'POST') {
        json(res, 404, { error: 'ERR_NOT_FOUND' })
        return
      }
      const data = await body(req, action === 'human-verification' ? 32 * 1024 : LIMIT)
      let result
      if (action === 'approve')
        result = await control.approve(id, data.version, data.artifactSha256)
      else if (action === 'activate' || action === 'rollback')
        result = await control.activate(id, data.version, data.config, data.artifactSha256)
      else if (action === 'deactivate') result = await control.deactivate(id)
      else if (action === 'reload') result = await control.reload(id, data.config)
      else if (action === 'remove') result = await control.remove(id)
      else if (action === 'events') {
        await control.events(id, data)
        result = { status: 'ok' }
      } else if (action === 'human-verification') result = await control.humanVerification(id, data)
      else if (action === 'proxy') result = await control.proxy(id, data)
      else {
        json(res, 404, { error: 'ERR_NOT_FOUND' })
        return
      }
      json(res, 200, result)
    } catch (error) {
      const code = errorCode(error)
      json(
        res,
        code.includes('TOO_LARGE')
          ? 413
          : code.includes('NOT_ACTIVE')
            ? 404
            : code.includes('IN_PROGRESS')
              ? 409
              : 400,
        { error: code },
      )
    }
  })
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.resolve(process.env.PLUGIN_ROOT || '/opt/myndbbs/plugins')
  const trustKeysFile = process.env.PLUGIN_TRUST_KEYS_FILE || ''
  const runtimeSecret = process.env.PLUGIN_RUNTIME_SECRET || ''
  if (runtimeSecret.length < 32) throw new Error('ERR_PLUGIN_RUNTIME_SECRET_MISSING')
  const runtime = new DockerPluginRuntime({
    root,
    dockerRoot: process.env.PLUGIN_DOCKER_ROOT || root,
    trustKeysFile,
    dockerTrustKeysFile: process.env.PLUGIN_DOCKER_TRUST_KEYS_FILE || trustKeysFile,
    network: process.env.PLUGIN_NETWORK || 'myndbbs_plugins',
    image: process.env.PLUGIN_RUNTIME_IMAGE || 'ghcr.io/kelomina/myndbbs-plugin-runtime:latest',
  })
  const control = new PluginControl({ root, trustKeysFile, runtimeSecret, runtime })
  await mkdir(root, { recursive: true })
  const server = createControlServer(control, process.env.PLUGIN_CONTROL_TOKEN)
  server.listen(Number(process.env.PORT || 3600), '0.0.0.0')
  // Supervisor upgrades never stop healthy runtime containers. Their durable state
  // pointer and Docker restart policy survive this process/container restarting.
  process.on('SIGTERM', () => server.close(() => process.exit(0)))
}
