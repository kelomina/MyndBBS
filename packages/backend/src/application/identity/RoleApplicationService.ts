import { IRoleRepository } from '../../domain/identity/IRoleRepository';
import { IPermissionRepository } from '../../domain/identity/IPermissionRepository';
import { Role } from '../../domain/identity/Role';
import { Permission } from '../../domain/identity/Permission';
import { v4 as uuidv4 } from 'uuid';
import redis from '../../lib/redis';
import { prisma } from '../../db';

/**
 * Callers: [AdminController]
 * Callees: [IRoleRepository, IPermissionRepository, Role.create, Permission.create, Role.assignPermission, Role.revokePermission, Role.updateDetails]
 * Description: The Application Service for managing Roles and Permissions in the Identity Domain.
 * Keywords: role, permission, rbac, service, application, orchestration
 */
export class RoleApplicationService {
  constructor(
    private roleRepository: IRoleRepository,
    private permissionRepository: IPermissionRepository
  ) {}

  public async createRole(name: string, description: string | null): Promise<Role> {
    const role = Role.create({
      id: uuidv4(),
      name,
      description,
      permissions: []
    });
    await this.roleRepository.save(role);
    return role;
  }

  public async updateRole(roleId: string, name: string, description: string | null): Promise<Role> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new Error('ERR_ROLE_NOT_FOUND');
    
    role.updateDetails(name, description);
    await this.roleRepository.save(role);
    return role;
  }

  public async createPermission(action: string, subject: string, conditions: string | null): Promise<Permission> {
    const permission = Permission.create({
      id: uuidv4(),
      action,
      subject,
      conditions
    });
    await this.permissionRepository.save(permission);
    return permission;
  }

  private async invalidateCacheForRoleUsers(roleId: string): Promise<void> {
    const users = await prisma.user.findMany({
      where: { roleId },
      select: { id: true }
    });
    const pipeline = redis.pipeline();
    for (const user of users) {
      pipeline.del(`ability_rules:user:${user.id}`);
    }
    await pipeline.exec();
  }

  public async assignPermissionToRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new Error('ERR_ROLE_NOT_FOUND');

    const permission = await this.permissionRepository.findById(permissionId);
    if (!permission) throw new Error('ERR_PERMISSION_NOT_FOUND');

    role.assignPermission(permission);
    await this.roleRepository.save(role);
    
    await this.invalidateCacheForRoleUsers(roleId);

    return role;
  }

  public async revokePermissionFromRole(roleId: string, permissionId: string): Promise<Role> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new Error('ERR_ROLE_NOT_FOUND');

    role.revokePermission(permissionId);
    await this.roleRepository.save(role);
    
    await this.invalidateCacheForRoleUsers(roleId);

    return role;
  }
}
