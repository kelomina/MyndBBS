export interface BackendPluginManifest {
  id: string
  version: string
  apiVersion: 1
  entry: string
  sha256: string
}

export interface BackendPluginContext {
  readonly pluginId: string
  registerHealthCheck(check: () => Promise<void>): void
}

export interface BackendPlugin {
  activate(context: BackendPluginContext): Promise<void> | void
  deactivate?(): Promise<void> | void
}
