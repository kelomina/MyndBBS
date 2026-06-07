import { InstallationApplicationService } from '../../src/application/provisioning/InstallationApplicationService';
import { IEnvStore } from '../../src/domain/provisioning/IEnvStore';
import { IDatabaseConnectionValidator } from '../../src/domain/provisioning/IDatabaseConnectionValidator';
import { IDatabaseSchemaApplier } from '../../src/domain/provisioning/IDatabaseSchemaApplier';
import { IInstallationSessionRepository } from '../../src/domain/provisioning/IInstallationSessionRepository';
import { IIdentityBootstrapPort } from '../../src/domain/provisioning/IIdentityBootstrapPort';
import { IRestartScheduler } from '../../src/domain/provisioning/IRestartScheduler';
import { IEventBus } from '../../src/domain/shared/events/IEventBus';
import { getTempTokenSecret } from '../../src/lib/securityConfig';

describe('InstallationApplicationService', () => {
  let envStore: jest.Mocked<IEnvStore>;
  let dbValidator: jest.Mocked<IDatabaseConnectionValidator>;
  let dbSchemaApplier: jest.Mocked<IDatabaseSchemaApplier>;
  let sessionRepository: jest.Mocked<IInstallationSessionRepository>;
  let identityBootstrap: jest.Mocked<IIdentityBootstrapPort>;
  let restartScheduler: jest.Mocked<IRestartScheduler>;
  let eventBus: jest.Mocked<IEventBus>;
  let service: InstallationApplicationService;

  beforeEach(() => {
    envStore = {
      setupEnvironment: jest.fn(),
      updateDatabaseUrl: jest.fn(),
      updateDomainConfig: jest.fn(),
      read: jest.fn().mockResolvedValue(''),
      write: jest.fn(),
    } as any;
    dbValidator = { validate: jest.fn() } as any;
    dbSchemaApplier = { applySchema: jest.fn() } as any;
    sessionRepository = {
      createSession: jest.fn().mockResolvedValue({ id: 'test-session-id', isCompleted: false }),
      getSession: jest.fn().mockResolvedValue({ id: 'test-session-id', isCompleted: false }),
      markCompleted: jest.fn(),
    } as any;
    identityBootstrap = { bootstrapSuperAdmin: jest.fn().mockResolvedValue('user-id-123') } as any;
    restartScheduler = { scheduleRestart: jest.fn() } as any;
    eventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() } as any;

    service = new InstallationApplicationService({
      envStore,
      dbValidator,
      dbSchemaApplier,
      sessionRepository,
      identityBootstrap,
      restartScheduler,
      eventBus,
    });
  });

  describe('verifySessionId()', () => {
    it('should return true for valid session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'valid-session',
        isCompleted: false
      });

      const result = await service.verifySessionId('valid-session');

      expect(result).toBe(true);
      expect(sessionRepository.getSession).toHaveBeenCalledWith('valid-session');
    });

    it('should return false for non-existent session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce(null);

      const result = await service.verifySessionId('non-existent');

      expect(result).toBe(false);
    });

    it('should return false for completed session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'completed-session',
        isCompleted: true
      });

      const result = await service.verifySessionId('completed-session');

      expect(result).toBe(false);
    });
  });

  describe('generateTempToken()', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes';
      delete process.env.TEMP_TOKEN_SECRET;
    });

    afterEach(() => {
      delete process.env.JWT_SECRET;
      delete process.env.TEMP_TOKEN_SECRET;
    });

    it('should generate a valid JWT token', () => {
      const userId = 'user-123';
      const token = service.generateTempToken(userId);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include userId and type in token payload', () => {
      const userId = 'user-456';
      const token = service.generateTempToken(userId);
      const jwt = require('jsonwebtoken');

      const decoded = jwt.verify(token, getTempTokenSecret());

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('registration');
    });

    it('should use TEMP_TOKEN_SECRET if available', () => {
      process.env.TEMP_TOKEN_SECRET = 'temp-secret-key';

      const token = service.generateTempToken('user-789');
      const jwt = require('jsonwebtoken');

      const decoded = jwt.verify(token, process.env.TEMP_TOKEN_SECRET);

      expect(decoded.userId).toBe('user-789');
    });

    it('should set expiration to 1 hour', () => {
      const token = service.generateTempToken('user-999');
      const jwt = require('jsonwebtoken');

      const decoded = jwt.verify(token, getTempTokenSecret());
      const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600;

      expect(decoded.exp).toBeCloseTo(oneHourFromNow, -1);
    });
  });

  describe('getCurrentDbConfig()', () => {
    it('should throw ERR_FORBIDDEN_SUPER_ADMIN_ONLY for non-super-admin', () => {
      expect(() => service.getCurrentDbConfig('USER')).toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should throw ERR_FORBIDDEN_SUPER_ADMIN_ONLY when role is undefined', () => {
      expect(() => service.getCurrentDbConfig(undefined)).toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should return default config when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;

      const config = service.getCurrentDbConfig('SUPER_ADMIN');

      expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: '',
        database: 'myndbbs',
      });
    });

    it('should parse valid DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@db.example.com:5433/testdb';

      const config = service.getCurrentDbConfig('SUPER_ADMIN');

      expect(config).toEqual({
        host: 'db.example.com',
        port: 5433,
        username: 'testuser',
        password: 'testpass',
        database: 'testdb',
      });
    });

    it('should decode URL-encoded passwords', () => {
      process.env.DATABASE_URL = 'postgresql://user:p%40ss%3Dword@localhost:5432/mydb';

      const config = service.getCurrentDbConfig('SUPER_ADMIN');

      expect(config.password).toBe('p@ss=word');
    });
  });

  describe('getDomainConfig()', () => {
    beforeEach(() => {
      delete process.env.ORIGIN;
      delete process.env.RP_ID;
      delete process.env.TRUST_PROXY;
    });

    it('should throw ERR_FORBIDDEN_SUPER_ADMIN_ONLY for non-super-admin', () => {
      expect(() => service.getDomainConfig('USER')).toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should return default origin when ORIGIN is not set', () => {
      const config = service.getDomainConfig('SUPER_ADMIN');

      expect(config.origin).toBe('http://localhost');
    });

    it('should parse ORIGIN correctly', () => {
      process.env.ORIGIN = 'https://forum.example.com';

      const config = service.getDomainConfig('SUPER_ADMIN');

      expect(config.protocol).toBe('https');
      expect(config.hostname).toBe('forum.example.com');
    });

    it('should set reverseProxyMode based on TRUST_PROXY', () => {
      process.env.TRUST_PROXY = 'true';

      const config = service.getDomainConfig('SUPER_ADMIN');

      expect(config.reverseProxyMode).toBe(true);
    });
  });

  describe('configureDatabase()', () => {
    it('should throw ERR_INVALID_SESSION for non-existent session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce(null);

      await expect(
        service.configureDatabase('invalid-session', 'postgresql://localhost/db')
      ).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should throw ERR_INVALID_SESSION for completed session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'completed',
        isCompleted: true
      });

      await expect(
        service.configureDatabase('completed', 'postgresql://localhost/db')
      ).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should throw ERR_DB_CONNECTION_FAILED when validation fails', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'session-1',
        isCompleted: false
      });
      dbValidator.validate.mockResolvedValueOnce(false);

      await expect(
        service.configureDatabase('session-1', 'postgresql://localhost/db')
      ).rejects.toThrow('ERR_DB_CONNECTION_FAILED');
    });

    it('should update database URL on success', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'session-1',
        isCompleted: false
      });
      dbValidator.validate.mockResolvedValueOnce(true);

      await service.configureDatabase('session-1', 'postgresql://localhost/mydb');

      expect(envStore.updateDatabaseUrl).toHaveBeenCalledWith('postgresql://localhost/mydb');
    });
  });

  describe('applySchema()', () => {
    it('should throw ERR_INVALID_SESSION for non-existent session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce(null);

      await expect(service.applySchema('invalid-session')).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should throw ERR_INVALID_SESSION for completed session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'completed',
        isCompleted: true
      });

      await expect(service.applySchema('completed')).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should call dbSchemaApplier on success', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'session-1',
        isCompleted: false
      });

      await service.applySchema('session-1');

      expect(dbSchemaApplier.applySchema).toHaveBeenCalled();
    });
  });

  describe('finalizeInstallation()', () => {
    it('should throw ERR_INVALID_SESSION for non-existent session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce(null);

      await expect(
        service.finalizeInstallation('invalid', 'admin', 'admin@test.com', 'password123')
      ).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should throw ERR_INVALID_SESSION for completed session', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'completed',
        isCompleted: true
      });

      await expect(
        service.finalizeInstallation('completed', 'admin', 'admin@test.com', 'password123')
      ).rejects.toThrow('ERR_INVALID_SESSION');
    });

    it('should mark session as completed on success', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'session-1',
        isCompleted: false
      });

      await service.finalizeInstallation('session-1', 'admin', 'admin@test.com', 'password123');

      expect(sessionRepository.markCompleted).toHaveBeenCalledWith('session-1');
    });

    it('should write INSTALL_LOCKED=true to env', async () => {
      sessionRepository.getSession.mockResolvedValueOnce({
        id: 'session-1',
        isCompleted: false
      });
      envStore.read.mockResolvedValueOnce('EXISTING=value\n');

      await service.finalizeInstallation('session-1', 'admin', 'admin@test.com', 'password123');

      expect(envStore.write).toHaveBeenCalled();
      const writtenContent = envStore.write.mock.calls[0][0];
      expect(writtenContent).toContain('INSTALL_LOCKED=true');
    });
  });

  describe('updateDomainConfig()', () => {
    it('should throw ERR_FORBIDDEN_SUPER_ADMIN_ONLY for non-super-admin', async () => {
      await expect(
        service.updateDomainConfig({
          protocol: 'https',
          hostname: 'example.com',
          rpId: 'example.com',
        }, 'USER')
      ).rejects.toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');
    });

    it('should normalize protocol to https only when explicitly set', async () => {
      await service.updateDomainConfig({
        protocol: 'https',
        hostname: 'example.com',
        rpId: 'example.com',
      }, 'SUPER_ADMIN');

      expect(envStore.updateDomainConfig).toHaveBeenCalledWith(
        expect.objectContaining({ protocol: 'https' })
      );
    });

    it('should default to http for non-https protocol', async () => {
      await service.updateDomainConfig({
        protocol: 'ftp',
        hostname: 'example.com',
        rpId: 'example.com',
      }, 'SUPER_ADMIN');

      expect(envStore.updateDomainConfig).toHaveBeenCalledWith(
        expect.objectContaining({ protocol: 'http' })
      );
    });

    it('should trim hostname and rpId', async () => {
      await service.updateDomainConfig({
        protocol: 'https',
        hostname: '  example.com  ',
        rpId: '  example.com  ',
      }, 'SUPER_ADMIN');

      expect(envStore.updateDomainConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'example.com',
          rpId: 'example.com',
        })
      );
    });
  });
});
