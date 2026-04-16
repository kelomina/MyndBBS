import { IEnvStore } from '../../domain/provisioning/IEnvStore';
import { IDatabaseConnectionValidator } from '../../domain/provisioning/IDatabaseConnectionValidator';
import { IDatabaseSchemaApplier } from '../../domain/provisioning/IDatabaseSchemaApplier';
import { IInstallationSessionRepository } from '../../domain/provisioning/IInstallationSessionRepository';
import { IdentityBootstrapApplicationService } from '../identity/IdentityBootstrapApplicationService';

export class InstallationApplicationService {
  constructor(
    private envStore: IEnvStore,
    private dbValidator: IDatabaseConnectionValidator,
    private dbSchemaApplier: IDatabaseSchemaApplier,
    private sessionRepository: IInstallationSessionRepository,
    private identityBootstrap: IdentityBootstrapApplicationService
  ) {}

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
}
