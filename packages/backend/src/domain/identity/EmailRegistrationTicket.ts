import { EmailAddress } from './EmailAddress';

export interface EmailRegistrationTicketProps {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  verificationToken: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Callers: [RedisEmailRegistrationTicketRepository, AuthApplicationService]
 * Callees: [EmailAddress.create]
 * Description: Represents a pending email-registration aggregate that reserves the submitted identity data until the mailbox owner verifies the email link.
 * 描述：表示“邮箱注册待验证单”聚合根，在邮箱链接完成验证前暂存并保留用户提交的身份信息。
 * Variables: `props` stores the aggregate state including the normalized email, username, hashed password, verification token, expiration time, and creation time.
 * 变量：`props` 保存聚合状态，包含规范化邮箱、用户名、密码哈希、验证令牌、过期时间与创建时间。
 * Integration: Create or load this aggregate inside the identity application service, then persist it through `IEmailRegistrationTicketRepository`.
 * 接入方式：在身份应用服务中创建或重建本聚合，再通过 `IEmailRegistrationTicketRepository` 进行持久化。
 * Error Handling: Throws `ERR_INVALID_EMAIL`, `ERR_USERNAME_ALREADY_EXISTS`, `ERR_INVALID_PASSWORD`, `ERR_EMAIL_REGISTRATION_TOKEN_REQUIRED`, or `ERR_EMAIL_REGISTRATION_EXPIRED` when invariant validation fails.
 * 错误处理：当不变式校验失败时抛出 `ERR_INVALID_EMAIL`、`ERR_USERNAME_ALREADY_EXISTS`、`ERR_INVALID_PASSWORD`、`ERR_EMAIL_REGISTRATION_TOKEN_REQUIRED` 或 `ERR_EMAIL_REGISTRATION_EXPIRED`。
 * Keywords: email registration, verification ticket, pending signup, identity aggregate, mailbox verification, 邮箱注册, 验证票据, 待确认注册, 身份聚合, 邮箱验证
 */
export class EmailRegistrationTicket {
  private props: EmailRegistrationTicketProps;

  /**
   * Callers: [EmailRegistrationTicket.create, EmailRegistrationTicket.load]
   * Callees: []
   * Description: Initializes the aggregate with already validated state so all construction flows go through the factory methods.
   * 描述：用已校验的状态初始化聚合，确保所有实例化流程都经过工厂方法。
   * Variables: `props` is the validated aggregate snapshot copied into the private state bag.
   * 变量：`props` 是已校验的聚合快照，会被复制进私有状态容器。
   * Integration: Do not call this constructor directly; use `create` for new tickets and `load` for repository reconstitution.
   * 接入方式：不要直接调用构造函数；新建票据使用 `create`，仓储重建使用 `load`。
   * Error Handling: This constructor assumes prior validation and therefore does not perform additional checks.
   * 错误处理：构造函数假定前置校验已完成，因此不再重复检查。
   * Keywords: constructor, aggregate initialization, state copy, factory only, reconstitution, 构造函数, 聚合初始化, 状态复制, 工厂创建, 仓储重建
   */
  private constructor(props: EmailRegistrationTicketProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [AuthApplicationService.registerUser]
   * Callees: [EmailAddress.create, EmailRegistrationTicket.constructor]
   * Description: Creates a new pending registration aggregate after validating the email, username, password hash, verification token, and expiration timestamp.
   * 描述：在校验邮箱、用户名、密码哈希、验证令牌与过期时间后，创建新的待验证注册聚合。
   * Variables: `props` carries the submitted registration data that will be normalized and guarded by the aggregate invariants.
   * 变量：`props` 携带提交的注册数据，工厂会对其做规范化并应用聚合不变式。
   * Integration: Call this when a verified captcha has passed and the system is ready to persist a new verification ticket.
   * 接入方式：在滑块验证码通过且系统准备持久化新的邮箱验证票据时调用本方法。
   * Error Handling: Throws domain error codes when any required field is empty or when the ticket is already expired.
   * 错误处理：当任何必填字段为空或票据已过期时抛出领域错误码。
   * Keywords: create ticket, pending registration, validation, email normalize, expiry guard, 创建票据, 待验证注册, 字段校验, 邮箱规范化, 过期保护
   */
  public static create(props: EmailRegistrationTicketProps): EmailRegistrationTicket {
    const normalizedEmail = EmailAddress.create(props.email.trim().toLowerCase()).value;
    const normalizedUsername = props.username.trim();
    const normalizedPasswordHash = props.passwordHash.trim();
    const normalizedVerificationToken = props.verificationToken.trim();

    if (!normalizedUsername) {
      throw new Error('ERR_USERNAME_ALREADY_EXISTS');
    }
    if (!normalizedPasswordHash) {
      throw new Error('ERR_INVALID_PASSWORD');
    }
    if (!normalizedVerificationToken) {
      throw new Error('ERR_EMAIL_REGISTRATION_TOKEN_REQUIRED');
    }
    if (props.expiresAt <= new Date()) {
      throw new Error('ERR_EMAIL_REGISTRATION_EXPIRED');
    }

    return new EmailRegistrationTicket({
      ...props,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash: normalizedPasswordHash,
      verificationToken: normalizedVerificationToken,
    });
  }

  /**
   * Callers: [RedisEmailRegistrationTicketRepository]
   * Callees: [EmailRegistrationTicket.constructor]
   * Description: Reconstitutes an existing aggregate from persisted storage without re-running creation-time invariants.
   * 描述：从持久化存储中重建已有聚合，不重复执行创建期不变式校验。
   * Variables: `props` is the stored aggregate snapshot loaded from the repository backend.
   * 变量：`props` 是从仓储后端读取出的聚合快照。
   * Integration: Repository implementations should call `load` after deserializing stored ticket data.
   * 接入方式：仓储实现应在反序列化票据数据后调用 `load`。
   * Error Handling: Trusts repository data; malformed persisted data should be prevented by repository serialization logic and tests.
   * 错误处理：本方法信任仓储数据；持久化格式错误应由仓储序列化逻辑和测试预防。
   * Keywords: load ticket, rehydrate aggregate, repository restore, persisted state, domain reconstitution, 载入票据, 聚合重建, 仓储恢复, 持久化状态, 领域重组
   */
  public static load(props: EmailRegistrationTicketProps): EmailRegistrationTicket {
    return new EmailRegistrationTicket(props);
  }

  public get id(): string { return this.props.id; }
  public get email(): string { return this.props.email; }
  public get username(): string { return this.props.username; }
  public get passwordHash(): string { return this.props.passwordHash; }
  public get verificationToken(): string { return this.props.verificationToken; }
  public get expiresAt(): Date { return this.props.expiresAt; }
  public get createdAt(): Date { return this.props.createdAt; }

  /**
   * Callers: [AuthApplicationService.verifyEmailRegistration]
   * Callees: []
   * Description: Ensures that the pending registration ticket is still valid at the moment the verification link is consumed.
   * 描述：在验证链接被消费时，确保待验证注册票据仍然处于有效状态。
   * Variables: `currentTime` is the comparison timestamp used to evaluate ticket expiry.
   * 变量：`currentTime` 是用于判断票据是否过期的比较时间点。
   * Integration: Invoke this immediately after loading a ticket from the repository and before creating the real user aggregate.
   * 接入方式：在仓储加载票据后、创建真实用户聚合前立即调用。
   * Error Handling: Throws `ERR_EMAIL_REGISTRATION_EXPIRED` when the current time is after the configured expiration time.
   * 错误处理：当当前时间晚于过期时间时抛出 `ERR_EMAIL_REGISTRATION_EXPIRED`。
   * Keywords: validate ticket, consume verification, expiry check, registration finalization, mailbox proof, 校验票据, 消费验证, 过期检查, 注册完成, 邮箱证明
   */
  public validateForCompletion(currentTime: Date = new Date()): void {
    if (currentTime > this.props.expiresAt) {
      throw new Error('ERR_EMAIL_REGISTRATION_EXPIRED');
    }
  }
}
