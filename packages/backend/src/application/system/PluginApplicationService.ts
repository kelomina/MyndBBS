import { type PrismaClient, type Prisma as PrismaTypes } from '../../generated/prisma/client'
import { prisma } from '../../db'
import type {
  BackendPluginManifest,
  PluginRuntimeState,
} from '../../infrastructure/plugins/PluginContracts'
import {
  pluginControlClient,
  type PluginControlPort,
  type StagePluginArtifactInput,
} from '../../infrastructure/plugins/PluginControlPort'
import {
  preparePluginConfigUpdate,
  publicPluginConfig,
  resolvedPluginConfig,
  validatePluginConfig,
  validatePluginConfigSchema,
  configForManifest,
} from '../../infrastructure/plugins/PluginConfig'
import { validatePluginManifest } from '../../infrastructure/plugins/PluginManifest'

export type PluginAdminDto = {
  id: string
  pluginId: string
  displayName: string | null
  description: string | null
  desiredState: string
  runtimeState: string
  currentVersion: string | null
  lastError: string | null
  healthy: boolean | null
  lastHealthAt: Date | null
  releases: Array<{
    id: string
    version: string
    apiVersion: number
    artifactSha256: string
    signatureKeyId: string
    state: string
    uploadedBy: string | null
    approvedBy: string | null
    uploadedAt: Date
    approvedAt: Date | null
    activatedAt: Date | null
  }>
  config: Record<string, unknown> | null
  configSchema: Record<string, unknown> | null
  secretPaths: readonly string[]
  uiMounts: Array<{ slot: string; path: string }>
  routeCapabilities: Array<{
    path: string
    methods: string[]
    auth?: 'authenticated' | 'admin' | 'super_admin'
  }>
}

function inputJson(value: unknown): PrismaTypes.InputJsonValue {
  return value as PrismaTypes.InputJsonValue
}

function manifestFromJson(value: unknown): BackendPluginManifest {
  validatePluginManifest(value)
  return value
}

class ControlOperationError extends Error {}

export class PluginApplicationService {
  private undoRuntime: (() => Promise<unknown>) | undefined
  public constructor(
    private readonly control: PluginControlPort = pluginControlClient(),
    private readonly db: PrismaClient | PrismaTypes.TransactionClient = prisma,
    private readonly inTransaction = false,
  ) {}

  /** Cross-process DB lock covers supervisor I/O and atomic multi-row updates. */
  private async operation<T>(
    pluginId: string,
    run: (service: PluginApplicationService) => Promise<T>,
  ): Promise<T> {
    const outcome = await (this.db as PrismaClient).$transaction(
      async (tx) => {
        const locks = await tx.$queryRaw<
          Array<{ locked: boolean }>
        >`SELECT pg_try_advisory_xact_lock(hashtext('myndbbs.plugin'), hashtext(${pluginId})) AS locked`
        if (!locks[0]?.locked) throw new Error('ERR_PLUGIN_OPERATION_IN_PROGRESS')
        const service = new PluginApplicationService(this.control, tx, true)
        try {
          return { value: await run(service) }
        } catch (error) {
          // Supervisor failure metadata commits; a database error rolls back all writes.
          if (error instanceof ControlOperationError) return { error }
          // Compensate runtime changes before releasing the DB lock on a row-write failure.
          if (service.undoRuntime) {
            try {
              await service.undoRuntime()
            } catch {
              throw new Error('ERR_PLUGIN_RECONCILIATION_REQUIRED')
            }
          }
          throw error
        }
      },
      { maxWait: 5000, timeout: 90000 },
    )
    if ('error' in outcome) throw outcome.error
    return outcome.value
  }

  public async list(): Promise<PluginAdminDto[]> {
    const rows = await this.db.plugin.findMany({
      include: { releases: { orderBy: { createdAt: 'desc' } }, config: true },
      orderBy: { pluginId: 'asc' },
    })
    return rows.map((row) => this.toDto(row))
  }

  public async get(pluginId: string): Promise<PluginAdminDto> {
    const row = await this.db.plugin.findUnique({
      where: { pluginId },
      include: { releases: { orderBy: { createdAt: 'desc' } }, config: true },
    })
    if (!row) throw new Error('ERR_PLUGIN_NOT_FOUND')
    return this.toDto(row)
  }

  public async stageRelease(input: StagePluginArtifactInput): Promise<PluginAdminDto> {
    if (!this.inTransaction)
      return this.operation('__stage__', (service) => service.stageRelease(input))
    const staged = await this.control.stageArtifact(input)
    const manifest = manifestFromJson(staged.manifest)
    if (
      staged.pluginId !== manifest.id ||
      staged.version !== manifest.version ||
      !/^[a-f0-9]{64}$/i.test(staged.artifactSha256)
    )
      throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    if (manifest.capabilities.config)
      validatePluginConfigSchema(
        manifest.capabilities.config.schema,
        manifest.capabilities.config.secretPaths,
      )
    const locks = await this.db.$queryRaw<
      Array<{ locked: boolean }>
    >`SELECT pg_try_advisory_xact_lock(hashtext('myndbbs.plugin'), hashtext(${staged.pluginId})) AS locked`
    if (!locks[0]?.locked) throw new Error('ERR_PLUGIN_OPERATION_IN_PROGRESS')
    const plugin = await this.db.plugin.upsert({
      where: { pluginId: staged.pluginId },
      create: {
        pluginId: staged.pluginId,
        displayName: manifest.displayName ?? staged.pluginId,
        description: manifest.description ?? null,
        runtimeState: 'PENDING_APPROVAL',
        desiredState: 'DISABLED',
      },
      update: {
        ...(manifest.displayName !== undefined ? { displayName: manifest.displayName } : {}),
        ...(manifest.description !== undefined ? { description: manifest.description } : {}),
      },
    })
    await this.db.pluginRelease.create({
      data: {
        pluginId: plugin.id,
        version: staged.version,
        apiVersion: staged.manifest.apiVersion,
        manifest: inputJson(staged.manifest),
        artifactSha256: staged.artifactSha256,
        signatureKeyId: staged.manifest.signatureKeyId,
        ...(staged.artifactPath ? { artifactPath: staged.artifactPath } : {}),
        state: 'QUARANTINED',
        uploadedBy: input.requestedBy,
      },
    })
    return this.get(staged.pluginId)
  }

  public async approve(
    pluginId: string,
    releaseId: string,
    operatorId: string,
  ): Promise<PluginAdminDto> {
    if (!this.inTransaction)
      return this.operation(pluginId, (service) => service.approve(pluginId, releaseId, operatorId))
    const plugin = await this.requirePlugin(pluginId)
    const release = await this.findRelease(pluginId, releaseId)
    if (release.state !== 'QUARANTINED') throw new Error('ERR_PLUGIN_RELEASE_NOT_PENDING_APPROVAL')
    await this.control.approve(pluginId, release.version, release.artifactSha256)
    await this.db.pluginRelease.update({
      where: { id: release.id },
      data: { state: 'APPROVED', approvedBy: operatorId, approvedAt: new Date() },
    })
    // Approval is not a runtime transition for an existing installation (healthy or otherwise).
    if (!plugin.currentVersion && plugin.desiredState === 'DISABLED') {
      await this.db.plugin.update({
        where: { id: plugin.id },
        data: { runtimeState: 'APPROVED', lastError: null },
      })
    }
    return this.get(pluginId)
  }

  public async activate(pluginId: string, version: string | undefined): Promise<PluginAdminDto> {
    if (!this.inTransaction)
      return this.operation(pluginId, (service) => service.activate(pluginId, version))
    return this.switchVersion(pluginId, version, false)
  }

  public async rollback(pluginId: string, version: string): Promise<PluginAdminDto> {
    if (!this.inTransaction)
      return this.operation(pluginId, (service) => service.rollback(pluginId, version))
    return this.switchVersion(pluginId, version, true)
  }

  private async switchVersion(
    pluginId: string,
    version: string | undefined,
    rollback: boolean,
  ): Promise<PluginAdminDto> {
    const plugin = await this.requirePlugin(pluginId)
    const release = await this.db.pluginRelease.findFirst({
      where: {
        pluginId: plugin.id,
        ...(version ? { version } : {}),
        state: { in: rollback ? ['ACTIVE', 'RETIRED', 'APPROVED'] : ['APPROVED'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!release)
      throw new Error(rollback ? 'ERR_PLUGIN_RELEASE_NOT_FOUND' : 'ERR_PLUGIN_RELEASE_NOT_APPROVED')
    const config = await this.configForRelease(plugin.id, manifestFromJson(release.manifest))
    const restore = await this.restoreRuntimeAction(plugin)
    let snapshot
    try {
      snapshot = rollback
        ? await this.control.rollback(pluginId, release.version, config, release.artifactSha256)
        : await this.control.activate(pluginId, release.version, config, release.artifactSha256)
      if (
        !snapshot.healthy ||
        snapshot.version !== release.version ||
        snapshot.pluginId !== pluginId
      )
        throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    } catch (error) {
      return this.runtimeFailure(plugin, error)
    }
    this.undoRuntime = restore
    await this.db.pluginRelease.updateMany({
      where: { pluginId: plugin.id, state: 'ACTIVE' },
      data: { state: 'RETIRED' },
    })
    await this.db.pluginRelease.update({
      where: { id: release.id },
      data: { state: 'ACTIVE', activatedAt: new Date() },
    })
    await this.db.plugin.update({
      where: { id: plugin.id },
      data: {
        desiredState: 'ACTIVE',
        runtimeState: rollback ? 'ROLLED_BACK' : 'ACTIVE',
        currentVersion: release.version,
        healthy: true,
        lastHealthAt: new Date(),
        lastError: null,
      },
    })
    return this.get(pluginId)
  }

  public async deactivate(pluginId: string): Promise<PluginAdminDto> {
    if (!this.inTransaction)
      return this.operation(pluginId, (service) => service.deactivate(pluginId))
    return this.stop(pluginId)
  }

  /** Physical removal is allowed only after a successful explicit deactivation. */
  public async remove(pluginId: string): Promise<{ pluginId: string; deleted: true }> {
    if (!this.inTransaction) return this.operation(pluginId, (service) => service.remove(pluginId))
    const plugin = await this.requirePlugin(pluginId)
    if (plugin.desiredState !== 'DISABLED') throw new Error('ERR_PLUGIN_MUST_BE_DISABLED')
    const snapshot = await this.control.remove(pluginId)
    if (
      snapshot.pluginId !== pluginId ||
      snapshot.state !== 'DELETED' ||
      snapshot.healthy !== false
    )
      throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    // FK cascades remove plugin metadata; the independent audit log is deliberately untouched.
    await this.db.plugin.delete({ where: { id: plugin.id } })
    return { pluginId, deleted: true }
  }

  private async stop(pluginId: string): Promise<PluginAdminDto> {
    const plugin = await this.requirePlugin(pluginId)
    // Emergency stop must remain available even when saved configuration cannot be decrypted.
    const restore = await this.restoreRuntimeAction(plugin).catch(() => undefined)
    try {
      const snapshot = await this.control.deactivate(pluginId)
      if (snapshot.pluginId !== pluginId || snapshot.healthy || snapshot.state !== 'DISABLED')
        throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    } catch (error) {
      return this.runtimeFailure(plugin, error)
    }
    this.undoRuntime = restore
    await this.db.pluginRelease.updateMany({
      where: { pluginId: plugin.id, state: 'ACTIVE' },
      data: { state: 'APPROVED' },
    })
    await this.db.plugin.update({
      where: { id: plugin.id },
      data: {
        desiredState: 'DISABLED',
        runtimeState: 'DISABLED',
        healthy: false,
        lastHealthAt: new Date(),
        lastError: null,
      },
    })
    return this.get(pluginId)
  }

  public async reload(pluginId: string): Promise<PluginAdminDto> {
    if (!this.inTransaction) return this.operation(pluginId, (service) => service.reload(pluginId))
    const plugin = await this.requirePlugin(pluginId)
    if (plugin.desiredState !== 'ACTIVE' || !plugin.currentVersion)
      throw new Error('ERR_PLUGIN_NOT_ACTIVE')
    const manifest = await this.currentManifest(plugin.id, plugin.currentVersion)
    if (!manifest) throw new Error('ERR_PLUGIN_RELEASE_NOT_FOUND')
    const config = await this.configForRelease(plugin.id, manifest)
    try {
      const snapshot = await this.control.reload(pluginId, config)
      if (
        !snapshot.healthy ||
        snapshot.version !== plugin.currentVersion ||
        snapshot.pluginId !== pluginId
      )
        throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    } catch (error) {
      return this.runtimeFailure(plugin, error)
    }
    await this.db.plugin.update({
      where: { id: plugin.id },
      data: { runtimeState: 'ACTIVE', healthy: true, lastHealthAt: new Date(), lastError: null },
    })
    return this.get(pluginId)
  }

  public async health(pluginId: string): Promise<unknown> {
    if (!this.inTransaction) return this.operation(pluginId, (service) => service.health(pluginId))
    const plugin = await this.requirePlugin(pluginId)
    let snapshot
    try {
      snapshot = await this.control.health(pluginId)
      if (
        snapshot.pluginId !== pluginId ||
        (plugin.desiredState === 'ACTIVE' && snapshot.version !== plugin.currentVersion) ||
        (plugin.desiredState === 'DISABLED' && snapshot.healthy)
      )
        throw new Error('ERR_PLUGIN_CONTROL_FAILED')
    } catch (error) {
      return this.runtimeFailure(plugin, error)
    }
    const healthy = plugin.desiredState === 'ACTIVE' && snapshot.healthy
    await this.db.plugin.update({
      where: { id: plugin.id },
      data: {
        runtimeState:
          plugin.desiredState === 'DISABLED' ? plugin.runtimeState : this.runtimeState(healthy),
        healthy,
        lastHealthAt: new Date(),
        lastError: snapshot.lastError ? this.errorMessage(new Error(snapshot.lastError)) : null,
      },
    })
    return {
      pluginId: snapshot.pluginId,
      ...(snapshot.version ? { version: snapshot.version } : {}),
      state: plugin.desiredState === 'DISABLED' ? 'DISABLED' : this.runtimeState(healthy),
      healthy,
      lastError: snapshot.lastError ? this.errorMessage(new Error(snapshot.lastError)) : null,
    }
  }

  private async restoreRuntimeAction(
    plugin: Awaited<ReturnType<PluginApplicationService['requirePlugin']>>,
  ): Promise<() => Promise<unknown>> {
    if (plugin.desiredState !== 'ACTIVE' || !plugin.currentVersion)
      return () => this.control.deactivate(plugin.pluginId)
    const previous = await this.db.pluginRelease.findFirst({
      where: { pluginId: plugin.id, version: plugin.currentVersion },
    })
    if (!previous) throw new Error('ERR_PLUGIN_RELEASE_NOT_FOUND')
    const config = await this.configForRelease(plugin.id, manifestFromJson(previous.manifest))
    return async () => {
      const snapshot = await this.control.rollback(
        plugin.pluginId,
        previous.version,
        config,
        previous.artifactSha256,
      )
      if (!snapshot.healthy || snapshot.version !== previous.version)
        throw new Error('ERR_PLUGIN_RECONCILIATION_REQUIRED')
      return snapshot
    }
  }

  private async runtimeFailure(
    plugin: Awaited<ReturnType<PluginApplicationService['requirePlugin']>>,
    error: unknown,
  ): Promise<never> {
    let healthy: boolean | null = null
    try {
      const actual = await this.control.health(plugin.pluginId)
      healthy =
        actual.pluginId === plugin.pluginId &&
        actual.version === plugin.currentVersion &&
        actual.healthy
    } catch {
      /* Unknown health must never be reported as a healthy old release. */
    }
    await this.db.plugin.update({
      where: { id: plugin.id },
      data: {
        runtimeState:
          plugin.desiredState === 'ACTIVE'
            ? healthy
              ? plugin.runtimeState === 'ROLLED_BACK'
                ? 'ROLLED_BACK'
                : 'ACTIVE'
              : 'UNHEALTHY'
            : plugin.currentVersion
              ? 'DISABLED'
              : 'FAILED',
        healthy,
        lastHealthAt: new Date(),
        lastError: this.errorMessage(error),
      },
    })
    throw new ControlOperationError(this.errorMessage(error))
  }

  public async getConfig(pluginId: string): Promise<{
    config: Record<string, unknown>
    schema: Record<string, unknown> | null
    secretPaths: readonly string[]
  }> {
    const plugin = await this.requirePlugin(pluginId)
    const manifest = await this.editableManifest(
      plugin.id,
      plugin.currentVersion,
      plugin.desiredState,
    )
    const capability = manifest?.capabilities.config
    const row = await this.db.pluginConfig.findUnique({ where: { pluginId: plugin.id } })
    return {
      config: capability ? this.safePublicConfig(row, capability.secretPaths) : {},
      schema: capability?.schema ?? null,
      secretPaths: capability?.secretPaths ?? [],
    }
  }

  public async updateConfig(
    pluginId: string,
    value: unknown,
    operatorId: string,
  ): Promise<{
    config: Record<string, unknown>
    schema: Record<string, unknown> | null
    secretPaths: readonly string[]
  }> {
    if (!this.inTransaction)
      return this.operation(pluginId, (service) =>
        service.updateConfig(pluginId, value, operatorId),
      )
    const plugin = await this.requirePlugin(pluginId)
    const manifest = await this.editableManifest(
      plugin.id,
      plugin.currentVersion,
      plugin.desiredState,
    )
    const capability = manifest?.capabilities.config
    if (!capability) throw new Error('ERR_PLUGIN_CONFIG_NOT_SUPPORTED')
    const existing = await this.db.pluginConfig.findUnique({ where: { pluginId: plugin.id } })
    validatePluginConfigSchema(capability.schema, capability.secretPaths)
    const compatible = configForManifest(
      existing?.publicConfig,
      existing?.encryptedSecrets,
      this.storedPaths(existing),
      capability.secretPaths,
    )
    const update = preparePluginConfigUpdate(
      value,
      capability.secretPaths,
      compatible.encryptedSecrets,
    )
    const resolved = resolvedPluginConfig(update.publicConfig, update.encryptedSecrets)
    validatePluginConfig(resolved, capability.schema)
    await this.db.pluginConfig.upsert({
      where: { pluginId: plugin.id },
      create: {
        pluginId: plugin.id,
        publicConfig: inputJson(update.publicConfig),
        encryptedSecrets: update.encryptedSecrets,
        secretPaths: inputJson(capability.secretPaths),
        updatedBy: operatorId,
      },
      update: {
        publicConfig: inputJson(update.publicConfig),
        encryptedSecrets: update.encryptedSecrets,
        secretPaths: inputJson(capability.secretPaths),
        updatedBy: operatorId,
      },
    })
    return this.getConfig(pluginId)
  }

  public async currentManifestForPlugin(pluginId: string): Promise<BackendPluginManifest | null> {
    const plugin = await this.db.plugin.findUnique({
      where: { pluginId },
      select: { id: true, currentVersion: true, desiredState: true },
    })
    if (!plugin || plugin.desiredState !== 'ACTIVE') return null
    return this.currentManifest(plugin.id, plugin.currentVersion)
  }

  private async currentManifest(
    pluginId: string,
    version: string | null,
  ): Promise<BackendPluginManifest | null> {
    if (!version) return null
    const release = await this.db.pluginRelease.findFirst({
      where: { pluginId, version, state: { in: ['ACTIVE', 'RETIRED', 'APPROVED'] } },
      select: { manifest: true },
    })
    return release ? manifestFromJson(release.manifest) : null
  }

  private async editableManifest(
    pluginId: string,
    version: string | null,
    desiredState: string,
  ): Promise<BackendPluginManifest | null> {
    if (desiredState === 'ACTIVE' && version) return this.currentManifest(pluginId, version)
    const release = await this.db.pluginRelease.findFirst({
      where: { pluginId, state: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    })
    return release ? manifestFromJson(release.manifest) : null
  }

  private storedPaths(row: { secretPaths: unknown } | null): string[] {
    if (!row) return []
    if (
      !Array.isArray(row.secretPaths) ||
      row.secretPaths.some((value) => typeof value !== 'string')
    )
      throw new Error('ERR_INVALID_PLUGIN_SECRET_PATH')
    return row.secretPaths as string[]
  }

  private safePublicConfig(
    row: { publicConfig: unknown; encryptedSecrets: string; secretPaths: unknown } | null,
    paths: readonly string[],
  ): Record<string, unknown> {
    const safe = configForManifest(
      row?.publicConfig,
      row?.encryptedSecrets,
      this.storedPaths(row),
      paths,
    )
    return publicPluginConfig(safe.publicConfig, safe.encryptedSecrets, paths)
  }

  private async configForRelease(
    pluginId: string,
    manifest: BackendPluginManifest,
  ): Promise<Record<string, unknown>> {
    const capability = manifest.capabilities.config
    if (!capability) return {}
    validatePluginConfigSchema(capability.schema, capability.secretPaths)
    const row = await this.db.pluginConfig.findUnique({ where: { pluginId } })
    const safe = configForManifest(
      row?.publicConfig,
      row?.encryptedSecrets,
      this.storedPaths(row),
      capability.secretPaths,
    )
    const resolved = resolvedPluginConfig(safe.publicConfig, safe.encryptedSecrets)
    validatePluginConfig(resolved, capability.schema)
    return resolved
  }

  private async requirePlugin(pluginId: string) {
    const plugin = await this.db.plugin.findUnique({ where: { pluginId } })
    if (!plugin) throw new Error('ERR_PLUGIN_NOT_FOUND')
    return plugin
  }

  private async findRelease(pluginId: string, releaseId: string) {
    const release = await this.db.pluginRelease.findFirst({
      where: { id: releaseId, plugin: { pluginId } },
    })
    if (!release) throw new Error('ERR_PLUGIN_RELEASE_NOT_FOUND')
    return release
  }

  private toDto(row: any): PluginAdminDto {
    const current =
      row.desiredState === 'ACTIVE' && row.currentVersion
        ? row.releases.find((release: any) => release.version === row.currentVersion)
        : row.releases.find((release: any) => release.state === 'APPROVED')
    const manifest = current ? manifestFromJson(current.manifest) : null
    return {
      id: row.id,
      pluginId: row.pluginId,
      displayName: row.displayName,
      description: row.description,
      desiredState: row.desiredState,
      runtimeState: row.runtimeState,
      currentVersion: row.currentVersion,
      lastError: row.lastError,
      healthy: row.healthy ?? null,
      lastHealthAt: row.lastHealthAt ?? null,
      releases: row.releases.map((release: any) => ({
        id: release.id,
        version: release.version,
        apiVersion: release.apiVersion,
        artifactSha256: release.artifactSha256,
        signatureKeyId: release.signatureKeyId,
        state: release.state,
        uploadedBy: release.uploadedBy ?? null,
        approvedBy: release.approvedBy ?? null,
        uploadedAt: release.uploadedAt,
        approvedAt: release.approvedAt,
        activatedAt: release.activatedAt,
      })),
      config:
        row.config && manifest?.capabilities.config
          ? this.safePublicConfig(row.config, manifest.capabilities.config.secretPaths)
          : null,
      configSchema: manifest?.capabilities.config?.schema ?? null,
      secretPaths: manifest?.capabilities.config?.secretPaths ?? [],
      uiMounts:
        manifest?.capabilities.ui.map((mount) => ({ slot: mount.slot, path: mount.path })) ?? [],
      routeCapabilities:
        manifest?.capabilities.routes.map((route) => ({
          path: route.path,
          methods: [...route.methods],
          ...(route.auth ? { auth: route.auth } : {}),
        })) ?? [],
    }
  }

  private runtimeState(healthy: boolean): PluginRuntimeState {
    return healthy ? 'ACTIVE' : 'UNHEALTHY'
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error && /^ERR_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : 'ERR_PLUGIN_CONTROL_FAILED'
  }
}

export const pluginApplicationService = new PluginApplicationService()
