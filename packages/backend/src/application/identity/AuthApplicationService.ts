import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { CaptchaChallenge } from '../../domain/identity/CaptchaChallenge';
import { Passkey } from '../../domain/identity/Passkey';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { prisma } from '../../db'; // Still needed for User creation since User isn't fully DDD'd yet

/**
 * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController]
 * Callees: [ICaptchaChallengeRepository, IPasskeyRepository, argon2.hash, prisma.user.create]
 * Description: The Application Service for the Identity Domain. Orchestrates registration, captcha verification, and passkey management.
 * Keywords: identity, auth, service, application, orchestration, register, captcha, passkey
 */
export class AuthApplicationService {
  /**
   * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController]
   * Callees: []
   * Description: Initializes the service with repository implementations via Dependency Injection.
   * Keywords: constructor, inject, repository, service, identity, auth
   */
  constructor(
    private captchaChallengeRepository: ICaptchaChallengeRepository,
    private passkeyRepository: IPasskeyRepository
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

  // --- Registration Orchestration ---

  /**
   * Callers: [RegisterController.registerUser]
   * Callees: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption, ICaptchaChallengeRepository.delete, prisma.user.findUnique, argon2.hash, prisma.user.create]
   * Description: Orchestrates user registration. Consumes the verified captcha, hashes the password, and creates the user.
   * Keywords: register, user, captcha, consume, hash, command, identity
   */
  public async registerUser(email: string, username: string, password: string, captchaId: string): Promise<any> {
    // 1. Verify and consume Captcha
    const challenge = await this.captchaChallengeRepository.findById(captchaId);
    if (!challenge) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA');
    }

    try {
      challenge.validateForConsumption();
      // Consume it so it can't be reused
      await this.captchaChallengeRepository.delete(captchaId);
    } catch (error) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA');
    }

    // 2. Check uniqueness (this could be pushed to a Domain Service or handled by Prisma constraints, but explicit checks yield better errors)
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });
    if (existingUser) {
      if (existingUser.email === email) throw new Error('ERR_EMAIL_ALREADY_EXISTS');
      if (existingUser.username === username) throw new Error('ERR_USERNAME_ALREADY_EXISTS');
    }

    // 3. Hash password
    const hashedPassword = await argon2.hash(password);

    // 4. Create User (Active Record style for now since User aggregate isn't fully DDD'd)
    const defaultRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        roleId: defaultRole?.id,
        level: 1,
      },
      select: { id: true, username: true, email: true, level: true, role: { select: { name: true } } }
    });

    return user;
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
