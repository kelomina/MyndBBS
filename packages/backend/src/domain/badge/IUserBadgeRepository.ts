/**
 * 接口名称：IUserBadgeRepository
 *
 * 函数作用：
 *   "用户持有徽章"关联的仓储接口。
 * Purpose:
 *   Repository interface for user-badge ownership records.
 */
import { UserBadge } from './UserBadge';

export interface IUserBadgeRepository {
  findByUserAndBadge(userId: string, badgeId: string): Promise<UserBadge | null>;

  /** 查询某用户持有的全部徽章记录 */
  findByUser(userId: string): Promise<UserBadge[]>;

  /** 查询某徽章的全部持有人记录 */
  findByBadge(badgeId: string): Promise<UserBadge[]>;

  /** 批量查询已有持有关系，返回 `${badgeId}:${userId}` 键集合（用于去重） */
  findExistingKeys(badgeIds: string[]): Promise<Set<string>>;

  /** 新增一条持有记录；若已存在则忽略（幂等） */
  save(userBadge: UserBadge): Promise<void>;

  /** 删除持有记录；返回是否确实删除了记录 */
  remove(userId: string, badgeId: string): Promise<boolean>;
}
