import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { IAuthChallengeRepository } from '../../domain/identity/IAuthChallengeRepository';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { ISessionCache } from './ports/ISessionCache';
import { CaptchaChallenge } from '../../domain/identity/CaptchaChallenge';
import { Passkey } from '../../domain/identity/Passkey';
import { Session } from '../../domain/identity/Session';
import { AuthChallenge } from '../../domain/identity/AuthChallenge';
import { User } from '../../domain/identity/User';
import { Password } from '../../domain/identity/Password';
import { UserStatus } from '@myndbbs/shared';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { randomUUID as uuidv4 } from 'crypto';
import { APP_NAME } from '@myndbbs/shared';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';
import { IPasskeyPort } from '../../domain/identity/ports/IPasskeyPort';
import { ITokenPort } from '../../domain/identity/ports/ITokenPort';

import { SvgCaptchaGenerator } from './SvgCaptchaGenerator';

const rpName = APP_NAME;
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

/**
 * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController, SudoController]
 * Callees: [ICaptchaChallengeRepository, IPasskeyRepository, ISessionRepository, IAuthChallengeRepository, IUserRepository, IPasswordHasher]
 * Description: The Application Service for the Identity Domain. Orchestrates registration, session management, auth challenges, captcha verification, and passkey management.
 * Keywords: identity, auth, service, application, orchestration, register, session, challenge, captcha, passkey
 */
export class AuthApplicationService {
  /**
   * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController, SudoController]
   * Callees: []
   * Description: Initializes the service with repository implementations via Dependency Injection.
   * Keywords: constructor, inject, repository, service, identity, auth
   */
  constructor(
    private captchaChallengeRepository: ICaptchaChallengeRepository,
    private passkeyRepository: IPasskeyRepository,
    private sessionRepository: ISessionRepository,
    private authChallengeRepository: IAuthChallengeRepository,
    private userRepository: IUserRepository,
    private roleRepository: IRoleRepository,
    private passwordHasher: IPasswordHasher,
    private authCache: ISessionCache,
    private totpPort: ITotpPort,
    private passkeyPort: IPasskeyPort,
    private tokenPort: ITokenPort
  ) {}

  // --- Captcha Orchestration ---

  /**
   * Callers: [CaptchaController.generate]
   * Callees: [CaptchaChallenge.create, ICaptchaChallengeRepository.save, SvgCaptchaGenerator.generateImage]
   * Description: Generates a new captcha challenge with a random target position, a 5-minute expiration, and returns the SVG image.
   * Keywords: generate, captcha, challenge, command, identity
   */
  public async generateCaptcha(): Promise<{ id: string, image: string }> {
    // Random position between 80 and 240
    const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80;
    
    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    await this.captchaChallengeRepository.save(challenge);
    
    const image = SvgCaptchaGenerator.generateImage(targetPosition);
    return { id: challenge.id, image };
  }

  /**
   * Callers: [CaptchaController.verify]
   * Callees: [ICaptchaChallengeRepository.findById, ICaptchaChallengeRepository.delete, CaptchaChallenge.verifyTrajectory, ICaptchaChallengeRepository.save]
   * Description: Verifies a captcha challenge based on the user's drag trajectory. Deletes expired challenges.
   * Keywords: verify, captcha, trajectory, command, identity
   */
  public async verifyCaptcha(id: string, dragPath: any[], totalDragTime: number, finalPosition: number): Promise<void> {
    const challenge = await this.captchaChallengeRepository.findById(id);
    if (!challenge) {
      throw new Error('ERR_INVALID_CAPTCHA');
    }

    try {
      challenge.verifyTrajectory(dragPath, totalDragTime, finalPosition);
      await this.captchaChallengeRepository.save(challenge);
    } catch (error: any) {
      if (error.message === 'ERR_CAPTCHA_EXPIRED') {
        await this.captchaChallengeRepository.delete(id);
      }
      throw error;
    }
  }

  /**
   * Callers: [RegisterController.registerUser, PostController.createPost, PostController.createComment]
   * Callees: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption, ICaptchaChallengeRepository.delete]
   * Description: Validates that a captcha challenge is verified and not expired, then deletes it to prevent reuse.
   * Keywords: verify, consume, captcha, challenge, identity
   */
  public async consumeCaptcha(captchaId: string): Promise<boolean> {
    const challenge = await this.captchaChallengeRepository.findById(captchaId);
    if (!challenge) {
      return false;
    }
    try {
      challenge.validateForConsumption();
      await this.captchaChallengeRepository.delete(captchaId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Callers: [RegisterController.registerUser]
   * Callees: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption, ICaptchaChallengeRepository.delete, IUserRepository.findByEmail, IUserRepository.findByUsername, IPasswordHasher.hash, User.create, IUserRepository.save]
   * Description: Orchestrates user registration. Consumes the verified captcha, hashes the password, and creates the user domain entity.
   * Keywords: register, user, captcha, consume, hash, command, identity
   */
  public async registerUser(email: string, username: string, password: string, captchaId: string): Promise<any> {
    Password.validatePolicy(password);

    const isCaptchaValid = await this.consumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA');
    }

    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) throw new Error('ERR_EMAIL_ALREADY_EXISTS');

    const existingUsername = await this.userRepository.findByUsername(username);
    if (existingUsername) throw new Error('ERR_USERNAME_ALREADY_EXISTS');

    const hashedPassword = await this.passwordHasher.hash(password);
    const defaultRole = await this.roleRepository.findByName('USER');
    
    const user = User.create({
      id: uuidv4(),
      email,
      username,
      password: hashedPassword,
      roleId: defaultRole?.id || null,
      level: 1,
      status: UserStatus.ACTIVE,
      isPasskeyMandatory: false,
      totpSecret: null,
      isTotpEnabled: false,
      createdAt: new Date()
    });

    await this.userRepository.save(user);

    // Return DTO format expected by controller
    return { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      level: user.level, 
      role: { name: defaultRole?.name || null } 
    };
  }

  public async changePasswordWithVerification(
    userId: string,
    currentPassword?: string,
    totpCode?: string,
    newPassword?: string,
    newEmail?: string,
    newUsername?: string
  ): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    if (newPassword) {
      Password.validatePolicy(newPassword);
    }

    if (newEmail || newPassword) {
      if (!currentPassword && !totpCode) {
        throw new Error('ERR_CURRENT_PASSWORD_OR_TOTP_CODE_REQUIRED_FOR_SENSITIVE_CHANGES');
      }
      if (currentPassword && user.password) {
        const isValid = await this.passwordHasher.verify(user.password, currentPassword);
        if (!isValid) throw new Error('ERR_INVALID_CURRENT_PASSWORD');
      }
      if (totpCode && user.totpSecret) {
        const isValid = this.totpPort.verify(user.totpSecret, totpCode);
        if (!isValid) throw new Error('ERR_INVALID_TOTP_CODE');
      }
    }

    if (newEmail && newEmail !== user.email) {
      const existing = await this.userRepository.findByEmail(newEmail);
      if (existing) throw new Error('ERR_EMAIL_ALREADY_IN_USE');
    }
    if (newUsername && newUsername !== user.username) {
      const existing = await this.userRepository.findByUsername(newUsername);
      if (existing) throw new Error('ERR_USERNAME_ALREADY_IN_USE');
    }

    let hashedPassword;
    if (newPassword) {
      hashedPassword = await this.passwordHasher.hash(newPassword);
    }

    user.updateProfile(newEmail, newUsername, hashedPassword);
    await this.userRepository.save(user);

    return { id: user.id, email: user.email, username: user.username, roleId: user.roleId };
  }

  // --- Auth Orchestration ---

  public async loginUser(emailOrUsername: string, password: string): Promise<{
    user: any;
    requires2FA: boolean;
    methods: string[];
    tempToken?: string;
  }> {
    let user = await this.userRepository.findByEmail(emailOrUsername);
    if (!user) {
      user = await this.userRepository.findByUsername(emailOrUsername);
    }

    if (!user || !user.password) {
      throw new Error('ERR_INVALID_CREDENTIALS');
    }

    if (user.status === UserStatus.BANNED) {
      throw new Error('ERR_ACCOUNT_IS_BANNED');
    }

    const isValid = await this.passwordHasher.verify(user.password, password);
    if (!isValid) {
      throw new Error('ERR_INVALID_CREDENTIALS');
    }

    const methods: string[] = [];
    if (user.isTotpEnabled) methods.push('totp');
    
    const passkeys = await this.passkeyRepository.findByUserId(user.id);
    if (passkeys && passkeys.length > 0) methods.push('passkey');

    let roleName = null;
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId);
      if (role) roleName = role.name;
    }

    const requires2FA = methods.length > 0;
    let tempToken;
    if (requires2FA) {
      tempToken = this.generateTempToken(user.id, 'login');
    }

    const result: any = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: { name: roleName },
        isTotpEnabled: user.isTotpEnabled,
        level: user.level
      },
      requires2FA,
      methods
    };

    if (tempToken) {
      result.tempToken = tempToken;
    }

    return result;
  }

  public async generatePasskeyRegistrationOptions(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    const userPasskeys = await this.passkeyRepository.findByUserId(userId);

    const excludeCredentials = userPasskeys.map(passkey => ({
      id: passkey.id,
      transports: ['internal'] as any,
    }));

    const options = await this.passkeyPort.generateRegistrationOptions(user, excludeCredentials);

    const authChallenge = await this.generateAuthChallenge(options.challenge);

    return { ...options, challengeId: authChallenge.id };
  }

  /**
   * Callers: [AuthController]
   * Callees: [IUserRepository.findById, IPasskeyRepository.save, User.changeLevel, IUserRepository.save]
   * Description: Verifies the passkey registration response. Automatically promotes a level 1 user to level 2 upon successful passkey registration.
   * Keywords: passkey, registration, verify, level, promote, identity
   */
  public async verifyPasskeyRegistration(userId: string, response: any, challengeId: string): Promise<{ verified: boolean, requiresTotpSetup?: boolean, message?: string, user?: any }> {
    if (!challengeId) {
      throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED');
    }

    const expectedChallenge = await this.consumeAuthChallenge(challengeId);

    const verification = await this.passkeyPort.verifyRegistrationResponse(
      response,
      expectedChallenge.challenge,
      origin,
      rpID
    );

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      await this.addPasskey(
        userId,
        credentialID,
        Buffer.from(credentialPublicKey),
        userId,
        BigInt(counter),
        credentialDeviceType,
        credentialBackedUp
      );

      const user = await this.userRepository.findById(userId);
      if (user && user.level === 1) {
        user.changeLevel(2, true);
        await this.userRepository.save(user);
      }

      let roleName = null;
      if (user?.roleId) {
        const role = await this.roleRepository.findById(user.roleId);
        if (role) roleName = role.name;
      }

      const returnedUser = user ? {
        id: user.id,
        email: user.email,
        username: user.username,
        role: { name: roleName },
        isTotpEnabled: user.isTotpEnabled,
        level: user.level
      } : undefined;

      const requiresTotpSetup = user ? !user.isTotpEnabled : false;
      const message = requiresTotpSetup 
        ? 'Passkey registered successfully. Please proceed to setup TOTP.'
        : 'Passkey registered successfully';

      return { verified: true, requiresTotpSetup, message, user: returnedUser };
    } else {
      throw new Error('ERR_VERIFICATION_FAILED');
    }
  }

  // --- Session Orchestration ---

  /**
   * Callers: [AuthController.login, AuthController.verifyPasskeyAuthentication, RegisterController.registerUser]
   * Callees: [Session.create, ISessionRepository.save]
   * Description: Creates a new user session.
   * Keywords: create, session, command, identity
   */
  public async createSession(userId: string, ipAddress: string | null, userAgent: string | null, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): Promise<Session> {
    const session = Session.create({
      id: uuidv4(),
      userId,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + expiresInMs),
      createdAt: new Date()
    });

    await this.sessionRepository.save(session);
    return session;
  }

  /**
   * Callers: [AuthController.logout, UserController.revokeSession]
   * Callees: [ISessionRepository.delete]
   * Description: Revokes a specific user session.
   * Keywords: revoke, session, command, identity
   */
  public async revokeSession(sessionId: string, expectedUserId?: string): Promise<void> {
    if (expectedUserId) {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session || session.userId !== expectedUserId) {
        throw new Error('ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED');
      }
    }
    await this.sessionRepository.delete(sessionId);
    await this.authCache.revokeSession(sessionId);
  }

  // --- TOTP Setup Orchestration ---

  public async generateTotp(userId: string, email: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = this.totpPort.generateSecret();
    const otpauth = this.totpPort.generateURI(APP_NAME, email, secret);
    
    // We need QRCode.toDataURL to generate the image. Since QRCode is infrastructure, we should probably return the otpauth URI and let the adapter or controller handle it, but the instructions say "completely to authApplicationService".
    // Wait, the instruction says remove QRCode from auth.ts. So we must use QRCode here, or pass it to a port.
    // The instruction didn't add QRCode to ITotpPort. So we have to import QRCode in AuthApplicationService.
    const QRCode = require('qrcode');
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    
    await this.storeTotpSecret(userId, secret, 300); // 5 minutes
    
    return { secret, qrCodeUrl };
  }

  public async storeTotpSecret(userId: string, secret: string, ttlSeconds: number = 300): Promise<void> {
    await this.authCache.storeTotpSecret(userId, secret, ttlSeconds);
  }

  public async verifyTotpRegistration(userId: string, code: string): Promise<string> {
    const pendingSecret = await this.getTotpSecret(userId);
    if (!pendingSecret) {
      throw new Error('ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED');
    }

    const isValid = this.totpPort.verify(pendingSecret, code);
    if (!isValid) {
      throw new Error('ERR_INVALID_TOTP_CODE');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');
    
    if (user.isTotpEnabled) {
      throw new Error('ERR_TOTP_ALREADY_ENABLED');
    }
    
    user.enableTotp(pendingSecret);
    await this.userRepository.save(user);

    await this.removeTotpSecret(userId);

    return pendingSecret;
  }

  public async getTotpSecret(userId: string): Promise<string | null> {
    return await this.authCache.getTotpSecret(userId);
  }

  public async removeTotpSecret(userId: string): Promise<void> {
    await this.authCache.removeTotpSecret(userId);
  }

  /**
   * Callers: [UserController.revokeAllSessions, AdminController.kickUser, AdminController.updateUserRole, AdminController.updateUserLevel, AdminController.banUser, RegisterController.registerUser]
   * Callees: [ISessionRepository.deleteManyByUserId]
   * Description: Revokes all sessions for a specific user.
   * Keywords: revoke, all, sessions, command, identity
   */
  public async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.deleteManyByUserId(userId);
  }

  /**
   * Callers: [requireAuth]
   * Callees: [ISessionRepository.findById, IUserRepository.findById, IRoleRepository.findById]
   * Description: Validates the session and retrieves the user context for refresh logic.
   * Keywords: validate, session, refresh, identity
   */
  public async validateSession(sessionId: string, userId: string): Promise<{
    isValid: boolean;
    reason?: 'SESSION_NOT_FOUND' | 'USER_NOT_FOUND' | 'USER_BANNED';
    user?: User;
    roleName?: string;
  }> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return { isValid: false, reason: 'SESSION_NOT_FOUND' };
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      return { isValid: false, reason: 'USER_NOT_FOUND' };
    }
    if (user.status === UserStatus.BANNED) {
      return { isValid: false, reason: 'USER_BANNED' };
    }

    let roleName = 'USER';
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId);
      if (role) {
        roleName = role.name;
      }
    }

    return { isValid: true, user, roleName };
  }

  // --- AuthChallenge Orchestration ---

  /**
   * Callers: [AuthController.getPasskeyOptions, SudoController.getSudoPasskeyOptions]
   * Callees: [AuthChallenge.create, IAuthChallengeRepository.save]
   * Description: Generates a new authentication challenge (e.g., for WebAuthn).
   * Keywords: generate, authchallenge, command, identity
   */
  public async generateAuthChallenge(challengeString: string, expiresInMs: number = 5 * 60 * 1000): Promise<AuthChallenge> {
    const challenge = AuthChallenge.create({
      id: uuidv4(),
      challenge: challengeString,
      expiresAt: new Date(Date.now() + expiresInMs)
    });

    await this.authChallengeRepository.save(challenge);
    return challenge;
  }

  /**
   * Callers: [AuthController.verifyPasskeyAuthentication, AuthController.verifyPasskeyRegistration, SudoController.verifySudo]
   * Callees: [IAuthChallengeRepository.findById, AuthChallenge.validateForConsumption, IAuthChallengeRepository.delete]
   * Description: Validates that an auth challenge is not expired, then consumes (deletes) it.
   * Keywords: verify, consume, authchallenge, identity
   */
  public async consumeAuthChallenge(challengeId: string): Promise<AuthChallenge> {
    const challenge = await this.authChallengeRepository.findById(challengeId);
    if (!challenge) {
      throw new Error('ERR_CHALLENGE_NOT_FOUND');
    }
    
    challenge.validateForConsumption();
    await this.authChallengeRepository.delete(challengeId);
    
    return challenge;
  }

  // --- Passkey Orchestration ---

  public async generatePasskeyAuthenticationOptions(userId?: string): Promise<any> {
    let allowCredentials: any[] = [];
    
    if (userId) {
      const userPasskeys = await this.passkeyRepository.findByUserId(userId);
      allowCredentials = userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'] as any,
      }));
    }

    const options = await this.passkeyPort.generateAuthenticationOptions(allowCredentials);
    const authChallenge = await this.generateAuthChallenge(options.challenge);
    
    return { ...options, challengeId: authChallenge.id };
  }

  public async processGeneratePasskeyAuthenticationOptions(tempToken: string | undefined): Promise<any> {
    if (tempToken) {
      const user = await this.getUserFromTempToken(tempToken, 'login');
      if (!user) {
        throw new Error('ERR_UNAUTHORIZED');
      }
      return await this.generatePasskeyAuthenticationOptions(user.id);
    }
    return await this.generatePasskeyAuthenticationOptions();
  }

  public async processPasskeyAuthentication(response: any, challengeId: string | undefined, tempToken: string | undefined): Promise<any> {
    let userId: string | undefined;

    if (tempToken) {
      const user = await this.getUserFromTempToken(tempToken, 'login');
      if (!user) {
        throw new Error('ERR_UNAUTHORIZED');
      }
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED');
      }
      userId = user.id;
    } else {
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED_FOR_PASSWORDLESS_LOGIN');
      }
    }

    return await this.verifyPasskeyAuthenticationResponse(userId, response, challengeId);
  }

  public async verifyPasskeyAuthenticationResponse(userId: string | undefined, response: any, challengeId: string): Promise<any> {
    if (!challengeId) {
      throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED');
    }
    
    const expectedChallenge = await this.consumeAuthChallenge(challengeId);
    
    const passkey = await this.passkeyRepository.findById(response.id);
    if (!passkey) {
      throw new Error('ERR_PASSKEY_NOT_FOUND');
    }
    
    if (userId && passkey.userId !== userId) {
      throw new Error('ERR_PASSKEY_DOES_NOT_BELONG_TO_USER');
    }
    
    const credential = {
      id: passkey.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
    };
    
    const verification = await this.passkeyPort.verifyAuthenticationResponse(
      response,
      expectedChallenge.challenge,
      origin,
      rpID,
      credential
    );
    
    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;
      await this.updatePasskeyCounter(passkey.id, BigInt(newCounter));
      
      const authenticatedUserId = passkey.userId;
      const user = await this.userRepository.findById(authenticatedUserId);
      if (!user) throw new Error('ERR_USER_NOT_FOUND');
      
      let roleName = null;
      if (user.roleId) {
        const role = await this.roleRepository.findById(user.roleId);
        if (role) roleName = role.name;
      }
      
      return {
        verified: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: { name: roleName }
        }
      };
    } else {
      throw new Error('ERR_VERIFICATION_FAILED');
    }
  }

  public async verifyTotpLogin(userId: string, code: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isTotpEnabled || !user.totpSecret) {
      throw new Error('ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED');
    }
    
    const isValid = this.totpPort.verify(user.totpSecret, code);
    if (!isValid) {
      throw new Error('ERR_INVALID_TOTP_CODE');
    }
    
    let roleName = null;
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId);
      if (role) roleName = role.name;
    }
    
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: { name: roleName }
    };
  }

  public async getUserFromTempToken(tempToken: string | undefined, expectedType: 'registration' | 'login' = 'registration'): Promise<any> {
    if (!tempToken) return null;
    try {
      const decoded = this.verifyTempToken(tempToken);
      if (decoded.type !== expectedType) return null;
      
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) return null;

      let roleName = null;
      if (user.roleId) {
        const role = await this.roleRepository.findById(user.roleId);
        if (role) roleName = role.name;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: { name: roleName },
        isTotpEnabled: user.isTotpEnabled,
        totpSecret: user.totpSecret
      };
    } catch (err) {
      return null;
    }
  }

  public verifyTempToken(token: string): any {
    return this.tokenPort.verify(token, process.env.JWT_SECRET as string);
  }

  public generateTempToken(userId: string, type: 'registration' | 'login'): string {
    return this.tokenPort.sign(
      { userId, type },
      process.env.JWT_SECRET as string,
      '1h'
    );
  }

  public verifyRefreshToken(token: string): any {
    return this.tokenPort.verify(token, process.env.JWT_REFRESH_SECRET as string);
  }

  public generateAccessToken(userId: string, roleName: string | null, sessionId: string): string {
    return this.tokenPort.sign(
      { userId, role: roleName, sessionId },
      process.env.JWT_SECRET as string,
      '15m'
    );
  }

  public async refreshAccessToken(refreshTokenStr: string): Promise<{ accessToken: string }> {
    const decoded = this.verifyRefreshToken(refreshTokenStr);
    
    if (decoded.sessionId) {
      const session = await this.sessionRepository.findById(decoded.sessionId);
      if (!session) {
        throw new Error('ERR_SESSION_REVOKED_OR_INVALID');
      }
    }

    const user = await this.userRepository.findById(decoded.userId);
    if (!user) {
      throw new Error('ERR_INVALID_REFRESH_TOKEN');
    }

    if (user.status === UserStatus.BANNED) {
      throw new Error('ERR_ACCOUNT_IS_BANNED');
    }

    let roleName = null;
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId);
      if (role) roleName = role.name;
    }

    const accessToken = this.generateAccessToken(user.id, roleName, decoded.sessionId);
    return { accessToken };
  }

  public async logout(accessToken?: string, refreshToken?: string): Promise<void> {
    let sessionId = null;
    
    if (accessToken) {
      try {
        const decoded = this.tokenPort.verify(accessToken, process.env.JWT_SECRET as string, { ignoreExpiration: true });
        if (decoded.sessionId) sessionId = decoded.sessionId;
      } catch (e) {
        // ignore invalid token errors
      }
    }
    
    if (!sessionId && refreshToken) {
      try {
        const decoded = this.tokenPort.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string, { ignoreExpiration: true });
        if (decoded.sessionId) sessionId = decoded.sessionId;
      } catch (e) {
        // ignore
      }
    }

    if (sessionId) {
      await this.revokeSession(sessionId);
    }
  }

  public async finalizeAuth(user: any, ip: string | null, userAgent: string | null): Promise<{ accessToken: string, refreshToken: string }> {
    const session = await this.createSession(
      user.id,
      ip,
      userAgent,
      7 * 24 * 60 * 60 * 1000 // 7 days
    );

    const roleName = user.role?.name || user.role || null;

    const accessToken = this.tokenPort.sign(
      { userId: user.id, role: roleName, sessionId: session.id },
      process.env.JWT_SECRET as string,
      '15m'
    );
    
    const refreshToken = this.tokenPort.sign(
      { userId: user.id, role: roleName, sessionId: session.id },
      process.env.JWT_REFRESH_SECRET as string,
      '7d'
    );

    return { accessToken, refreshToken };
  }

  /**
   * Callers: [UserController.verifyPasskey, AuthController.verifyPasskeyRegistration]
   * Callees: [Passkey.create, IPasskeyRepository.save]
   * Description: Registers a new WebAuthn Passkey for a user.
   * Keywords: add, passkey, webauthn, credential, command, identity
   */
  public async addPasskey(
    userId: string,
    credentialId: string,
    credentialPublicKey: Buffer,
    webAuthnUserID: string,
    counter: bigint,
    deviceType: string,
    backedUp: boolean
  ): Promise<void> {
    const passkey = Passkey.create({
      id: credentialId,
      userId,
      publicKey: credentialPublicKey,
      webAuthnUserID,
      counter,
      deviceType,
      backedUp,
      createdAt: new Date()
    });
    await this.passkeyRepository.save(passkey);
  }

  /**
   * Callers: [UserController.deletePasskey]
   * Callees: [IPasskeyRepository.findById, IPasskeyRepository.delete, IPasskeyRepository.findByUserId, IUserRepository.findById, User.changeLevel, IUserRepository.save]
   * Description: Deletes a specific passkey. If the user has no remaining passkeys, automatically downgrades them to level 1.
   * Keywords: delete, passkey, webauthn, command, identity, level, downgrade
   */
  public async deletePasskey(id: string, requesterUserId: string): Promise<string> {
    const passkey = await this.passkeyRepository.findById(id);
    if (!passkey) {
      throw new Error('ERR_PASSKEY_NOT_FOUND');
    }
    if (passkey.userId !== requesterUserId) {
      throw new Error('ERR_FORBIDDEN_NOT_YOUR_PASSKEY');
    }
    
    await this.passkeyRepository.delete(id);
    
    const remainingPasskeys = await this.passkeyRepository.findByUserId(requesterUserId);
    if (remainingPasskeys.length === 0) {
      const user = await this.userRepository.findById(requesterUserId);
      if (user) {
        user.changeLevel(1, false);
        await this.userRepository.save(user);
      }
    }
    
    return passkey.userId;
  }

  /**
   * Callers: [AuthController.verifyPasskeyAuthentication]
   * Callees: [IPasskeyRepository.findById, Passkey.updateCounter, IPasskeyRepository.save]
   * Description: Verifies a passkey authentication attempt by updating its counter to prevent replay attacks.
   * Keywords: verify, authenticate, passkey, counter, command, identity
   */
  public async updatePasskeyCounter(credentialId: string, newCounter: bigint): Promise<string> {
    const passkey = await this.passkeyRepository.findById(credentialId);
    if (!passkey) {
      throw new Error('ERR_PASSKEY_NOT_FOUND');
    }
    
    passkey.updateCounter(newCounter);
    await this.passkeyRepository.save(passkey);
    
    return passkey.userId;
  }
}
