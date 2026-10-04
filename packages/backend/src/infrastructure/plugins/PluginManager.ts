import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import type { BackendPluginManifest } from './PluginContracts'
import { sha256File, validatePluginManifest } from './PluginManifest'

/**
 * Read-only manifest inspector kept for tooling compatibility.
 * Production plugins are never imported in the backend process; the external
 * plugin-control supervisor owns activation and lifecycle management.
 */
export class PluginManager {
  public constructor(private readonly root: string, private readonly allowList: ReadonlySet<string>) {}

  public async inspect(manifestPath: string): Promise<{ manifest: BackendPluginManifest; entryPath: string }> {
    const rootPath = await realpath(this.root)
    const resolvedManifest = await realpath(manifestPath)
    if (!resolvedManifest.startsWith(rootPath + path.sep)) throw new Error('ERR_PLUGIN_PATH_TRAVERSAL')
    const manifest = JSON.parse(await readFile(resolvedManifest, 'utf8')) as unknown
    validatePluginManifest(manifest)
    if (!this.allowList.has(manifest.id)) throw new Error('ERR_PLUGIN_NOT_ALLOWLISTED')
    const pluginDir = path.dirname(resolvedManifest)
    const entryPath = await realpath(path.resolve(pluginDir, manifest.entry))
    if (!entryPath.startsWith(pluginDir + path.sep)) throw new Error('ERR_PLUGIN_PATH_TRAVERSAL')
    if (await sha256File(entryPath) !== manifest.entrySha256) throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
    return { manifest, entryPath }
  }

  public async activate(_manifestPath: string): Promise<void> {
    throw new Error('ERR_PLUGIN_IN_PROCESS_DISABLED')
  }

  public async healthCheck(): Promise<void> {
    throw new Error('ERR_PLUGIN_EXTERNAL_RUNTIME_REQUIRED')
  }

  public async deactivate(_id: string): Promise<void> {
    throw new Error('ERR_PLUGIN_EXTERNAL_RUNTIME_REQUIRED')
  }
}