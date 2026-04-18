import { AuthApplicationService } from '../src/application/identity/AuthApplicationService';
import { UserStatus } from '@myndbbs/shared';
import { User } from '../src/domain/identity/User';

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let captchaChallengeRepository: any;
  let passkeyRepository: any;
  let sessionRepository: any;
  let authChallengeRepository: any;
  let userRepository: any;
  let roleRepository: any;
  let passwordHasher: any;
  let authCache: any;
  let totpPort: any;
  let passkeyPort: any;
  let tokenPort: any;

  beforeEach(() => {
    captchaChallengeRepository = {};
    passkeyRepository = {
      findByUserId: jest.fn().mockResolvedValue([])
    };
    sessionRepository = {};
    authChallengeRepository = {
      findById: jest.fn(),
      delete: jest.fn()
    };
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      save: jest.fn()
    };
    roleRepository = {
      findById: jest.fn()
    };
    passwordHasher = {
      verify: jest.fn().mockResolvedValue(true)
    };
    authCache = {};
    totpPort = {};
    passkeyPort = {
      verifyRegistrationResponse: jest.fn()
    };
    tokenPort = {};

    service = new AuthApplicationService(
      captchaChallengeRepository,
      passkeyRepository,
      sessionRepository,
      authChallengeRepository,
      userRepository,
      roleRepository,
      passwordHasher,
      authCache,
      totpPort,
      passkeyPort,
      tokenPort
    );
    
    // mock generateTempToken
    service.generateTempToken = jest.fn().mockReturnValue('mock-temp-token');
    service.consumeAuthChallenge = jest.fn().mockResolvedValue({ challenge: 'mock-challenge' });
    service.addPasskey = jest.fn().mockResolvedValue(undefined);
  });

  describe('loginUser', () => {
    it('should return tempToken if requires2FA is true (TOTP enabled)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed-password',
        status: UserStatus.ACTIVE,
        isTotpEnabled: true,
        level: 1,
        roleId: 'role-1'
      };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      roleRepository.findById.mockResolvedValue({ name: 'USER' });

      const result = await service.loginUser('test@test.com', 'password123');

      expect(result.requires2FA).toBe(true);
      expect(result.methods).toContain('totp');
      expect(result.tempToken).toBe('mock-temp-token');
      expect(service.generateTempToken).toHaveBeenCalledWith('user-1', 'login');
    });

    it('should not return tempToken if requires2FA is false', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        username: 'testuser',
        password: 'hashed-password',
        status: UserStatus.ACTIVE,
        isTotpEnabled: false,
        level: 1,
        roleId: 'role-1'
      };
      userRepository.findByEmail.mockResolvedValue(mockUser);
      roleRepository.findById.mockResolvedValue({ name: 'USER' });

      const result = await service.loginUser('test@test.com', 'password123');

      expect(result.requires2FA).toBe(false);
      expect(result.tempToken).toBeUndefined();
    });
  });

  describe('verifyPasskeyRegistration', () => {
    it('should return requiresTotpSetup true if user has no TOTP', async () => {
      const mockUser = User.create({
        id: 'user-1',
        email: 'test@test.com',
        username: 'test',
        password: 'pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });
      userRepository.findById.mockResolvedValue(mockUser);

      passkeyPort.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array(), counter: 0 },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false
        }
      });

      const result = await service.verifyPasskeyRegistration('user-1', {}, 'challenge-1');

      expect(result.verified).toBe(true);
      expect(result.requiresTotpSetup).toBe(true);
      expect(result.message).toContain('Please proceed to setup TOTP');
      expect(userRepository.save).toHaveBeenCalled(); // user level up
    });

    it('should return requiresTotpSetup false if user has TOTP enabled', async () => {
      const mockUser = User.create({
        id: 'user-1',
        email: 'test@test.com',
        username: 'test',
        password: 'pwd',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: true,
        createdAt: new Date()
      });
      userRepository.findById.mockResolvedValue(mockUser);

      passkeyPort.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'cred-1', publicKey: new Uint8Array(), counter: 0 },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false
        }
      });

      const result = await service.verifyPasskeyRegistration('user-1', {}, 'challenge-1');

      expect(result.verified).toBe(true);
      expect(result.requiresTotpSetup).toBe(false);
      expect(result.message).toBe('Passkey registered successfully');
    });
  });
});
