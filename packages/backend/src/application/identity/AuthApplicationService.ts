import { ICaptchaChallengeRepository } from '../../domain/identity/ICaptchaChallengeRepository'
import { IPasskeyRepository } from '../../domain/identity/IPasskeyRepository'
import { ISessionRepository } from '../../domain/identity/ISessionRepository'
import { IAuthChallengeRepository } from '../../domain/identity/IAuthChallengeRepository'
import { IUserRepository } from '../../domain/identity/IUserRepository'
import { IRoleRepository } from '../../domain/identity/IRoleRepository'
import { IEmailRegistrationTicketRepository } from '../../domain/identity/IEmailRegistrationTicketRepository'
import { IPasswordResetTicketRepository } from '../../domain/identity/IPasswordResetTicketRepository'
import { ISessionCache } from './ports/ISessionCache'
import { CaptchaChallenge } from '../../domain/identity/CaptchaChallenge'
import { Passkey } from '../../domain/identity/Passkey'
import { Session } from '../../domain/identity/Session'
import { AuthChallenge } from '../../domain/identity/AuthChallenge'
import { User } from '../../domain/identity/User'
import { Password } from '../../domain/identity/Password'
import { EmailAddress } from '../../domain/identity/EmailAddress'
import { EmailRegistrationTicket } from '../../domain/identity/EmailRegistrationTicket'
import { PasswordResetTicket } from '../../domain/identity/PasswordResetTicket'
import { UserStatus } from '@myndbbs/shared'
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher'
import { randomBytes, randomUUID as uuidv4 } from 'crypto'
import { APP_NAME } from '@myndbbs/shared'
import { ITotpPort } from '../../domain/identity/ports/ITotpPort'
import { IPasskeyPort } from '../../domain/identity/ports/IPasskeyPort'
import { ITokenPort } from '../../domain/identity/ports/ITokenPort'
import { IEmailSender, type SendEmailCommand } from '../../domain/identity/ports/IEmailSender'
import { IEmailTemplateRepository } from '../../domain/notification/IEmailTemplateRepository'
import { EmailTemplateType } from '../../domain/notification/EmailTemplate'
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork'

import { SvgCaptchaGenerator } from './SvgCaptchaGenerator'

const rpName = APP_NAME
const rpID = process.env.RP_ID || 'localhost'
const origin = process.env.ORIGIN || `http://${rpID}:3000`

export interface RegisteredUserResult {
  id: string
  username: string
  email: string
  level: number
  role: { name: string | null }
}

export interface RegistrationRequestAcceptedResult {
  email: string
  expiresAt: Date
}

export interface PasswordResetRequestAcceptedResult {
  email: string
  expiresAt: Date
}

/**
 * 身份与应用服务
 * ================
 * 身份限界上下文的应用服务。编排注册、会话管理、认证挑战、验证码验证和通行密钥管理。
 * 作为领域层与接口层之间的协调器，负责按正确顺序调用领域实体和仓储，并管理事务边界。
 *
 * The Application Service for the Identity Domain. Orchestrates registration, session management,
 * auth challenges, captcha verification, and passkey management. Acts as the coordinator between
 * the domain layer and the interface layer, responsible for calling domain entities and repositories
 * in the correct order and managing transaction boundaries.
 *
 * Callers: [CaptchaController, RegisterController, AuthController, UserController, AdminController, SudoController]
 * Callees: [ICaptchaChallengeRepository, IPasskeyRepository, ISessionRepository, IAuthChallengeRepository,
 *           IUserRepository, IPasswordHasher, IRoleRepository, IEmailRegistrationTicketRepository,
 *           IPasswordResetTicketRepository, ISessionCache, ITotpPort, IPasskeyPort, ITokenPort,
 *           IEmailSender, IEmailTemplateRepository, IUnitOfWork]
 * Calls: [ICaptchaChallengeRepository, IPasskeyRepository, ISessionRepository, IAuthChallengeRepository,
 *         IUserRepository, IPasswordHasher, IRoleRepository, IEmailRegistrationTicketRepository,
 *         IPasswordResetTicketRepository, ISessionCache, ITotpPort, IPasskeyPort, ITokenPort,
 *         IEmailSender, IEmailTemplateRepository, IUnitOfWork]
 * Keywords: identity, auth, service, application, orchestration, register, session, challenge, captcha, passkey,
 *           身份, 认证, 应用服务, 编排, 注册, 会话, 挑战, 验证码, 通行密钥
 */
export class AuthApplicationService {
  /**
   * Function: constructor
   * ----------------------
   * 通过依赖注入初始化服务实例。接收所有所需的仓储、端口和服务实现。
   *
   * Initializes the service instance via Dependency Injection. Accepts all required repository, port,
   * and service implementations.
   *
   * Callers: [Registry, tests]
   * Called by: [Registry, tests]
   *
   * Callees: [] (仅赋值 / assignments only)
   * Calls: [] (仅赋值 / assignments only)
   *
   * Parameters:
   * - captchaChallengeRepository: ICaptchaChallengeRepository, 验证码挑战仓储 / captcha challenge repository
   * - passkeyRepository: IPasskeyRepository, 通行密钥仓储 / passkey repository
   * - sessionRepository: ISessionRepository, 会话仓储 / session repository
   * - authChallengeRepository: IAuthChallengeRepository, 认证挑战仓储 / auth challenge repository
   * - userRepository: IUserRepository, 用户仓储 / user repository
   * - roleRepository: IRoleRepository, 角色仓储 / role repository
   * - emailRegistrationTicketRepository: IEmailRegistrationTicketRepository, 邮箱注册票据仓储
   * - passwordResetTicketRepository: IPasswordResetTicketRepository, 密码重置票据仓储
   * - passwordHasher: IPasswordHasher, 密码哈希器 / password hasher
   * - authCache: ISessionCache, 会话缓存 / session cache
   * - totpPort: ITotpPort, TOTP 端口 / TOTP port
   * - passkeyPort: IPasskeyPort, Passkey 端口 / Passkey port
   * - tokenPort: ITokenPort, 令牌端口 / token port
   * - emailSender: IEmailSender, 邮件发送器 / email sender
   * - emailTemplateRepository: IEmailTemplateRepository | null, 可选，邮件模板仓储 / optional email template repository
   * - unitOfWork: IUnitOfWork, 工作单元 / unit of work
   *
   * Returns:
   * - AuthApplicationService 实例 / an instance of AuthApplicationService
   *
   * Error Handling / 错误处理:
   * - 无显式错误处理；依赖项为 null 时后续调用将抛出对应异常
   *   No explicit error handling; null dependencies will cause corresponding exceptions in subsequent calls
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * 中文关键词: 构造函数, 依赖注入, 仓储初始化, 端口注入, 服务注册, 身份服务
   * English keywords: constructor, dependency injection, repository initialization, port injection, service registration, identity service
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
    private emailTemplateRepository: IEmailTemplateRepository | null,
    private unitOfWork: IUnitOfWork,
  ) {}

  // --- Captcha Orchestration ---

  /**
   * Function: generateCaptcha
   * --------------------------
   * 生成新的验证码挑战。创建一个随机目标位置（80-240 范围），设置 5 分钟过期时间，保存验证码挑战，
   * 并调用 SvgCaptchaGenerator 生成对应的 SVG 图像。
   *
   * Generates a new captcha challenge. Creates a random target position (range 80-240), sets a 5-minute
   * expiration, persists the captcha challenge, and calls SvgCaptchaGenerator to produce the corresponding SVG image.
   *
   * Callers: [CaptchaController.generate]
   * Called by: [CaptchaController.generate]
   *
   * Callees: [CaptchaChallenge.create, ICaptchaChallengeRepository.save, SvgCaptchaGenerator.generateImage]
   * Calls: [CaptchaChallenge.create, ICaptchaChallengeRepository.save, SvgCaptchaGenerator.generateImage]
   *
   * Parameters:
   * - 无参数 / no parameters
   *
   * Returns:
   * - Promise<{ id: string, image: string }>, 包含验证码 ID 和 base64 SVG 图像的对象
   *   an object containing the captcha ID and the base64 SVG image
   *
   * Error Handling / 错误处理:
   * - 无显式业务异常；仓储保存失败时抛出基础设施异常
   *   No explicit business exceptions; repository save failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 写入数据库（通过 ICaptchaChallengeRepository）/ writes to database (via ICaptchaChallengeRepository)
   *
   * Transaction / 事务:
   * - 无事务边界，仅单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 验证码生成, SVG图形, 随机位置, 挑战创建, 人机验证, 机器人防护, 图形验证码
   * English keywords: captcha generation, SVG image, random position, challenge creation, human verification, bot protection, image captcha
   */
  public async generateCaptcha(): Promise<{ id: string; image: string }> {
    // Random position between 80 and 240
    const targetPosition = Math.floor(Math.random() * (240 - 80 + 1)) + 80

    const challenge = CaptchaChallenge.create({
      id: uuidv4(),
      targetPosition,
      verified: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    })

    await this.captchaChallengeRepository.save(challenge)

    const image = SvgCaptchaGenerator.generateImage(targetPosition)
    return { id: challenge.id, image }
  }

  /**
   * Function: verifyCaptcha
   * ------------------------
   * 验证用户拖拽轨迹与验证码挑战是否匹配。如果验证码已过期，则删除它并抛出异常。
   * 验证成功后保存已验证状态。
   *
   * Verifies whether the user's drag trajectory matches the captcha challenge. Deletes the challenge
   * if it has expired and throws an exception. Persists the verified state on success.
   *
   * Callers: [CaptchaController.verify]
   * Called by: [CaptchaController.verify]
   *
   * Callees: [ICaptchaChallengeRepository.findById, ICaptchaChallengeRepository.delete,
   *           CaptchaChallenge.verifyTrajectory, ICaptchaChallengeRepository.save]
   * Calls: [ICaptchaChallengeRepository.findById, ICaptchaChallengeRepository.delete,
   *         CaptchaChallenge.verifyTrajectory, ICaptchaChallengeRepository.save]
   *
   * Parameters:
   * - id: string, 验证码挑战 ID / the captcha challenge ID
   * - dragPath: any[], 用户拖拽轨迹点数组 / the user's drag trajectory point array
   * - totalDragTime: number, 拖拽总耗时（毫秒）/ total drag duration (milliseconds)
   * - finalPosition: number, 最终拖拽位置 / the final drag position
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_CAPTCHA: 验证码 ID 不存在 / captcha ID not found
   * - ERR_CAPTCHA_EXPIRED: 验证码已过期（会删除该验证码）/ captcha has expired (deletes the challenge)
   * - 其他验证失败异常由 CaptchaChallenge.verifyTrajectory 抛出
   *   Other verification failures are thrown by CaptchaChallenge.verifyTrajectory
   *
   * Side Effects / 副作用:
   * - 更新数据库（保存验证状态）/ updates database (persists verification status)
   * - 验证码过期时删除数据库记录 / deletes database record on expiration
   *
   * Transaction / 事务:
   * - 无事务边界，最多两次写入 / no transaction boundary, at most two writes
   *
   * 中文关键词: 验证码验证, 拖拽轨迹, 滑块验证, 人机验证, 过期清理, 轨迹校验, 安全验证
   * English keywords: captcha verification, drag trajectory, slider captcha, human verification, expiration cleanup, trajectory validation, security check
   */
  public async verifyCaptcha(
    id: string,
    dragPath: any[],
    totalDragTime: number,
    finalPosition: number,
  ): Promise<void> {
    const challenge = await this.captchaChallengeRepository.findById(id)
    if (!challenge) {
      throw new Error('ERR_INVALID_CAPTCHA')
    }

    try {
      challenge.verifyTrajectory(dragPath, totalDragTime, finalPosition)
      await this.captchaChallengeRepository.save(challenge)
    } catch (error: any) {
      if (error.message === 'ERR_CAPTCHA_EXPIRED') {
        await this.captchaChallengeRepository.delete(id)
      }
      throw error
    }
  }

  /**
   * Function: consumeCaptcha
   * -------------------------
   * 消费已验证的验证码挑战。检查验证码是否已验证且未过期，然后删除它以阻止重复使用。
   * 用于需要在操作前进行人机验证的场景（如注册、发帖、评论）。
   *
   * Consumes a verified captcha challenge. Checks that the captcha has been verified and has not expired,
   * then deletes it to prevent reuse. Used in scenarios that require human verification before an action
   * (e.g., registration, posting, commenting).
   *
   * Callers: [RegisterController.registerUser, PostController.createPost, PostController.createComment]
   * Called by: [RegisterController.registerUser, PostController.createPost, PostController.createComment]
   *
   * Callees: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption,
   *           ICaptchaChallengeRepository.delete]
   * Calls: [ICaptchaChallengeRepository.findById, CaptchaChallenge.validateForConsumption,
   *         ICaptchaChallengeRepository.delete]
   *
   * Parameters:
   * - captchaId: string, 要消费的验证码挑战 ID / the captcha challenge ID to consume
   *
   * Returns:
   * - Promise<boolean>, 成功消费返回 true；验证码不存在或未通过验证返回 false
   *   Returns true on successful consumption; false if the captcha does not exist or has not been verified
   *
   * Error Handling / 错误处理:
   * - 验证码不存在时返回 false（不抛异常）/ returns false (no exception) when the captcha is not found
   * - CaptchaChallenge.validateForConsumption 抛出的异常被捕获，返回 false
   *   Exceptions from CaptchaChallenge.validateForConsumption are caught and return false
   *
   * Side Effects / 副作用:
   * - 删除数据库中的验证码记录 / deletes the captcha record from the database
   *
   * Transaction / 事务:
   * - 无事务边界，单次删除操作 / no transaction boundary, single delete operation
   *
   * 中文关键词: 验证码消费, 人机验证, 防滥用, 验证码删除, 操作保护, 验证通过检查
   * English keywords: captcha consumption, human verification, abuse prevention, captcha deletion, action protection, verification check
   */
  public async consumeCaptcha(captchaId: string): Promise<boolean> {
    const challenge = await this.captchaChallengeRepository.findById(captchaId)
    if (!challenge) {
      return false
    }
    try {
      challenge.validateForConsumption()
      await this.captchaChallengeRepository.delete(captchaId)
      return true
    } catch (error) {
      return false
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
  public async registerUser(
    email: string,
    username: string,
    password: string,
    captchaId: string,
  ): Promise<RegistrationRequestAcceptedResult> {
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value
    const normalizedUsername = username.trim()

    Password.validatePolicy(password)

    const isCaptchaValid = await this.consumeCaptcha(captchaId)
    if (!isCaptchaValid) {
      throw new Error('ERR_INVALID_EXPIRED_OR_UNVERIFIED_CAPTCHA')
    }

    await this.assertRegistrationIdentityAvailable(normalizedEmail, normalizedUsername)

    const hashedPassword = await this.passwordHasher.hash(password)
    await this.deleteReusablePendingRegistration(normalizedEmail, normalizedUsername)
    const ticket = this.createEmailRegistrationTicket(
      normalizedEmail,
      normalizedUsername,
      hashedPassword,
    )

    await this.emailRegistrationTicketRepository.save(ticket)

    try {
      await this.sendRegistrationVerificationEmail(ticket)
    } catch (error) {
      await this.emailRegistrationTicketRepository.delete(ticket.id)
      throw error
    }

    return {
      email: ticket.email,
      expiresAt: ticket.expiresAt,
    }
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
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value
    const existingUser = await this.userRepository.findByEmail(normalizedEmail)
    if (existingUser) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS')
    }

    const pendingTicket = await this.emailRegistrationTicketRepository.findByEmail(normalizedEmail)
    if (!pendingTicket) {
      throw new Error('ERR_EMAIL_REGISTRATION_NOT_FOUND')
    }

    await this.deleteReusablePendingRegistration(pendingTicket.email, pendingTicket.username)
    const replacementTicket = this.createEmailRegistrationTicket(
      pendingTicket.email,
      pendingTicket.username,
      pendingTicket.passwordHash,
    )

    await this.emailRegistrationTicketRepository.save(replacementTicket)

    try {
      await this.sendRegistrationVerificationEmail(replacementTicket)
    } catch (error) {
      await this.emailRegistrationTicketRepository.delete(replacementTicket.id)
      throw error
    }

    return {
      email: replacementTicket.email,
      expiresAt: replacementTicket.expiresAt,
    }
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
    const ticket = await this.emailRegistrationTicketRepository.findByVerificationToken(
      verificationToken.trim(),
    )
    if (!ticket) {
      throw new Error('ERR_EMAIL_REGISTRATION_NOT_FOUND')
    }

    ticket.validateForCompletion()

    const registeredUser = await this.unitOfWork.execute(async () => {
      const existingEmailUser = await this.userRepository.findByEmail(ticket.email)
      const existingUsernameUser = await this.userRepository.findByUsername(ticket.username)

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
            : null

          return this.toRegisteredUserResult(existingEmailUser, existingRole?.name ?? null)
        }

        if (existingEmailUser) {
          throw new Error('ERR_EMAIL_ALREADY_EXISTS')
        }

        throw new Error('ERR_USERNAME_ALREADY_EXISTS')
      }

      const defaultRole = await this.roleRepository.findByName('USER')
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
      })

      await this.userRepository.save(user)

      return this.toRegisteredUserResult(user, defaultRole?.name ?? null)
    })

    await this.emailRegistrationTicketRepository.delete(ticket.id)
    return registeredUser
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
    const normalizedEmail = EmailAddress.create(email.trim().toLowerCase()).value
    const fallbackExpiresAt = new Date(Date.now() + this.getPasswordResetTtlMinutes() * 60 * 1000)
    const user = await this.userRepository.findByEmail(normalizedEmail)

    if (!user) {
      return {
        email: normalizedEmail,
        expiresAt: fallbackExpiresAt,
      }
    }

    await this.deleteReusablePasswordResetTicket(user.id, user.email)
    const ticket = this.createPasswordResetTicket(user.id, user.email, user.username)

    await this.passwordResetTicketRepository.save(ticket)

    try {
      await this.sendPasswordResetEmail(ticket)
    } catch (error) {
      await this.passwordResetTicketRepository.delete(ticket.id)
      throw error
    }

    return {
      email: ticket.email,
      expiresAt: ticket.expiresAt,
    }
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
    Password.validatePolicy(newPassword)

    const ticket = await this.passwordResetTicketRepository.findByResetToken(resetToken.trim())
    if (!ticket) {
      throw new Error('ERR_PASSWORD_RESET_NOT_FOUND')
    }

    ticket.validateForReset()

    await this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(ticket.userId)
      if (!user || user.email !== ticket.email) {
        throw new Error('ERR_USER_NOT_FOUND')
      }

      const hashedPassword = await this.passwordHasher.hash(newPassword)
      user.updateProfile(undefined, undefined, hashedPassword)
      await this.userRepository.save(user)
      await this.sessionRepository.deleteManyByUserId(user.id)
    })

    await this.passwordResetTicketRepository.delete(ticket.id)
  }

  /**
   * Function: changePasswordWithVerification
   * ------------------------------------------
   * 在事务内修改用户的密码、邮箱或用户名。修改敏感信息时需要当前密码或 TOTP 动态口令进行二次验证。
   * 验证新邮箱和用户名的唯一性后执行更新。
   *
   * Changes a user's password, email, or username within a transaction. Requires the current password
   * or a TOTP code for secondary verification when modifying sensitive information. Validates uniqueness
   * of the new email and username before applying the update.
   *
   * Callers: [UserController.changePassword]
   * Called by: [UserController.changePassword]
   *
   * Callees: [IUnitOfWork.execute, IUserRepository.findById, Password.validatePolicy, IPasswordHasher.verify,
   *           ITotpPort.verify, IUserRepository.findByEmail, IUserRepository.findByUsername,
   *           IPasswordHasher.hash, User.updateProfile, IUserRepository.save]
   * Calls: [IUnitOfWork.execute, IUserRepository.findById, Password.validatePolicy, IPasswordHasher.verify,
   *         ITotpPort.verify, IUserRepository.findByEmail, IUserRepository.findByUsername,
   *         IPasswordHasher.hash, User.updateProfile, IUserRepository.save]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - currentPassword: string | undefined, 可选，当前密码（至少与 totpCode 提供一个）/ optional current password
   * - totpCode: string | undefined, 可选，TOTP 动态口令（至少与 currentPassword 提供一个）/ optional TOTP code
   * - newPassword: string | undefined, 可选，新密码 / optional new password
   * - newEmail: string | undefined, 可选，新邮箱 / optional new email
   * - newUsername: string | undefined, 可选，新用户名 / optional new username
   *
   * Returns:
   * - Promise<any>, 更新后的用户信息对象（id, email, username, roleId）/ updated user info object (id, email, username, roleId)
   *
   * Error Handling / 错误处理:
   * - ERR_USER_NOT_FOUND: 用户不存在 / user not found
   * - ERR_CURRENT_PASSWORD_OR_TOTP_CODE_REQUIRED_FOR_SENSITIVE_CHANGES: 修改敏感信息需要二次验证
   * - ERR_INVALID_CURRENT_PASSWORD: 当前密码错误 / current password is incorrect
   * - ERR_INVALID_TOTP_CODE: TOTP 动态口令错误 / TOTP code is incorrect
   * - ERR_EMAIL_ALREADY_IN_USE: 新邮箱已被占用 / new email is already in use
   * - ERR_USERNAME_ALREADY_IN_USE: 新用户名已被占用 / new username is already in use
   *
   * Side Effects / 副作用:
   * - 写入数据库（用户信息更新）/ writes to database (user info update)
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界 / transaction boundary managed by IUnitOfWork.execute
   *
   * 中文关键词: 密码修改, 邮箱修改, 用户名修改, 二次验证, TOTP, 事务更新, 唯一性检查, 安全变更, 用户资料
   * English keywords: password change, email change, username change, secondary verification, TOTP, transactional update, uniqueness check, secure change, user profile
   */
  public async changePasswordWithVerification(
    userId: string,
    currentPassword?: string,
    totpCode?: string,
    newPassword?: string,
    newEmail?: string,
    newUsername?: string,
  ): Promise<any> {
    return this.unitOfWork.execute(async () => {
      const user = await this.userRepository.findById(userId)
      if (!user) throw new Error('ERR_USER_NOT_FOUND')

      if (newPassword) {
        Password.validatePolicy(newPassword)
      }

      if (newEmail || newPassword) {
        if (!currentPassword && !totpCode) {
          throw new Error('ERR_CURRENT_PASSWORD_OR_TOTP_CODE_REQUIRED_FOR_SENSITIVE_CHANGES')
        }
        if (currentPassword && user.password) {
          const isValid = await this.passwordHasher.verify(user.password, currentPassword)
          if (!isValid) throw new Error('ERR_INVALID_CURRENT_PASSWORD')
        }
        if (totpCode && user.totpSecret) {
          const isValid = this.totpPort.verify(user.totpSecret, totpCode)
          if (!isValid) throw new Error('ERR_INVALID_TOTP_CODE')
        }
      }

      if (newEmail && newEmail !== user.email) {
        const existing = await this.userRepository.findByEmail(newEmail)
        if (existing) throw new Error('ERR_EMAIL_ALREADY_IN_USE')
      }
      if (newUsername && newUsername !== user.username) {
        const existing = await this.userRepository.findByUsername(newUsername)
        if (existing) throw new Error('ERR_USERNAME_ALREADY_IN_USE')
      }

      let hashedPassword
      if (newPassword) {
        hashedPassword = await this.passwordHasher.hash(newPassword)
      }

      user.updateProfile(newEmail, newUsername, hashedPassword)
      await this.userRepository.save(user)

      return { id: user.id, email: user.email, username: user.username, roleId: user.roleId }
    })
  }

  // --- Auth Orchestration ---

  /**
   * Function: loginUser
   * --------------------
   * 处理用户登录，通过邮箱或用户名查找用户并验证密码。检查账号是否被封禁。如果用户启用了双因素认证（TOTP/Passkey），
   * 则返回需要 2FA 的标识和可用方法，并生成临时令牌用于后续 2FA 验证。
   *
   * Handles user login by looking up the user via email or username and verifying the password.
   * Checks whether the account is banned. If the user has two-factor authentication (TOTP/Passkey) enabled,
   * returns a flag indicating that 2FA is required, lists the available methods, and generates a temporary token
   * for subsequent 2FA verification.
   *
   * Callers: [AuthController, RegisterController]
   * Called by: [AuthController, RegisterController]
   *
   * Callees: [IUserRepository.findByEmail, IUserRepository.findByUsername, IPasswordHasher.verify,
   *           IPasskeyRepository.findByUserId, IRoleRepository.findById, AuthApplicationService.generateTempToken]
   * Calls: [IUserRepository.findByEmail, IUserRepository.findByUsername, IPasswordHasher.verify,
   *         IPasskeyRepository.findByUserId, IRoleRepository.findById, AuthApplicationService.generateTempToken]
   *
   * Parameters:
   * - emailOrUsername: string, 用户输入的邮箱或用户名 / The email or username submitted by the user
   * - password: string, 用户输入的明文密码 / The plain-text password submitted by the user
   *
   * Returns:
   * - Promise<{ user: any, requires2FA: boolean, methods: string[], tempToken?: string }>
   *   包含用户信息、是否需要 2FA、可用方法列表，以及可选的临时令牌
   *   Contains user info, whether 2FA is required, a list of available methods, and an optional temporary token
   *
   * Error Handling / 错误处理:
   * - ERR_INVALID_CREDENTIALS: 用户不存在或密码错误 / user not found or wrong password
   * - ERR_ACCOUNT_IS_BANNED: 账号已被封禁 / account is banned
   *
   * Side Effects / 副作用:
   * - 无数据库写入操作，仅读取数据 / no database writes, only reads
   * - 当需要 2FA 时会生成临时令牌（调用 tokenPort.sign）/ generates a temp token (via tokenPort.sign) when 2FA is needed
   *
   * Transaction / 事务:
   * - 无事务边界，纯读取操作 / no transaction boundary, pure read operations
   *
   * 中文关键词: 登录, 认证, 密码验证, 双因素认证, 临时令牌, 账号封禁检查, 角色解析, 邮箱查询, 用户名查询, 安全认证
   * English keywords: login, authentication, password verification, two-factor auth, temp token, account ban check, role resolution, email lookup, username lookup, secure auth
   */
  public async loginUser(
    emailOrUsername: string,
    password: string,
  ): Promise<{
    user: any
    requires2FA: boolean
    methods: string[]
    tempToken?: string
  }> {
    let user = await this.userRepository.findByEmail(emailOrUsername)
    if (!user) {
      user = await this.userRepository.findByUsername(emailOrUsername)
    }

    if (!user || !user.password) {
      throw new Error('ERR_INVALID_CREDENTIALS')
    }

    if (user.status === UserStatus.BANNED) {
      throw new Error('ERR_ACCOUNT_IS_BANNED')
    }

    const isValid = await this.passwordHasher.verify(user.password, password)
    if (!isValid) {
      throw new Error('ERR_INVALID_CREDENTIALS')
    }

    const methods: string[] = []
    if (user.isTotpEnabled) methods.push('totp')

    const passkeys = await this.passkeyRepository.findByUserId(user.id)
    if (passkeys && passkeys.length > 0) methods.push('passkey')

    let roleName = null
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId)
      if (role) roleName = role.name
    }

    const requires2FA = methods.length > 0
    let tempToken
    if (requires2FA) {
      tempToken = this.generateTempToken(user.id, 'login')
    }

    const result: any = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: { name: roleName },
        isTotpEnabled: user.isTotpEnabled,
        level: user.level,
      },
      requires2FA,
      methods,
    }

    if (tempToken) {
      result.tempToken = tempToken
    }

    return result
  }

  /**
   * Function: generatePasskeyRegistrationOptions
   * ----------------------------------------------
   * 生成 WebAuthn Passkey 注册选项。查找用户及其已有的通行密钥，将已有凭据放入 excludeCredentials 以避免重复注册，
   * 调用 passkeyPort 生成注册选项，同时创建认证挑战并返回 challengeId。
   *
   * Generates WebAuthn Passkey registration options for a user. Looks up the user and their existing passkeys,
   * places existing credentials into excludeCredentials to prevent duplicate registration, calls the passkeyPort
   * to generate registration options, and creates an authentication challenge returning its ID.
   *
   * Callers: [AuthController, UserController]
   * Called by: [AuthController, UserController]
   *
   * Callees: [IUserRepository.findById, IPasskeyRepository.findByUserId, IPasskeyPort.generateRegistrationOptions,
   *           AuthApplicationService.generateAuthChallenge]
   * Calls: [IUserRepository.findById, IPasskeyRepository.findByUserId, IPasskeyPort.generateRegistrationOptions,
   *         AuthApplicationService.generateAuthChallenge]
   *
   * Parameters:
   * - userId: string, 要注册通行密钥的用户 ID / the ID of the user registering a passkey
   *
   * Returns:
   * - Promise<any>, 包含 WebAuthn 注册选项和 challengeId / WebAuthn registration options plus challengeId
   *
   * Error Handling / 错误处理:
   * - ERR_USER_NOT_FOUND: 用户不存在 / user not found
   *
   * Side Effects / 副作用:
   * - 写入 IAuthChallengeRepository（通过 generateAuthChallenge）/ writes to IAuthChallengeRepository (via generateAuthChallenge)
   *
   * Transaction / 事务:
   * - 无显式事务边界，包含两个独立写入（注册选项生成 + 挑战保存）/ no explicit transaction boundary, two independent writes
   *
   * 中文关键词: 通行密钥, WebAuthn, 注册选项, 排除凭据, 认证挑战, 生物认证, 免密码, FIDO2, 凭据管理, 安全认证
   * English keywords: passkey, WebAuthn, registration options, exclude credentials, auth challenge, biometric auth, passwordless, FIDO2, credential management, secure auth
   */
  public async generatePasskeyRegistrationOptions(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new Error('ERR_USER_NOT_FOUND')

    const userPasskeys = await this.passkeyRepository.findByUserId(userId)

    const excludeCredentials = userPasskeys.map((passkey) => ({
      id: passkey.id,
      transports: ['internal'] as any,
    }))

    const options = await this.passkeyPort.generateRegistrationOptions(user, excludeCredentials)

    const authChallenge = await this.generateAuthChallenge(options.challenge)

    return { ...options, challengeId: authChallenge.id }
  }

  /**
   * Function: verifyPasskeyRegistration
   * -------------------------------------
   * 在事务内验证 Passkey 注册响应。消费认证挑战，调用 passkeyPort 验证注册响应，保存新的通行密钥，
   * 并自动将 level 1 用户提升到 level 2。返回验证结果和用户信息。
   *
   * Verifies a Passkey registration response within a transaction. Consumes the authentication challenge,
   * calls the passkeyPort to verify the registration response, persists the new passkey,
   * and automatically promotes a level 1 user to level 2. Returns the verification result and user info.
   *
   * Callers: [AuthController]
   * Called by: [AuthController]
   *
   * Callees: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyPort.verifyRegistrationResponse,
   *           AuthApplicationService.addPasskey, IUserRepository.findById, User.changeLevel, IUserRepository.save,
   *           IRoleRepository.findById]
   * Calls: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyPort.verifyRegistrationResponse,
   *         AuthApplicationService.addPasskey, IUserRepository.findById, User.changeLevel, IUserRepository.save,
   *         IRoleRepository.findById]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - response: any, WebAuthn 注册响应对象 / the WebAuthn registration response object
   * - challengeId: string, 认证挑战 ID / the authentication challenge ID
   *
   * Returns:
   * - Promise<{ verified: boolean, requiresTotpSetup?: boolean, message?: string, user?: any }>
   *   验证结果对象（验证状态、是否需设置 TOTP、消息、用户信息）
   *   result object (verification status, whether TOTP setup is needed, message, user info)
   *
   * Error Handling / 错误处理:
   * - ERR_CHALLENGE_ID_IS_REQUIRED: 缺少 challengeId / challengeId is required
   * - ERR_VERIFICATION_FAILED: 验证失败 / verification failed
   *
   * Side Effects / 副作用:
   * - 写入通行密钥到数据库 / persists the passkey to the database
   * - 可能更新用户等级 / may update the user's level
   * - 删除已消费的认证挑战 / deletes the consumed auth challenge
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界 / transaction boundary managed by IUnitOfWork.execute
   *
   * 中文关键词: 通行密钥, 注册验证, 事务处理, 用户升级, 认证挑战, WebAuthn, 凭据存储, 级别提升
   * English keywords: passkey, registration verification, transaction, user promotion, auth challenge, WebAuthn, credential storage, level promotion
   */
  public async verifyPasskeyRegistration(
    userId: string,
    response: any,
    challengeId: string,
  ): Promise<{ verified: boolean; requiresTotpSetup?: boolean; message?: string; user?: any }> {
    return this.unitOfWork.execute(async () => {
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED')
      }

      const expectedChallenge = await this.consumeAuthChallenge(challengeId)

      const verification = await this.passkeyPort.verifyRegistrationResponse(
        response,
        expectedChallenge.challenge,
        origin,
        rpID,
      )

      if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } =
          verification.registrationInfo
        const { id: credentialID, publicKey: credentialPublicKey, counter } = credential

        await this.addPasskey(
          userId,
          credentialID,
          Buffer.from(credentialPublicKey),
          userId,
          BigInt(counter),
          credentialDeviceType,
          credentialBackedUp,
        )

        const user = await this.userRepository.findById(userId)
        if (user && user.level === 1) {
          user.changeLevel(2, true)
          await this.userRepository.save(user)
        }

        let roleName = null
        if (user?.roleId) {
          const role = await this.roleRepository.findById(user.roleId)
          if (role) roleName = role.name
        }

        const returnedUser = user
          ? {
              id: user.id,
              email: user.email,
              username: user.username,
              role: { name: roleName },
              isTotpEnabled: user.isTotpEnabled,
              level: user.level,
            }
          : undefined

        const requiresTotpSetup = user ? !user.isTotpEnabled : false
        const message = requiresTotpSetup
          ? 'Passkey registered successfully. Please proceed to setup TOTP.'
          : 'Passkey registered successfully'

        return { verified: true, requiresTotpSetup, message, user: returnedUser }
      } else {
        throw new Error('ERR_VERIFICATION_FAILED')
      }
    })
  }

  // --- Session Orchestration ---

  /**
   * Function: createSession
   * ------------------------
   * 创建新的用户会话。生成唯一会话 ID，绑定用户、IP 和 User-Agent，设置过期时间（默认 7 天），
   * 然后持久化到数据库。
   *
   * Creates a new user session. Generates a unique session ID, binds the user, IP, and User-Agent,
   * sets the expiration time (default 7 days), then persists to the database.
   *
   * Callers: [AuthController.login, AuthController.verifyPasskeyAuthentication, RegisterController.registerUser,
   *           AuthApplicationService.finalizeAuth]
   * Called by: [AuthController.login, AuthController.verifyPasskeyAuthentication, RegisterController.registerUser,
   *              AuthApplicationService.finalizeAuth]
   *
   * Callees: [Session.create, ISessionRepository.save]
   * Calls: [Session.create, ISessionRepository.save]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - ipAddress: string | null, 客户端的 IP 地址 / the client's IP address
   * - userAgent: string | null, 客户端的 User-Agent 字符串 / the client's User-Agent string
   * - expiresInMs: number, 会话过期时间（毫秒），默认 7 天 / session expiration in milliseconds, default 7 days
   *
   * Returns:
   * - Promise<Session>, 创建的会话实体 / the created Session entity
   *
   * Error Handling / 错误处理:
   * - 仓储保存失败时抛出基础设施异常 / repository save failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 写入数据库（ISessionRepository）/ writes to database (ISessionRepository)
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 会话创建, 用户会话, IP绑定, UserAgent, 过期时间, 会话持久化, 登录会话
   * English keywords: session creation, user session, IP binding, UserAgent, expiration, session persistence, login session
   */
  public async createSession(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
    expiresInMs: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<Session> {
    const session = Session.create({
      id: uuidv4(),
      userId,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + expiresInMs),
      createdAt: new Date(),
    })

    await this.sessionRepository.save(session)
    return session
  }

  /**
   * Function: revokeSession
   * -------------------------
   * 撤销指定的用户会话。如果提供了 expectedUserId，则先校验该会话属于指定用户，防止越权撤销。
   * 删除数据库记录并清除缓存。
   *
   * Revokes a specific user session. If expectedUserId is provided, first verifies that the session
   * belongs to the specified user to prevent unauthorized revocation. Deletes the database record
   * and clears the cache.
   *
   * Callers: [AuthController.logout, UserController.revokeSession, AuthApplicationService.logout]
   * Called by: [AuthController.logout, UserController.revokeSession, AuthApplicationService.logout]
   *
   * Callees: [ISessionRepository.findById, ISessionRepository.delete, ISessionCache.revokeSession]
   * Calls: [ISessionRepository.findById, ISessionRepository.delete, ISessionCache.revokeSession]
   *
   * Parameters:
   * - sessionId: string, 要撤销的会话 ID / the session ID to revoke
   * - expectedUserId: string | undefined, 可选，期望的所属用户 ID，用于越权检查
   *   optional expected owner user ID, used for authorization check
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED: 会话不存在或不属于指定用户
   *   session not found or does not belong to the specified user
   *
   * Side Effects / 副作用:
   * - 删除数据库会话记录 / deletes the session record from the database
   * - 删除缓存中的会话数据 / deletes session data from cache
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 会话撤销, 退出登录, 权限校验, 会话删除, 缓存清理, 安全退出, 会话管理
   * English keywords: session revocation, logout, authorization check, session deletion, cache cleanup, secure exit, session management
   */
  public async revokeSession(sessionId: string, expectedUserId?: string): Promise<void> {
    if (expectedUserId) {
      const session = await this.sessionRepository.findById(sessionId)
      if (!session || session.userId !== expectedUserId) {
        throw new Error('ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED')
      }
    }
    await this.sessionRepository.delete(sessionId)
    await this.authCache.revokeSession(sessionId)
  }

  // --- TOTP Setup Orchestration ---

  /**
   * Function: generateTotp
   * ----------------------
   * 生成 TOTP（基于时间的一次性密码）密钥。调用 totpPort 生成密钥和 otpauth URI，使用 QRCode 库将 URI 转为二维码图片，
   * 然后将密钥临时存储到缓存中（默认 5 分钟），用于后续验证。
   *
   * Generates a TOTP (Time-based One-Time Password) secret. Calls the totpPort to generate the secret and the otpauth URI,
   * converts the URI to a QR code image using the QRCode library, then temporarily stores the secret in cache
   * (default 5 minutes) for subsequent verification.
   *
   * Callers: [AuthController, UserController]
   * Called by: [AuthController, UserController]
   *
   * Callees: [ITotpPort.generateSecret, ITotpPort.generateURI, QRCode.toDataURL,
   *           AuthApplicationService.storeTotpSecret]
   * Calls: [ITotpPort.generateSecret, ITotpPort.generateURI, QRCode.toDataURL,
   *         AuthApplicationService.storeTotpSecret]
   *
   * Parameters:
   * - userId: string, 要设置 TOTP 的用户 ID / the ID of the user setting up TOTP
   * - email: string, 用户的邮箱，用于 otpauth URI 中的标签 / the user's email, used as the label in the otpauth URI
   *
   * Returns:
   * - Promise<{ secret: string, qrCodeUrl: string }>
   *   secret: TOTP 密钥明文 / the plain TOTP secret
   *   qrCodeUrl: 二维码图片的 Data URL（base64 PNG）/ Data URL (base64 PNG) of the QR code image
   *
   * Error Handling / 错误处理:
   * - 无显式业务异常，QRCode.toDataURL 可能抛出 I/O 异常并向上传递
   *   No explicit business exceptions; QRCode.toDataURL may throw I/O errors which propagate upward
   *
   * Side Effects / 副作用:
   * - 写入缓存（通过 authCache.storeTotpSecret）/ writes to cache (via authCache.storeTotpSecret)
   * - 调用 QRCode 库生成图片 / calls QRCode library to generate an image
   *
   * Transaction / 事务:
   * - 无事务边界，仅有缓存写入 / no transaction boundary, only cache writes
   *
   * 中文关键词: TOTP, 动态口令, 双因素认证, 密钥生成, 二维码, otpauth, 时间同步, 验证器, 安全设置, 密钥缓存
   * English keywords: TOTP, one-time password, two-factor auth, secret generation, QR code, otpauth, time-based, authenticator, security setup, secret cache
   */
  public async generateTotp(
    userId: string,
    email: string,
  ): Promise<{ secret: string; qrCodeUrl: string }> {
    const secret = this.totpPort.generateSecret()
    const otpauth = this.totpPort.generateURI(APP_NAME, email, secret)

    // We need QRCode.toDataURL to generate the image. Since QRCode is infrastructure, we should probably return the otpauth URI and let the adapter or controller handle it, but the instructions say "completely to authApplicationService".
    // Wait, the instruction says remove QRCode from auth.ts. So we must use QRCode here, or pass it to a port.
    // The instruction didn't add QRCode to ITotpPort. So we have to import QRCode in AuthApplicationService.
    const QRCode = require('qrcode')
    const qrCodeUrl = await QRCode.toDataURL(otpauth)

    await this.storeTotpSecret(userId, secret, 300) // 5 minutes

    return { secret, qrCodeUrl }
  }

  /**
   * Function: storeTotpSecret
   * -------------------------
   * 将 TOTP 密钥临时存储到缓存中，用于后续验证步骤。在 TOTP 设置流程中，先存储密钥，用户验证通过后再持久化到数据库。
   *
   * Temporarily stores a TOTP secret in cache for use during the verification step. In the TOTP setup flow,
   * the secret is stored first, then persisted to the database after the user successfully verifies.
   *
   * Callers: [AuthApplicationService.generateTotp]
   * Called by: [AuthApplicationService.generateTotp]
   *
   * Callees: [ISessionCache.storeTotpSecret]
   * Calls: [ISessionCache.storeTotpSecret]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - secret: string, TOTP 密钥明文 / the plain TOTP secret
   * - ttlSeconds: number, 缓存过期时间（秒），默认 300 秒（5 分钟）/ cache TTL in seconds, default 300 (5 minutes)
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 无显式错误处理；缓存写入失败将向上传递异常 / no explicit error handling; cache write failures propagate upward
   *
   * Side Effects / 副作用:
   * - 写入缓存（ISessionCache）/ writes to cache (ISessionCache)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: TOTP密钥, 缓存存储, 临时存储, 验证步骤, 密钥生命周期, 过期时间
   * English keywords: TOTP secret, cache storage, temporary storage, verification step, secret lifecycle, TTL
   */
  public async storeTotpSecret(
    userId: string,
    secret: string,
    ttlSeconds: number = 300,
  ): Promise<void> {
    await this.authCache.storeTotpSecret(userId, secret, ttlSeconds)
  }

  /**
   * Function: verifyTotpRegistration
   * ----------------------------------
   * 在事务内验证 TOTP 设置并启用。从缓存获取待验证的 TOTP 密钥，验证用户输入的动态口令，
   * 检查 TOTP 是否已启用，然后为用户启用 TOTP 并清理缓存中的临时密钥。
   *
   * Verifies TOTP setup within a transaction and enables it. Retrieves the pending TOTP secret from cache,
   * verifies the code entered by the user, checks whether TOTP is already enabled, then enables TOTP
   * for the user and cleans up the temporary secret from cache.
   *
   * Callers: [UserController.verifyTotpSetup]
   * Called by: [UserController.verifyTotpSetup]
   *
   * Callees: [IUnitOfWork.execute, AuthApplicationService.getTotpSecret, ITotpPort.verify,
   *           IUserRepository.findById, User.enableTotp, IUserRepository.save,
   *           AuthApplicationService.removeTotpSecret]
   * Calls: [IUnitOfWork.execute, AuthApplicationService.getTotpSecret, ITotpPort.verify,
   *         IUserRepository.findById, User.enableTotp, IUserRepository.save,
   *         AuthApplicationService.removeTotpSecret]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - code: string, 用户输入的 TOTP 动态口令 / the TOTP code entered by the user
   *
   * Returns:
   * - Promise<string>, 验证成功后返回 TOTP 密钥明文 / returns the TOTP secret on successful verification
   *
   * Error Handling / 错误处理:
   * - ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED: 未发起 TOTP 设置或密钥已过期
   *   TOTP setup not initiated or secret expired
   * - ERR_INVALID_TOTP_CODE: 动态口令不正确 / TOTP code is incorrect
   * - ERR_USER_NOT_FOUND: 用户不存在 / user not found
   * - ERR_TOTP_ALREADY_ENABLED: TOTP 已经启用 / TOTP is already enabled
   *
   * Side Effects / 副作用:
   * - 更新数据库（用户 TOTP 状态）/ updates database (user TOTP status)
   * - 删除缓存中的临时密钥 / deletes the temporary secret from cache
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界 / transaction boundary managed by IUnitOfWork.execute
   *
   * 中文关键词: TOTP设置, 动态口令验证, 双因素认证, 事务提交, 密钥启用, 缓存清理, 安全配置
   * English keywords: TOTP setup, code verification, two-factor auth, transaction commit, secret enable, cache cleanup, security configuration
   */
  public async verifyTotpRegistration(userId: string, code: string): Promise<string> {
    return this.unitOfWork.execute(async () => {
      const pendingSecret = await this.getTotpSecret(userId)
      if (!pendingSecret) {
        throw new Error('ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED')
      }

      const isValid = this.totpPort.verify(pendingSecret, code)
      if (!isValid) {
        throw new Error('ERR_INVALID_TOTP_CODE')
      }

      const user = await this.userRepository.findById(userId)
      if (!user) throw new Error('ERR_USER_NOT_FOUND')

      if (user.isTotpEnabled) {
        throw new Error('ERR_TOTP_ALREADY_ENABLED')
      }

      user.enableTotp(pendingSecret)
      await this.userRepository.save(user)

      await this.removeTotpSecret(userId)

      return pendingSecret
    })
  }

  /**
   * Function: getTotpSecret
   * -----------------------
   * 从缓存中获取之前临时存储的 TOTP 密钥，用于验证用户输入的动态口令是否正确。
   *
   * Retrieves the previously stored TOTP secret from cache, used to verify whether the code entered by the user is correct.
   *
   * Callers: [AuthApplicationService.verifyTotpRegistration]
   * Called by: [AuthApplicationService.verifyTotpRegistration]
   *
   * Callees: [ISessionCache.getTotpSecret]
   * Calls: [ISessionCache.getTotpSecret]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   *
   * Returns:
   * - Promise<string | null>, 成功返回密钥字符串，密钥不存在或已过期返回 null
   *   Returns the secret string on success, or null if the secret does not exist or has expired
   *
   * Error Handling / 错误处理:
   * - 无显式异常；缓存未命中返回 null，由调用方处理 / no explicit exceptions; cache miss returns null, handled by the caller
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: TOTP密钥, 缓存读取, 密钥获取, 验证步骤, 动态口令校验
   * English keywords: TOTP secret, cache read, secret retrieval, verification step, code validation
   */
  public async getTotpSecret(userId: string): Promise<string | null> {
    return await this.authCache.getTotpSecret(userId)
  }

  /**
   * Function: removeTotpSecret
   * --------------------------
   * 从缓存中删除已用完的 TOTP 密钥。在 TOTP 验证成功后调用，清理临时密钥防止重复使用。
   *
   * Deletes a consumed TOTP secret from cache. Called after successful TOTP verification to clean up
   * the temporary secret and prevent reuse.
   *
   * Callers: [AuthApplicationService.verifyTotpRegistration]
   * Called by: [AuthApplicationService.verifyTotpRegistration]
   *
   * Callees: [ISessionCache.removeTotpSecret]
   * Calls: [ISessionCache.removeTotpSecret]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 幂等操作；密钥不存在时静默成功 / idempotent operation; silently succeeds if the key does not exist
   *
   * Side Effects / 副作用:
   * - 删除缓存条目 / deletes a cache entry
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: TOTP密钥, 缓存删除, 密钥清理, 消费完成, 防重用
   * English keywords: TOTP secret, cache delete, secret cleanup, consumed, reuse prevention
   */
  public async removeTotpSecret(userId: string): Promise<void> {
    await this.authCache.removeTotpSecret(userId)
  }

  /**
   * Function: revokeAllUserSessions
   * --------------------------------
   * 撤销指定用户的所有会话。用于密码重置后强制用户重新登录，或管理员封禁/降级用户时踢下线。
   *
   * Revokes all sessions for a specific user. Used to force re-login after a password reset,
   * or to kick a user offline when an admin bans/downgrades them.
   *
   * Callers: [UserController.revokeAllSessions, AdminController.kickUser, AdminController.updateUserRole,
   *           AdminController.updateUserLevel, AdminController.banUser, RegisterController.registerUser]
   * Called by: [UserController.revokeAllSessions, AdminController.kickUser, AdminController.updateUserRole,
   *              AdminController.updateUserLevel, AdminController.banUser, RegisterController.registerUser]
   *
   * Callees: [ISessionRepository.deleteManyByUserId]
   * Calls: [ISessionRepository.deleteManyByUserId]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 幂等操作；用户无会话时静默成功 / idempotent; silently succeeds if the user has no sessions
   *
   * Side Effects / 副作用:
   * - 批量删除数据库中的会话记录 / batch deletes session records from the database
   *
   * Transaction / 事务:
   * - 无事务边界，单次批量操作 / no transaction boundary, single batch operation
   *
   * 中文关键词: 撤销会话, 强制登出, 密码重置, 管理员操作, 批量删除, 账户安全, 会话管理
   * English keywords: revoke sessions, force logout, password reset, admin action, batch delete, account security, session management
   */
  public async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.deleteManyByUserId(userId)
  }

  /**
   * Function: validateSession
   * --------------------------
   * 验证会话的有效性并获取用户上下文。检查会话是否存在、用户是否存在以及用户是否被封禁。
   * 用于中间件的请求鉴权和令牌刷新逻辑。
   *
   * Validates a session and retrieves the user context. Checks whether the session exists,
   * the user exists, and the user is not banned. Used for request authorization in middleware
   * and token refresh logic.
   *
   * Callers: [requireAuth middleware]
   * Called by: [requireAuth middleware]
   *
   * Callees: [ISessionRepository.findById, IUserRepository.findById, IRoleRepository.findById]
   * Calls: [ISessionRepository.findById, IUserRepository.findById, IRoleRepository.findById]
   *
   * Parameters:
   * - sessionId: string, 会话 ID / the session ID
   * - userId: string, 用户 ID / the user's ID
   *
   * Returns:
   * - Promise<{ isValid: boolean, reason?: string, user?: User, roleName?: string }>
   *   验证结果（是否有效、失败原因、用户对象、角色名）
   *   validation result (validity flag, failure reason, user object, role name)
   *
   * Error Handling / 错误处理:
   * - 不抛出异常；验证失败时返回带有原因的 invalid 结果
   *   Does not throw; returns an invalid result with a reason on failure
   * - SESSION_NOT_FOUND: 会话不存在 / session not found
   * - USER_NOT_FOUND: 用户不存在 / user not found
   * - USER_BANNED: 用户被封禁 / user is banned
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取操作 / no side effects, pure read operations
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 会话验证, 请求鉴权, 中间件, 用户状态检查, 角色解析, 令牌刷新, 安全校验
   * English keywords: session validation, request authorization, middleware, user status check, role resolution, token refresh, security check
   */
  public async validateSession(
    sessionId: string,
    userId: string,
  ): Promise<{
    isValid: boolean
    reason?: 'SESSION_NOT_FOUND' | 'USER_NOT_FOUND' | 'USER_BANNED'
    user?: User
    roleName?: string
  }> {
    const session = await this.sessionRepository.findById(sessionId)
    if (!session) {
      return { isValid: false, reason: 'SESSION_NOT_FOUND' }
    }

    const user = await this.userRepository.findById(userId)
    if (!user) {
      return { isValid: false, reason: 'USER_NOT_FOUND' }
    }
    if (user.status === UserStatus.BANNED) {
      return { isValid: false, reason: 'USER_BANNED' }
    }

    let roleName = 'USER'
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId)
      if (role) {
        roleName = role.name
      }
    }

    return { isValid: true, user, roleName }
  }

  // --- AuthChallenge Orchestration ---

  /**
   * Function: generateAuthChallenge
   * ---------------------------------
   * 生成新的认证挑战（用于 WebAuthn 等）。创建 AuthChallenge 实体，设置过期时间（默认 5 分钟），
   * 并保存到仓储中。
   *
   * Generates a new authentication challenge (for WebAuthn, etc.). Creates an AuthChallenge entity,
   * sets the expiration time (default 5 minutes), and persists it to the repository.
   *
   * Callers: [AuthController.getPasskeyOptions, SudoController.getSudoPasskeyOptions,
   *           AuthApplicationService.generatePasskeyRegistrationOptions,
   *           AuthApplicationService.generatePasskeyAuthenticationOptions]
   * Called by: [AuthController.getPasskeyOptions, SudoController.getSudoPasskeyOptions,
   *              AuthApplicationService.generatePasskeyRegistrationOptions,
   *              AuthApplicationService.generatePasskeyAuthenticationOptions]
   *
   * Callees: [AuthChallenge.create, IAuthChallengeRepository.save]
   * Calls: [AuthChallenge.create, IAuthChallengeRepository.save]
   *
   * Parameters:
   * - challengeString: string, WebAuthn 的 challenge 字符串 / the WebAuthn challenge string
   * - expiresInMs: number, 过期时间（毫秒），默认 5 分钟 / expiration in milliseconds, default 5 minutes
   *
   * Returns:
   * - Promise<AuthChallenge>, 创建的认证挑战实体 / the created AuthChallenge entity
   *
   * Error Handling / 错误处理:
   * - 仓储保存失败时抛出基础设施异常 / repository save failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 写入数据库 / writes to database
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 认证挑战, WebAuthn, challenge生成, 过期时间, 挑战存储, FIDO2, 安全挑战
   * English keywords: auth challenge, WebAuthn, challenge generation, expiration, challenge storage, FIDO2, security challenge
   */
  public async generateAuthChallenge(
    challengeString: string,
    expiresInMs: number = 5 * 60 * 1000,
  ): Promise<AuthChallenge> {
    const challenge = AuthChallenge.create({
      id: uuidv4(),
      challenge: challengeString,
      expiresAt: new Date(Date.now() + expiresInMs),
    })

    await this.authChallengeRepository.save(challenge)
    return challenge
  }

  /**
   * Function: consumeAuthChallenge
   * --------------------------------
   * 消费（验证并删除）认证挑战。查找挑战，检查是否过期，验证通过后删除以防止重复使用。
   *
   * Consumes (validates and deletes) an authentication challenge. Looks up the challenge, checks
   * whether it has expired, and deletes it after validation to prevent reuse.
   *
   * Callers: [AuthController.verifyPasskeyAuthentication, AuthController.verifyPasskeyRegistration,
   *           SudoController.verifySudo,
   *           AuthApplicationService.verifyPasskeyRegistration,
   *           AuthApplicationService.verifyPasskeyAuthenticationResponse]
   * Called by: [AuthController.verifyPasskeyAuthentication, AuthController.verifyPasskeyRegistration,
   *              SudoController.verifySudo,
   *              AuthApplicationService.verifyPasskeyRegistration,
   *              AuthApplicationService.verifyPasskeyAuthenticationResponse]
   *
   * Callees: [IAuthChallengeRepository.findById, AuthChallenge.validateForConsumption,
   *           IAuthChallengeRepository.delete]
   * Calls: [IAuthChallengeRepository.findById, AuthChallenge.validateForConsumption,
   *         IAuthChallengeRepository.delete]
   *
   * Parameters:
   * - challengeId: string, 要消费的认证挑战 ID / the auth challenge ID to consume
   *
   * Returns:
   * - Promise<AuthChallenge>, 被消费的认证挑战实体 / the consumed AuthChallenge entity
   *
   * Error Handling / 错误处理:
   * - ERR_CHALLENGE_NOT_FOUND: 挑战 ID 不存在 / challenge ID not found
   * - AuthChallenge.validateForConsumption 抛出过期异常 / throws expiration exception from validateForConsumption
   *
   * Side Effects / 副作用:
   * - 删除数据库中的挑战记录 / deletes the challenge record from the database
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 挑战消费, 认证挑战, 一次性使用, 防重放, 挑战验证, 过期检查, 挑战删除
   * English keywords: challenge consumption, auth challenge, single-use, replay prevention, challenge validation, expiration check, challenge deletion
   */
  public async consumeAuthChallenge(challengeId: string): Promise<AuthChallenge> {
    const challenge = await this.authChallengeRepository.findById(challengeId)
    if (!challenge) {
      throw new Error('ERR_CHALLENGE_NOT_FOUND')
    }

    challenge.validateForConsumption()
    await this.authChallengeRepository.delete(challengeId)

    return challenge
  }

  // --- Passkey Orchestration ---

  /**
   * Function: generatePasskeyAuthenticationOptions
   * ------------------------------------------------
   * 生成 WebAuthn Passkey 认证选项。如果提供了 userId，则查找该用户的通行密钥并放入 allowCredentials 限制可用凭据；
   * 如果没有 userId（匿名登录场景），则生成不限制凭据的认证选项。同时创建认证挑战并返回 challengeId。
   *
   * Generates WebAuthn Passkey authentication options. If userId is provided, looks up the user's passkeys
   * and places them in allowCredentials to restrict available credentials; if no userId (anonymous login scenario),
   * generates authentication options without credential restrictions. Also creates an authentication challenge
   * and returns its ID.
   *
   * Callers: [AuthController, AuthApplicationService.processGeneratePasskeyAuthenticationOptions]
   * Called by: [AuthController, AuthApplicationService.processGeneratePasskeyAuthenticationOptions]
   *
   * Callees: [IPasskeyRepository.findByUserId, IPasskeyPort.generateAuthenticationOptions,
   *           AuthApplicationService.generateAuthChallenge]
   * Calls: [IPasskeyRepository.findByUserId, IPasskeyPort.generateAuthenticationOptions,
   *         AuthApplicationService.generateAuthChallenge]
   *
   * Parameters:
   * - userId: string | undefined, 可选，用户 ID，提供时限制可用的通行密钥列表 / optional user ID, restricts the available passkey list when provided
   *
   * Returns:
   * - Promise<any>, 包含 WebAuthn 认证选项和 challengeId / WebAuthn authentication options plus challengeId
   *
   * Error Handling / 错误处理:
   * - 无显式业务异常 / no explicit business exceptions
   *
   * Side Effects / 副作用:
   * - 写入 IAuthChallengeRepository（通过 generateAuthChallenge）/ writes to IAuthChallengeRepository (via generateAuthChallenge)
   *
   * Transaction / 事务:
   * - 无显式事务边界 / no explicit transaction boundary
   *
   * 中文关键词: 通行密钥, WebAuthn, 认证选项, 允许凭据, 匿名登录, 认证挑战, 免密码登录, FIDO2, 凭据选择, 安全认证
   * English keywords: passkey, WebAuthn, authentication options, allow credentials, anonymous login, auth challenge, passwordless login, FIDO2, credential selection, secure auth
   */
  public async generatePasskeyAuthenticationOptions(userId?: string): Promise<any> {
    let allowCredentials: any[] = []

    if (userId) {
      const userPasskeys = await this.passkeyRepository.findByUserId(userId)
      allowCredentials = userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: ['internal'] as any,
      }))
    }

    const options = await this.passkeyPort.generateAuthenticationOptions(allowCredentials)
    const authChallenge = await this.generateAuthChallenge(options.challenge)

    return { ...options, challengeId: authChallenge.id }
  }

  /**
   * Function: processGeneratePasskeyAuthenticationOptions
   * ------------------------------------------------------
   * 处理 Passkey 认证选项生成请求。如果提供了临时令牌，则从令牌中解析用户并生成该用户的 passkey 认证选项；
   * 否则生成匿名（免密码登录）passkey 认证选项。
   *
   * Processes a request to generate Passkey authentication options. If a temp token is provided, resolves
   * the user from the token and generates passkey authentication options for that user; otherwise generates
   * anonymous (passwordless login) passkey authentication options.
   *
   * Callers: [AuthController]
   * Called by: [AuthController]
   *
   * Callees: [AuthApplicationService.getUserFromTempToken, AuthApplicationService.generatePasskeyAuthenticationOptions]
   * Calls: [AuthApplicationService.getUserFromTempToken, AuthApplicationService.generatePasskeyAuthenticationOptions]
   *
   * Parameters:
   * - tempToken: string | undefined, 可选，登录流程中的临时令牌 / optional temp token from the login flow
   *
   * Returns:
   * - Promise<any>, WebAuthn 认证选项（可能包含用户特定的凭据限制）/ WebAuthn authentication options (may include user-specific credential restrictions)
   *
   * Error Handling / 错误处理:
   * - ERR_UNAUTHORIZED: 临时令牌无效或已过期 / temp token is invalid or expired
   *
   * Side Effects / 副作用:
   * - 写入 IAuthChallengeRepository（通过 generatePasskeyAuthenticationOptions）/ writes to IAuthChallengeRepository (via generatePasskeyAuthenticationOptions)
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 通行密钥, 认证选项处理, 临时令牌, 用户解析, 免密码登录, 匿名认证, 流程编排
   * English keywords: passkey, auth options processing, temp token, user resolution, passwordless login, anonymous auth, flow orchestration
   */
  public async processGeneratePasskeyAuthenticationOptions(
    tempToken: string | undefined,
  ): Promise<any> {
    if (tempToken) {
      const user = await this.getUserFromTempToken(tempToken, 'login')
      if (!user) {
        throw new Error('ERR_UNAUTHORIZED')
      }
      return await this.generatePasskeyAuthenticationOptions(user.id)
    }
    return await this.generatePasskeyAuthenticationOptions()
  }

  /**
   * Function: processPasskeyAuthentication
   * ---------------------------------------
   * 处理 Passkey 认证请求。如果提供了临时令牌，则从令牌解析用户并进行用户关联的认证；
   * 否则进行免密码登录认证。统一调用 verifyPasskeyAuthenticationResponse 完成实际验证。
   *
   * Processes a Passkey authentication request. If a temp token is provided, resolves the user from the token
   * and performs user-associated authentication; otherwise performs passwordless login authentication.
   * Delegates the actual verification to verifyPasskeyAuthenticationResponse.
   *
   * Callers: [AuthController]
   * Called by: [AuthController]
   *
   * Callees: [AuthApplicationService.getUserFromTempToken, AuthApplicationService.verifyPasskeyAuthenticationResponse]
   * Calls: [AuthApplicationService.getUserFromTempToken, AuthApplicationService.verifyPasskeyAuthenticationResponse]
   *
   * Parameters:
   * - response: any, WebAuthn 认证响应对象 / the WebAuthn authentication response object
   * - challengeId: string | undefined, 认证挑战 ID / the authentication challenge ID
   * - tempToken: string | undefined, 可选，登录临时令牌 / optional login temp token
   *
   * Returns:
   * - Promise<any>, 认证结果（包含 verified 标志和用户信息）/ authentication result (contains verified flag and user info)
   *
   * Error Handling / 错误处理:
   * - ERR_UNAUTHORIZED: 临时令牌无效 / temp token is invalid
   * - ERR_CHALLENGE_ID_IS_REQUIRED: 缺少 challengeId / challengeId is missing
   * - ERR_CHALLENGE_ID_IS_REQUIRED_FOR_PASSWORDLESS_LOGIN: 免密码登录时缺少 challengeId / challengeId is missing for passwordless login
   *
   * Side Effects / 副作用:
   * - 通过 verifyPasskeyAuthenticationResponse 写入数据库和缓存 / writes to database and cache via verifyPasskeyAuthenticationResponse
   *
   * Transaction / 事务:
   * - 通过 verifyPasskeyAuthenticationResponse 在事务内执行 / executed within a transaction via verifyPasskeyAuthenticationResponse
   *
   * 中文关键词: 通行密钥认证, 流程处理, 临时令牌, 免密码登录, 验证委托, 响应处理, 认证编排
   * English keywords: passkey auth, flow processing, temp token, passwordless login, verification delegation, response handling, auth orchestration
   */
  public async processPasskeyAuthentication(
    response: any,
    challengeId: string | undefined,
    tempToken: string | undefined,
  ): Promise<any> {
    let userId: string | undefined

    if (tempToken) {
      const user = await this.getUserFromTempToken(tempToken, 'login')
      if (!user) {
        throw new Error('ERR_UNAUTHORIZED')
      }
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED')
      }
      userId = user.id
    } else {
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED_FOR_PASSWORDLESS_LOGIN')
      }
    }

    return await this.verifyPasskeyAuthenticationResponse(userId, response, challengeId)
  }

  /**
   * Function: verifyPasskeyAuthenticationResponse
   * -----------------------------------------------
   * 在事务内验证 Passkey 认证响应。消费认证挑战，查找对应的通行密钥，调用 passkeyPort 验证认证响应，
   * 更新通行密钥计数器以防重放攻击，获取用户信息并返回。
   *
   * Verifies the Passkey authentication response within a transaction. Consumes the auth challenge,
   * looks up the corresponding passkey, calls the passkeyPort to verify the authentication response,
   * updates the passkey counter to prevent replay attacks, retrieves user info and returns it.
   *
   * Callers: [AuthApplicationService.processPasskeyAuthentication]
   * Called by: [AuthApplicationService.processPasskeyAuthentication]
   *
   * Callees: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyRepository.findById,
   *           IPasskeyPort.verifyAuthenticationResponse, AuthApplicationService.updatePasskeyCounter,
   *           IUserRepository.findById, IRoleRepository.findById]
   * Calls: [IUnitOfWork.execute, AuthApplicationService.consumeAuthChallenge, IPasskeyRepository.findById,
   *         IPasskeyPort.verifyAuthenticationResponse, AuthApplicationService.updatePasskeyCounter,
   *         IUserRepository.findById, IRoleRepository.findById]
   *
   * Parameters:
   * - userId: string | undefined, 可选，期望的用户 ID（用于校验）/ optional expected user ID (for ownership check)
   * - response: any, WebAuthn 认证响应对象 / the WebAuthn authentication response object
   * - challengeId: string, 认证挑战 ID / the authentication challenge ID
   *
   * Returns:
   * - Promise<any>, 认证结果（包含 verified 状态和用户信息）/ authentication result (verified flag and user info)
   *
   * Error Handling / 错误处理:
   * - ERR_CHALLENGE_ID_IS_REQUIRED: 缺少 challengeId / challengeId is required
   * - ERR_PASSKEY_NOT_FOUND: 通行密钥未找到 / passkey not found
   * - ERR_PASSKEY_DOES_NOT_BELONG_TO_USER: 通行密钥不属于指定用户 / passkey does not belong to the specified user
   * - ERR_USER_NOT_FOUND: 用户不存在 / user not found
   * - ERR_VERIFICATION_FAILED: 认证验证失败 / authentication verification failed
   *
   * Side Effects / 副作用:
   * - 更新通行密钥计数器 / updates the passkey counter
   * - 删除已消费的认证挑战 / deletes the consumed auth challenge
   *
   * Transaction / 事务:
   * - 通过 IUnitOfWork.execute 管理事务边界 / transaction boundary managed by IUnitOfWork.execute
   *
   * 中文关键词: 通行密钥, 认证验证, 事务处理, 防重放攻击, WebAuthn, 凭据查找, 计数器更新, 用户信息
   * English keywords: passkey, authentication verification, transaction, replay attack prevention, WebAuthn, credential lookup, counter update, user info
   */
  public async verifyPasskeyAuthenticationResponse(
    userId: string | undefined,
    response: any,
    challengeId: string,
  ): Promise<any> {
    return this.unitOfWork.execute(async () => {
      if (!challengeId) {
        throw new Error('ERR_CHALLENGE_ID_IS_REQUIRED')
      }

      const expectedChallenge = await this.consumeAuthChallenge(challengeId)

      const passkey = await this.passkeyRepository.findById(response.id)
      if (!passkey) {
        throw new Error('ERR_PASSKEY_NOT_FOUND')
      }

      if (userId && passkey.userId !== userId) {
        throw new Error('ERR_PASSKEY_DOES_NOT_BELONG_TO_USER')
      }

      const credential = {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      }

      const verification = await this.passkeyPort.verifyAuthenticationResponse(
        response,
        expectedChallenge.challenge,
        origin,
        rpID,
        credential,
      )

      if (verification.verified && verification.authenticationInfo) {
        const { newCounter } = verification.authenticationInfo
        await this.updatePasskeyCounter(passkey.id, BigInt(newCounter))

        const authenticatedUserId = passkey.userId
        const user = await this.userRepository.findById(authenticatedUserId)
        if (!user) throw new Error('ERR_USER_NOT_FOUND')

        let roleName = null
        if (user.roleId) {
          const role = await this.roleRepository.findById(user.roleId)
          if (role) roleName = role.name
        }

        return {
          verified: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: { name: roleName },
          },
        }
      } else {
        throw new Error('ERR_VERIFICATION_FAILED')
      }
    })
  }

  /**
   * Function: verifyTotpLogin
   * --------------------------
   * 在登录流程中验证 TOTP 动态口令。查找用户，检查 TOTP 是否已启用，验证动态口令，成功后返回用户信息。
   *
   * Verifies a TOTP code during the login flow. Looks up the user, checks whether TOTP is enabled,
   * verifies the code, and returns user info on success.
   *
   * Callers: [AuthController]
   * Called by: [AuthController]
   *
   * Callees: [IUserRepository.findById, ITotpPort.verify, IRoleRepository.findById]
   * Calls: [IUserRepository.findById, ITotpPort.verify, IRoleRepository.findById]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - code: string, 用户输入的 TOTP 动态口令 / the TOTP code entered by the user
   *
   * Returns:
   * - Promise<any>, 验证成功返回用户信息对象（id, username, email, role）/ on success returns user info object (id, username, email, role)
   *
   * Error Handling / 错误处理:
   * - ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED: 用户不存在或 TOTP 未启用 / user not found or TOTP not enabled
   * - ERR_INVALID_TOTP_CODE: 动态口令不正确 / the TOTP code is incorrect
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 + 验证 / no side effects, pure read + verification
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: TOTP验证, 登录验证, 动态口令, 双因素认证, 用户查找, 角色解析, 安全登录
   * English keywords: TOTP verification, login verification, one-time code, two-factor auth, user lookup, role resolution, secure login
   */
  public async verifyTotpLogin(userId: string, code: string): Promise<any> {
    const user = await this.userRepository.findById(userId)
    if (!user || !user.isTotpEnabled || !user.totpSecret) {
      throw new Error('ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED')
    }

    const isValid = this.totpPort.verify(user.totpSecret, code)
    if (!isValid) {
      throw new Error('ERR_INVALID_TOTP_CODE')
    }

    let roleName = null
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId)
      if (role) roleName = role.name
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: { name: roleName },
    }
  }

  /**
   * Function: getUserFromTempToken
   * -------------------------------
   * 从临时令牌中解析用户信息。验证令牌有效且类型匹配，查找用户并返回包含角色信息的用户对象。
   * 令牌无效、类型不匹配或用户不存在时返回 null（不抛异常，供调用方优雅处理）。
   *
   * Resolves user info from a temp token. Verifies that the token is valid and the type matches,
   * looks up the user, and returns a user object with role info. Returns null if the token is invalid,
   * the type does not match, or the user is not found (no exception thrown, allowing graceful handling by caller).
   *
   * Callers: [AuthApplicationService.processGeneratePasskeyAuthenticationOptions,
   *           AuthApplicationService.processPasskeyAuthentication]
   * Called by: [AuthApplicationService.processGeneratePasskeyAuthenticationOptions,
   *              AuthApplicationService.processPasskeyAuthentication]
   *
   * Callees: [AuthApplicationService.verifyTempToken, IUserRepository.findById, IRoleRepository.findById]
   * Calls: [AuthApplicationService.verifyTempToken, IUserRepository.findById, IRoleRepository.findById]
   *
   * Parameters:
   * - tempToken: string | undefined, 临时令牌（可能为空）/ the temp token (may be undefined)
   * - expectedType: 'registration' | 'login', 期望的令牌类型，默认为 'registration' / the expected token type, defaults to 'registration'
   *
   * Returns:
   * - Promise<any>, 成功返回用户对象（含 id, username, email, role, isTotpEnabled, totpSecret），失败返回 null
   *   On success returns a user object (with id, username, email, role, isTotpEnabled, totpSecret); on failure returns null
   *
   * Error Handling / 错误处理:
   * - 不抛出异常；令牌解析异常时捕获并返回 null / does not throw; catches token parsing exceptions and returns null
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取 / no side effects, pure read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 临时令牌, 用户解析, 令牌验证, 类型检查, 用户查找, 角色解析, 注册流程, 登录流程, 安全令牌, 优雅降级
   * English keywords: temp token, user resolution, token verification, type check, user lookup, role resolution, registration flow, login flow, secure token, graceful degradation
   */
  public async getUserFromTempToken(
    tempToken: string | undefined,
    expectedType: 'registration' | 'login' = 'registration',
  ): Promise<any> {
    if (!tempToken) return null
    try {
      const decoded = this.verifyTempToken(tempToken)
      if (decoded.type !== expectedType) return null

      const user = await this.userRepository.findById(decoded.userId)
      if (!user) return null

      let roleName = null
      if (user.roleId) {
        const role = await this.roleRepository.findById(user.roleId)
        if (role) roleName = role.name
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: { name: roleName },
        isTotpEnabled: user.isTotpEnabled,
        totpSecret: user.totpSecret,
      }
    } catch (err) {
      return null
    }
  }

  /**
   * Function: verifyTempToken
   * --------------------------
   * 验证临时令牌（JWT）的有效性。使用 JWT_SECRET 解密令牌并返回载荷。
   *
   * Verifies a temp token (JWT). Decrypts the token using JWT_SECRET and returns the payload.
   *
   * Callers: [AuthApplicationService.getUserFromTempToken]
   * Called by: [AuthApplicationService.getUserFromTempToken]
   *
   * Callees: [ITokenPort.verify]
   * Calls: [ITokenPort.verify]
   *
   * Parameters:
   * - token: string, JWT 格式的临时令牌 / the temp token in JWT format
   *
   * Returns:
   * - any, 解密后的令牌载荷（包含 userId, type 等）/ the decoded token payload (contains userId, type, etc.)
   *
   * Error Handling / 错误处理:
   * - 令牌无效或过期时抛出异常，由调用方 getUserFromTempToken 捕获
   *   Throws on invalid or expired token; caught by the caller getUserFromTempToken
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 令牌验证, JWT, 临时令牌, 令牌解密, 载荷解析
   * English keywords: token verification, JWT, temp token, token decode, payload parsing
   */
  public verifyTempToken(token: string): any {
    return this.tokenPort.verify(token, process.env.JWT_SECRET as string)
  }

  /**
   * Function: generateTempToken
   * ----------------------------
   * 生成临时 JWT 令牌，包含用户 ID 和类型信息，有效期 1 小时。用于注册流程的 2FA 交接和登录流程的 2FA 验证。
   *
   * Generates a temporary JWT token containing user ID and type information, valid for 1 hour.
   * Used for the 2FA handoff in the registration flow and 2FA verification in the login flow.
   *
   * Callers: [AuthApplicationService.loginUser, AuthController, RegisterController]
   * Called by: [AuthApplicationService.loginUser, AuthController, RegisterController]
   *
   * Callees: [ITokenPort.sign]
   * Calls: [ITokenPort.sign]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - type: 'registration' | 'login', 令牌类型 / the token type
   *
   * Returns:
   * - string, JWT 格式的临时令牌 / the temp token in JWT format
   *
   * Error Handling / 错误处理:
   * - 签名失败时抛出异常，由调用方处理 / throws on signing failure; handled by the caller
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 令牌生成, JWT, 临时令牌, 签名, 有效期, 注册流程, 登录流程, 双因素认证
   * English keywords: token generation, JWT, temp token, sign, expiry, registration flow, login flow, two-factor auth
   */
  public generateTempToken(userId: string, type: 'registration' | 'login'): string {
    return this.tokenPort.sign({ userId, type }, process.env.JWT_SECRET as string, '1h')
  }

  /**
   * Function: verifyRefreshToken
   * -----------------------------
   * 验证刷新令牌（JWT）的有效性。使用 JWT_REFRESH_SECRET 解密令牌并返回载荷。
   *
   * Verifies a refresh token (JWT). Decrypts the token using JWT_REFRESH_SECRET and returns the payload.
   *
   * Callers: [AuthApplicationService.refreshAccessToken]
   * Called by: [AuthApplicationService.refreshAccessToken]
   *
   * Callees: [ITokenPort.verify]
   * Calls: [ITokenPort.verify]
   *
   * Parameters:
   * - token: string, JWT 格式的刷新令牌 / the refresh token in JWT format
   *
   * Returns:
   * - any, 解密后的令牌载荷（包含 userId, sessionId 等）/ the decoded token payload (contains userId, sessionId, etc.)
   *
   * Error Handling / 错误处理:
   * - 令牌无效或过期时抛出异常，由调用方 refreshAccessToken 处理
   *   Throws on invalid or expired token; handled by the caller refreshAccessToken
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 刷新令牌, JWT验证, 令牌刷新, 会话续期, 令牌解密, 长期令牌
   * English keywords: refresh token, JWT verification, token refresh, session renewal, token decode, long-lived token
   */
  public verifyRefreshToken(token: string): any {
    return this.tokenPort.verify(token, process.env.JWT_REFRESH_SECRET as string)
  }

  /**
   * Function: generateAccessToken
   * ------------------------------
   * 生成短期访问令牌（JWT），有效期 15 分钟。包含用户 ID、角色名和会话 ID，用于 API 请求的鉴权。
   *
   * Generates a short-lived access token (JWT), valid for 15 minutes. Contains the user ID, role name,
   * and session ID, used for API request authorization.
   *
   * Callers: [AuthApplicationService.refreshAccessToken, AuthController]
   * Called by: [AuthApplicationService.refreshAccessToken, AuthController]
   *
   * Callees: [ITokenPort.sign]
   * Calls: [ITokenPort.sign]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - roleName: string | null, 用户角色名（可为空）/ the user's role name (may be null)
   * - sessionId: string, 会话 ID / the session ID
   *
   * Returns:
   * - string, JWT 格式的访问令牌 / the access token in JWT format
   *
   * Error Handling / 错误处理:
   * - 签名失败时抛出异常 / throws on signing failure
   *
   * Side Effects / 副作用:
   * - 无副作用 / no side effects
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 访问令牌, JWT, 短期令牌, 签名, 会话绑定, 角色鉴权, API安全
   * English keywords: access token, JWT, short-lived token, sign, session binding, role auth, API security
   */
  public generateAccessToken(userId: string, roleName: string | null, sessionId: string): string {
    return this.tokenPort.sign(
      { userId, role: roleName, sessionId },
      process.env.JWT_SECRET as string,
      '15m',
    )
  }

  /**
   * Function: refreshAccessToken
   * -----------------------------
   * 使用刷新令牌获取新的访问令牌。验证刷新令牌的有效性，检查对应会话是否仍然存在，验证用户状态，
   * 然后生成新的 15 分钟访问令牌。被封禁用户的刷新请求会被拒绝。
   *
   * Uses a refresh token to obtain a new access token. Verifies the refresh token's validity, checks
   * that the corresponding session still exists, validates the user's status, then generates a new
   * 15-minute access token. Refresh requests from banned users are rejected.
   *
   * Callers: [AuthController]
   * Called by: [AuthController]
   *
   * Callees: [AuthApplicationService.verifyRefreshToken, ISessionRepository.findById,
   *           IUserRepository.findById, IRoleRepository.findById, AuthApplicationService.generateAccessToken]
   * Calls: [AuthApplicationService.verifyRefreshToken, ISessionRepository.findById,
   *         IUserRepository.findById, IRoleRepository.findById, AuthApplicationService.generateAccessToken]
   *
   * Parameters:
   * - refreshTokenStr: string, JWT 格式的刷新令牌 / the refresh token in JWT format
   *
   * Returns:
   * - Promise<{ accessToken: string }>, 包含新访问令牌的对象 / an object containing the new access token
   *
   * Error Handling / 错误处理:
   * - ERR_SESSION_REVOKED_OR_INVALID: 会话已被撤销或不存在 / session was revoked or does not exist
   * - ERR_INVALID_REFRESH_TOKEN: 刷新令牌无效或用户不存在 / refresh token is invalid or user not found
   * - ERR_ACCOUNT_IS_BANNED: 账号已被封禁 / the account is banned
   *
   * Side Effects / 副作用:
   * - 无副作用，纯读取操作 / no side effects, pure read operations
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 令牌刷新, 访问令牌, 刷新令牌, 会话检查, 用户状态验证, 角色解析, JWT, 令牌续期, 安全鉴权, 账号状态
   * English keywords: token refresh, access token, refresh token, session check, user status validation, role resolution, JWT, token renewal, secure auth, account status
   */
  public async refreshAccessToken(refreshTokenStr: string): Promise<{ accessToken: string }> {
    const decoded = this.verifyRefreshToken(refreshTokenStr)

    if (decoded.sessionId) {
      const session = await this.sessionRepository.findById(decoded.sessionId)
      if (!session) {
        throw new Error('ERR_SESSION_REVOKED_OR_INVALID')
      }
    }

    const user = await this.userRepository.findById(decoded.userId)
    if (!user) {
      throw new Error('ERR_INVALID_REFRESH_TOKEN')
    }

    if (user.status === UserStatus.BANNED) {
      throw new Error('ERR_ACCOUNT_IS_BANNED')
    }

    let roleName = null
    if (user.roleId) {
      const role = await this.roleRepository.findById(user.roleId)
      if (role) roleName = role.name
    }

    const accessToken = this.generateAccessToken(user.id, roleName, decoded.sessionId)
    return { accessToken }
  }

  /**
   * Function: logout
   * -----------------
   * 处理用户登出。从访问令牌或刷新令牌中提取会话 ID，然后撤销该会话。令牌可能已过期但允许使用 ignoreExpiration 解析。
   *
   * Handles user logout. Extracts the session ID from either the access token or the refresh token,
   * then revokes that session. Expired tokens are still parsed using ignoreExpiration.
   *
   * Callers: [AuthController, RegisterController]
   * Called by: [AuthController, RegisterController]
   *
   * Callees: [ITokenPort.verify, AuthApplicationService.revokeSession]
   * Calls: [ITokenPort.verify, AuthApplicationService.revokeSession]
   *
   * Parameters:
   * - accessToken: string | undefined, 可选，JWT 访问令牌 / optional JWT access token
   * - refreshToken: string | undefined, 可选，JWT 刷新令牌 / optional JWT refresh token
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 令牌解析异常被静默忽略（catch 空处理），确保登出不会因无效令牌而失败
   *   Token parsing exceptions are silently ignored to ensure logout does not fail due to invalid tokens
   *
   * Side Effects / 副作用:
   * - 撤销会话（通过 revokeSession）/ revokes a session (via revokeSession)
   * - 删除缓存中的会话数据 / deletes session data from cache
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 登出, 会话撤销, 令牌解析, 访问令牌, 刷新令牌, 幂等操作, 安全退出, 会话清理
   * English keywords: logout, session revocation, token parsing, access token, refresh token, idempotent, secure exit, session cleanup
   */
  public async logout(accessToken?: string, refreshToken?: string): Promise<void> {
    let sessionId = null

    if (accessToken) {
      try {
        const decoded = this.tokenPort.verify(accessToken, process.env.JWT_SECRET as string, {
          ignoreExpiration: true,
        })
        if (decoded.sessionId) sessionId = decoded.sessionId
      } catch (e) {
        // ignore invalid token errors
      }
    }

    if (!sessionId && refreshToken) {
      try {
        const decoded = this.tokenPort.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET as string,
          { ignoreExpiration: true },
        )
        if (decoded.sessionId) sessionId = decoded.sessionId
      } catch (e) {
        // ignore
      }
    }

    if (sessionId) {
      await this.revokeSession(sessionId)
    }
  }

  /**
   * Function: finalizeAuth
   * -----------------------
   * 完成认证流程。创建用户会话（7 天有效期），然后生成访问令牌（15 分钟）和刷新令牌（7 天），返回给客户端。
   * 在登录/注册 2FA 验证成功后调用。
   *
   * Finalizes the authentication flow. Creates a user session (7-day validity), then generates both
   * an access token (15 minutes) and a refresh token (7 days), returning them to the client.
   * Called after successful login/registration 2FA verification.
   *
   * Callers: [AuthController, RegisterController]
   * Called by: [AuthController, RegisterController]
   *
   * Callees: [AuthApplicationService.createSession, ITokenPort.sign]
   * Calls: [AuthApplicationService.createSession, ITokenPort.sign]
   *
   * Parameters:
   * - user: any, 用户对象（含 id, role 信息）/ the user object (contains id, role info)
   * - ip: string | null, 客户端 IP 地址 / the client's IP address
   * - userAgent: string | null, 客户端 User-Agent / the client's User-Agent string
   *
   * Returns:
   * - Promise<{ accessToken: string, refreshToken: string }>, 包含访问令牌和刷新令牌的对象
   *   an object containing the access token and the refresh token
   *
   * Error Handling / 错误处理:
   * - 会话创建失败时抛出异常，由调用方处理 / throws on session creation failure; handled by the caller
   *
   * Side Effects / 副作用:
   * - 创建数据库会话记录 / creates a database session record
   * - 生成两个 JWT 令牌 / generates two JWT tokens
   *
   * Transaction / 事务:
   * - 无显式事务边界（createSession 和 tokenPort.sign 是独立的）/ no explicit transaction boundary (createSession and tokenPort.sign are independent)
   *
   * 中文关键词: 认证完成, 会话创建, 访问令牌, 刷新令牌, 令牌签发, 认证收尾, 客户端信息, 安全会话
   * English keywords: auth finalization, session creation, access token, refresh token, token issuance, auth completion, client info, secure session
   */
  public async finalizeAuth(
    user: any,
    ip: string | null,
    userAgent: string | null,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await this.createSession(
      user.id,
      ip,
      userAgent,
      7 * 24 * 60 * 60 * 1000, // 7 days
    )

    const roleName = user.role?.name || user.role || null

    const accessToken = this.tokenPort.sign(
      { userId: user.id, role: roleName, sessionId: session.id },
      process.env.JWT_SECRET as string,
      '15m',
    )

    const refreshToken = this.tokenPort.sign(
      { userId: user.id, role: roleName, sessionId: session.id },
      process.env.JWT_REFRESH_SECRET as string,
      '7d',
    )

    return { accessToken, refreshToken }
  }

  /**
   * Function: addPasskey
   * ---------------------
   * 为用户注册新的 WebAuthn 通行密钥。创建 Passkey 实体并保存到数据库。
   *
   * Registers a new WebAuthn passkey for a user. Creates a Passkey entity and persists it to the database.
   *
   * Callers: [UserController.verifyPasskey, AuthController.verifyPasskeyRegistration,
   *           AuthApplicationService.verifyPasskeyRegistration]
   * Called by: [UserController.verifyPasskey, AuthController.verifyPasskeyRegistration,
   *              AuthApplicationService.verifyPasskeyRegistration]
   *
   * Callees: [Passkey.create, IPasskeyRepository.save]
   * Calls: [Passkey.create, IPasskeyRepository.save]
   *
   * Parameters:
   * - userId: string, 用户 ID / the user's ID
   * - credentialId: string, WebAuthn 凭据 ID / the WebAuthn credential ID
   * - credentialPublicKey: Buffer, 凭据公钥 / the credential public key
   * - webAuthnUserID: string, WebAuthn 用户 ID / the WebAuthn user ID
   * - counter: bigint, 凭据计数器 / the credential counter
   * - deviceType: string, 设备类型（如 'platform'、'cross-platform'）/ the device type
   * - backedUp: boolean, 凭据是否已被备份 / whether the credential has been backed up
   *
   * Returns:
   * - Promise<void>, 无返回值 / no return value
   *
   * Error Handling / 错误处理:
   * - 仓储保存失败时抛出基础设施异常 / repository save failures propagate infrastructure exceptions
   *
   * Side Effects / 副作用:
   * - 写入数据库 / writes to database
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 通行密钥, 凭据注册, WebAuthn, 公钥存储, 设备类型, 生物认证, 免密码, FIDO2
   * English keywords: passkey, credential registration, WebAuthn, public key storage, device type, biometric auth, passwordless, FIDO2
   */
  public async addPasskey(
    userId: string,
    credentialId: string,
    credentialPublicKey: Buffer,
    webAuthnUserID: string,
    counter: bigint,
    deviceType: string,
    backedUp: boolean,
  ): Promise<void> {
    const passkey = Passkey.create({
      id: credentialId,
      userId,
      publicKey: credentialPublicKey,
      webAuthnUserID,
      counter,
      deviceType,
      backedUp,
      createdAt: new Date(),
    })
    await this.passkeyRepository.save(passkey)
  }

  /**
   * Function: deletePasskey
   * ------------------------
   * 删除指定的通行密钥。检查通行密钥是否属于请求用户（防止越权删除）。
   * 如果用户删除后没有剩余的通行密钥，自动将用户降级到 1 级。
   *
   * Deletes a specific passkey. Verifies that the passkey belongs to the requesting user
   * (prevents unauthorized deletion). If the user has no remaining passkeys after deletion,
   * automatically downgrades the user to level 1.
   *
   * Callers: [UserController.deletePasskey]
   * Called by: [UserController.deletePasskey]
   *
   * Callees: [IPasskeyRepository.findById, IPasskeyRepository.delete, IPasskeyRepository.findByUserId,
   *           IUserRepository.findById, User.changeLevel, IUserRepository.save]
   * Calls: [IPasskeyRepository.findById, IPasskeyRepository.delete, IPasskeyRepository.findByUserId,
   *         IUserRepository.findById, User.changeLevel, IUserRepository.save]
   *
   * Parameters:
   * - id: string, 要删除的通行密钥 ID / the passkey ID to delete
   * - requesterUserId: string, 发起删除请求的用户 ID / the ID of the user requesting the deletion
   *
   * Returns:
   * - Promise<string>, 被删除通行密钥所属的用户 ID / the user ID of the deleted passkey's owner
   *
   * Error Handling / 错误处理:
   * - ERR_PASSKEY_NOT_FOUND: 通行密钥不存在 / passkey not found
   * - ERR_FORBIDDEN_NOT_YOUR_PASSKEY: 通行密钥不属于请求用户 / passkey does not belong to the requesting user
   *
   * Side Effects / 副作用:
   * - 删除数据库中的通行密钥记录 / deletes the passkey record from the database
   * - 可能更新用户等级（降级）/ may update the user's level (downgrade)
   *
   * Transaction / 事务:
   * - 无事务边界，最多三次写入（删除 + 可能更新用户等级）
   *   no transaction boundary, at most three writes (delete + possible user level update)
   *
   * 中文关键词: 通行密钥删除, 权限校验, 密钥管理, 用户降级, 凭据清理, 安全删除, 通行密钥管理
   * English keywords: passkey deletion, authorization check, key management, user downgrade, credential cleanup, secure deletion, passkey management
   */
  public async deletePasskey(id: string, requesterUserId: string): Promise<string> {
    const passkey = await this.passkeyRepository.findById(id)
    if (!passkey) {
      throw new Error('ERR_PASSKEY_NOT_FOUND')
    }
    if (passkey.userId !== requesterUserId) {
      throw new Error('ERR_FORBIDDEN_NOT_YOUR_PASSKEY')
    }

    await this.passkeyRepository.delete(id)

    const remainingPasskeys = await this.passkeyRepository.findByUserId(requesterUserId)
    if (remainingPasskeys.length === 0) {
      const user = await this.userRepository.findById(requesterUserId)
      if (user) {
        user.changeLevel(1, false)
        await this.userRepository.save(user)
      }
    }

    return passkey.userId
  }

  /**
   * Function: updatePasskeyCounter
   * --------------------------------
   * 更新通行密钥的计数器以防止重放攻击。每次成功认证后都应更新计数器，使之前的认证响应失效。
   *
   * Updates the passkey counter to prevent replay attacks. The counter should be updated after each
   * successful authentication to invalidate previous authentication responses.
   *
   * Callers: [AuthController.verifyPasskeyAuthentication, AuthApplicationService.verifyPasskeyAuthenticationResponse]
   * Called by: [AuthController.verifyPasskeyAuthentication, AuthApplicationService.verifyPasskeyAuthenticationResponse]
   *
   * Callees: [IPasskeyRepository.findById, Passkey.updateCounter, IPasskeyRepository.save]
   * Calls: [IPasskeyRepository.findById, Passkey.updateCounter, IPasskeyRepository.save]
   *
   * Parameters:
   * - credentialId: string, 通行密钥凭据 ID / the passkey credential ID
   * - newCounter: bigint, 新的计数器值 / the new counter value
   *
   * Returns:
   * - Promise<string>, 更新的通行密钥所属用户 ID / the user ID of the updated passkey's owner
   *
   * Error Handling / 错误处理:
   * - ERR_PASSKEY_NOT_FOUND: 通行密钥不存在 / passkey not found
   *
   * Side Effects / 副作用:
   * - 更新数据库中的通行密钥计数器 / updates the passkey counter in the database
   *
   * Transaction / 事务:
   * - 无事务边界，单次写入 / no transaction boundary, single write
   *
   * 中文关键词: 通行密钥, 计数器更新, 防重放, 认证安全, WebAuthn, 凭据管理, 安全更新
   * English keywords: passkey, counter update, replay prevention, authentication security, WebAuthn, credential management, security update
   */
  public async updatePasskeyCounter(credentialId: string, newCounter: bigint): Promise<string> {
    const passkey = await this.passkeyRepository.findById(credentialId)
    if (!passkey) {
      throw new Error('ERR_PASSKEY_NOT_FOUND')
    }

    passkey.updateCounter(newCounter)
    await this.passkeyRepository.save(passkey)

    return passkey.userId
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
  private async assertRegistrationIdentityAvailable(
    email: string,
    username: string,
  ): Promise<void> {
    const existingEmailUser = await this.userRepository.findByEmail(email)
    if (existingEmailUser) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS')
    }

    const existingUsernameUser = await this.userRepository.findByUsername(username)
    if (existingUsernameUser) {
      throw new Error('ERR_USERNAME_ALREADY_EXISTS')
    }

    const pendingByEmail = await this.emailRegistrationTicketRepository.findByEmail(email)
    if (pendingByEmail && pendingByEmail.username !== username) {
      throw new Error('ERR_EMAIL_ALREADY_EXISTS')
    }

    const pendingByUsername = await this.emailRegistrationTicketRepository.findByUsername(username)
    if (pendingByUsername && pendingByUsername.email !== email) {
      throw new Error('ERR_USERNAME_ALREADY_EXISTS')
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
    const pendingByEmail = await this.emailRegistrationTicketRepository.findByEmail(email)
    if (pendingByEmail && pendingByEmail.username === username) {
      await this.emailRegistrationTicketRepository.delete(pendingByEmail.id)
    }

    const pendingByUsername = await this.emailRegistrationTicketRepository.findByUsername(username)
    if (
      pendingByUsername &&
      pendingByUsername.email === email &&
      pendingByUsername.id !== pendingByEmail?.id
    ) {
      await this.emailRegistrationTicketRepository.delete(pendingByUsername.id)
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
    const pendingByUserId = await this.passwordResetTicketRepository.findByUserId(userId)
    if (pendingByUserId) {
      await this.passwordResetTicketRepository.delete(pendingByUserId.id)
    }

    const pendingByEmail = await this.passwordResetTicketRepository.findByEmail(email)
    if (pendingByEmail && pendingByEmail.id !== pendingByUserId?.id) {
      await this.passwordResetTicketRepository.delete(pendingByEmail.id)
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
  private createEmailRegistrationTicket(
    email: string,
    username: string,
    passwordHash: string,
  ): EmailRegistrationTicket {
    const expiresAt = new Date(Date.now() + this.getEmailRegistrationTtlMinutes() * 60 * 1000)
    return EmailRegistrationTicket.create({
      id: uuidv4(),
      email,
      username,
      passwordHash,
      verificationToken: randomBytes(32).toString('hex'),
      expiresAt,
      createdAt: new Date(),
    })
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
  private createPasswordResetTicket(
    userId: string,
    email: string,
    username: string,
  ): PasswordResetTicket {
    const expiresAt = new Date(Date.now() + this.getPasswordResetTtlMinutes() * 60 * 1000)
    return PasswordResetTicket.create({
      id: uuidv4(),
      userId,
      email,
      username,
      resetToken: randomBytes(32).toString('hex'),
      expiresAt,
      createdAt: new Date(),
    })
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
    const configuredTtlMinutes = process.env.EMAIL_VERIFICATION_TTL_MINUTES
    const parsedTtlMinutes = configuredTtlMinutes
      ? Number.parseInt(configuredTtlMinutes, 10)
      : Number.NaN

    if (!Number.isFinite(parsedTtlMinutes) || parsedTtlMinutes <= 0) {
      return 30
    }

    return parsedTtlMinutes
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
    const configuredTtlMinutes = process.env.PASSWORD_RESET_TTL_MINUTES
    const parsedTtlMinutes = configuredTtlMinutes
      ? Number.parseInt(configuredTtlMinutes, 10)
      : Number.NaN

    if (!Number.isFinite(parsedTtlMinutes) || parsedTtlMinutes <= 0) {
      return 30
    }

    return parsedTtlMinutes
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
    const command = await this.buildRegistrationVerificationEmailCommand(ticket)
    await this.emailSender.sendEmail(command)
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
    const command = await this.buildPasswordResetEmailCommand(ticket)
    await this.emailSender.sendEmail(command)
  }

  /**
   * Function: renderTemplateOrDefault
   * -----------------------------------
   * 使用数据库中的邮件模板渲染邮件内容。如果数据库中不存在该类型的模板，或模板仓库不可用，则使用提供的
   * buildDefault 回调函数生成默认的邮件内容（主题、纯文本正文、HTML 正文）。这是邮件模板系统的核心渲染方法。
   *
   * Renders email content using a template from the database. If no template of the given type exists
   * in the database, or the template repository is unavailable, falls back to the buildDefault callback
   * to generate default email content (subject, text body, HTML body). This is the core rendering method
   * of the email template system.
   *
   * Callers: [AuthApplicationService.buildRegistrationVerificationEmailCommand,
   *           AuthApplicationService.buildPasswordResetEmailCommand]
   * Called by: [AuthApplicationService.buildRegistrationVerificationEmailCommand,
   *              AuthApplicationService.buildPasswordResetEmailCommand]
   *
   * Callees: [IEmailTemplateRepository.findByType, EmailTemplate.render]
   * Calls: [IEmailTemplateRepository.findByType, EmailTemplate.render]
   *
   * Parameters:
   * - type: EmailTemplateType, 邮件模板类型（注册验证 / 密码重置等）/ the email template type (registration verification / password reset, etc.)
   * - variables: Record<string, string>, 模板变量键值对 / template variable key-value pairs
   * - buildDefault: () => { subject, textBody, htmlBody }, 当数据库无模板时的回退回调
   *   fallback callback invoked when no template is available in the database
   *
   * Returns:
   * - Promise<{ subject: string, textBody: string, htmlBody: string }>, 渲染后的邮件内容
   *   the rendered email content
   *
   * Error Handling / 错误处理:
   * - 如果 emailTemplateRepository 为 null 或查询/渲染抛出异常，静默回退到默认模板
   *   If emailTemplateRepository is null or the query/render throws, silently falls back to the default template
   *
   * Side Effects / 副作用:
   * - 无副作用，纯函数 + 数据库读取 / no side effects, pure function + database read
   *
   * Transaction / 事务:
   * - 无事务边界 / no transaction boundary
   *
   * 中文关键词: 邮件模板, 模板渲染, 回退策略, 数据库模板, 默认内容, 变量替换, 邮件构建, 模板引擎
   * English keywords: email template, template rendering, fallback strategy, database template, default content, variable substitution, mail building, template engine
   */
  private async renderTemplateOrDefault(
    type: EmailTemplateType,
    variables: Record<string, string>,
    buildDefault: () => { subject: string; textBody: string; htmlBody: string },
  ): Promise<{ subject: string; textBody: string; htmlBody: string }> {
    if (this.emailTemplateRepository) {
      try {
        const template = await this.emailTemplateRepository.findByType(type)
        if (template) {
          return template.render(variables)
        }
      } catch {
        // Fall through to default
      }
    }
    return buildDefault()
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
  private async buildRegistrationVerificationEmailCommand(
    ticket: EmailRegistrationTicket,
  ): Promise<SendEmailCommand> {
    const verificationLink = this.buildEmailRegistrationVerificationLink(
      ticket.verificationToken,
      ticket.email,
    )
    const expiresInMinutes = Math.max(
      1,
      Math.ceil((ticket.expiresAt.getTime() - Date.now()) / 60000),
    )
    const expiresInMinutesStr = String(expiresInMinutes)

    const rendered = await this.renderTemplateOrDefault(
      EmailTemplateType.REGISTRATION_VERIFICATION,
      {
        appName: APP_NAME,
        username: ticket.username,
        verificationLink,
        expiresInMinutes: expiresInMinutesStr,
      },
      () => {
        const subject = `${APP_NAME} email verification`
        const textBody = [
          `Hello ${ticket.username},`,
          '',
          `Please verify your ${APP_NAME} registration by opening the link below:`,
          verificationLink,
          '',
          `This link expires in ${expiresInMinutes} minutes.`,
          '',
          `If you did not start this registration, you can safely ignore this email.`,
        ].join('\n')
        const htmlBody = [
          `<p>Hello ${ticket.username},</p>`,
          `<p>Please verify your <strong>${APP_NAME}</strong> registration by opening the link below:</p>`,
          `<p><a href="${verificationLink}">${verificationLink}</a></p>`,
          `<p>This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>`,
          `<p>If you did not start this registration, you can safely ignore this email.</p>`,
        ].join('')
        return { subject, textBody, htmlBody }
      },
    )

    return {
      to: ticket.email,
      ...rendered,
    }
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
  private async buildPasswordResetEmailCommand(
    ticket: PasswordResetTicket,
  ): Promise<SendEmailCommand> {
    const resetLink = this.buildPasswordResetLink(ticket.resetToken, ticket.email)
    const expiresInMinutes = Math.max(
      1,
      Math.ceil((ticket.expiresAt.getTime() - Date.now()) / 60000),
    )
    const expiresInMinutesStr = String(expiresInMinutes)

    const rendered = await this.renderTemplateOrDefault(
      EmailTemplateType.PASSWORD_RESET,
      {
        appName: APP_NAME,
        username: ticket.username,
        resetLink,
        expiresInMinutes: expiresInMinutesStr,
      },
      () => {
        const subject = `${APP_NAME} password reset`
        const textBody = [
          `Hello ${ticket.username},`,
          '',
          `You requested a password reset for ${APP_NAME}. Open the link below to choose a new password:`,
          resetLink,
          '',
          `This link expires in ${expiresInMinutes} minutes.`,
          '',
          'If you did not request a password reset, you can safely ignore this email.',
        ].join('\n')
        const htmlBody = [
          `<p>Hello ${ticket.username},</p>`,
          `<p>You requested a password reset for <strong>${APP_NAME}</strong>. Open the link below to choose a new password:</p>`,
          `<p><a href="${resetLink}">${resetLink}</a></p>`,
          `<p>This link expires in <strong>${expiresInMinutes} minutes</strong>.</p>`,
          '<p>If you did not request a password reset, you can safely ignore this email.</p>',
        ].join('')
        return { subject, textBody, htmlBody }
      },
    )

    return {
      to: ticket.email,
      ...rendered,
    }
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
    const frontendUrl = (process.env.FRONTEND_URL || origin).replace(/\/+$/, '')
    const encodedToken = encodeURIComponent(verificationToken)
    const encodedEmail = encodeURIComponent(email)
    return `${frontendUrl}/register?verificationToken=${encodedToken}&email=${encodedEmail}`
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
    const frontendUrl = (process.env.FRONTEND_URL || origin).replace(/\/+$/, '')
    const encodedToken = encodeURIComponent(resetToken)
    const encodedEmail = encodeURIComponent(email)
    return `${frontendUrl}/reset-password?token=${encodedToken}&email=${encodedEmail}`
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
    }
  }
}
