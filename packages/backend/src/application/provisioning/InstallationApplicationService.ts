import crypto from 'crypto';
import { IEnvStore, EnvironmentConfigInput, DomainConfigInput } from '../../domain/provisioning/IEnvStore';
import { IDatabaseConnectionValidator } from '../../domain/provisioning/IDatabaseConnectionValidator';
import { IDatabaseSchemaApplier } from '../../domain/provisioning/IDatabaseSchemaApplier';
import { IInstallationSessionRepository } from '../../domain/provisioning/IInstallationSessionRepository';
import { IIdentityBootstrapPort } from '../../domain/provisioning/IIdentityBootstrapPort';
import { IRestartScheduler } from '../../domain/provisioning/IRestartScheduler';

export type DbConnectionConfigView = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export class InstallationApplicationService {
  constructor(
    private envStore: IEnvStore,
    private dbValidator: IDatabaseConnectionValidator,
    private dbSchemaApplier: IDatabaseSchemaApplier,
    private sessionRepository: IInstallationSessionRepository,
    private identityBootstrap: IIdentityBootstrapPort,
    private restartScheduler: IRestartScheduler
  ) {}

  /**
   * Callers: [adminController.getDbConfig]
   * Callees: [URL, parseInt, decodeURIComponent, slice]
   * Description: Parses DATABASE_URL into a UI-friendly DB config shape for admin display.
   * Keywords: db, config, parse, database_url, admin
   */
  public getCurrentDbConfig(): DbConnectionConfigView {
    const parsed = process.env.DATABASE_URL
      ? InstallationApplicationService.parseDatabaseUrl(process.env.DATABASE_URL)
      : null;

    if (parsed) return parsed;

    return {
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: '',
      database: 'myndbbs',
    };
  }

  /**
   * Callers: [adminController.updateDbConfig, adminController.updateDomainConfig]
   * Callees: [IRestartScheduler.scheduleRestart]
   * Description: Schedules a backend restart (typically after env config changes).
   * Keywords: restart, schedule, provisioning, backend
   */
  public scheduleRestart(delayMs = 1000): void {
    this.restartScheduler.scheduleRestart(delayMs);
  }

  public async setupEnvironment(config: EnvironmentConfigInput): Promise<string> {
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');

    await this.envStore.setupEnvironment(config, jwtSecret, jwtRefreshSecret);

    const sessionId = await this.startInstallation();
    await this.configureDatabase(sessionId, config.databaseUrl);
    await this.applySchema(sessionId);

    return sessionId;
  }

  public async updateDomainConfig(config: DomainConfigInput): Promise<void> {
    await this.envStore.updateDomainConfig(config);
  }

  public async updateDbConfig(host: string, port: number, username: string, password: string, database: string): Promise<void> {
    const newDbUrl = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`;
    const sessionId = await this.startInstallation();
    await this.configureDatabase(sessionId, newDbUrl);
    await this.applySchema(sessionId);
  }

  public async startInstallation(): Promise<string> {
    const session = await this.sessionRepository.createSession();
    return session.id;
  }

  public async configureDatabase(sessionId: string, dbUrl: string): Promise<void> {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION');

    const isValid = await this.dbValidator.validate(dbUrl);
    if (!isValid) throw new Error('ERR_DB_CONNECTION_FAILED');

    await this.envStore.updateDatabaseUrl(dbUrl);
  }

  public async applySchema(sessionId: string): Promise<void> {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION');

    await this.dbSchemaApplier.applySchema();
  }

  public async finalizeInstallation(sessionId: string, username: string, email: string, password: string): Promise<string> {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session || session.isCompleted) throw new Error('ERR_INVALID_SESSION');

    const userId = await this.identityBootstrap.bootstrapSuperAdmin(username, email, password);
    await this.sessionRepository.markCompleted(sessionId);
    
    // Mark system as installed in .env
    let envContent = await this.envStore.read();
    envContent += '\nINSTALL_LOCKED=true\n';
    await this.envStore.write(envContent);
    
    return userId;
  }

  private static parseDatabaseUrl(dbUrl: string): DbConnectionConfigView | null {
    const normalized = String(dbUrl || '').trim().replace(/^"(.*)"$/, '$1');
    if (!normalized) return null;

    try {
      const url = new URL(normalized);
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 5432,
        username: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
      };
    } catch {
      return null;
    }
  }
}
