import { Role } from './Role';

/**
 * Callers: [RoleApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Role Aggregates.
 * Keywords: role, repository, interface, contract, domain, identity
 */
export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  save(role: Role): Promise<void>;
  delete(id: string): Promise<void>;
}
