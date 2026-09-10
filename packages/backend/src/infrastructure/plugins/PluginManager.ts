import { readFile } from 'fs/promises'
import path from 'path'
import type { BackendPlugin, BackendPluginContext, BackendPluginManifest } from './PluginContracts'
import { sha256File, validatePluginManifest } from './PluginManifest'

/** Runtime manager for signed, allow-listed plugins. Core services never load arbitrary paths. */
export class PluginManager {
  private readonly active = new Map<string, { manifest: BackendPluginManifest; plugin: BackendPlugin }>()
  private readonly healthChecks = new Map<string, () => Promise<void>>()

  public constructor(private readonly root: string, private readonly allowList: ReadonlySet<string>) {}

  public async activate(manifestPath: string): Promise<void> {
    const rootPath = path.resolve(this.root)
    const resolvedManifest = path.resolve(manifestPath)
    if (!resolvedManifest.startsWith(rootPath + path.sep)) throw new Error('ERR_PLUGIN_PATH_TRAVERSAL')
    const manifest = JSON.parse(await readFile(resolvedManifest, 'utf8')) as BackendPluginManifest
    validatePluginManifest(manifest)
    if (!this.allowList.has(manifest.id)) throw new Error('ERR_PLUGIN_NOT_ALLOWLISTED')
    const pluginDir = path.dirname(resolvedManifest)
    const entryPath = path.resolve(pluginDir, manifest.entry)
    if (!entryPath.startsWith(path.resolve(pluginDir) + path.sep)) throw new Error('ERR_PLUGIN_PATH_TRAVERSAL')
    if (await sha256File(entryPath) !== manifest.sha256) throw new Error('ERR_PLUGIN_INTEGRITY_FAILED')
    const loaded = (await import(entryPath)) as { default?: BackendPlugin }
    if (!loaded.default?.activate) throw new Error('ERR_PLUGIN_ENTRY_INVALID')
    const context: BackendPluginContext = {
      pluginId: manifest.id,
      registerHealthCheck: (check) => this.healthChecks.set(manifest.id, check),
    }
    await loaded.default.activate(context)
    this.active.set(manifest.id, { manifest, plugin: loaded.default })
  }

  public async healthCheck(): Promise<void> {
    for (const check of this.healthChecks.values()) await check()
  }

  public async deactivate(id: string): Promise<void> {
    const entry = this.active.get(id)
    if (!entry) return
    await entry.plugin.deactivate?.()
    this.active.delete(id)
    this.healthChecks.delete(id)
  }
}
