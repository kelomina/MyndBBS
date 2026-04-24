import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository';
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository';
import { ISessionRepository } from '../../domain/identity/ISessionRepository';
import { IAuthChallengeRepository } from '../../domain/identity/IAuthChallengeRepository';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IEmailRegistrationTicketRepository } from '../../domain/identity/IEmailRegistrationTicketRepository';
import { IPasswordResetTicketRepository } from '../../domain/identity/IPasswordResetTicketRepository';
import { ISessionCache } from './ports/ISessionCache';
import { CaptchaChallenge } from '../../domain/identity/CaptchaChallenge';
import { Passkey } from '../../domain/identity/Passkey';
import { Session } from '../../domain/identity/Session';
import { AuthChallenge } from '../../domain/identity/AuthChallenge';
import { User } from '../../domain/identity/User';
import { Password } from '../../domain/identity/Password';
import { EmailAddress } from '../../domain/identity/EmailAddress';
import { EmailRegistrationTicket } from '../../domain/identity/EmailRegistrationTicket';
import { PasswordResetTicket } from '../../domain/identity/PasswordResetTicket';
import { UserStatus } from '@myndbbs/shared';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { randomBytes, randomUUID as uuidv4 } from 'crypto';
import { APP_NAME } from '@myndbbs/shared';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';
import { IPasskeyPort } from '../../domain/identity/ports/IPasskeyPort';
import { ITokenPort } from '../../domain/identity/ports/ITokenPort';
import { IEmailSender, type SendEmailCommand } from '../../domain/identity/ports/IEmailSender';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';

import { SvgCaptchaGenerator } from './SvgCaptchaGenerator';

const rpName = APP_NAME;
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

export interface RegisteredUserResult {
  id: string;
  username: string;
  email: string;
  level: number;
  role: { name: string | null };
}

export interface RegistrationRequestAcceptedResult {
  email: string;
  expiresAt: Date;
}

export interface PasswordResetRequestAcceptedResult {
  email: string;
  expiresAt: Date;
}

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
    private emailRegistrationTicketRepository: IEmailRegistrationTicketRepository,
    private passwordResetTicketRepository: IPasswordResetTicketRepository,
    private passwordHasher: IPasswordHasher,
    private authCache: ISessionCache,
    private totpPort: ITotpPort,
    private passkeyPort: IPasskeyPort,
    private tokenPort: ITokenPort,
    private emailSender: IEmailSender,
    private unitOfWork: IUnitOfWork
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
   * Callees: [EmailAddress.create, Password.validatePolicy, AuthApplicationService.consumeCaptcha, AuthApplicationService.assertRegistrationIdentityAvailable, IPasswordHasher.hash, AuthApplicationService.deleteReusablePendingRegistration, EmailRegistrationTicket.create, IEmailRegistrationTicketRepository.save, AuthApplicationService.sendRegistrationVerificationEmail]
   * Description: Starts the email-registration flow by validating the submitted identity, persisting a pending registration ticket, and sending a verification email instead of creating the user immediately.
   * 描述：发起邮箱注册流程，先校验提交的身份信息并保存待验证注册票据，然后发送验证邮件，而不是立即创建用户。
   * Variables: `email` and `username` are normalized identity inputs; `password` is validated then hashed; `captchaId` identifies the verified anti-bot challenge.
   * 变量：`email` 与 `username` 是规范化后的身份输入；`password` 会先校验再哈希；`captchaId` 指向通过验证的人机校验挑战。
   * Integration: Keep the existing `/auth/register` entry point wired to this method so the frontend can remain on the same endpoint while the server behavior changes to email verification.
   * 接入方式：保持 `/auth/register` 入口继续调用本方法，让前端沿用原接口路径，同时把服务端行为切换为邮箱验证。
   * Error Handling: Throws explicit error codes for invalid captcha, duplicate identity claims, invalid email/password, or email delivery failures.
   * 错误处理：当验证码无效、身份冲突、邮箱/密码非法或邮件投递失败时抛出明确错误码。
   * Keywords: email signup, registration start, verification mail, pending ticket, captcha consume, 邮箱注册, 注册发起, 验证邮件, 待验证票据, 验证码消费
   */
  public async registerUser(email: string, username: string, password: string, captchaId: string): Promise<RegistrationRequestAcceptedResult> {
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value;
    const normalizedUsername = username.trim();

    Password.validatePolicy(password);

    const isCaptchaValid = await this.consumeCaptcha(captchaId);
    if (!isCaptchaValid) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA');
    }

    await this.assertRegistrationIdentityAvailable(normalizedEmail, normalizedUsername);

    const hashedPassword = await this.passwordHasher.hash(password);
    await this.deleteReusablePendingRegistration(normalizedEmail, normalizedUsername);
    const ticket = this.createEmailRegistrationTicket(
      normalizedEmail,
      normalizedUsername,
      hashedPassword
    );

    await this.emailRegistrationTicketRepository.save(ticket);

    try {
      await this.sendRegistrationVerificationEmail(ticket);
    } catch (error) {
      await this.emailRegistrationTicketRepository.delete(ticket.id);
      throw error;
    }

    return {
      email: ticket.email,
      expiresAt: ticket.expiresAt,
    };
  }

  /**
   * Callers: [RegisterController.resendEmailRegistration]
   * Callees: [EmailAddress.create, IUserRepository.findByEmail, IEmailRegistrationTicketRepository.findByEmail, AuthApplicationService.deleteReusablePendingRegistration, AuthApplicationService.createEmailRegistrationTicket, IEmailRegistrationTicketRepository.save, AuthApplicationService.sendRegistrationVerificationEmail]
   * Description: Replaces an existing pending registration ticket for the same mailbox and sends a fresh verification email so expired or lost links can be recovered safely.
   * 描述：为同一邮箱替换已有的待注册票据并发送新的验证邮件，使过期或丢失的注册链接能够被安全恢复。
   * Variables: `email` is the mailbox whose pending registration should be recovered; `pendingTicket` is the retained registration snapshot used to mint the replacement link.
   * 变量：`email` 是需要恢复待注册状态的邮箱；`pendingTicket` 是用于生成新链接的已保留待注册快照。
   * Integration: Expose this through a dedicated resend endpoint and call it from the registration pending or expired UI branches.
   * 接入方式：通过独立的补发接口暴露本方法，并在注册页的待验证或过期分支中调用。
   * Error Handling: Throws `ERR_EMAIL_ALREADY_EXISTS` if the account was already created, and `ERR_EMAIL_REGISTRATION_NOT_FOUND` when no retained pending registration can be recovered.
   * 错误处理：当账号已经创建时抛出 `ERR_EMAIL_ALREADY_EXISTS`；当无法恢复任何待注册记录时抛出 `ERR_EMAIL_REGISTRATION_NOT_FOUND`。
   * Keywords: resend verification, replace ticket, mailbox recovery, expired link, registration retry, 补发验证邮件, 替换票据, 邮箱恢复, 过期链接, 注册重试
   */
  public async resendEmailRegistration(email: string): Promise<RegistrationRequestAcceptedResult> {
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value;
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS');
    }

    const pendingTicket = await this.emailRegistrationTicketRepository.findByEmail(normalizedEmail);
    if (!pendingTicket) {
      throw new Error('ERR_EMAIL_REGISTRATION_NOT_FOUND');
    }

    await this.deleteReusablePendingRegistration(pendingTicket.email, pendingTicket.username);
    const replacementTicket = this.createEmailRegistrationTicket(
      pendingTicket.email,
      pendingTicket.username,
      pendingTicket.passwordHash
    );

    await this.emailRegistrationTicketRepository.save(replacementTicket);

    try {
      await this.sendRegistrationVerificationEmail(replacementTicket);
    } catch (error) {
      await this.emailRegistrationTicketRepository.delete(replacementTicket.id);
      throw error;
    }

    return {
      email: replacementTicket.email,
      expiresAt: replacementTicket.expiresAt,
    };
  }

  /**
   * Callers: [RegisterController.verifyEmailRegistration]
   * Callees: [IEmailRegistrationTicketRepository.findByVerificationToken, EmailRegistrationTicket.validateForCompletion, IUnitOfWork.execute, IUserRepository.findByEmail, IUserRepository.findByUsername, IRoleRepository.findByName, User.create, IUserRepository.save, AuthApplicationService.toRegisteredUserResult, IEmailRegistrationTicketRepository.delete]
   * Description: Completes the email-registration flow by consuming the verification token, creating the real user aggregate transactionally, and returning the user payload required for the existing 2FA onboarding path.
   * 描述：完成邮箱注册流程，消费验证令牌，在事务内创建真实用户聚合，并返回现有 2FA 引导流程所需的用户载荷。
   * Variables: `verificationToken` is the opaque mailbox-proof token emitted in the verification link; `ticket` is the persisted pending registration aggregate.
   * 变量：`verificationToken` 是验证链接里携带的不透明邮箱证明令牌；`ticket` 是持久化的待注册聚合。
   * Integration: Controllers should call this method before generating the existing registration temp-token cookie so the rest of the 2FA flow remains unchanged.
   * 接入方式：控制器应先调用本方法，再生成现有的注册 temp-token Cookie，使后续 2FA 流程保持不变。
   * Error Handling: Throws `ERR_EMAIL_REGISTRATION_NOT_FOUND`, `ERR_EMAIL_REGISTRATION_EXPIRED`, or the usual duplicate-identity error codes if the token is invalid or the claimed identity was taken meanwhile.
   * 错误处理：当令牌无效、已过期，或其声明的身份在此期间被占用时，抛出 `ERR_EMAIL_REGISTRATION_NOT_FOUND`、`ERR_EMAIL_REGISTRATION_EXPIRED` 或常规重复身份错误码。
   * Keywords: verify registration, consume email token, finalize signup, user creation, 2fa handoff, 验证注册, 消费邮箱令牌, 完成注册, 创建用户, 交接2FA
   */
  public async verifyEmailRegistration(verificationToken: string): Promise<RegisteredUserResult> {
    const ticket = await this.emailRegistrationTicketRepository.findByVerificationToken(verificationToken.trim());
    if (!ticket) {
      throw new Error('ERR_EMAIL_REGISTRATION_NOT_FOUND');
    }

    ticket.validateForCompletion();

    const registeredUser = await this.unitOfWork.execute(async () => {
      const existingEmailUser = await this.userRepository.findByEmail(ticket.email);
      const existingUsernameUser = await this.userRepository.findByUsername(ticket.username);

      if (existingEmailUser || existingUsernameUser) {
        if (
          existingEmailUser &&
          existingUsernameUser &&
          existingEmailUser.id === existingUsernameUser.id &&
          existingEmailUser.email === ticket.email &&
          existingEmailUser.username === ticket.username
        ) {
          const existingRole = existingEmailUser.roleId
            ? await this.roleRepository.findById(existingEmailUser.roleId)
            : null;

          return this.toRegisteredUserResult(existingEmailUser, existingRole?.name ?? null);
        }

        if (existingEmailUser) {
          throw new Error('ERR_EMAIL_ALREADY_EXISTS');
        }

        throw new Error('ERR_USERNAME_ALREADY_EXISTS');
      }

      const defaultRole = await this.roleRepository.findByName('USER');
      const user = User.create({
        id: uuidv4(),
        email: ticket.email,
        username: ticket.username,
        password: ticket.passwordHash,
        roleId: defaultRole?.id ?? null,
        level: 1,
        status: UserStatus.ACTIVE,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        createdAt: new Date(),
      });

      await this.userRepository.save(user);

      return this.toRegisteredUserResult(user, defaultRole?.name ?? null);
    });

    await this.emailRegistrationTicketRepository.delete(ticket.id);
    return registeredUser;
  }

  /**
   * Callers: [RegisterController.requestPasswordReset]
   * Callees: [EmailAddress.create, IUserRepository.findByEmail, AuthApplicationService.deleteReusablePasswordResetTicket, AuthApplicationService.createPasswordResetTicket, IPasswordResetTicketRepository.save, AuthApplicationService.sendPasswordResetEmail]
   * Description: Starts the forgot-password flow by creating a retained reset ticket for the mailbox owner and sending the reset link via email.
   * 描述：发起忘记密码流程，为邮箱所有者创建可保留的重置票据，并通过邮件发送重置链接。
   * Variables: `email` is the mailbox submitted by the user; `user` is the resolved target account when one exists.
   * 变量：`email` 是用户提交的邮箱；`user` 是解析出的目标账号（如果存在）。
   * Integration: Expose this behind a public forgot-password endpoint and keep the response shape generic so the frontend can always show the same confirmation state.
   * 接入方式：通过公开的忘记密码接口暴露本方法，并保持响应形状通用，让前端始终展示一致的确认状态。
   * Error Handling: Invalid email syntax still throws `ERR_INVALID_EMAIL`; nonexistent users return an accepted-looking response without sending email to reduce account enumeration.
   * 错误处理：邮箱语法非法时仍抛出 `ERR_INVALID_EMAIL`；不存在的用户会返回“已受理”样式的响应而不发送邮件，以降低账户枚举风险。
   * Keywords: forgot password, reset request, mailbox confirmation, anti enumeration, reset mail, 忘记密码, 重置请求, 邮箱确认, 防枚举, 重置邮件
   */
  public async requestPasswordReset(email: string): Promise<PasswordResetRequestAcceptedResult> {
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value;
    const fallbackExpiresAt = new Date(Date.now() + this.getPasswordResetTtlMinutes() * 60 * 1000);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      return {
        email: normalizedEmail,
        expiresAt: fallbackExpiresAt,
      };
    }

    await this.deleteReusablePasswordResetTicket(user.id, user.email);
    const ticket = this.createPasswordResetTicket(user.id, user.email, user.username);

    await this.passwordResetTicketRepository.save(ticket);

    try {
      await this.sendPasswordResetEmail(ticket);
    } catch (error) {
      await this.passwordResetTicketRepository.delete(ticket.id);
      throw error;
    }

    return {
      email: ticket.email,
      expiresAt: ticket.expiresAt,
    };
  }

  /**
   * Callers: [RegisterController.resetPasswordWithToken]
   * Callees: [Password.validatePolicy, IPasswordResetTicketRepository.findByResetToken, PasswordResetTicket.validateForReset, IUnitOfWork.execute, IUserRepository.findById, IPasswordHasher.hash, User.updateProfile, IUserRepository.save, ISessionRepository.deleteManyByUserId, IPasswordResetTicketRepository.delete]
   * Description: Completes the forgot-password flow by consuming the reset ticket, replacing the stored password hash transactionally, and revoking existing sessions.
   * 描述：完成忘记密码流程，消费重置票据，在事务内替换存储密码哈希，并撤销现有会话。
   * Variables: `resetToken` is the opaque mailbox reset token; `newPassword` is the validated replacement password chosen by the user.
   * 变量：`resetToken` 是邮箱重置链接中的不透明令牌；`newPassword` 是用户选择并通过校验的新密码。
   * Integration: Call this from the public reset-password endpoint after the frontend submits the link token and the new password.
   * 接入方式：当前端提交链接令牌和新密码后，从公开的重置密码接口调用本方法。
   * Error Handling: Throws `ERR_PASSWORD_RESET_NOT_FOUND`, `ERR_PASSWORD_RESET_EXPIRED`, `ERR_INVALID_PASSWORD`, or `ERR_USER_NOT_FOUND` when the reset request is invalid or stale.
   * 错误处理：当重置请求无效或陈旧时，抛出 `ERR_PASSWORD_RESET_NOT_FOUND`、`ERR_PASSWORD_RESET_EXPIRED`、`ERR_INVALID_PASSWORD` 或 `ERR_USER_NOT_FOUND`。
   * Keywords: reset password, consume reset token, replace hash, revoke sessions, mailbox recovery, 重置密码, 消费重置令牌, 替换哈希, 撤销会话, 邮箱恢复
   */
  public async resetPasswordWithToken(resetToken: string, newPassword: string): Promise<void> {
    Password.validatePolicy(newPassword);

    const ticket = await this.passwordResetTicketRepository.findByResetToken(resetToken.trim());
    if (!ticket) {
      throw new Error('ERR_PASSWORD_RESET_NOT_FOUND');
    }

    ticket.validateForReset();

    await this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(ticket.userId);
      if (!user || user.email !== ticket.email) {
        throw new Error('ERR_USER_NOT_FOUND');
      }

      const hashedPassword = await this.passwordHasher.hash(newPassword);
      user.updateProfile(undefined, undefined, hashedPassword);
      await this.userRepository.save(user);
      await this.sessionRepository.deleteManyByUserId(user.id);
    });

    await this.passwordResetTicketRepository.delete(ticket.id);
  }

  /**
   * Callers: [UserController.changePassword]
   * Callees: [IUnitOfWork.execute, IUserRepository.findById, Password.validatePolicy, IPasswordHasher.verify, ITotpPort.verify, IUserRepository.findByEmail, IUserRepository.findByUsername, IPasswordHasher.hash, User.updateProfile, IUserRepository.save]
   * Description: Changes user password, email, or username with verification of current password or TOTP in a transaction.
   * Keywords: change, password, email, username, verify, totp, user, identity
   */
  public async changePasswordWithVerification(
    userId: string,
    currentPassword?: string,
    totpCode?: string,
    newPassword?: string,
    newEmail?: string,
    newUsername?: string
  ): Promise<any> {
    return this.unitOfWork.execute(async () => {
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
    });
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
   * Callees: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyPort.verifyRegistrationResponse, AuthApplicationService.addPasskey, IUserRepository.findById, User.changeLevel, IUserRepository.save]
   * Description: Verifies the passkey registration response in a transaction. Automatically promotes a level 1 user to level 2 upon successful passkey registration.
   * Keywords: passkey, registration, verify, level, promote, identity
   */
  public async verifyPasskeyRegistration(userId: string, response: any, challengeId: string): Promise<{ verified: boolean, requiresTotpSetup?: boolean, message?: string, user?: any }> {
    return this.unitOfWork.execute(async () => {
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
    });
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

  /**
   * Callers: [UserController.verifyTotpSetup]
   * Callees: [IUnitOfWork.execute, AuthApplicationService.getTotpSecret, ITotpPort.verify, IUserRepository.findById, User.enableTotp, IUserRepository.save, AuthApplicationService.removeTotpSecret]
   * Description: Verifies TOTP registration and enables it for the user in a transaction.
   * Keywords: totp, verify, registration, identity
   */
  public async verifyTotpRegistration(userId: string, code: string): Promise<string> {
    return this.unitOfWork.execute(async () => {
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
    });
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

  /**
   * Callers: [AuthApplicationService.processPasskeyAuthentication]
   * Callees: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyRepository.findById, IPasskeyPort.verifyAuthenticationResponse, AuthApplicationService.updatePasskeyCounter, IUserRepository.findById]
   * Description: Verifies the passkey authentication response in a transaction and returns user data.
   * Keywords: passkey, verify, authenticate, identity
   */
  public async verifyPasskeyAuthenticationResponse(userId: string | undefined, response: any, challengeId: string): Promise<any> {
    return this.unitOfWork.execute(async () => {
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
    });
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

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [IUserRepository.findByEmail, IUserRepository.findByUsername, IEmailRegistrationTicketRepository.findByEmail, IEmailRegistrationTicketRepository.findByUsername]
   * Description: Verifies that the email and username are not already claimed by an existing user or by a different pending registration ticket.
   * 描述：校验邮箱和用户名未被现有用户或其他待验证注册票据占用。
   * Variables: `email` is the normalized mailbox identifier; `username` is the normalized forum handle being claimed.
   * 变量：`email` 是规范化邮箱标识；`username` 是待占用的规范化论坛用户名。
   * Integration: Execute this before creating a new pending registration ticket so collisions are rejected early.
   * 接入方式：在创建新的待验证注册票据前先执行本方法，尽早拒绝冲突。
   * Error Handling: Throws the same duplicate identity errors used elsewhere in the auth flow to keep API behavior consistent.
   * 错误处理：沿用认证流程已有的重复身份错误码，保持 API 行为一致。
   * Keywords: identity availability, email uniqueness, username uniqueness, pending collision, registration guard, 身份可用性, 邮箱唯一性, 用户名唯一性, 待注册冲突, 注册保护
   */
  private async assertRegistrationIdentityAvailable(email: string, username: string): Promise<void> {
    const existingEmailUser = await this.userRepository.findByEmail(email);
    if (existingEmailUser) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS');
    }

    const existingUsernameUser = await this.userRepository.findByUsername(username);
    if (existingUsernameUser) {
      throw new Error('ERR_USERNAME_ALREADY_EXISTS');
    }

    const pendingByEmail = await this.emailRegistrationTicketRepository.findByEmail(email);
    if (pendingByEmail && pendingByEmail.username !== username) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS');
    }

    const pendingByUsername = await this.emailRegistrationTicketRepository.findByUsername(username);
    if (pendingByUsername && pendingByUsername.email !== email) {
      throw new Error('ERR_USERNAME_ALREADY_EXISTS');
    }
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [IEmailRegistrationTicketRepository.findByEmail, IEmailRegistrationTicketRepository.findByUsername, IEmailRegistrationTicketRepository.delete]
   * Description: Removes a previous pending registration when the same email and username pair retries registration, so the latest verification link invalidates the older one.
   * 描述：当同一邮箱和用户名组合重复提交注册时，删除旧的待验证注册票据，使最新验证链接自动作废旧链接。
   * Variables: `email` and `username` identify the reusable pending registration that should be replaced.
   * 变量：`email` 和 `username` 用于定位可被替换的旧待注册票据。
   * Integration: Call this immediately before persisting the replacement ticket.
   * 接入方式：在保存替换后的新票据之前立即调用。
   * Error Handling: The method is intentionally idempotent; missing pending tickets are ignored.
   * 错误处理：本方法刻意保持幂等；未找到旧票据时会直接忽略。
   * Keywords: replace pending registration, invalidate old link, retry signup, ticket cleanup, idempotent replace, 替换待注册, 旧链接失效, 重试注册, 票据清理, 幂等替换
   */
  private async deleteReusablePendingRegistration(email: string, username: string): Promise<void> {
    const pendingByEmail = await this.emailRegistrationTicketRepository.findByEmail(email);
    if (pendingByEmail && pendingByEmail.username === username) {
      await this.emailRegistrationTicketRepository.delete(pendingByEmail.id);
    }

    const pendingByUsername = await this.emailRegistrationTicketRepository.findByUsername(username);
    if (
      pendingByUsername &&
      pendingByUsername.email === email &&
      pendingByUsername.id !== pendingByEmail?.id
    ) {
      await this.emailRegistrationTicketRepository.delete(pendingByUsername.id);
    }
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset]
   * Callees: [IPasswordResetTicketRepository.findByUserId, IPasswordResetTicketRepository.findByEmail, IPasswordResetTicketRepository.delete]
   * Description: Removes an older pending password-reset ticket for the same user and mailbox so the latest reset link invalidates the previous one.
   * 描述：删除同一用户和邮箱的旧密码重置票据，使最新重置链接自动作废旧链接。
   * Variables: `userId` identifies the target user; `email` is the mailbox index that should resolve to the same retained ticket.
   * 变量：`userId` 标识目标用户；`email` 是应解析到同一保留票据的邮箱索引。
   * Integration: Call this immediately before persisting the replacement reset ticket.
   * 接入方式：在保存替换后的新重置票据之前立即调用。
   * Error Handling: The method is intentionally idempotent; missing pending tickets are ignored.
   * 错误处理：本方法刻意保持幂等；未找到旧票据时会直接忽略。
   * Keywords: replace reset ticket, invalidate old reset link, password recovery retry, ticket cleanup, idempotent replace, 替换重置票据, 旧重置链接失效, 密码找回重试, 票据清理, 幂等替换
   */
  private async deleteReusablePasswordResetTicket(userId: string, email: string): Promise<void> {
    const pendingByUserId = await this.passwordResetTicketRepository.findByUserId(userId);
    if (pendingByUserId) {
      await this.passwordResetTicketRepository.delete(pendingByUserId.id);
    }

    const pendingByEmail = await this.passwordResetTicketRepository.findByEmail(email);
    if (pendingByEmail && pendingByEmail.id !== pendingByUserId?.id) {
      await this.passwordResetTicketRepository.delete(pendingByEmail.id);
    }
  }

  /**
   * Callers: [AuthApplicationService.registerUser, AuthApplicationService.resendEmailRegistration]
   * Callees: [AuthApplicationService.getEmailRegistrationTtlMinutes, EmailRegistrationTicket.create, randomBytes]
   * Description: Creates a new pending email-registration ticket with a fresh verification token and expiry window.
   * 描述：创建新的待邮箱注册票据，并分配新的验证令牌与过期窗口。
   * Variables: `email`, `username`, and `passwordHash` are the retained registration fields reused when a new link must be issued.
   * 变量：`email`、`username` 和 `passwordHash` 是在需要签发新链接时复用的待注册字段。
   * Integration: Use this helper for both first-time registration and resend flows so ticket minting stays consistent.
   * 接入方式：在首次注册和补发流程中统一使用本方法，保持票据签发规则一致。
   * Error Handling: Delegates field and expiry validation to `EmailRegistrationTicket.create`.
   * 错误处理：把字段与过期校验委托给 `EmailRegistrationTicket.create`。
   * Keywords: create registration ticket, verification token, signup minting, resend reuse, expiry window, 创建注册票据, 验证令牌, 注册签发, 补发复用, 过期窗口
   */
  private createEmailRegistrationTicket(email: string, username: string, passwordHash: string): EmailRegistrationTicket {
    const expiresAt = new Date(Date.now() + this.getEmailRegistrationTtlMinutes() * 60 * 1000);
    return EmailRegistrationTicket.create({
      id: uuidv4(),
      email,
      username,
      passwordHash,
      verificationToken: randomBytes(32).toString('hex'),
      expiresAt,
      createdAt: new Date(),
    });
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset]
   * Callees: [AuthApplicationService.getPasswordResetTtlMinutes, PasswordResetTicket.create, randomBytes]
   * Description: Creates a new pending password-reset ticket with a fresh reset token and expiry window.
   * 描述：创建新的待密码重置票据，并分配新的重置令牌与过期窗口。
   * Variables: `userId`, `email`, and `username` identify the account whose password will be replaced after mailbox verification.
   * 变量：`userId`、`email` 和 `username` 标识在邮箱验证后要被修改密码的账号。
   * Integration: Use this helper whenever the forgot-password flow needs to mint a replacement ticket.
   * 接入方式：当忘记密码流程需要签发新的替换票据时调用本方法。
   * Error Handling: Delegates field and expiry validation to `PasswordResetTicket.create`.
   * 错误处理：把字段与过期校验委托给 `PasswordResetTicket.create`。
   * Keywords: create reset ticket, reset token, password recovery, mailbox link, expiry window, 创建重置票据, 重置令牌, 密码找回, 邮箱链接, 过期窗口
   */
  private createPasswordResetTicket(userId: string, email: string, username: string): PasswordResetTicket {
    const expiresAt = new Date(Date.now() + this.getPasswordResetTtlMinutes() * 60 * 1000);
    return PasswordResetTicket.create({
      id: uuidv4(),
      userId,
      email,
      username,
      resetToken: randomBytes(32).toString('hex'),
      expiresAt,
      createdAt: new Date(),
    });
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [parseInt]
   * Description: Reads the email-verification TTL from configuration and falls back to 30 minutes when the value is absent or invalid.
   * 描述：从配置读取邮箱验证有效期；当配置缺失或非法时，回退为 30 分钟。
   * Variables: `configuredTtlMinutes` is the raw environment value, and `parsedTtlMinutes` is the validated numeric result.
   * 变量：`configuredTtlMinutes` 是原始环境变量值，`parsedTtlMinutes` 是校验后的数字结果。
   * Integration: Use this helper wherever the registration flow needs a consistent verification expiry window.
   * 接入方式：在注册流程所有需要统一验证过期时间的地方都通过本方法取值。
   * Error Handling: Invalid numbers do not throw; the method falls back to a safe default to keep registration operational.
   * 错误处理：非法数字不会抛错；本方法会回退到安全默认值，保持注册流程可用。
   * Keywords: verification ttl, config fallback, mail expiry, registration timeout, environment parsing, 验证有效期, 配置回退, 邮件过期, 注册超时, 环境解析
   */
  private getEmailRegistrationTtlMinutes(): number {
    const configuredTtlMinutes = process.env.EMAIL_VERIFICATION_TTL_MINUTES;
    const parsedTtlMinutes = configuredTtlMinutes ? Number.parseInt(configuredTtlMinutes, 10) : Number.NaN;

    if (!Number.isFinite(parsedTtlMinutes) || parsedTtlMinutes <= 0) {
      return 30;
    }

    return parsedTtlMinutes;
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset, AuthApplicationService.createPasswordResetTicket]
   * Callees: [parseInt]
   * Description: Reads the password-reset TTL from configuration and falls back to 30 minutes when the value is absent or invalid.
   * 描述：从配置读取密码重置有效期；当配置缺失或非法时，回退为 30 分钟。
   * Variables: `configuredTtlMinutes` is the raw environment value, and `parsedTtlMinutes` is the validated numeric result.
   * 变量：`configuredTtlMinutes` 是原始环境变量值，`parsedTtlMinutes` 是校验后的数字结果。
   * Integration: Use this helper wherever the forgot-password flow needs a consistent reset expiry window.
   * 接入方式：在忘记密码流程所有需要统一重置过期时间的地方都通过本方法取值。
   * Error Handling: Invalid numbers do not throw; the method falls back to a safe default to keep password recovery operational.
   * 错误处理：非法数字不会抛错；本方法会回退到安全默认值，保持密码找回流程可用。
   * Keywords: password reset ttl, config fallback, reset expiry, recovery timeout, environment parsing, 密码重置有效期, 配置回退, 重置过期, 找回超时, 环境解析
   */
  private getPasswordResetTtlMinutes(): number {
    const configuredTtlMinutes = process.env.PASSWORD_RESET_TTL_MINUTES;
    const parsedTtlMinutes = configuredTtlMinutes ? Number.parseInt(configuredTtlMinutes, 10) : Number.NaN;

    if (!Number.isFinite(parsedTtlMinutes) || parsedTtlMinutes <= 0) {
      return 30;
    }

    return parsedTtlMinutes;
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [AuthApplicationService.buildRegistrationVerificationEmailCommand, IEmailSender.sendEmail]
   * Description: Renders and delivers the verification email for a pending registration ticket.
   * 描述：为待注册票据渲染并发送验证邮件。
   * Variables: `ticket` contains the pending registration state used to populate the verification link and human-readable expiry information.
   * 变量：`ticket` 包含待注册状态，用于填充验证链接和可读的过期说明。
   * Integration: Keep mail rendering centralized here so subject and body stay consistent across future resend flows.
   * 接入方式：把邮件渲染集中在此，便于未来补发流程复用统一主题与正文。
   * Error Handling: Propagates adapter exceptions so the caller can delete the just-created pending ticket and report a delivery failure.
   * 错误处理：向上传递适配器异常，让调用方可以删除刚创建的待验证票据并报告投递失败。
   * Keywords: send verification mail, mail rendering, pending ticket email, signup notification, identity communication, 发送验证邮件, 邮件渲染, 待注册通知, 注册提醒, 身份通信
   */
  private async sendRegistrationVerificationEmail(ticket: EmailRegistrationTicket): Promise<void> {
    const command = this.buildRegistrationVerificationEmailCommand(ticket);
    await this.emailSender.sendEmail(command);
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset]
   * Callees: [AuthApplicationService.buildPasswordResetEmailCommand, IEmailSender.sendEmail]
   * Description: Renders and delivers the password-reset email for a pending reset ticket.
   * 描述：为待处理的密码重置票据渲染并发送重置邮件。
   * Variables: `ticket` contains the pending reset state used to populate the reset link and human-readable expiry information.
   * 变量：`ticket` 包含待重置状态，用于填充重置链接和可读的过期说明。
   * Integration: Keep mail rendering centralized here so subject and body stay consistent across future resend or account-recovery flows.
   * 接入方式：把邮件渲染集中在此，便于未来补发或其他账户恢复流程复用统一文案。
   * Error Handling: Propagates adapter exceptions so the caller can delete the just-created pending ticket and report a delivery failure.
   * 错误处理：向上传递适配器异常，让调用方可以删除刚创建的待重置票据并报告投递失败。
   * Keywords: send reset mail, mail rendering, pending reset email, password recovery notification, identity communication, 发送重置邮件, 邮件渲染, 待重置通知, 密码找回提醒, 身份通信
   */
  private async sendPasswordResetEmail(ticket: PasswordResetTicket): Promise<void> {
    const command = this.buildPasswordResetEmailCommand(ticket);
    await this.emailSender.sendEmail(command);
  }

  /**
   * Callers: [AuthApplicationService.sendRegistrationVerificationEmail]
   * Callees: [AuthApplicationService.buildEmailRegistrationVerificationLink]
   * Description: Builds the subject and both email bodies for the registration verification mail.
   * 描述：构建注册验证邮件的主题、纯文本正文与 HTML 正文。
   * Variables: `ticket` contributes the recipient identity, verification link, and expiration minutes shown to the user.
   * 变量：`ticket` 提供收件身份、验证链接以及展示给用户的过期分钟数。
   * Integration: Update this method if the product later adds branded templates or resend-specific copy.
   * 接入方式：如果后续产品增加品牌化模板或补发邮件文案，应修改本方法。
   * Error Handling: This renderer is pure and does not throw under normal aggregate invariants.
   * 错误处理：在聚合不变式成立的前提下，本渲染方法是纯函数，通常不会抛错。
   * Keywords: email template, verification subject, html body, text body, signup mail copy, 邮件模板, 验证主题, HTML正文, 文本正文, 注册邮件文案
   */
  private buildRegistrationVerificationEmailCommand(ticket: EmailRegistrationTicket): SendEmailCommand {
    const verificationLink = this.buildEmailRegistrationVerificationLink(ticket.verificationToken, ticket.email);
    const expiresInMinutes = Math.max(1, Math.ceil((ticket.expiresAt.getTime() - Date.now()) / 60000));
    const subject = `${APP_NAME} email verification`;
    const textBody = [
      `Hello ${ticket.username},`,
      '',
      `Please verify your ${APP_NAME} registration by opening the link below:`,
      verificationLink,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      `If you did not start this registration, you can safely ignore this email.`,
    ].join('\n');

    const htmlBody = [
      `<p>Hello ${ticket.username},</p>`,
      `<p>Please verify your <strong>${APP_NAME}</strong> registration by opening the link below:</p>`,
      `<p><a href="${verificationLink}">${verificationLink}</a></p>`,
      `<p>This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>`,
      `<p>If you did not start this registration, you can safely ignore this email.</p>`,
    ].join('');

    return {
      to: ticket.email,
      subject,
      textBody,
      htmlBody,
    };
  }

  /**
   * Callers: [AuthApplicationService.sendPasswordResetEmail]
   * Callees: [AuthApplicationService.buildPasswordResetLink]
   * Description: Builds the subject and both email bodies for the password-reset mail.
   * 描述：构建密码重置邮件的主题、纯文本正文与 HTML 正文。
   * Variables: `ticket` contributes the recipient identity, reset link, and expiration minutes shown to the user.
   * 变量：`ticket` 提供收件身份、重置链接以及展示给用户的过期分钟数。
   * Integration: Update this method if the product later adds branded templates or additional recovery instructions.
   * 接入方式：如果后续产品加入品牌化模板或更多恢复指引，应修改本方法。
   * Error Handling: This renderer is pure and does not throw under normal aggregate invariants.
   * 错误处理：在聚合不变式成立的前提下，本渲染方法是纯函数，通常不会抛错。
   * Keywords: reset email template, recovery subject, html body, text body, password recovery copy, 重置邮件模板, 找回主题, HTML正文, 文本正文, 密码找回文案
   */
  private buildPasswordResetEmailCommand(ticket: PasswordResetTicket): SendEmailCommand {
    const resetLink = this.buildPasswordResetLink(ticket.resetToken, ticket.email);
    const expiresInMinutes = Math.max(1, Math.ceil((ticket.expiresAt.getTime() - Date.now()) / 60000));
    const subject = `${APP_NAME} password reset`;
    const textBody = [
      `Hello ${ticket.username},`,
      '',
      `You requested a password reset for ${APP_NAME}. Open the link below to choose a new password:`,
      resetLink,
      '',
      `This link expires in ${expiresInMinutes} minutes.`,
      '',
      'If you did not request a password reset, you can safely ignore this email.',
    ].join('\n');

    const htmlBody = [
      `<p>Hello ${ticket.username},</p>`,
      `<p>You requested a password reset for <strong>${APP_NAME}</strong>. Open the link below to choose a new password:</p>`,
      `<p><a href="${resetLink}">${resetLink}</a></p>`,
      `<p>This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>`,
      '<p>If you did not request a password reset, you can safely ignore this email.</p>',
    ].join('');

    return {
      to: ticket.email,
      subject,
      textBody,
      htmlBody,
    };
  }

  /**
   * Callers: [AuthApplicationService.buildRegistrationVerificationEmailCommand]
   * Callees: []
   * Description: Generates the frontend verification URL consumed by the register page when the user clicks the mailbox link.
   * 描述：生成前端注册页消费的验证 URL，用户点击邮箱链接后会使用这个地址。
   * Variables: `verificationToken` is the opaque token embedded into the query string; `frontendUrl` is the configured frontend origin.
   * 变量：`verificationToken` 是嵌入查询串中的不透明令牌；`frontendUrl` 是已配置的前端源地址。
   * Integration: Keep the verification entry on the frontend so browser navigation and cookie handling continue to use the same web application origin.
   * 接入方式：把验证入口保持在前端页面，保证浏览器导航与 Cookie 处理继续走同一个 Web 应用源。
   * Error Handling: Falls back to `origin` when `FRONTEND_URL` is absent, ensuring development still produces a usable link.
   * 错误处理：当 `FRONTEND_URL` 缺失时回退到 `origin`，保证开发环境仍能生成可用链接。
   * Keywords: verification link, frontend callback, query token, signup url, mailbox click, 验证链接, 前端回调, 查询令牌, 注册URL, 邮箱点击
   */
  private buildEmailRegistrationVerificationLink(verificationToken: string, email: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || origin).replace(/\/+$/, '');
    const encodedToken = encodeURIComponent(verificationToken);
    const encodedEmail = encodeURIComponent(email);
    return `${frontendUrl}/register?verificationToken=${encodedToken}&email=${encodedEmail}`;
  }

  /**
   * Callers: [AuthApplicationService.buildPasswordResetEmailCommand]
   * Callees: []
   * Description: Generates the frontend reset URL consumed by the reset-password page when the user clicks the mailbox link.
   * 描述：生成前端重置密码页消费的重置 URL，用户点击邮箱链接后会使用这个地址。
   * Variables: `resetToken` is the opaque token embedded into the query string; `email` is included to let the frontend offer recovery actions on expired links.
   * 变量：`resetToken` 是嵌入查询串中的不透明令牌；`email` 会一并带上，方便前端在链接过期时继续提供恢复动作。
   * Integration: Keep the reset entry on the frontend so browser navigation and post-reset UX remain inside the same web application origin.
   * 接入方式：把重置入口保持在前端页面，保证浏览器导航和重置后的交互继续处于同一 Web 应用源。
   * Error Handling: Falls back to `origin` when `FRONTEND_URL` is absent, ensuring development still produces a usable link.
   * 错误处理：当 `FRONTEND_URL` 缺失时回退到 `origin`，保证开发环境仍能生成可用链接。
   * Keywords: reset link, frontend callback, query token, password reset url, mailbox click, 重置链接, 前端回调, 查询令牌, 重置URL, 邮箱点击
   */
  private buildPasswordResetLink(resetToken: string, email: string): string {
    const frontendUrl = (process.env.FRONTEND_URL || origin).replace(/\/+$/, '');
    const encodedToken = encodeURIComponent(resetToken);
    const encodedEmail = encodeURIComponent(email);
    return `${frontendUrl}/reset-password?token=${encodedToken}&email=${encodedEmail}`;
  }

  /**
   * Callers: [AuthApplicationService.verifyEmailRegistration]
   * Callees: []
   * Description: Maps a persisted user aggregate and optional role name into the registration DTO expected by controllers and the 2FA flow.
   * 描述：把持久化用户聚合与可选角色名映射为控制器和 2FA 流程期望的注册 DTO。
   * Variables: `user` is the domain aggregate; `roleName` is the optional resolved role label.
   * 变量：`user` 是领域聚合；`roleName` 是已解析出的可选角色名。
   * Integration: Reuse this helper whenever registration completion needs to hand user context to cookies, controllers, or the frontend.
   * 接入方式：当注册完成需要把用户上下文交给 Cookie、控制器或前端时，统一复用本方法。
   * Error Handling: Mapping is pure and relies on a valid user aggregate, so it does not introduce new error branches.
   * 错误处理：该映射是纯函数，依赖有效用户聚合，不会引入新的错误分支。
   * Keywords: user dto, registration result, role mapping, controller payload, auth handoff, 用户DTO, 注册结果, 角色映射, 控制器载荷, 认证交接
   */
  private toRegisteredUserResult(user: User, roleName: string | null): RegisteredUserResult {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      level: user.level,
      role: { name: roleName },
    };
  }
}
