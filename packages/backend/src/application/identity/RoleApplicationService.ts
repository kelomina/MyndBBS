import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPermissionRepository } from '../../domain/identity/IPermissionRepository';
import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IAbilityCache } from '../../domain/identity/IAbilityCache';
import { Role } from '../../domain/identity/Role';
import { Permission } from '../../domain/identity/Permission';
import { IUnitOfWork } from '../../domain/shared/IUnitOfWork';
import { randomUUID as uuidv4 } from 'crypto';

/**
 * Callers: [AdminController]
 * Callees: [IRoleRepository, IPermissionRepository, Role.create, Permission.create, Role.assignPermission, Role.revokePermission, Role.updateDetails, IUnitOfWork.execute]
 * Description: The Application Service for managing Roles and Permissions in the Identity Domain.
 * Keywords: role, permission, rbac, service, application, orchestration
 */
export class RoleApplicationService {
  constructor(
    private roleRepository: IRoleRepository,
    private permissionRepository: IPermissionRepository,
    private userRepository: IUserRepository,
    private abilityCache: IAbilityCache,
    private unitOfWork: IUnitOfWork
  ) {}

  /**
   * Callers: [AdminController]
   * Callees: [Role.create, IRoleRepository.save, IUnitOfWork.execute]
   * Description: Creates a new role and saves it.
   * Keywords: create, role, rbac
   */
  public async createRole(name: string, description: string | null): Promise<Role> {
    return this.unitOfWork.execute(async () => {
      const role = Role.create({
        id: uuidv4(),
        name,
        description,
        permissions: []
      });
      await this.roleRepository.save(role);
      return role;
    });
  }

  /**
   * Callers: [AdminController]
   * Callees: [IRoleRepository.findById, Role.updateDetails, IRoleRepository.save, IUnitOfWork.execute]
   * Description: Updates an existing role's details.
   * Keywords: update, role, rbac
   */
  public async updateRole(roleId: string, name: string, description: string | null): Promise<Role> {
    return this.unitOfWork.execute(async () => {
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new Error('ERR_ROLE_NOT_FOUND');
      
      role.updateDetails(name, description);
      await this.roleRepository.save(role);
      return role;
    });
  }

  /**
   * Callers: [AdminController]
   * Callees: [Permission.create, IPermissionRepository.save, IUnitOfWork.execute]
   * Description: Creates a new permission and saves it.
   * Keywords: create, permission, rbac
   */
  public async createPermission(action: string, subject: string, conditions: string | null): Promise<Permission> {
    return this.unitOfWork.execute(async () => {
      const permission = Permission.create({
        id: uuidv4(),
        action,
        subject,
        conditions
      });
      await this.permissionRepository.save(permission);
      return permission;
    });
  }

  private async invalidateCacheForRoleUsers(roleId: string): Promise<void> {
    const users = await this.userRepository.findByRoleId(roleId);
    await this.abilityCache.invalidateUsersRules(users.map(u => u.id));
  }

  /**
   * Callers: [AdminController]
   * Callees: [IRoleRepository.findById, IPermissionRepository.findById, Role.assignPermission, IRoleRepository.save, IAbilityCache.invalidateUsersRules, IUnitOfWork.execute]
   * Description: Assigns a permission to a role and invalidates users' ability cache.
   * Keywords: assign, permission, role, rbac
   */
  public async assignPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    return this.unitOfWork.execute(async () => {
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new Error('ERR_ROLE_NOT_FOUND');

      const permission = await this.permissionRepository.findById(permissionId);
      if (!permission) throw new Error('ERR_PERMISSION_NOT_FOUND');

      role.assignPermission(permission);
      await this.roleRepository.save(role);
      
      await this.invalidateCacheForRoleUsers(roleId);

      return role;
    });
  }

  /**
   * Callers: [AdminController]
   * Callees: [IRoleRepository.findById, Role.revokePermission, IRoleRepository.save, IAbilityCache.invalidateUsersRules, IUnitOfWork.execute]
   * Description: Revokes a permission from a role and invalidates users' ability cache.
   * Keywords: revoke, permission, role, rbac
   */
  public async revokePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    return this.unitOfWork.execute(async () => {
      const role = await this.roleRepository.findById(roleId);
      if (!role) throw new Error('ERR_ROLE_NOT_FOUND');

      role.revokePermission(permissionId);
      await this.roleRepository.save(role);
      
      await this.invalidateCacheForRoleUsers(roleId);

      return role;
    });
  }
}
