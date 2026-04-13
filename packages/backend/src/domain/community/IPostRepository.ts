import { Post } from './Post';

/**
 * Callers: [CommunityApplicationService, ModerationApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Post Aggregates.
 * Keywords: post, repository, interface, contract, domain
 */
export interface IPostRepository {
  findById(id: string): Promise<Post | null>;
  save(post: Post): Promise<void>;
  delete(id: string): Promise<void>;
  deleteManyByCategoryId(categoryId: string): Promise<void>;
}
