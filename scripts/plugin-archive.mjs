import { gunzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { safeRelative, sha256, validateManifest, verifySignature } from './plugin-v2.mjs'

export const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
export const MAX_EXTRACTED_BYTES = 64 * 1024 * 1024
export const MAX_ENTRIES = 4096
const RESERVED = new Set(['manifest.sig', '.artifact-sha256', '.approved.json', 'release.tar.gz'])
const text = (buf) => new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/\0.*$/s, '')
function octal(buf) {
  if (buf[0] & 128) throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
  const value = text(buf).trim()
  if (!/^[0-7]*$/.test(value)) throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
  const result = parseInt(value || '0', 8)
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
  return result
}
// Parse a deliberately restricted USTAR archive ourselves. No external tar process,
// PAX path override, GNU longlink, filesystem link, or device can reach extraction.
export function inspectArchive(archive) {
  if (!Buffer.isBuffer(archive) || !archive.length || archive.length > MAX_ARCHIVE_BYTES)
    throw new Error('ERR_PLUGIN_ARTIFACT_TOO_LARGE')
  let tar
  try {
    tar = gunzipSync(archive, { maxOutputLength: MAX_EXTRACTED_BYTES + MAX_ENTRIES * 1024 + 1024 })
  } catch {
    throw new Error('ERR_PLUGIN_ARCHIVE_INVALID_OR_TOO_LARGE')
  }
  const files = new Map()
  const names = new Set()
  let offset = 0,
    bytes = 0,
    count = 0,
    ended = false
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((v) => v === 0)) {
      if (tar.length - offset < 1024 || tar.subarray(offset).some((v) => v !== 0))
        throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
      ended = true
      break
    }
    let checksum = 0
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i]
    if (checksum !== octal(header.subarray(148, 156)))
      throw new Error('ERR_PLUGIN_ARCHIVE_CHECKSUM')
    const magic = text(header.subarray(257, 263)).trim()
    if (magic && magic !== 'ustar') throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
    const type = header[156]
    if (![0, 48, 53].includes(type)) throw new Error('ERR_PLUGIN_ARCHIVE_SPECIAL_FILE')
    if (text(header.subarray(157, 257))) throw new Error('ERR_PLUGIN_ARCHIVE_SPECIAL_FILE')
    const size = octal(header.subarray(124, 136))
    const prefix = text(header.subarray(345, 500))
    const base = text(header.subarray(0, 100))
    let name = (prefix ? prefix + '/' : '') + base
    name = name.replace(/^\.\//, '').replace(/\/$/, '')
    offset += 512
    if (++count > MAX_ENTRIES || bytes + size > MAX_EXTRACTED_BYTES)
      throw new Error('ERR_PLUGIN_ARCHIVE_UNPACKED_TOO_LARGE')
    if (offset + Math.ceil(size / 512) * 512 > tar.length)
      throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
    if (type === 53 && (!name || name === '.') && size === 0) continue
    if (!safeRelative(name) || RESERVED.has(name))
      throw new Error('ERR_PLUGIN_ARCHIVE_PATH_TRAVERSAL')
    if (names.has(name.toLowerCase())) throw new Error('ERR_PLUGIN_ARCHIVE_DUPLICATE_PATH')
    names.add(name.toLowerCase())
    if (type === 53) {
      if (size !== 0) throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
    } else {
      files.set(name, Buffer.from(tar.subarray(offset, offset + size)))
      bytes += size
    }
    offset += Math.ceil(size / 512) * 512
  }
  if (!ended || !files.size) throw new Error('ERR_PLUGIN_ARCHIVE_INVALID')
  for (const name of files.keys()) {
    const parts = name.split('/')
    for (let i = 1; i < parts.length; i++)
      if (files.has(parts.slice(0, i).join('/')))
        throw new Error('ERR_PLUGIN_ARCHIVE_DUPLICATE_PATH')
  }
  const raw = files.get('manifest.json')
  if (!raw || raw.length > 65536) throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  let manifest
  try {
    manifest = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  }
  validateManifest(manifest)
  if (!files.has(manifest.entry) || sha256(files.get(manifest.entry)) !== manifest.entrySha256)
    throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
  for (const mount of manifest.capabilities.ui)
    if (!files.has(mount.path) || files.get(mount.path).length > 256 * 1024)
      throw new Error('ERR_INVALID_PLUGIN_UI_CAPABILITY')
  return { manifest, files, artifactSha256: sha256(archive) }
}
export function verifyArchive(archive, signature, trustKeys) {
  const result = inspectArchive(archive)
  const key = trustKeys?.keys?.[result.manifest.signatureKeyId]
  if (typeof key !== 'string') throw new Error('ERR_PLUGIN_SIGNATURE_KEY_NOT_TRUSTED')
  if (!verifySignature(signature, key, result.artifactSha256, result.manifest))
    throw new Error('ERR_PLUGIN_SIGNATURE_INVALID')
  return result
}
export async function extractVerifiedFiles(result, destination) {
  await mkdir(destination, { recursive: true, mode: 0o755 })
  for (const [name, content] of result.files) {
    const target = path.resolve(destination, name)
    if (!target.startsWith(path.resolve(destination) + path.sep))
      throw new Error('ERR_PLUGIN_ARCHIVE_PATH_TRAVERSAL')
    await mkdir(path.dirname(target), { recursive: true, mode: 0o755 })
    await writeFile(target, content, { flag: 'wx', mode: 0o644 })
  }
}
