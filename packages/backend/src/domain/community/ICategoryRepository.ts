import { Category } from './Category';

/**
 * Callers: [CommunityApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of forum Categories.
 * Keywords: category, repository, interface, contract, domain
 */
export interface ICategoryRepository {
  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Retrieves a Category by its unique identifier.
   * Keywords: find, by, id, category, repository
   */
  findById(id: string): Promise<Category | null>;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Persists a Category entity to the database.
   * Keywords: save, create, update, category, repository
   */
  save(category: Category): Promise<void>;

  /**
   * Callers: [CommunityApplicationService]
   * Callees: []
   * Description: Removes a Category from the database.
   * Keywords: delete, remove, category, repository
   */
  delete(id: string): Promise<void>;
}
