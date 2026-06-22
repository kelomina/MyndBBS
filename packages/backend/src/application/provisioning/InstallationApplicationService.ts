import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import {
  IEnvStore,
  EnvironmentConfigInput,
  DomainConfigInput,
} from '../../domain/provisioning/IEnvStore'
import { IDatabaseConnectionValidator } from '../../domain/provisioning/IDatabaseConnectionValidator'
import { IDatabaseSchemaApplier } from '../../domain/provisioning/IDatabaseSchemaApplier'
import { IInstallationSessionRepository } from '../../domain/provisioning/IInstallationSessionRepository'
import { IIdentityBootstrapPort } from '../../domain/provisioning/IIdentityBootstrapPort'
import { IRestartScheduler } from '../../domain/provisioning/IRestartScheduler'
import { IEventBus } from '../../domain/shared/events/IEventBus'
import { DbConfigUpdatedEvent } from '../../domain/shared/events/DomainEvents'
import { getTempTokenSecret } from '../../lib/securityConfig'

export type DbConnectionConfigView = {
  host: string
  port: number
  username: string
  password: string
  database: string
}

export interface InstallationApplicationServiceOptions {
  envStore: IEnvStore
  dbValidator: IDatabaseConnectionValidator
  dbSchemaApplier: IDatabaseSchemaApplier
  sessionRepository: IInstallationSessionRepository
  identityBootstrap: IIdentityBootstrapPort
  restartScheduler: IRestartScheduler
  eventBus: IEventBus
}
export class InstallationApplicationService {
  constructor(private readonly opts: InstallationApplicationServiceOptions) {}

  public getCurrentDbConfig(operatorRole?: string): DbConnectionConfigView {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const parsed = process.env.DATABASE_URL
      ? InstallationApplicationService.parseDatabaseUrl(process.env.DATABASE_URL)
      : null

    if (parsed) return parsed

    return {
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '',
      database: 'myndbbs',
    }
  }

  public scheduleRestart(delayMs = 1000): void {
    this.opts.restartScheduler.scheduleRestart(delayMs)
  }

  public async setupEnvironment(config: EnvironmentConfigInput): Promise<string> {
    const jwtSecret = crypto.randomBytes(32).toString('hex')
    const tempTokenSecret = crypto.randomBytes(32).toString('hex')

    await this.opts.envStore.setupEnvironment(config, jwtSecret, tempTokenSecret)

    const sessionId = await this.startInstallation()
    await this.configureDatabase(sessionId, config.databaseUrl)
    await this.applySchema(sessionId)

    return sessionId
  }

  public getDomainConfig(operatorRole?: string): any {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const originRaw = process.env.ORIGIN || 'http://localhost'
    const splitIndex = originRaw.indexOf('://')
    const protocol = splitIndex > -1 ? originRaw.slice(0, splitIndex) : 'http'
    const hostname = splitIndex > -1 ? originRaw.slice(splitIndex + 3) : originRaw
    const rpId = process.env.RP_ID || hostname || 'localhost'
    const reverseProxyMode = process.env.TRUST_PROXY === 'true'

    return {
      protocol,
      hostname,
      rpId,
      reverseProxyMode,
      origin: protocol + '://' + hostname,
    }
  }

  public async updateDomainConfig(config: DomainConfigInput, operatorRole?: string): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const normalizedProtocol = config.protocol === 'https' ? 'https' : 'http'
    const normalizedHostname = String(config.hostname || '').trim()
    const normalizedRpId = String(config.rpId || '').trim()

    await this.opts.envStore.updateDomainConfig({
      protocol: normalizedProtocol,
      hostname: normalizedHostname,
      rpId: normalizedRpId,
      reverseProxyMode: !!config.reverseProxyMode,
    })
  }

  public async updateDbConfig(
    host: string,
    port: number,
    username: string,
    password: string,
    database: string,
    operatorRole?: string,
    operatorId?: string,
  ): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const newDbUrl = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`
    const sessionId = await this.startInstallation()
    await this.configureDatabase(sessionId, newDbUrl)
    await this.applySchema(sessionId)

    if (operatorId) {
      await this.opts.eventBus.publish(new DbConfigUpdatedEvent(operatorId))
    }
    this.scheduleRestart(1000)
  }

  public async startInstallation(): Promise<string> {
    const session = await this.opts.sessionRepository.createSession()
    return session.id
  }

  public async configureDatabase(sessionId: string, dbUrl: string): Promise<void> {
    const session = await this.opts.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    const isValid = await this.opts.dbValidator.validate(dbUrl)
    if (!isValid) throw new Error('ERR_DB_CONNECTION_FAILED')

    await this.opts.envStore.updateDatabaseUrl(dbUrl)
  }

  public async applySchema(sessionId: string): Promise<void> {
    const session = await this.opts.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    await this.opts.dbSchemaApplier.applySchema()
  }

  public async finalizeInstallation(
    sessionId: string,
    username: string,
    email: string,
    password: string,
  ): Promise<string> {
    const session = await this.opts.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    const userId = await this.opts.identityBootstrap.bootstrapSuperAdmin(username, email, password)
    await this.opts.sessionRepository.markCompleted(sessionId)

    let envContent = await this.opts.envStore.read()
    const { upsertKey } = require('../../infrastructure/services/provisioning/EnvStoreAdapter')
    envContent = upsertKey(envContent, 'INSTALL_LOCKED', 'true')
    await this.opts.envStore.write(envContent)

    return userId
  }

  public generateTempToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'registration' },
      getTempTokenSecret(),
      { expiresIn: '1h' },
    )
  }

  public async verifySessionId(sessionId: string): Promise<boolean> {
    const session = await this.opts.sessionRepository.getSession(sessionId)
    return !!session && !session.isCompleted
  }

  private static parseDatabaseUrl(dbUrl: string): DbConnectionConfigView | null {
    const normalized = String(dbUrl || '')
      .trim()
      .replace(/^"(.*)"$/, '$1')
    if (!normalized) return null

    try {
      const url = new URL(normalized)
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 5432,
        username: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
      }
    } catch {
      return null
    }
  }
}
