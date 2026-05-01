import { Session } from './Session';

/**
 * 接口名称：ISessionRepository
 *
 * 函数作用：
 *   会话聚合的仓储接口——定义会话持久化的契约。
 * Purpose:
 *   Repository interface for Session aggregates — defines the persistence contract.
 *
 * 中文关键词：
 *   会话，仓储接口
 * English keywords:
 *   session, repository interface
 */
export interface ISessionRepository {
  findById(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
  deleteManyByUserId(userId: string): Promise<void>;
  findByUserId(userId: string): Promise<Session[]>;
}
