export interface PasskeyProps {
  id: string; // credentialId
  publicKey: Buffer;
  userId: string;
  webAuthnUserID: string;
  counter: bigint;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date;
}

/**
 * 类名称：Passkey
 *
 * 函数作用：
 *   表示与用户关联的 WebAuthn Passkey。是身份域中的凭证实体。
 * Purpose:
 *   Represents a WebAuthn Passkey associated with a User. Acts as a credential entity in the Identity domain.
 *
 * 调用方 / Called by:
 *   - PrismaPasskeyRepository
 *   - AuthApplicationService
 *
 * 中文关键词：
 *   Passkey，WebAuthn，凭证，实体
 * English keywords:
 *   passkey, WebAuthn, credential, entity
 */
export class Passkey {
  private props: PasskeyProps;

  /**
   * 函数名称：constructor（私有）
   *
   * 函数作用：
   *   私有构造函数，强制通过静态工厂方法实例化。
   * Purpose:
   *   Private constructor to enforce instantiation via static factory methods.
   */
  private constructor(props: PasskeyProps) {
    this.props = { ...props };
  }

  /**
   * 函数名称：create
   *
   * 函数作用：
   *   静态工厂方法——创建新的 Passkey 实体。校验必须包含 userId、id 和 publicKey。
   * Purpose:
   *   Static factory method — creates a new Passkey entity. Validates userId, id, and publicKey must be present.
   *
   * 调用方 / Called by:
   *   - PrismaPasskeyRepository.toDomain
   *   - AuthApplicationService.addPasskey
   *
   * 参数说明 / Parameters:
   *   - props: PasskeyProps, Passkey 属性（userId、id、publicKey 必填）
   *
   * 错误处理 / Error handling:
   *   - ERR_PASSKEY_MISSING_REQUIRED_FIELDS（缺少必填字段）
   *
   * 中文关键词：
   创建 Passkey，工厂方法
   * English keywords:
   *   create passkey, factory method
   */
  public static create(props: PasskeyProps): Passkey {
    if (!props.userId || !props.id || !props.publicKey) {
      throw new Error('ERR_PASSKEY_MISSING_REQUIRED_FIELDS');
    }
    return new Passkey(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get publicKey(): Buffer { return this.props.publicKey; }
  public get userId(): string { return this.props.userId; }
  public get webAuthnUserID(): string { return this.props.webAuthnUserID; }
  public get counter(): bigint { return this.props.counter; }
  public get deviceType(): string { return this.props.deviceType; }
  public get backedUp(): boolean { return this.props.backedUp; }
  public get createdAt(): Date { return this.props.createdAt; }

  // --- Domain Behaviors ---

  /**
   * 函数名称：updateCounter
   *
   * 函数作用：
   *   更新 Passkey 计数器以防止重放攻击。
   * Purpose:
   *   Updates the passkey counter to prevent replay attacks.
   *
   * 调用方 / Called by:
   *   - AuthApplicationService.updatePasskeyCounter
   *
   * 参数说明 / Parameters:
   *   - newCounter: bigint, 认证响应中返回的新计数器值
   *
   * 错误处理 / Error handling:
   *   - ERR_PASSKEY_COUNTER_MISMATCH_POSSIBLE_REPLAY（可能的重放攻击）
   *
   * 中文关键词：
   更新计数器，防重放，Passkey
   * English keywords:
   *   update counter, replay protection, passkey
   */
  public updateCounter(newCounter: bigint): void {
    if (newCounter < this.props.counter) {
      throw new Error('ERR_PASSKEY_COUNTER_MISMATCH_POSSIBLE_REPLAY');
    }
    this.props.counter = newCounter;
  }
}