import { AuthApplicationService } from '../../src/application/identity/AuthApplicationService';
import { AuthChallenge } from '../../src/domain/identity/AuthChallenge';
import { CaptchaChallenge } from '../../src/domain/identity/CaptchaChallenge';
import { Passkey } from '../../src/domain/identity/Passkey';
import { Session } from '../../src/domain/identity/Session';
import { UserStatus } from '@myndbbs/shared';

describe('AuthApplicationService', () => {
  let service: AuthApplicationService;
  let mocks: any;

  beforeEach(() => {
    mocks = {
      captchaChallengeRepository: {
        findById: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      },
      passkeyRepository: {
        findByUserId: jest.fn(),
        findById: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      },
      sessionRepository: {
        findById: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        deleteManyByUserId: jest.fn(),
        deleteExpiredByUserId: jest.fn(),
        findActiveByUserAndFingerprint: jest.fn(),
      },
      authChallengeRepository: {
        findById: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      },
      userRepository: {
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findByUsername: jest.fn(),
        save: jest.fn(),
      },
      roleRepository: {
        findById: jest.fn(),
        findByName: jest.fn(),
      },
      emailRegistrationTicketRepository: {
        save: jest.fn(),
        findByEmail: jest.fn(),
        findByVerificationToken: jest.fn(),
        delete: jest.fn(),
      },
      passwordResetTicketRepository: {
        save: jest.fn(),
        findByResetToken: jest.fn(),
        delete: jest.fn(),
      },
      passwordHasher: {
        hash: jest.fn().mockResolvedValue('hashed-password'),
        verify: jest.fn().mockResolvedValue(true),
      },
      authCache: {
        revokeSession: jest.fn(),
        storeTotpSecret: jest.fn(),
        getTotpSecret: jest.fn(),
        removeTotpSecret: jest.fn(),
      },
      totpPort: {
        generateSecret: jest.fn().mockReturnValue('totp-secret'),
        generateURI: jest.fn().mockReturnValue('otpauth://totp/test'),
        verify: jest.fn().mockReturnValue(true),
      },
      passkeyPort: {
        generateRegistrationOptions: jest.fn().mockResolvedValue({ challenge: 'challenge' }),
        verifyRegistrationResponse: jest.fn().mockResolvedValue({ verified: true, registrationInfo: null }),
        generateAuthenticationOptions: jest.fn().mockResolvedValue({ challenge: 'challenge' }),
        verifyAuthenticationResponse: jest.fn().mockResolvedValue({ verified: true, authenticationInfo: null }),
      },
      tokenPort: {
        sign: jest.fn().mockReturnValue('token'),
        verify: jest.fn().mockReturnValue({ userId: 'user-1' }),
      },
      emailSender: {
        send: jest.fn().mockResolvedValue({ success: true }),
        sendEmail: jest.fn().mockResolvedValue({ success: true }),
      },
      emailTemplateRepository: null,
      unitOfWork: {
        execute: jest.fn((fn: any) => fn()),
      },
    };

    service = new AuthApplicationService({
      captchaChallengeRepository: mocks.captchaChallengeRepository,
      passkeyRepository: mocks.passkeyRepository,
      sessionRepository: mocks.sessionRepository,
      authChallengeRepository: mocks.authChallengeRepository,
      userRepository: mocks.userRepository,
      roleRepository: mocks.roleRepository,
      emailRegistrationTicketRepository: mocks.emailRegistrationTicketRepository,
      passwordResetTicketRepository: mocks.passwordResetTicketRepository,
      passwordHasher: mocks.passwordHasher,
      authCache: mocks.authCache,
      totpPort: mocks.totpPort,
      passkeyPort: mocks.passkeyPort,
      tokenPort: mocks.tokenPort,
      emailSender: mocks.emailSender,
      emailTemplateRepository: mocks.emailTemplateRepository,
      unitOfWork: mocks.unitOfWork,
    });

    jest.clearAllMocks();
  });

  describe('generateCaptcha', () => {
    it('should generate a captcha with random position between 80-240', async () => {
      mocks.captchaChallengeRepository.save.mockResolvedValue();

      const result = await service.generateCaptcha();

      expect(result.id).toBeDefined();
      expect(result.image).toContain('data:image/png;base64,');
      expect(result.image).not.toContain('<path');
      expect(result.image).not.toContain('svg+xml');
      expect(mocks.captchaChallengeRepository.save).toHaveBeenCalled();
    });
  });

  describe('verifyCaptcha', () => {
    it('should verify captcha successfully', async () => {
      const challenge = CaptchaChallenge.reconstitute({
        id: 'captcha-1',
        targetPosition: 150,
        verified: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      mocks.captchaChallengeRepository.findById.mockResolvedValue(challenge);
      jest.spyOn(challenge, 'verifyTrajectory').mockReturnValue();

      await service.verifyCaptcha('captcha-1', [], 1000, 150);

      expect(challenge.verifyTrajectory).toHaveBeenCalled();
      expect(mocks.captchaChallengeRepository.save).toHaveBeenCalledWith(challenge);
    });

    it('should throw error when captcha not found', async () => {
      mocks.captchaChallengeRepository.findById.mockResolvedValue(null);

      await expect(service.verifyCaptcha('captcha-1', [], 1000, 150)).rejects.toThrow('ERR_INVALID_CAPTCHA');
    });

    it('should delete expired captcha and throw error', async () => {
      const challenge = CaptchaChallenge.reconstitute({
        id: 'captcha-1',
        targetPosition: 150,
        verified: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      mocks.captchaChallengeRepository.findById.mockResolvedValue(challenge);
      jest.spyOn(challenge, 'verifyTrajectory').mockImplementation(() => {
        throw new Error('ERR_CAPTCHA_EXPIRED');
      });

      await expect(service.verifyCaptcha('captcha-1', [], 1000, 150)).rejects.toThrow('ERR_CAPTCHA_EXPIRED');
      expect(mocks.captchaChallengeRepository.delete).toHaveBeenCalledWith('captcha-1');
    });
  });

  describe('consumeCaptcha', () => {
    it('should consume valid captcha successfully', async () => {
      const challenge = CaptchaChallenge.reconstitute({
        id: 'captcha-1',
        targetPosition: 150,
        verified: true,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });
      mocks.captchaChallengeRepository.findById.mockResolvedValue(challenge);
      jest.spyOn(challenge, 'validateForConsumption').mockReturnValue();

      const result = await service.consumeCaptcha('captcha-1');

      expect(result).toBe(true);
      expect(mocks.captchaChallengeRepository.delete).toHaveBeenCalledWith('captcha-1');
    });

    it('should return false when captcha not found', async () => {
      mocks.captchaChallengeRepository.findById.mockResolvedValue(null);

      const result = await service.consumeCaptcha('captcha-1');

      expect(result).toBe(false);
    });

    it('should return false when captcha validation fails', async () => {
      const challenge = CaptchaChallenge.reconstitute({
        id: 'captcha-1',
        targetPosition: 150,
        verified: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      mocks.captchaChallengeRepository.findById.mockResolvedValue(challenge);
      jest.spyOn(challenge, 'validateForConsumption').mockImplementation(() => {
        throw new Error('ERR_CAPTCHA_EXPIRED');
      });

      const result = await service.consumeCaptcha('captcha-1');

      expect(result).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      mocks.sessionRepository.deleteExpiredByUserId.mockResolvedValue();
      mocks.sessionRepository.findActiveByUserAndFingerprint.mockResolvedValue(null);
      mocks.sessionRepository.save.mockResolvedValue();

      const result = await service.createSession('user-1', '192.168.1.1', 'user-agent');

      expect(result).toBeInstanceOf(Session);
      expect(result.userId).toBe('user-1');
      expect(mocks.sessionRepository.save).toHaveBeenCalled();
    });

    it('should extend existing session when same fingerprint', async () => {
      const existingSession = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });
      mocks.sessionRepository.deleteExpiredByUserId.mockResolvedValue();
      mocks.sessionRepository.findActiveByUserAndFingerprint.mockResolvedValue(existingSession);
      mocks.sessionRepository.save.mockResolvedValue();

      const result = await service.createSession('user-1', '192.168.1.1', 'user-agent');

      expect(result.id).toBe('session-1');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('revokeSession', () => {
    it('should revoke session without user check', async () => {
      await service.revokeSession('session-1');

      expect(mocks.sessionRepository.delete).toHaveBeenCalledWith('session-1');
      expect(mocks.authCache.revokeSession).toHaveBeenCalledWith('session-1');
    });

    it('should revoke session with user authorization check', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      mocks.sessionRepository.findById.mockResolvedValue(session);

      await service.revokeSession('session-1', 'user-1');

      expect(mocks.sessionRepository.delete).toHaveBeenCalledWith('session-1');
    });

    it('should throw when session does not belong to user', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-2',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      mocks.sessionRepository.findById.mockResolvedValue(session);

      await expect(service.revokeSession('session-1', 'user-1')).rejects.toThrow('ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED');
    });
  });

  describe('validateSession', () => {
    it('should validate valid session', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      const user = { id: 'user-1', status: UserStatus.ACTIVE, roleId: null };
      mocks.sessionRepository.findById.mockResolvedValue(session);
      mocks.userRepository.findById.mockResolvedValue(user);

      const result = await service.validateSession('session-1', 'user-1');

      expect(result.isValid).toBe(true);
      expect(result.user).toBe(user);
    });

    it('should return invalid when session not found', async () => {
      mocks.sessionRepository.findById.mockResolvedValue(null);

      const result = await service.validateSession('session-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_FOUND');
    });

    it('should return invalid when user is banned', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      const user = { id: 'user-1', status: UserStatus.BANNED, roleId: null };
      mocks.sessionRepository.findById.mockResolvedValue(session);
      mocks.userRepository.findById.mockResolvedValue(user);

      const result = await service.validateSession('session-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('USER_BANNED');
    });

    it('should return invalid when user is inactive', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 1000),
        createdAt: new Date(),
      });
      const user = { id: 'user-1', status: UserStatus.INACTIVE, roleId: null };
      mocks.sessionRepository.findById.mockResolvedValue(session);
      mocks.userRepository.findById.mockResolvedValue(user);

      const result = await service.validateSession('session-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('USER_NOT_ACTIVE');
    });

    it('should delete expired session', async () => {
      const session = Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      });
      mocks.sessionRepository.findById.mockResolvedValue(session);

      const result = await service.validateSession('session-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(mocks.sessionRepository.delete).toHaveBeenCalledWith('session-1');
      expect(mocks.authCache.revokeSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should delete all sessions for user', async () => {
      await service.revokeAllUserSessions('user-1');

      expect(mocks.sessionRepository.deleteManyByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('loginUser account status', () => {
    it('rejects backoffice users that have no second factor enrolled', async () => {
      const user = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        password: 'hashed-password',
        status: UserStatus.ACTIVE,
        isTotpEnabled: false,
        roleId: 'role-admin',
        level: 6,
      };
      mocks.userRepository.findByEmail.mockResolvedValue(user);
      mocks.roleRepository.findById.mockResolvedValue({ id: 'role-admin', name: 'ADMIN' });
      mocks.passkeyRepository.findByUserId.mockResolvedValue([]);

      await expect(service.loginUser('admin@example.com', 'password')).rejects.toThrow(
        'ERR_ADMIN_SECOND_FACTOR_REQUIRED',
      );
      expect(mocks.tokenPort.sign).not.toHaveBeenCalled();
    });

    it('requires second-factor completion for backoffice users with an enrolled passkey', async () => {
      const user = {
        id: 'mod-1',
        email: 'mod@example.com',
        username: 'moderator',
        password: 'hashed-password',
        status: UserStatus.ACTIVE,
        isTotpEnabled: false,
        roleId: 'role-mod',
        level: 3,
      };
      mocks.userRepository.findByEmail.mockResolvedValue(user);
      mocks.roleRepository.findById.mockResolvedValue({ id: 'role-mod', name: 'MODERATOR' });
      mocks.passkeyRepository.findByUserId.mockResolvedValue([{ id: 'passkey-1' }]);
      mocks.tokenPort.sign.mockReturnValue('temp-token');

      const result = await service.loginUser('mod@example.com', 'password');

      expect(result.requires2FA).toBe(true);
      expect(result.methods).toEqual(['passkey']);
      expect(result.tempToken).toBe('temp-token');
    });

    it('should reject inactive users', async () => {
      const user = {
        id: 'user-1',
        email: 'inactive@example.com',
        username: 'inactive',
        password: 'hashed-password',
        status: UserStatus.INACTIVE,
      };
      mocks.userRepository.findByEmail.mockResolvedValue(user);

      await expect(service.loginUser('inactive@example.com', 'password')).rejects.toThrow('ERR_ACCOUNT_NOT_ACTIVE');
      expect(mocks.passwordHasher.verify).not.toHaveBeenCalled();
    });

    it('should reject inactive users after passkey authentication verifies', async () => {
      const challenge = AuthChallenge.load({
        id: 'challenge-1',
        challenge: 'challenge',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const passkey = Passkey.create({
        id: 'credential-1',
        publicKey: Buffer.from('public-key'),
        userId: 'user-1',
        webAuthnUserID: 'webauthn-user-1',
        counter: 0n,
        deviceType: 'singleDevice',
        backedUp: false,
        createdAt: new Date(),
      });
      const user = {
        id: 'user-1',
        email: 'inactive@example.com',
        username: 'inactive',
        status: UserStatus.INACTIVE,
        roleId: null,
      };
      mocks.authChallengeRepository.findById.mockResolvedValue(challenge);
      mocks.passkeyRepository.findById.mockResolvedValue(passkey);
      mocks.userRepository.findById.mockResolvedValue(user);
      mocks.passkeyPort.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      await expect(
        service.verifyPasskeyAuthenticationResponse(
          'user-1',
          { id: 'credential-1' },
          'challenge-1',
        ),
      ).rejects.toThrow('ERR_ACCOUNT_NOT_ACTIVE');
      expect(mocks.passkeyRepository.save).toHaveBeenCalledWith(passkey);
    });

    it('should reject inactive users when completing TOTP login', async () => {
      const user = {
        id: 'user-1',
        email: 'inactive@example.com',
        username: 'inactive',
        status: UserStatus.INACTIVE,
        isTotpEnabled: true,
        totpSecret: 'totp-secret',
        roleId: null,
      };
      mocks.userRepository.findById.mockResolvedValue(user);

      await expect(service.verifyTotpLogin('user-1', '123456')).rejects.toThrow('ERR_ACCOUNT_NOT_ACTIVE');
      expect(mocks.totpPort.verify).not.toHaveBeenCalled();
    });

    it('should reject inactive users when refreshing access tokens', async () => {
      const user = {
        id: 'user-1',
        email: 'inactive@example.com',
        username: 'inactive',
        status: UserStatus.INACTIVE,
        roleId: null,
      };
      mocks.tokenPort.verify.mockReturnValue({
        type: 'refresh',
        userId: 'user-1',
        sessionId: 'session-1',
      });
      mocks.sessionRepository.findById.mockResolvedValue(Session.load({
        id: 'session-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'user-agent',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      }));
      mocks.userRepository.findById.mockResolvedValue(user);

      await expect(service.refreshAccessToken('refresh-token')).rejects.toThrow('ERR_ACCOUNT_NOT_ACTIVE');
      expect(mocks.tokenPort.sign).not.toHaveBeenCalled();
    });
  });
});
