/**
 * 接口名称：IBadgeRepository
 *
 * 函数作用：
 *   徽章定义聚合的仓储接口。
 * Purpose:
 *   Repository interface for badge definition aggregates.
 */
import { Badge } from './Badge';

export interface IBadgeRepository {
  findById(id: string): Promise<Badge | null>;

  findByCode(code: string): Promise<Badge | null>;

  /** 返回全部徽章（含停用），按 sortOrder、createdAt 排序 */
  findAll(): Promise<Badge[]>;

  /** 返回所有启用中的自动授予徽章 */
  findAllActiveAuto(): Promise<Badge[]>;

  /** 新建或更新徽章 */
  save(badge: Badge): Promise<void>;

  /** 删除徽章（关联持有记录由数据库级联删除） */
  delete(id: string): Promise<void>;

  /** 统计每个徽章的持有人数，键为 badgeId */
  countHoldersGrouped(): Promise<Map<string, number>>;
}
