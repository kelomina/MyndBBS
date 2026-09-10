import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import type { BackendPluginManifest } from './PluginContracts'

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/
const VERSION = /^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/

export function validatePluginManifest(value: unknown): asserts value is BackendPluginManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  const manifest = value as Record<string, unknown>
  if (typeof manifest.id !== 'string' || typeof manifest.version !== 'string' || !ID.test(manifest.id) || !VERSION.test(manifest.version) || manifest.apiVersion !== 1 || typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  }
  if (typeof manifest.entry !== 'string' || !manifest.entry || path.posix.isAbsolute(manifest.entry) || path.win32.isAbsolute(manifest.entry) || manifest.entry.includes('\\') || manifest.entry.includes(':') || manifest.entry.split('/').some(part => !part || part === '..' || part === '.') || manifest.entry.includes('\0')) {
    throw new Error('ERR_INVALID_PLUGIN_ENTRY')
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const digest = createHash('sha256').update(await readFile(filePath)).digest('hex')
  return digest
}
