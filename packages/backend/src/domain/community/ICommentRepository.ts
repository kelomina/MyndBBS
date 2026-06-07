import { Comment } from './Comment';

/**
 * 接口名称：ICommentRepository
 *
 * 函数作用：
 *   评论聚合的仓储接口——定义评论持久化的契约。
 * Purpose:
 *   Repository interface for Comment aggregates — defines the persistence contract.
 *
 * 中文关键词：
 *   评论，仓储接口
 * English keywords:
 *   comment, repository interface
 */
export interface ICommentRepository {
  findById(id: string): Promise<Comment | null>;
  save(comment: Comment): Promise<void>;
  delete(id: string): Promise<void>;
  softDeleteManyByPostId(postId: string): Promise<void>;
}
