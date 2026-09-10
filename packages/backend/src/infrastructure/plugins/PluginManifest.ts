import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import type { BackendPluginManifest } from './PluginContracts'

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/
const VERSION = /^\d+\.\d+\.\d+([+-][0-9A-Za-z.-]+)?$/

export function validatePluginManifest(manifest: BackendPluginManifest): void {
  if (!ID.test(manifest.id) || !VERSION.test(manifest.version) || manifest.apiVersion !== 1) {
    throw new Error('ERR_INVALID_PLUGIN_MANIFEST')
  }
  if (!path.posix.isAbsolute(manifest.entry) && manifest.entry.includes('..')) {
    throw new Error('ERR_INVALID_PLUGIN_ENTRY')
  }
}

export async function sha256File(filePath: string): Promise<string> {
  const digest = createHash('sha256').update(await readFile(filePath)).digest('hex')
  return digest
}
