import { Friendship } from './Friendship';

/**
 * Callers: [MessagingApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Friendship Aggregates.
 * Keywords: friendship, repository, interface, contract, domain
 */
export interface IFriendshipRepository {
  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Retrieves a Friendship by its unique identifier.
   * Keywords: find, by, id, friendship, repository
   */
  findById(id: string): Promise<Friendship | null>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Retrieves a Friendship by the two involved user IDs.
   * Keywords: find, by, users, friendship, repository
   */
  findByUsers(userId1: string, userId2: string): Promise<Friendship | null>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Persists a Friendship entity to the database.
   * Keywords: save, create, update, friendship, repository
   */
  save(friendship: Friendship): Promise<void>;

  /**
   * Callers: [MessagingApplicationService]
   * Callees: []
   * Description: Removes a Friendship from the database.
   * Keywords: delete, remove, friendship, repository
   */
  delete(id: string): Promise<void>;
}
