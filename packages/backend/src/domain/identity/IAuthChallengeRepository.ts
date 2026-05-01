import { AuthChallenge } from './AuthChallenge';

/**
 * 接口名称：IAuthChallengeRepository
 *
 * 函数作用：
 *   认证挑战聚合的仓储接口。
 * Purpose:
 *   Repository interface for AuthChallenge aggregates.
 *
 * 中文关键词：
 *   认证挑战，仓储接口
 * English keywords:
 *   auth challenge, repository interface
 */
export interface IAuthChallengeRepository {
  findById(id: string): Promise<AuthChallenge | null>;
  save(challenge: AuthChallenge): Promise<void>;
  delete(id: string): Promise<void>;
}
