import { Comment } from './Comment';

/**
 * Callers: [CommunityApplicationService, ModerationApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Comment Aggregates.
 * Keywords: comment, repository, interface, contract, domain
 */
export interface ICommentRepository {
  findById(id: string): Promise<Comment | null>;
  save(comment: Comment): Promise<void>;
  delete(id: string): Promise<void>;
  softDeleteManyByPostId(postId: string): Promise<void>;
}
