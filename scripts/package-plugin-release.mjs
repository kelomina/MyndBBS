#!/usr/bin/env node
// Offline only: never uploads, approves, activates, or talks to Docker.
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { verifyArchive } from './plugin-archive.mjs'
import { canonicalize, safeRelative, signingPayload, validateManifest, verifySignature } from './plugin-v2.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const MAX_BYTES = 64 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 4096
const forbidden = name => name.split('/').some(part =>
  ['manifest.sig', '.artifact-sha256', '.approved.json', 'release.tar.gz'].includes(part) ||
  /^\.env(?:\.|$)/i.test(part) || ['.git', '.ssh', 'node_modules'].includes(part) || /\.(?:pem|key|p12|pfx)$/i.test(part))
const inside = (root, target) => target === root || target.startsWith(root + path.sep)

// Minimal deterministic USTAR: regular files only, UTF-8 paths <=100 bytes,
// uid/gid/mtime=0, fixed 0644 mode, sorted paths; no PAX/GNU extensions.
function tarFile(name, data) {
  const header = Buffer.alloc(512)
  if (!safeRelative(name) || Buffer.byteLength(name) > 100) throw new Error('ERR_PACKAGE_PATH')
  header.write(name, 0, 100, 'utf8')
  const octal = (value, offset, length) => header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii')
  octal(0o644, 100, 8)
  octal(0, 108, 8)
  octal(0, 116, 8)
  octal(data.length, 124, 12)
  octal(0, 136, 12)
  header.fill(32, 148, 156)
  header[156] = 48
  header.write('ustar\0', 257, 6, 'ascii')
  header.write('00', 263, 2, 'ascii')
  const sum = header.reduce((total, byte) => total + byte, 0)
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)])
}

export async function packageRelease({ source, out, keyFile, keyPem, keyId, id, version }) {
  if (!source || !out || !keyId || (keyFile && keyPem)) throw new Error('ERR_PACKAGE_ARGUMENTS')
  const sourcePath = path.resolve(source)
  const sourceStat = await lstat(sourcePath)
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) throw new Error('ERR_PACKAGE_SOURCE')
  const root = await realpath(sourcePath)
  const output = path.resolve(out)
  if (inside(root, output)) throw new Error('ERR_PACKAGE_OUTPUT_IN_SOURCE')
  if (keyFile && inside(root, await realpath(keyFile))) throw new Error('ERR_PACKAGE_KEY_IN_SOURCE')
  const pem = keyFile ? await readFile(keyFile, 'utf8') : keyPem
  if (!pem) throw new Error('ERR_PACKAGE_SIGNING_KEY_REQUIRED')
  let privateKey
  try { privateKey = createPrivateKey(pem) } catch { throw new Error('ERR_PACKAGE_SIGNING_KEY_INVALID') }
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('ERR_PACKAGE_ED25519_REQUIRED')
  const files = new Map()
  const seen = new Set()
  let bytes = 0
  let entries = 0
  async function walk(dir, prefix = '') {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + item.name
      if (++entries > MAX_FILES || !safeRelative(name) || Buffer.byteLength(name) > 100 || forbidden(name)) throw new Error('ERR_PACKAGE_UNSAFE_MEMBER')
      // Case-insensitive collision prevention keeps Windows/Linux interpretation aligned.
      if (seen.has(name.toLowerCase())) throw new Error('ERR_PACKAGE_DUPLICATE_MEMBER')
      seen.add(name.toLowerCase())
      const full = path.join(dir, item.name)
      const stat = await lstat(full)
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error('ERR_PACKAGE_SPECIAL_MEMBER')
      if (stat.isDirectory()) { await walk(full, name + '/'); continue }
      if (stat.nlink !== 1 || bytes + stat.size > MAX_BYTES) throw new Error('ERR_PACKAGE_MEMBER_LIMIT')
      const content = await readFile(full)
      bytes += content.length
      if (bytes > MAX_BYTES) throw new Error('ERR_PACKAGE_MEMBER_LIMIT')
      files.set(name, content)
    }
  }
  await walk(root)
  if (!files.has('manifest.json')) throw new Error('ERR_PACKAGE_MANIFEST_MISSING')
  let manifest
  try { manifest = JSON.parse(files.get('manifest.json').toString('utf8')) } catch { throw new Error('ERR_PACKAGE_MANIFEST_JSON') }
  validateManifest(manifest)
  if (manifest.signatureKeyId !== keyId || (id && id !== manifest.id) || (version && version !== manifest.version)) throw new Error('ERR_PACKAGE_IDENTITY_MISMATCH')
  if (!files.has(manifest.entry) || hash(files.get(manifest.entry)) !== manifest.entrySha256) throw new Error('ERR_PACKAGE_ENTRY_HASH')
  for (const ui of manifest.capabilities.ui) if (!files.has(ui.path)) throw new Error('ERR_PACKAGE_UI_MISSING')
  files.set('manifest.json', Buffer.from(canonicalize(manifest) + '\n'))
  const tar = Buffer.concat([...files.keys()].sort().map(name => tarFile(name, files.get(name))).concat(Buffer.alloc(1024)))
  if (tar.length > MAX_BYTES) throw new Error('ERR_PACKAGE_MEMBER_LIMIT')
  const archive = gzipSync(tar, { level: 9 })
  // Normalize OS metadata so identical inputs on Windows/Linux yield identical gzip bytes.
  archive[9] = 255
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error('ERR_PACKAGE_ARCHIVE_LIMIT')
  const digest = hash(archive)
  const signature = sign(null, signingPayload(digest, manifest), privateKey)
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
  if (!verifySignature(signature, publicKey, digest, manifest)) throw new Error('ERR_PACKAGE_SELF_VERIFY')
  verifyArchive(archive, signature, { keys: { [keyId]: publicKey } })
  await mkdir(output, { recursive: true })
  if (inside(root, await realpath(output))) throw new Error('ERR_PACKAGE_OUTPUT_IN_SOURCE')
  const filename = `${manifest.id}-${manifest.version}.tar.gz`
  // Fail before writing anything when a prior immutable release already exists.
  for (const suffix of ['', '.sig', '.sha256']) {
    try { await lstat(path.join(output, filename + suffix)); throw new Error('ERR_PACKAGE_OUTPUT_EXISTS') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  await writeFile(path.join(output, filename), archive, { flag: 'wx', mode: 0o644 })
  await writeFile(path.join(output, filename + '.sig'), signature, { flag: 'wx', mode: 0o644 })
  await writeFile(path.join(output, filename + '.sha256'), `${digest}  ${filename}\n`, { flag: 'wx', mode: 0o644 })
  return { filename, out: output, sha256: digest, signatureBytes: signature.length, signatureKeyId: keyId, files: files.size }
}

async function main(args) {
  const options = {}
  const names = { '--source': 'source', '--out': 'out', '--key-file': 'keyFile', '--key-id': 'keyId', '--id': 'id', '--version': 'version' }
  if (args.length === 1 && args[0] === '--help') {
    console.log('node scripts/package-plugin-release.mjs --source DIR --out DIR --key-id TRUST_KEY_ID [--key-file PRIVATE_PEM] [--id ID] [--version VERSION]')
    console.log('Without --key-file, read PLUGIN_SIGNING_KEY from the environment. Never pass key contents on argv. No installation or activation.')
    return
  }
  for (let i = 0; i < args.length; i += 2) {
    const name = names[args[i]]
    if (!name || Object.hasOwn(options, name) || args[i + 1] === undefined) throw new Error('ERR_PACKAGE_ARGUMENTS')
    options[name] = args[i + 1]
  }
  if (!options.keyFile) options.keyPem = process.env.PLUGIN_SIGNING_KEY
  console.log(JSON.stringify(await packageRelease(options)))
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    // Crypto/FS errors may contain sensitive paths or input. Emit only known codes.
    console.error(/^ERR_[A-Z0-9_]+$/.test(error.message) ? error.message : 'ERR_PLUGIN_PACKAGE_FAILED')
    process.exitCode = 1
  })
}
