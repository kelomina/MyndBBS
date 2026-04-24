import { AuthApplicationService } from '../src/application/identity/AuthApplicationService';
import { UserStatus } from '@myndbbs/shared';
import { User } from '../src/domain/identity/User';

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let captchaChallengeRepository: { findById?: jest.Mock; delete?: jest.Mock; save?: jest.Mock };
  let passkeyRepository: { findByUserId: jest.Mock; findById?: jest.Mock; save?: jest.Mock; delete?: jest.Mock };
  let sessionRepository: { deleteManyByUserId: jest.Mock };
  let authChallengeRepository: { findById: jest.Mock; delete: jest.Mock };
  let userRepository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    findByUsername: jest.Mock;
    save: jest.Mock;
  };
  let roleRepository: { findById: jest.Mock; findByName: jest.Mock };
  let emailRegistrationTicketRepository: {
    findByVerificationToken: jest.Mock;
    findByEmail: jest.Mock;
    findByUsername: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let passwordResetTicketRepository: {
    findByResetToken: jest.Mock;
    findByEmail: jest.Mock;
    findByUserId: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let passwordHasher: { verify: jest.Mock; hash: jest.Mock };
  let authCache: Record<string, never>;
  let totpPort: Record<string, never>;
  let passkeyPort: { verifyRegistrationResponse: jest.Mock };
  let tokenPort: Record<string, never>;
  let emailSender: { sendEmail: jest.Mock };

  beforeEach(() => {
    captchaChallengeRepository = {};
    passkeyRepository = {
      findByUserId: jest.fn().mockResolvedValue([])
    };
    sessionRepository = {
      deleteManyByUserId: jest.fn().mockResolvedValue(undefined)
    };
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
      findById: jest.fn(),
      findByName: jest.fn()
    };
    emailRegistrationTicketRepository = {
      findByVerificationToken: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      save: jest.fn(),
      delete: jest.fn()
    };
    passwordResetTicketRepository = {
      findByResetToken: jest.fn(),
      findByEmail: jest.fn(),
      findByUserId: jest.fn(),
      save: jest.fn(),
      delete: jest.fn()
    };
    passwordHasher = {
      verify: jest.fn().mockResolvedValue(true),
      hash: jest.fn().mockResolvedValue('hashed-password')
    };
    authCache = {};
    totpPort = {};
    passkeyPort = {
      verifyRegistrationResponse: jest.fn()
    };
    tokenPort = {};
    emailSender = {
      sendEmail: jest.fn().mockResolvedValue(undefined)
    };

    const unitOfWork = {
      execute: jest.fn().mockImplementation((work) => work())
    };

    service = new AuthApplicationService(
      captchaChallengeRepository,
      passkeyRepository,
      sessionRepository,
      authChallengeRepository,
      userRepository,
      roleRepository,
      emailRegistrationTicketRepository,
      passwordResetTicketRepository,
      passwordHasher,
      authCache,
      totpPort,
      passkeyPort,
      tokenPort,
      emailSender,
      unitOfWork
    );
    
    // mock generateTempToken
    service.generateTempToken = jest.fn().mockReturnValue('mock-temp-token');
    service.consumeAuthChallenge = jest.fn().mockResolvedValue({ challenge: 'mock-challenge' });
    service.addPasskey = jest.fn().mockResolvedValue(undefined);
  });

  describe('registerUser', () => {
    it('should persist a pending registration and send a verification email', async () => {
      service.consumeCaptcha = jest.fn().mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByEmail.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByUsername.mockResolvedValue(null);

      const result = await service.registerUser('User@Test.com', 'demo-user', 'Aa!12345', 'captcha-1');

      expect(result.email).toBe('user@test.com');
      expect(emailRegistrationTicketRepository.save).toHaveBeenCalledTimes(1);
      expect(emailSender.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('should delete the pending registration ticket when verification email delivery fails', async () => {
      service.consumeCaptcha = jest.fn().mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByEmail.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByUsername.mockResolvedValue(null);
      emailSender.sendEmail.mockRejectedValue(new Error('ERR_EMAIL_DELIVERY_FAILED'));

      await expect(service.registerUser('User@Test.com', 'demo-user', 'Aa!12345', 'captcha-1'))
        .rejects.toThrow('ERR_EMAIL_DELIVERY_FAILED');

      const savedTicket = emailRegistrationTicketRepository.save.mock.calls[0][0];
      expect(emailRegistrationTicketRepository.delete).toHaveBeenCalledWith(savedTicket.id);
    });

    it('should not send registration email when pending ticket persistence fails', async () => {
      service.consumeCaptcha = jest.fn().mockResolvedValue(true);
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByEmail.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByUsername.mockResolvedValue(null);
      emailRegistrationTicketRepository.save.mockRejectedValue(new Error('REDIS_UNAVAILABLE'));

      await expect(service.registerUser('User@Test.com', 'demo-user', 'Aa!12345', 'captcha-1'))
        .rejects.toThrow('REDIS_UNAVAILABLE');

      expect(emailSender.sendEmail).not.toHaveBeenCalled();
      expect(emailRegistrationTicketRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailRegistration', () => {
    it('should create the user and delete the pending registration ticket', async () => {
      emailRegistrationTicketRepository.findByVerificationToken.mockResolvedValue({
        id: 'ticket-1',
        email: 'user@example.com',
        username: 'demo-user',
        passwordHash: 'hashed-password',
        verificationToken: 'token-1',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        validateForCompletion: jest.fn(),
      });
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      roleRepository.findByName.mockResolvedValue({ id: 'role-1', name: 'USER' });

      const result = await service.verifyEmailRegistration('token-1');

      expect(result.email).toBe('user@example.com');
      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(emailRegistrationTicketRepository.delete).toHaveBeenCalledWith('ticket-1');
    });
  });

  describe('resendEmailRegistration', () => {
    it('should replace the pending registration ticket and send a fresh verification email', async () => {
      const pendingTicket = {
        id: 'ticket-1',
        email: 'user@example.com',
        username: 'demo-user',
        passwordHash: 'hashed-password',
      };

      userRepository.findByEmail.mockResolvedValue(null);
      emailRegistrationTicketRepository.findByEmail
        .mockResolvedValueOnce(pendingTicket)
        .mockResolvedValueOnce(pendingTicket);
      emailRegistrationTicketRepository.findByUsername.mockResolvedValue(pendingTicket);

      const result = await service.resendEmailRegistration('user@example.com');

      expect(result.email).toBe('user@example.com');
      expect(emailRegistrationTicketRepository.delete).toHaveBeenCalledWith('ticket-1');
      expect(emailRegistrationTicketRepository.save).toHaveBeenCalledTimes(1);
      expect(emailSender.sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestPasswordReset', () => {
    it('should persist a reset ticket and send a reset email for an existing user', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'demo-user'
      });
      passwordResetTicketRepository.findByUserId.mockResolvedValue(null);
      passwordResetTicketRepository.findByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset('user@example.com');

      expect(result.email).toBe('user@example.com');
      expect(passwordResetTicketRepository.save).toHaveBeenCalledTimes(1);
      expect(emailSender.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('should delete the reset ticket when reset email delivery fails', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'demo-user'
      });
      passwordResetTicketRepository.findByUserId.mockResolvedValue(null);
      passwordResetTicketRepository.findByEmail.mockResolvedValue(null);
      emailSender.sendEmail.mockRejectedValue(new Error('ERR_EMAIL_DELIVERY_FAILED'));

      await expect(service.requestPasswordReset('user@example.com'))
        .rejects.toThrow('ERR_EMAIL_DELIVERY_FAILED');

      const savedTicket = passwordResetTicketRepository.save.mock.calls[0][0];
      expect(passwordResetTicketRepository.delete).toHaveBeenCalledWith(savedTicket.id);
    });

    it('should not send reset email when reset ticket persistence fails', async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        username: 'demo-user'
      });
      passwordResetTicketRepository.findByUserId.mockResolvedValue(null);
      passwordResetTicketRepository.findByEmail.mockResolvedValue(null);
      passwordResetTicketRepository.save.mockRejectedValue(new Error('REDIS_UNAVAILABLE'));

      await expect(service.requestPasswordReset('user@example.com'))
        .rejects.toThrow('REDIS_UNAVAILABLE');

      expect(emailSender.sendEmail).not.toHaveBeenCalled();
      expect(passwordResetTicketRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('resetPasswordWithToken', () => {
    it('should update the stored password hash, revoke sessions, and delete the reset ticket', async () => {
      const targetUser = User.create({
        id: 'user-1',
        email: 'user@example.com',
        username: 'demo-user',
        password: 'old-hash',
        roleId: 'role-1',
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date()
      });

      passwordResetTicketRepository.findByResetToken.mockResolvedValue({
        id: 'reset-ticket-1',
        userId: 'user-1',
        email: 'user@example.com',
        username: 'demo-user',
        resetToken: 'reset-token',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        validateForReset: jest.fn()
      });
      userRepository.findById.mockResolvedValue(targetUser);

      await service.resetPasswordWithToken('reset-token', 'Aa!12345');

      expect(passwordHasher.hash).toHaveBeenCalledWith('Aa!12345');
      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(sessionRepository.deleteManyByUserId).toHaveBeenCalledWith('user-1');
      expect(passwordResetTicketRepository.delete).toHaveBeenCalledWith('reset-ticket-1');
    });
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
