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
  handle?(request: BackendPluginRequest): Promise<BackendPluginResponse> | BackendPluginResponse
}

export interface BackendPluginRequest {
  method: string
  path: string
  headers: Readonly<Record<string, string | string[] | undefined>>
  body: unknown
}

export interface BackendPluginResponse {
  status?: number
  headers?: Readonly<Record<string, string>>
  body?: unknown
}
