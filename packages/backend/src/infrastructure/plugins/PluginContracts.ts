export type PluginAuthLevel = 'authenticated' | 'admin' | 'super_admin'

export type PluginRouteCapability = {
  path: string
  methods: readonly string[]
  auth?: PluginAuthLevel
}

export type PluginEventCapability = {
  name: string
  version: number
}

export type PluginUiMount = {
  slot: 'admin.sidebar' | 'admin.dashboard' | 'admin.detail'
  path: string
}

export type PluginConfigCapability = {
  schema: Record<string, unknown>
  secretPaths: readonly string[]
}

export type BackendPluginManifest = {
  id: string
  displayName?: string
  description?: string
  version: string
  apiVersion: 2
  entry: string
  entrySha256: string
  signatureKeyId: string
  capabilities: {
    routes: readonly PluginRouteCapability[]
    events: readonly PluginEventCapability[]
    ui: readonly PluginUiMount[]
    config?: PluginConfigCapability
    humanVerification?: { apiVersion: 1; ui: string }
  }
}

export type PluginEventEnvelope = {
  eventId: string
  eventName: string
  schemaVersion: number
  occurredAt: string
  idempotencyKey: string
  payload: Record<string, unknown>
}

export type BackendPluginContext = {
  readonly pluginId: string
  readonly config: Readonly<Record<string, unknown>>
  getConfig(): Record<string, unknown>
  registerHealthCheck(check: () => Promise<void>): void
}

export type BackendPluginRequest = {
  method: string
  path: string
  headers: Readonly<Record<string, string | string[] | undefined>>
  body: unknown
}

export type BackendPluginResponse = {
  status?: number
  headers?: Readonly<Record<string, string>>
  body?: unknown
}

export type BackendPlugin = {
  activate(context: BackendPluginContext): Promise<void> | void
  deactivate?(): Promise<void> | void
  handle?(request: BackendPluginRequest): Promise<BackendPluginResponse> | BackendPluginResponse
  handleEvent?(event: PluginEventEnvelope): Promise<void> | void
  handleHumanVerification?(request: { operation: 'issue' | 'verify'; purpose: string; input: Record<string, unknown> }): Promise<Record<string, unknown>> | Record<string, unknown>
}

export type PluginRuntimeState =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'STARTING'
  | 'ACTIVE'
  | 'DISABLED'
  | 'UNHEALTHY'
  | 'FAILED'
  | 'ROLLED_BACK'

export type PluginReleaseState = 'QUARANTINED' | 'APPROVED' | 'ACTIVE' | 'RETIRED' | 'REJECTED'

export type PluginEventDeliveryState =
  | 'PENDING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'FAILED'
  | 'DEAD_LETTER'
