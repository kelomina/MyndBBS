import { Permission } from './Permission';

/**
 * Callers: [RoleApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of Permission Entities.
 * Keywords: permission, repository, interface, contract, domain, identity
 */
export interface IPermissionRepository {
  findById(id: string): Promise<Permission | null>;
  save(permission: Permission): Promise<void>;
  delete(id: string): Promise<void>;
}
