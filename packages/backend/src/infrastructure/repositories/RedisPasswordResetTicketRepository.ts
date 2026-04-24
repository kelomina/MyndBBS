import { IPasswordResetTicketRepository } from '../../domain/identity/IPasswordResetTicketRepository';
import { PasswordResetTicket, PasswordResetTicketProps } from '../../domain/identity/PasswordResetTicket';
import { redis } from '../../lib/redis';

interface StoredPasswordResetTicketRecord {
  id: string;
  userId: string;
  email: string;
  username: string;
  resetToken: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Callers: [Registry]
 * Callees: [redis.get, redis.set, redis.del, PasswordResetTicket.load]
 * Description: Persists pending password-reset tickets in Redis so the mailbox link can be consumed across requests and devices.
 * 描述：将待处理的密码重置票据持久化到 Redis，使邮箱链接能够跨请求和跨设备被消费。
 * Variables: The repository maps one aggregate to a primary JSON record plus lookup indexes for reset token, email, and user id.
 * 变量：本仓储会把一个聚合映射为一条主 JSON 记录，以及重置令牌、邮箱和用户 ID 三个索引键。
 * Integration: Use this repository as the concrete implementation of `IPasswordResetTicketRepository` in the application registry.
 * 接入方式：在应用注册表中把本类作为 `IPasswordResetTicketRepository` 的具体实现接入。
 * Error Handling: Returns `null` for missing keys, and propagates Redis runtime errors directly to the caller.
 * 错误处理：键不存在时返回 `null`，Redis 运行时异常会直接向上传递。
 * Keywords: redis repository, password reset store, token index, pending reset cache, identity infrastructure, Redis仓储, 密码重置存储, 令牌索引, 待重置缓存, 身份基础设施
 */
export class RedisPasswordResetTicketRepository implements IPasswordResetTicketRepository {
  private getTicketKey(id: string): string {
    return `password_reset:ticket:${id}`;
  }

  private getResetTokenKey(resetToken: string): string {
    return `password_reset:reset_token:${resetToken}`;
  }

  private getEmailKey(email: string): string {
    return `password_reset:email:${email.trim().toLowerCase()}`;
  }

  private getUserIdKey(userId: string): string {
    return `password_reset:user:${userId.trim()}`;
  }

  /**
   * Callers: [save]
   * Callees: []
   * Description: Converts the aggregate into a serialized Redis record that preserves date precision in ISO-8601 strings.
   * 描述：把聚合转换成 Redis 可存储的序列化记录，并以 ISO-8601 字符串保留时间精度。
   * Variables: `ticket` is the aggregate being serialized into the storage record.
   * 变量：`ticket` 是即将被序列化为存储记录的聚合。
   * Integration: Keep this method private so all serialization rules stay centralized in the repository.
   * 接入方式：保持此方法私有，让所有序列化规则集中留在仓储内部。
   * Error Handling: This method assumes a valid aggregate and therefore does not throw additional storage-specific errors.
   * 错误处理：本方法假定输入聚合已经有效，因此不会额外抛出存储格式相关错误。
   * Keywords: serialize ticket, redis record, iso date, storage mapping, repository helper, 序列化票据, Redis记录, ISO时间, 存储映射, 仓储辅助
   */
  private serialize(ticket: PasswordResetTicket): StoredPasswordResetTicketRecord {
    return {
      id: ticket.id,
      userId: ticket.userId,
      email: ticket.email,
      username: ticket.username,
      resetToken: ticket.resetToken,
      expiresAt: ticket.expiresAt.toISOString(),
      createdAt: ticket.createdAt.toISOString(),
    };
  }

  /**
   * Callers: [getById]
   * Callees: [PasswordResetTicket.load]
   * Description: Rebuilds the domain aggregate from the stored Redis JSON payload.
   * 描述：从 Redis JSON 载荷中重建领域聚合。
   * Variables: `record` is the deserialized Redis payload containing persisted ticket state.
   * 变量：`record` 是反序列化后的 Redis 载荷，包含已持久化的票据状态。
   * Integration: Keep reconstitution logic in one place so all lookup methods share the same mapping behavior.
   * 接入方式：将重建逻辑集中在一处，让所有查询方法共享同一套映射行为。
   * Error Handling: Throws if the stored payload is malformed enough to violate the aggregate constructor contract.
   * 错误处理：当存储载荷格式损坏到违反聚合构造契约时会抛错。
   * Keywords: deserialize ticket, aggregate restore, redis json, domain mapping, reconstitution helper, 反序列化票据, 聚合恢复, Redis JSON, 领域映射, 重建辅助
   */
  private toDomain(record: StoredPasswordResetTicketRecord): PasswordResetTicket {
    const props: PasswordResetTicketProps = {
      id: record.id,
      userId: record.userId,
      email: record.email,
      username: record.username,
      resetToken: record.resetToken,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
    };

    return PasswordResetTicket.load(props);
  }

  /**
   * Callers: [findByResetToken, findByEmail, findByUserId]
   * Callees: [redis.get, JSON.parse, RedisPasswordResetTicketRepository.toDomain]
   * Description: Loads a ticket by its primary identifier after a secondary index lookup has resolved the aggregate id.
   * 描述：在二级索引解析出聚合 id 后，根据主键加载票据。
   * Variables: `id` is the primary ticket identifier stored in secondary index keys.
   * 变量：`id` 是保存在二级索引键中的主票据标识。
   * Integration: Secondary-index methods should delegate here to avoid duplicating JSON parsing and mapping code.
   * 接入方式：二级索引查询方法应委托给本方法，避免重复 JSON 解析与映射逻辑。
   * Error Handling: Returns `null` when the primary record no longer exists, which lets callers treat stale indexes as cache misses.
   * 错误处理：当主记录已不存在时返回 `null`，调用方可把失效索引视为未命中。
   * Keywords: load by id, primary record, stale index handling, redis lookup, repository core, 按ID加载, 主记录, 失效索引处理, Redis查询, 仓储核心
   */
  private async getById(id: string): Promise<PasswordResetTicket | null> {
    const serializedRecord = await redis.get(this.getTicketKey(id));
    if (!serializedRecord) {
      return null;
    }

    const parsedRecord = JSON.parse(serializedRecord) as StoredPasswordResetTicketRecord;
    return this.toDomain(parsedRecord);
  }

  /**
   * Callers: [save]
   * Callees: []
   * Description: Computes a storage TTL that outlives the reset window so expired links can still be recognized and replaced for a short period.
   * 描述：计算一个长于重置有效期的存储 TTL，使过期链接在短时间内仍能被识别并支持补发。
   * Variables: `expiresAt` is the business expiry timestamp; `remainingSeconds` is the live reset window; `retentionSeconds` is the post-expiry retention buffer.
   * 变量：`expiresAt` 是业务过期时间；`remainingSeconds` 是当前有效窗口；`retentionSeconds` 是过期后的保留缓冲。
   * Integration: Use this helper when saving both the primary record and secondary indexes so lookup behavior stays consistent.
   * 接入方式：在保存主记录和二级索引时统一使用本方法，保持查询行为一致。
   * Error Handling: Throws `ERR_PASSWORD_RESET_EXPIRED` when the business expiry has already passed before persistence starts.
   * 错误处理：当业务过期时间在持久化开始前就已过去时，抛出 `ERR_PASSWORD_RESET_EXPIRED`。
   * Keywords: storage ttl, retention window, expired link support, redis expiry, reset persistence, 存储TTL, 保留窗口, 过期链接支持, Redis过期, 重置持久化
   */
  private getStorageTtlSeconds(expiresAt: Date): number {
    const remainingSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      throw new Error('ERR_PASSWORD_RESET_EXPIRED');
    }

    const retentionSeconds = 24 * 60 * 60;
    return remainingSeconds + retentionSeconds;
  }

  public async findByResetToken(resetToken: string): Promise<PasswordResetTicket | null> {
    const ticketId = await redis.get(this.getResetTokenKey(resetToken.trim()));
    if (!ticketId) {
      return null;
    }

    return this.getById(ticketId);
  }

  public async findByEmail(email: string): Promise<PasswordResetTicket | null> {
    const ticketId = await redis.get(this.getEmailKey(email));
    if (!ticketId) {
      return null;
    }

    return this.getById(ticketId);
  }

  public async findByUserId(userId: string): Promise<PasswordResetTicket | null> {
    const ticketId = await redis.get(this.getUserIdKey(userId));
    if (!ticketId) {
      return null;
    }

    return this.getById(ticketId);
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset]
   * Callees: [redis.set, RedisPasswordResetTicketRepository.serialize, RedisPasswordResetTicketRepository.getStorageTtlSeconds]
   * Description: Persists a ticket and all lookup indexes with the same TTL so the reset link remains queryable until the short retention window ends.
   * 描述：以相同 TTL 保存主记录和全部索引键，使重置链接在短期保留窗口结束前始终可查询。
   * Variables: `ticket` is the aggregate to persist; `ttlSeconds` is derived from `expiresAt` plus the repository retention window.
   * 变量：`ticket` 是要保存的聚合；`ttlSeconds` 由 `expiresAt` 和仓储保留窗口共同决定。
   * Integration: Call this after all domain checks have passed and before the reset email is sent.
   * 接入方式：在所有领域校验通过之后、发送重置邮件之前调用。
   * Error Handling: Throws `ERR_PASSWORD_RESET_EXPIRED` when the computed business window is not positive.
   * 错误处理：当计算出的业务有效窗口非正数时抛出 `ERR_PASSWORD_RESET_EXPIRED`。
   * Keywords: save ticket, ttl storage, redis indexes, pending reset persist, reset window, 保存票据, TTL存储, Redis索引, 待重置持久化, 重置窗口
   */
  public async save(ticket: PasswordResetTicket): Promise<void> {
    const ttlSeconds = this.getStorageTtlSeconds(ticket.expiresAt);
    const serializedRecord = JSON.stringify(this.serialize(ticket));

    await redis.set(this.getTicketKey(ticket.id), serializedRecord, 'EX', ttlSeconds);
    await redis.set(this.getResetTokenKey(ticket.resetToken), ticket.id, 'EX', ttlSeconds);
    await redis.set(this.getEmailKey(ticket.email), ticket.id, 'EX', ttlSeconds);
    await redis.set(this.getUserIdKey(ticket.userId), ticket.id, 'EX', ttlSeconds);
  }

  /**
   * Callers: [AuthApplicationService.requestPasswordReset, AuthApplicationService.resetPasswordWithToken]
   * Callees: [RedisPasswordResetTicketRepository.getById, redis.del]
   * Description: Deletes the primary ticket record together with all secondary indexes so stale reset links cannot be resolved again.
   * 描述：删除主票据记录及全部二级索引，防止过期或已消费的重置链接再次被解析。
   * Variables: `id` is the primary ticket identifier whose associated keys should be removed.
   * 变量：`id` 是待删除票据的主标识，其关联键都会被移除。
   * Integration: Use this when replacing a previous pending reset ticket or after successfully completing password replacement.
   * 接入方式：在替换旧的待重置票据或成功完成密码替换后调用。
   * Error Handling: Missing records are treated as no-op deletes so cleanup remains idempotent.
   * 错误处理：当主记录不存在时按空操作处理，保证清理过程具备幂等性。
   * Keywords: delete ticket, cleanup indexes, idempotent delete, reset revocation, redis cleanup, 删除票据, 清理索引, 幂等删除, 重置撤销, Redis清理
   */
  public async delete(id: string): Promise<void> {
    const ticket = await this.getById(id);
    if (!ticket) {
      return;
    }

    await redis.del(this.getResetTokenKey(ticket.resetToken));
    await redis.del(this.getEmailKey(ticket.email));
    await redis.del(this.getUserIdKey(ticket.userId));
    await redis.del(this.getTicketKey(ticket.id));
  }
}
