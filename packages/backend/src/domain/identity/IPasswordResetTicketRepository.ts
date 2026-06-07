import { PasswordResetTicket } from './PasswordResetTicket';

/**
 * 接口名称：IPasswordResetTicketRepository
 *
 * 函数作用：
 *   密码重置票据的仓储接口——定义待验证密码重置票据的加载和持久化契约。
 * Purpose:
 *   Repository interface for PasswordResetTicket aggregates — defines the contract for loading and persisting pending password-reset tickets.
 * Variables: The repository methods operate on `PasswordResetTicket` aggregates and lookup keys such as email, user id, and reset token.
 * 变量：仓储方法围绕 `PasswordResetTicket` 聚合以及邮箱、用户 ID、重置令牌等查找键工作。
 * Integration: Inject an implementation into `AuthApplicationService` so password-reset request and completion share one persistence abstraction.
 * 接入方式：将实现注入 `AuthApplicationService`，让密码重置发起与完成共享同一持久化抽象。
 * Error Handling: Implementations should return `null` for cache misses and surface infrastructure failures as thrown errors.
 * 错误处理：实现类在未命中时应返回 `null`，基础设施失败时应向上抛出异常。
 * Keywords: repository contract, password reset, token lookup, pending reset, persistence abstraction, 仓储契约, 密码重置, 令牌查询, 待重置票据, 持久化抽象
 */
export interface IPasswordResetTicketRepository {
  findByResetToken(resetToken: string): Promise<PasswordResetTicket | null>;
  findByEmail(email: string): Promise<PasswordResetTicket | null>;
  findByUserId(userId: string): Promise<PasswordResetTicket | null>;
  save(ticket: PasswordResetTicket): Promise<void>;
  delete(id: string): Promise<void>;
}
