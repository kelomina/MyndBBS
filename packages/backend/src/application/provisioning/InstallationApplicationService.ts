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

/**
 * 数据库连接配置的只读视图。用于向前端展示当前的数据库连接参数。
 *
 * Read-only database connection configuration view. Used to display current database
 * connection parameters to the frontend.
 */
export type DbConnectionConfigView = {
  /** 数据库主机地址 / Database host address */
  host: string
  /** 数据库端口号 / Database port number */
  port: number
  /** 数据库用户名 / Database username */
  username: string
  /** 数据库密码 / Database password */
  password: string
  /** 数据库名称 / Database name */
  database: string
}

/**
 * Function: class InstallationApplicationService
 * ------------------------------------------------
 * 安装配置应用服务。管理系统安装/配置过程的完整生命周期，包括环境设置、数据库连接验证、
 * Schema 应用、域名配置、SMTP 配置以及超级管理员引导。
 * 大部分操作要求操作者角色为 SUPER_ADMIN，安装过程中的内部步骤由 session 机制保护。
 *
 * Installation/configuration application service. Manages the full lifecycle of the system
 * installation/configuration process, including environment setup, database connection validation,
 * schema application, domain configuration, SMTP configuration, and super admin bootstrapping.
 * Most operations require SUPER_ADMIN role; internal steps during installation are protected
 * by a session mechanism.
 *
 * Callers: [AdminController, InstallController]
 * Called by: [AdminController, InstallController]
 *
 * Callees: [IEnvStore, IDatabaseConnectionValidator, IDatabaseSchemaApplier,
 *           IInstallationSessionRepository, IIdentityBootstrapPort, IRestartScheduler, IEventBus]
 * Calls: [IEnvStore, IDatabaseConnectionValidator, IDatabaseSchemaApplier,
 *         IInstallationSessionRepository, IIdentityBootstrapPort, IRestartScheduler, IEventBus]
 *
 * Keywords: installation, provisioning, database config, domain config, environment setup,
 *           schema apply, bootstrap, session, 安装, 配置, 数据库, 域名, 环境设置, 引导
 */
export class InstallationApplicationService {
  /**
   * Function: constructor
   * ----------------------
   * 通过依赖注入初始化服务实例。
   *
   * Initializes the service instance via Dependency Injection.
   *
   * Parameters:
   * - envStore: IEnvStore, 环境存储适配器 / environment store adapter
   * - dbValidator: IDatabaseConnectionValidator, 数据库连接验证器 / database connection validator
   * - dbSchemaApplier: IDatabaseSchemaApplier, 数据库 Schema 应用器 / database schema applier
   * - sessionRepository: IInstallationSessionRepository, 安装会话仓储 / installation session repository
   * - identityBootstrap: IIdentityBootstrapPort, 身份引导端口 / identity bootstrap port
   * - restartScheduler: IRestartScheduler, 重启调度器 / restart scheduler
   * - eventBus: IEventBus, 事件总线 / event bus
   */
  constructor(
    private envStore: IEnvStore,
    private dbValidator: IDatabaseConnectionValidator,
    private dbSchemaApplier: IDatabaseSchemaApplier,
    private sessionRepository: IInstallationSessionRepository,
    private identityBootstrap: IIdentityBootstrapPort,
    private restartScheduler: IRestartScheduler,
    private eventBus: IEventBus,
  ) {}

  /**
   * Function: getCurrentDbConfig
   * ------------------------------
   * 获取当前的数据库连接配置。从 DATABASE_URL 环境变量解析出主机、端口、用户名、密码和数据库名。
   * 如果环境变量不存在或解析失败，返回默认值（localhost:5432/postgres/myndbbs）。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Retrieves the current database connection configuration. Parses the DATABASE_URL environment variable
   * to extract host, port, username, password, and database name. If the environment variable is missing
   * or fails to parse, returns default values (localhost:5432/postgres/myndbbs).
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.getDbConfig]
   * Called by: [AdminController.getDbConfig]
   *
   * Callees: [InstallationApplicationService.parseDatabaseUrl, process.env]
   * Calls: [InstallationApplicationService.parseDatabaseUrl, process.env]
   *
   * Parameters:
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - DbConnectionConfigView, 数据库连接配置视图 / database connection config view
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 数据库配置, DATABASE_URL, 连接解析, 配置查看, 默认值, 超级管理员
   * English keywords: database config, DATABASE_URL, connection parse, config view, default value, super admin
   */
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

  /**
   * Function: scheduleRestart
   * ---------------------------
   * 调度后端重启。通常在环境配置变更后调用，使新配置生效。默认延迟 1 秒。
   *
   * Schedules a backend restart. Typically called after environment configuration changes
   * to make the new configuration take effect. Default delay is 1 second.
   *
   * Callers: [AdminController.updateDbConfig, AdminController.updateDomainConfig,
   *           InstallationApplicationService.updateDbConfig]
   * Called by: [AdminController.updateDbConfig, AdminController.updateDomainConfig,
   *              InstallationApplicationService.updateDbConfig]
   *
   * Callees: [IRestartScheduler.scheduleRestart]
   * Calls: [IRestartScheduler.scheduleRestart]
   *
   * Parameters:
   * - delayMs: number, 重启前的延迟时间（毫秒），默认 1000ms / delay before restart in ms, default 1000
   *
   * Returns:
   * - void, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 重启调度失败时抛出基础设施异常 / restart scheduling failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 触发后端进程重启（当前进程可能被终止）/ triggers backend process restart (current process may be terminated)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 重启调度, 后端重启, 配置生效, 进程管理, 部署运维
   * English keywords: restart schedule, backend restart, config生效, process management, deployment ops
   */
  public scheduleRestart(delayMs = 1000): void {
    this.restartScheduler.scheduleRestart(delayMs)
  }

  /**
   * Function: setupEnvironment
   * ----------------------------
   * 执行完整的环境初始化流程：生成 JWT 密钥对、保存环境配置、启动安装会话、
   * 配置数据库连接并应用 Schema。返回安装会话 ID。
   *
   * Executes the full environment initialization flow: generates JWT key pairs, persists
   * environment configuration, starts an installation session, configures the database connection,
   * and applies the schema. Returns the installation session ID.
   *
   * Callers: [InstallController.setupEnv]
   * Called by: [InstallController.setupEnv]
   *
   * Callees: [IEnvStore.setupEnvironment, InstallationApplicationService.startInstallation,
   *           InstallationApplicationService.configureDatabase,
   *           InstallationApplicationService.applySchema, crypto.randomBytes]
   * Calls: [IEnvStore.setupEnvironment, InstallationApplicationService.startInstallation,
   *         InstallationApplicationService.configureDatabase,
   *         InstallationApplicationService.applySchema, crypto.randomBytes]
   *
   * Parameters:
   * - config: EnvironmentConfigInput, 环境配置输入（含数据库连接串等）/ environment config input (including database URL, etc.)
   *
   * Returns:
   * - Promise<string>, 安装会话 ID / the installation session ID
   *
   * Error Handling / 错误处理:
   * - 任意步骤失败时向上抛出异常（数据库连接失败、Schema 应用失败等）
   *   Throws on any step failure (database connection failure, schema apply failure, etc.)
   *
   * Side Effects / 副作用:
   * - 写入环境存储（密钥和配置）/ writes to environment store (secrets and config)
   * - 写入数据库（安装会话）/ writes to database (installation session)
   * - 可能修改数据库 Schema / may modify database schema
   *
   * Transaction / 事务:
   * - 无统一事务边界；各步骤各自独立持久化 / no unified transaction boundary; each step persists independently
   *
   * 中文关键词: 环境初始化, JWT密钥, 数据库配置, Schema应用, 安装会话, 引导流程
   * English keywords: environment setup, JWT secret, database config, schema apply, installation session, bootstrap flow
   */
  public async setupEnvironment(config: EnvironmentConfigInput): Promise<string> {
    const jwtSecret = crypto.randomBytes(32).toString('hex')
    const jwtRefreshSecret = crypto.randomBytes(32).toString('hex')

    await this.envStore.setupEnvironment(config, jwtSecret, jwtRefreshSecret)

    const sessionId = await this.startInstallation()
    await this.configureDatabase(sessionId, config.databaseUrl)
    await this.applySchema(sessionId)

    return sessionId
  }

  /**
   * Function: getDomainConfig
   * --------------------------
   * 获取当前域名配置。从环境变量解析协议、主机名、Relying Party ID 和反向代理模式。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Retrieves the current domain configuration. Parses protocol, hostname, Relying Party ID,
   * and reverse proxy mode from environment variables.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.getDomainConfig]
   * Called by: [AdminController.getDomainConfig]
   *
   * Callees: [process.env]
   * Calls: [process.env]
   *
   * Parameters:
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - { protocol: string, hostname: string, rpId: string, reverseProxyMode: boolean, origin: string }
   *   包含协议、主机名、RP ID、反向代理模式和完整源地址的对象
   *   object containing protocol, hostname, RP ID, reverse proxy mode, and full origin
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 域名配置, 协议解析, 主机名, RP_ID, 反向代理, ORIGIN, 超级管理员
   * English keywords: domain config, protocol parse, hostname, RP_ID, reverse proxy, ORIGIN, super admin
   */
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

  /**
   * Function: updateDomainConfig
   * ------------------------------
   * 更新域名配置。规范化协议（仅允许 http/https）、主机名和 RP ID，然后保存到环境存储。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Updates the domain configuration. Normalizes the protocol (only http/https allowed), hostname,
   * and RP ID, then persists to the environment store.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.updateDomainConfig]
   * Called by: [AdminController.updateDomainConfig]
   *
   * Callees: [IEnvStore.updateDomainConfig]
   * Calls: [IEnvStore.updateDomainConfig]
   *
   * Parameters:
   * - config: DomainConfigInput, 域名配置输入（协议、主机名、RP ID、反向代理模式）
   *   domain config input (protocol, hostname, RP ID, reverse proxy mode)
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   *   the operator's role name, must be 'SUPER_ADMIN'
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN / operator is not SUPER_ADMIN
   *
   * Side Effects / 副作用:
   * - 写入环境存储 / writes to environment store
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 域名配置更新, 协议规范化, 主机名, RP_ID, 反向代理, 环境存储, 超级管理员
   * English keywords: domain config update, protocol normalization, hostname, RP_ID, reverse proxy, environment store, super admin
   */
  public async updateDomainConfig(config: DomainConfigInput, operatorRole?: string): Promise<void> {
    if (operatorRole !== 'SUPER_ADMIN') {
      throw new Error('ERR_FORBIDDEN_SUPER_ADMIN_ONLY')
    }

    const normalizedProtocol = config.protocol === 'https' ? 'https' : 'http'
    const normalizedHostname = String(config.hostname || '').trim()
    const normalizedRpId = String(config.rpId || '').trim()

    await this.envStore.updateDomainConfig({
      protocol: normalizedProtocol,
      hostname: normalizedHostname,
      rpId: normalizedRpId,
      reverseProxyMode: !!config.reverseProxyMode,
    })
  }

  /**
   * Function: updateDbConfig
   * --------------------------
   * 更新数据库连接配置。构建新的连接串，启动安装会话，验证连接可用性，应用 Schema，
   * 发布 DbConfigUpdatedEvent 事件，然后调度后端重启。
   * 仅 SUPER_ADMIN 角色可调用。
   *
   * Updates the database connection configuration. Builds a new connection URL, starts an installation
   * session, validates connection availability, applies the schema, publishes a DbConfigUpdatedEvent,
   * and schedules a backend restart.
   * Only accessible by SUPER_ADMIN role.
   *
   * Callers: [AdminController.updateDbConfig]
   * Called by: [AdminController.updateDbConfig]
   *
   * Callees: [InstallationApplicationService.startInstallation,
   *           InstallationApplicationService.configureDatabase,
   *           InstallationApplicationService.applySchema,
   *           IEventBus.publish, InstallationApplicationService.scheduleRestart]
   * Calls: [InstallationApplicationService.startInstallation,
   *         InstallationApplicationService.configureDatabase,
   *         InstallationApplicationService.applySchema,
   *         IEventBus.publish, InstallationApplicationService.scheduleRestart]
   *
   * Parameters:
   * - host: string, 数据库主机地址 / database host address
   * - port: number, 数据库端口号 / database port number
   * - username: string, 数据库用户名 / database username
   * - password: string, 数据库密码 / database password
   * - database: string, 数据库名称 / database name
   * - operatorRole: string | undefined, 操作者角色名，必须为 'SUPER_ADMIN'
   * - operatorId: string | undefined, 操作者用户 ID（用于事件发布）/ operator user ID (for event publishing)
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_FORBIDDEN_SUPER_ADMIN_ONLY: 操作者不是 SUPER_ADMIN
   * - ERR_INVALID_SESSION: 安装会话无效
   * - ERR_DB_CONNECTION_FAILED: 数据库连接失败
   *
   * Side Effects / 副作用:
   * - 写入环境存储（新的 DATABASE_URL）/ writes to environment store (new DATABASE_URL)
   * - 修改数据库 Schema / modifies database schema
   * - 发布领域事件 / publishes a domain event
   * - 调度后端重启 / schedules a backend restart
   *
   * Transaction / 事务:
   * - 无统一事务边界 / no unified transaction boundary
   *
   * 中文关键词: 数据库配置更新, 连接串构建, 会话保护, Schema应用, 事件发布, 后端重启, 超级管理员
   * English keywords: database config update, connection URL build, session protection, schema apply, event publish, backend restart, super admin
   */
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
      this.eventBus.publish(new DbConfigUpdatedEvent(operatorId))
    }
    this.scheduleRestart(1000)
  }

  /**
   * Function: startInstallation
   * -----------------------------
   * 创建新的安装会话并返回其 ID。安装会话用于保护安装流程中的中间状态（如正在配置数据库时不允许重复操作）。
   *
   * Creates a new installation session and returns its ID. The installation session protects intermediate
   * states during the installation flow (e.g., preventing duplicate operations while configuring the database).
   *
   * Callers: [InstallationApplicationService.setupEnvironment,
   *           InstallationApplicationService.updateDbConfig]
   * Called by: [InstallationApplicationService.setupEnvironment,
   *              InstallationApplicationService.updateDbConfig]
   *
   * Callees: [IInstallationSessionRepository.createSession]
   * Calls: [IInstallationSessionRepository.createSession]
   *
   * Parameters: 无 / none
   *
   * Returns:
   * - Promise<string>, 安装会话 ID / the installation session ID
   *
   * Error Handling / 错误处理:
   * - 仓储创建失败时抛出基础设施异常 / repository creation failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 写入数据库（创建会话记录）/ writes to database (creates session record)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 安装会话, 会话创建, 流程保护, 状态管理, 引导初始化
   * English keywords: installation session, session creation, flow protection, state management, bootstrap init
   */
  public async startInstallation(): Promise<string> {
    const session = await this.sessionRepository.createSession()
    return session.id
  }

  /**
   * Function: configureDatabase
   * ----------------------------
   * 配置数据库连接。验证安装会话有效，测试数据库连接是否可用，然后更新环境存储中的数据库连接串。
   *
   * Configures the database connection. Validates the installation session, tests database connectivity,
   * then updates the database connection URL in the environment store.
   *
   * Callers: [InstallationApplicationService.setupEnvironment,
   *           InstallationApplicationService.updateDbConfig]
   * Called by: [InstallationApplicationService.setupEnvironment,
   *              InstallationApplicationService.updateDbConfig]
   *
   * Callees: [IInstallationSessionRepository.getSession, IDatabaseConnectionValidator.validate,
   *           IEnvStore.updateDatabaseUrl]
   * Calls: [IInstallationSessionRepository.getSession, IDatabaseConnectionValidator.validate,
   *         IEnvStore.updateDatabaseUrl]
   *
   * Parameters:
   * - sessionId: string, 安装会话 ID / the installation session ID
   * - dbUrl: string, PostgreSQL 连接串 / the PostgreSQL connection URL
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_SESSION: 会话不存在或已完成 / session not found or already completed
   * - ERR_DB_CONNECTION_FAILED: 数据库连接测试失败 / database connection test failed
   *
   * Side Effects / 副作用:
   * - 写入环境存储（更新 DATABASE_URL）/ writes to environment store (updates DATABASE_URL)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 数据库配置, 连接验证, 会话检查, 环境存储, 连接串更新, 安装流程
   * English keywords: database config, connection validation, session check, environment store, URL update, installation flow
   */
  public async configureDatabase(sessionId: string, dbUrl: string): Promise<void> {
    const session = await this.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    const isValid = await this.dbValidator.validate(dbUrl)
    if (!isValid) throw new Error('ERR_DB_CONNECTION_FAILED')

    await this.envStore.updateDatabaseUrl(dbUrl)
  }

  /**
   * Function: applySchema
   * -----------------------
   * 应用数据库 Schema。验证安装会话有效，然后执行 Schema 迁移/应用操作。
   *
   * Applies the database schema. Validates the installation session, then executes the schema
   * migration/application operation.
   *
   * Callers: [InstallationApplicationService.setupEnvironment,
   *           InstallationApplicationService.updateDbConfig]
   * Called by: [InstallationApplicationService.setupEnvironment,
   *              InstallationApplicationService.updateDbConfig]
   *
   * Callees: [IInstallationSessionRepository.getSession, IDatabaseSchemaApplier.applySchema]
   * Calls: [IInstallationSessionRepository.getSession, IDatabaseSchemaApplier.applySchema]
   *
   * Parameters:
   * - sessionId: string, 安装会话 ID / the installation session ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_SESSION: 会话不存在或已完成 / session not found or already completed
   * - Schema 应用失败时抛出 IDatabaseSchemaApplier 异常 / schema apply failures throw from IDatabaseSchemaApplier
   *
   * Side Effects / 副作用:
   * - 修改数据库 Schema（创建表、索引等）/ modifies database schema (creates tables, indexes, etc.)
   *
   * Transaction / 事务:
   * - 由 IDatabaseSchemaApplier 内部管理事务 / transaction managed internally by IDatabaseSchemaApplier
   *
   * 中文关键词: 数据库Schema, Schema应用, 迁移, 表创建, 安装流程, 会话保护
   * English keywords: database schema, schema apply, migration, table creation, installation flow, session protection
   */
  public async applySchema(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    await this.dbSchemaApplier.applySchema()
  }

  /**
   * Function: finalizeInstallation
   * --------------------------------
   * 完成安装流程。验证安装会话有效，引导创建超级管理员账号，将会话标记为已完成，
   * 然后在 .env 文件中写入 INSTALL_LOCKED=true 锁定安装状态，防止重复安装。
   *
   * Finalizes the installation flow. Validates the installation session, bootstraps the super admin
   * account, marks the session as completed, then writes INSTALL_LOCKED=true to the .env file
   * to lock the installation state and prevent re-installation.
   *
   * Callers: [InstallController.setupAdmin]
   * Called by: [InstallController.setupAdmin]
   *
   * Callees: [IInstallationSessionRepository.getSession, IIdentityBootstrapPort.bootstrapSuperAdmin,
   *           IInstallationSessionRepository.markCompleted, IEnvStore.read, IEnvStore.write]
   * Calls: [IInstallationSessionRepository.getSession, IIdentityBootstrapPort.bootstrapSuperAdmin,
   *         IInstallationSessionRepository.markCompleted, IEnvStore.read, IEnvStore.write]
   *
   * Parameters:
   * - sessionId: string, 安装会话 ID / the installation session ID
   * - username: string, 超级管理员用户名 / the super admin username
   * - email: string, 超级管理员邮箱 / the super admin email
   * - password: string, 超级管理员密码 / the super admin password
   *
   * Returns:
   * - Promise<string>, 创建的超级管理员用户 ID / the created super admin user ID
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_SESSION: 会话不存在或已完成 / session not found or already completed
   *
   * Side Effects / 副作用:
   * - 创建超级管理员用户 / creates the super admin user
   * - 更新数据库（会话标记完成）/ updates database (session marked completed)
   * - 写入 .env 文件（锁定安装状态）/ writes to .env file (locks installation state)
   *
   * Transaction / 事务:
   * - 无统一事务边界；用户创建、会话更新和文件写入各自独立
   *   No unified transaction boundary; user creation, session update, and file write are independent
   *
   * 中文关键词: 安装完成, 超级管理员, 引导创建, 安装锁定, 会话完成, 环境文件
   * English keywords: installation complete, super admin, bootstrap creation, install lock, session complete, env file
   */
  public async finalizeInstallation(
    sessionId: string,
    username: string,
    email: string,
    password: string,
  ): Promise<string> {
    const session = await this.sessionRepository.getSession(sessionId)
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION')

    const userId = await this.identityBootstrap.bootstrapSuperAdmin(username, email, password)
    await this.sessionRepository.markCompleted(sessionId)

    // Mark system as installed in .env
    let envContent = await this.envStore.read()
    envContent += '\nINSTALL_LOCKED=true\n'
    await this.envStore.write(envContent)

    return userId
  }

  /**
   * Function: generateTempToken
   * ----------------------------
   * 生成临时 JWT 令牌。使用 TEMP_TOKEN_SECRET 或 JWT_SECRET 签名，包含用户 ID 和 'registration' 类型标记，
   * 有效期 1 小时。用于安装完成后将用户重定向到 admin-setup 页面时的身份验证。
   *
   * Generates a temporary JWT token. Signs with TEMP_TOKEN_SECRET or JWT_SECRET, contains the user ID
   * and a 'registration' type marker, valid for 1 hour. Used for authentication when redirecting the user
   * to the admin-setup page after installation is complete.
   *
   * Callers: [InstallController.setupAdmin]
   * Called by: [InstallController.setupAdmin]
   *
   * Callees: [jwt.sign, process.env]
   * Calls: [jwt.sign, process.env]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   *
   * Returns:
   * - string, JWT 格式的临时令牌 / the temp token in JWT format
   *
   * Error Handling / 错误处理:
   * - 签名失败时抛出 jsonwebtoken 异常 / throws jsonwebtoken exception on signing failure
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 临时令牌, JWT, 安装完成, 管理设置, 身份验证, 令牌签名
   * English keywords: temp token, JWT, install complete, admin setup, authentication, token sign
   */
  public generateTempToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'registration' },
      process.env.TEMP_TOKEN_SECRET || (process.env.JWT_SECRET as string),
      { expiresIn: '1h' },
    )
  }

  /**
   * Function: parseDatabaseUrl
   * ---------------------------
   * 解析 PostgreSQL 连接串（DATABASE_URL）为结构化的连接配置视图。
   * 支持引号包裹的连接串，解析失败时返回 null。
   *
   * Parses a PostgreSQL connection URL (DATABASE_URL) into a structured connection configuration view.
   * Supports quote-wrapped URLs; returns null on parse failure.
   *
   * Callers: [InstallationApplicationService.getCurrentDbConfig]
   * Called by: [InstallationApplicationService.getCurrentDbConfig]
   *
   * Callees: [URL, parseInt, decodeURIComponent]
   * Calls: [URL, parseInt, decodeURIComponent]
   *
   * Parameters:
   * - dbUrl: string, 原始数据库连接串 / the raw database connection URL
   *
   * Returns:
   * - DbConnectionConfigView | null, 解析成功返回配置视图，失败返回 null
   *   returns config view on success, null on failure
   *
   * Error Handling / 错误处理:
   * - URL 解析异常被捕获，返回 null（不抛异常）/ URL parse exceptions are caught, returns null (no exception thrown)
   *
   * Side Effects / 副作用:
   * - 无副作用，纯函数 / no side effects, pure function
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 连接串解析, DATABASE_URL, PostgreSQL, URL解析, 配置视图
   * English keywords: connection URL parse, DATABASE_URL, PostgreSQL, URL parsing, config view
   */
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
