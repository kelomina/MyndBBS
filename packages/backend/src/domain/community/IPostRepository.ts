import { Post } from './Post';

/**
 * 接口名称：IPostRepository
 *
 * 函数作用：
 *   帖子聚合的仓储接口——定义帖子持久化的契约。
 * Purpose:
 *   Repository interface for Post aggregates — defines the persistence contract.
 *
 * 调用方 / Called by:
 *   - CommunityApplicationService
 *   - ModerationApplicationService
 *
 * 实现方 / Implemented by:
 *   - PrismaPostRepository
 *
 * 中文关键词：
 *   帖子，仓储接口，持久化
 * English keywords:
 *   post, repository interface, persistence
 */
export interface IPostRepository {
  findById(id: string): Promise<Post | null>;
  save(post: Post): Promise<void>;
  delete(id: string): Promise<void>;
  deleteManyByCategoryId(categoryId: string): Promise<void>;
}
