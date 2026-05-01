import { Category } from './Category';

/**
 * 接口名称：ICategoryRepository
 *
 * 函数作用：
 *   分类聚合的仓储接口——定义分类持久化的契约。
 * Purpose:
 *   Repository interface for Category aggregates — defines the persistence contract.
 *
 * 调用方 / Called by:
 *   - CommunityApplicationService
 *
 * 中文关键词：
 *   分类，仓储接口，持久化
 * English keywords:
 *   category, repository interface, persistence
 */
export interface ICategoryRepository {
  /** 按 ID 查找分类 / Finds a category by ID */
  findById(id: string): Promise<Category | null>;

  /** 持久化分类（创建/更新）/ Persists a category (create/update) */
  save(category: Category): Promise<void>;

  /** 从数据库中删除分类 / Removes a category from the database */
  delete(id: string): Promise<void>;
}
