import { fork } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

export class FrontendSupervisor {
  #active = null
  async switchTo(releaseDir, port, probe = async () => {}) {
    const manifest = JSON.parse(await readFile(path.join(releaseDir, 'manifest.json'), 'utf8'))
    if (!manifest || typeof manifest.server !== 'string' || !manifest.server || manifest.server.includes('\\') || manifest.server.includes(':') || manifest.server.split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('ERR_FRONTEND_MANIFEST_INVALID')
    }
    const server = path.resolve(releaseDir, manifest.server)
    if (!server.startsWith(`${path.resolve(releaseDir)}${path.sep}`)) throw new Error('ERR_FRONTEND_PATH_TRAVERSAL')
    await access(server)
    const child = fork(server, [], { env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    try {
      await this.#waitReady(child, port, probe)
    } catch (error) {
      child.kill('SIGKILL')
      throw error
    }
    const previous = this.#active
    this.#active = { releaseDir, child, port }
    if (previous) await this.#stop(previous.child)
    return { releaseDir, pid: child.pid, port }
  }
  async #waitReady(child, port, probe) {
    const started = Date.now()
    while (Date.now() - started < 10000) {
      try { await probe(port); return } catch {}
      if (child.exitCode !== null) throw new Error('ERR_FRONTEND_START_FAILED')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('ERR_FRONTEND_START_TIMEOUT')
  }
  async #stop(child) {
    if (child.exitCode !== null) return
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
  }
  async stop() { if (this.#active) await this.#stop(this.#active.child); this.#active = null }
}
