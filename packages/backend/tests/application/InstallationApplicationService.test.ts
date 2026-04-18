import { InstallationApplicationService } from '../../src/application/provisioning/InstallationApplicationService';
import { IEnvStore } from '../../src/domain/provisioning/IEnvStore';
import { IDatabaseConnectionValidator } from '../../src/domain/provisioning/IDatabaseConnectionValidator';
import { IDatabaseSchemaApplier } from '../../src/domain/provisioning/IDatabaseSchemaApplier';
import { IInstallationSessionRepository } from '../../src/domain/provisioning/IInstallationSessionRepository';
import { IIdentityBootstrapPort } from '../../src/domain/provisioning/IIdentityBootstrapPort';
import { IRestartScheduler } from '../../src/domain/provisioning/IRestartScheduler';
import { AuditApplicationService } from '../../src/application/system/AuditApplicationService';

describe('InstallationApplicationService', () => {
  let envStore: jest.Mocked<IEnvStore>;
  let dbValidator: jest.Mocked<IDatabaseConnectionValidator>;
  let dbSchemaApplier: jest.Mocked<IDatabaseSchemaApplier>;
  let sessionRepository: jest.Mocked<IInstallationSessionRepository>;
  let identityBootstrap: jest.Mocked<IIdentityBootstrapPort>;
  let restartScheduler: jest.Mocked<IRestartScheduler>;
  let auditApplicationService: jest.Mocked<AuditApplicationService>;
  let service: InstallationApplicationService;

  beforeEach(() => {
    envStore = {
      setupEnvironment: jest.fn(),
      updateDatabaseUrl: jest.fn(),
      updateDomainConfig: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
    } as any;
    dbValidator = { validate: jest.fn() } as any;
    dbSchemaApplier = { applySchema: jest.fn() } as any;
    sessionRepository = {
      createSession: jest.fn().mockResolvedValue({ id: 'test-session-id', isCompleted: false }),
      getSession: jest.fn().mockResolvedValue({ id: 'test-session-id', isCompleted: false }),
      markCompleted: jest.fn(),
    } as any;
    identityBootstrap = { bootstrapSuperAdmin: jest.fn() } as any;
    restartScheduler = { scheduleRestart: jest.fn() } as any;
    auditApplicationService = { logAudit: jest.fn() } as any;

    service = new InstallationApplicationService(
      envStore,
      dbValidator,
      dbSchemaApplier,
      sessionRepository,
      identityBootstrap,
      restartScheduler,
      auditApplicationService
    );
  });

  it('should update DB config, log audit, and schedule restart', async () => {
    dbValidator.validate.mockResolvedValue(true);

    await service.updateDbConfig(
      'localhost',
      5432,
      'test_user',
      'test_pass',
      'test_db',
      'SUPER_ADMIN',
      'test_operator_id'
    );

    expect(envStore.updateDatabaseUrl).toHaveBeenCalled();
    expect(dbSchemaApplier.applySchema).toHaveBeenCalled();
    expect(auditApplicationService.logAudit).toHaveBeenCalledWith(
      'test_operator_id',
      'UPDATE_DB_CONFIG',
      'PostgreSQL config updated in .env'
    );
    expect(restartScheduler.scheduleRestart).toHaveBeenCalledWith(1000);
  });
});
