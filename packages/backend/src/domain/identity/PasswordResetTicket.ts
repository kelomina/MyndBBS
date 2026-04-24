import { EmailAddress } from './EmailAddress';

export interface PasswordResetTicketProps {
  id: string;
  userId: string;
  email: string;
  username: string;
  resetToken: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Callers: [RedisPasswordResetTicketRepository, AuthApplicationService]
 * Callees: [EmailAddress.create]
 * Description: Represents a pending password-reset aggregate that proves mailbox ownership before the user's password is replaced.
 * 描述：表示“密码重置待验证单”聚合根，在真正修改用户密码之前先用邮箱链接证明邮箱所有权。
 * Variables: `props` stores the aggregate state including the target user id, normalized email, username, reset token, expiration time, and creation time.
 * 变量：`props` 保存聚合状态，包含目标用户 ID、规范化邮箱、用户名、重置令牌、过期时间和创建时间。
 * Integration: Create or load this aggregate inside `AuthApplicationService`, then persist it through `IPasswordResetTicketRepository`.
 * 接入方式：在 `AuthApplicationService` 中创建或重建本聚合，再通过 `IPasswordResetTicketRepository` 持久化。
 * Error Handling: Throws `ERR_INVALID_EMAIL`, `ERR_PASSWORD_RESET_TOKEN_REQUIRED`, or `ERR_PASSWORD_RESET_EXPIRED` when invariant validation fails.
 * 错误处理：当不变式校验失败时抛出 `ERR_INVALID_EMAIL`、`ERR_PASSWORD_RESET_TOKEN_REQUIRED` 或 `ERR_PASSWORD_RESET_EXPIRED`。
 * Keywords: password reset, reset ticket, mailbox proof, identity aggregate, reset token, 密码重置, 重置票据, 邮箱证明, 身份聚合, 重置令牌
 */
export class PasswordResetTicket {
  private props: PasswordResetTicketProps;

  /**
   * Callers: [PasswordResetTicket.create, PasswordResetTicket.load]
   * Callees: []
   * Description: Initializes the aggregate with already validated state so all construction flows go through the factory methods.
   * 描述：用已校验状态初始化聚合，确保所有实例化流程都通过工厂方法。
   * Variables: `props` is the validated aggregate snapshot copied into the private state bag.
   * 变量：`props` 是已校验的聚合快照，会被复制到私有状态容器中。
   * Integration: Do not call this constructor directly; use `create` for new tickets and `load` for repository reconstitution.
   * 接入方式：不要直接调用构造函数；新建票据使用 `create`，仓储重建使用 `load`。
   * Error Handling: This constructor assumes prior validation and therefore does not perform additional checks.
   * 错误处理：构造函数假定前置校验已经完成，因此不再重复检查。
   * Keywords: constructor, aggregate initialization, state copy, factory only, reconstitution, 构造函数, 聚合初始化, 状态复制, 工厂创建, 仓储重建
   */
  private constructor(props: PasswordResetTicketProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset]
   * Callees: [EmailAddress.create, PasswordResetTicket.constructor]
   * Description: Creates a new password-reset aggregate after validating the target identity, reset token, and expiration timestamp.
   * 描述：在校验目标身份、重置令牌和过期时间后，创建新的密码重置聚合。
   * Variables: `props` carries the reset request data that will be normalized and guarded by aggregate invariants.
   * 变量：`props` 携带重置请求数据，工厂会对其做规范化并应用聚合不变式。
   * Integration: Call this when the application is ready to persist a fresh password-reset ticket and send the mailbox link.
   * 接入方式：当应用准备持久化新的密码重置票据并发送邮箱链接时调用本方法。
   * Error Handling: Throws domain error codes when any required field is empty or when the ticket is already expired.
   * 错误处理：当任何必填字段为空或票据已过期时抛出领域错误码。
   * Keywords: create ticket, reset request, mailbox validation, token guard, expiry check, 创建票据, 重置请求, 邮箱校验, 令牌保护, 过期检查
   */
  public static create(props: PasswordResetTicketProps): PasswordResetTicket {
    const normalizedEmail = EmailAddress.create(props.email.trim().toLowerCase()).value;
    const normalizedUsername = props.username.trim();
    const normalizedUserId = props.userId.trim();
    const normalizedResetToken = props.resetToken.trim();

    if (!normalizedUserId) {
      throw new Error('ERR_USER_NOT_FOUND');
    }
    if (!normalizedUsername) {
      throw new Error('ERR_USER_NOT_FOUND');
    }
    if (!normalizedResetToken) {
      throw new Error('ERR_PASSWORD_RESET_TOKEN_REQUIRED');
    }
    if (props.expiresAt <= new Date()) {
      throw new Error('ERR_PASSWORD_RESET_EXPIRED');
    }

    return new PasswordResetTicket({
      ...props,
      userId: normalizedUserId,
      email: normalizedEmail,
      username: normalizedUsername,
      resetToken: normalizedResetToken,
    });
  }

  /**
   * Callers: [RedisPasswordResetTicketRepository]
   * Callees: [PasswordResetTicket.constructor]
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
  public static load(props: PasswordResetTicketProps): PasswordResetTicket {
    return new PasswordResetTicket(props);
  }

  public get id(): string { return this.props.id; }
  public get userId(): string { return this.props.userId; }
  public get email(): string { return this.props.email; }
  public get username(): string { return this.props.username; }
  public get resetToken(): string { return this.props.resetToken; }
  public get expiresAt(): Date { return this.props.expiresAt; }
  public get createdAt(): Date { return this.props.createdAt; }

  /**
   * Callers: [AuthApplicationService.resetPasswordWithToken]
   * Callees: []
   * Description: Ensures that the pending password-reset ticket is still valid at the moment the reset link is consumed.
   * 描述：在重置链接被消费时，确保待处理的密码重置票据仍然有效。
   * Variables: `currentTime` is the comparison timestamp used to evaluate ticket expiry.
   * 变量：`currentTime` 是用于判断票据是否过期的比较时间点。
   * Integration: Invoke this immediately after loading a ticket from the repository and before mutating the target user aggregate.
   * 接入方式：在从仓储加载票据之后、修改目标用户聚合之前立即调用。
   * Error Handling: Throws `ERR_PASSWORD_RESET_EXPIRED` when the current time is after the configured expiration time.
   * 错误处理：当当前时间晚于过期时间时抛出 `ERR_PASSWORD_RESET_EXPIRED`。
   * Keywords: validate ticket, consume reset link, expiry check, password replacement, mailbox proof, 校验票据, 消费重置链接, 过期检查, 密码替换, 邮箱证明
   */
  public validateForReset(currentTime: Date = new Date()): void {
    if (currentTime > this.props.expiresAt) {
      throw new Error('ERR_PASSWORD_RESET_EXPIRED');
    }
  }
}
