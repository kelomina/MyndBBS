import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { IAuthChallengeRepository } from '../../domain/identity/IAuthChallengeRepository';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { CaptchaChallenge } from '../../domain/identity/CaptchaChallenge';
import { Passkey } from '../../domain/identity/Passkey';
import { Session } from '../../domain/identity/Session';
import { AuthChallenge } from '../../domain/identity/AuthChallenge';
import { User } from '../../domain/identity/User';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { prisma } from '../../db';

/**
 * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController, SudoController]
 * Callees: [ICaptchaChallengeRepository, IPasskeyRepository, ISessionRepository, IAuthChallengeRepository, IUserRepository]
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
    private userRepository: IUserRepository
  ) {}

  // --- Captcha Orchestration ---

  /**
   * Callers: [CaptchaController.generate]
   * Callees: [CaptchaChallenge.create, ICaptchaChallengeRepository.save]
   * Description: Generates a new captcha challenge with a random target position and a 5-minute expiration.
   * Keywords: generate, captcha, challenge, command, identity
   */
  public async generateCaptcha(): Promise<CaptchaChallenge> {
    // Random position between 80 and 240
    const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80;
    
    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    await this.captchaChallengeRepository.save(challenge);
    return challenge;
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
   * Callees: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption, ICaptchaChallengeRepository.delete, IUserRepository.findByEmail, IUserRepository.findByUsername, argon2.hash, User.create, IUserRepository.save]
   * Description: Orchestrates user registration. Consumes the verified captcha, hashes the password, and creates the user domain entity.
   * Keywords: register, user, captcha, consume, hash, command, identity
   */
  public async registerUser(email: string, username: string, password: string, captchaId: string): Promise<any> {
    const isCaptchaValid = await this.consumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA');
    }

    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) throw new Error('ERR_EMAIL_ALREADY_EXISTS');

    const existingUsername = await this.userRepository.findByUsername(username);
    if (existingUsername) throw new Error('ERR_USERNAME_ALREADY_EXISTS');

    const hashedPassword = await argon2.hash(password);
    const defaultRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    
    const user = User.create({
      id: uuidv4(),
      email,
      username,
      password: hashedPassword,
      roleId: defaultRole?.id || null,
      level: 1,
      status: 'ACTIVE',
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
  public async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
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
   * Callees: [IPasskeyRepository.findById, IPasskeyRepository.delete]
   * Description: Deletes a specific passkey and returns the userId it belonged to (useful for cascading level downgrades).
   * Keywords: delete, passkey, webauthn, command, identity
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
