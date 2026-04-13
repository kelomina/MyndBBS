import { User } from './User';

/**
 * Callers: [UserApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of User Aggregates.
 * Keywords: user, repository, interface, contract, domain
 */
export interface IUserRepository {
  /**
   * Callers: [UserApplicationService]
   * Callees: []
   * Description: Retrieves a User by its unique identifier.
   * Keywords: find, by, id, user, repository
   */
  findById(id: string): Promise<User | null>;

  /**
   * Callers: [UserApplicationService]
   * Callees: []
   * Description: Retrieves a User by their email.
   * Keywords: find, by, email, user, repository
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Callers: [UserApplicationService]
   * Callees: []
   * Description: Retrieves a User by their username.
   * Keywords: find, by, username, user, repository
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Callers: [UserApplicationService]
   * Callees: []
   * Description: Persists a User entity to the database.
   * Keywords: save, create, update, user, repository
   */
  save(user: User): Promise<void>;

  /**
   * Callers: [RoleApplicationService]
   * Callees: []
   * Description: Retrieves all Users associated with a specific role ID.
   * Keywords: find, by, role, user, repository
   */
  findByRoleId(roleId: string): Promise<User[]>;
}
