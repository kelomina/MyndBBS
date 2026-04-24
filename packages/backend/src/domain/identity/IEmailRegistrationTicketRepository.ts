import { EmailRegistrationTicket } from './EmailRegistrationTicket';

/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: Defines the repository contract for loading and persisting pending email-registration tickets across verification attempts.
 * 描述：定义待验证邮箱注册票据的仓储契约，用于跨多次验证请求加载和持久化票据。
 * Variables: The repository methods operate on `EmailRegistrationTicket` aggregates and lookup keys such as email, username, and verification token.
 * 变量：仓储方法围绕 `EmailRegistrationTicket` 聚合以及邮箱、用户名、验证令牌等查找键工作。
 * Integration: Inject an implementation into `AuthApplicationService` so registration start and completion share one persistence abstraction.
 * 接入方式：将实现注入 `AuthApplicationService`，让注册发起与完成共用同一持久化抽象。
 * Error Handling: Implementations should return `null` for cache misses and surface infrastructure failures as thrown errors.
 * 错误处理：实现类在未命中时应返回 `null`，基础设施失败时应向上抛出异常。
 * Keywords: repository contract, email registration, verification lookup, pending signup, persistence abstraction, 仓储契约, 邮箱注册, 验证查询, 待确认注册, 持久化抽象
 */
export interface IEmailRegistrationTicketRepository {
  findByVerificationToken(verificationToken: string): Promise<EmailRegistrationTicket | null>;
  findByEmail(email: string): Promise<EmailRegistrationTicket | null>;
  findByUsername(username: string): Promise<EmailRegistrationTicket | null>;
  save(ticket: EmailRegistrationTicket): Promise<void>;
  delete(id: string): Promise<void>;
}
