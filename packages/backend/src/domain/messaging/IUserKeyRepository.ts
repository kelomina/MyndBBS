import { UserKey } from './UserKey';

/**
 * 接口名称：IUserKeyRepository
 *
 * 函数作用：
 *   用户密钥聚合的仓储接口。
 * Purpose:
 *   Repository interface for UserKey aggregates.
 *
 * 中文关键词：
 *   用户密钥，仓储接口
 * English keywords:
 *   user key, repository interface
 */
export interface IUserKeyRepository {
  findByUserId(userId: string): Promise<UserKey | null>;
  save(userKey: UserKey): Promise<void>;
}
