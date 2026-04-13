import { Permission, PermissionProps } from './Permission';

export interface RoleProps {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
}

/**
 * Callers: [PrismaRoleRepository, RoleApplicationService]
 * Callees: [Permission]
 * Description: Represents the Role Aggregate Root within the Identity domain. Defines a user's capability level and associated permissions.
 * Keywords: role, aggregate, root, domain, identity, rbac, capability
 */
export class Role {
  private props: RoleProps;

  /**
   * Callers: [Role.create, Role.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, role, entity, instantiation
   */
  private constructor(props: RoleProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [RoleApplicationService.createRole]
   * Callees: [Role.constructor]
   * Description: Static factory method creating a new Role entity. Validates essential components.
   * Keywords: create, factory, role, domain, instantiation
   */
  public static create(props: RoleProps): Role {
    if (!props.name) {
      throw new Error('ERR_ROLE_MISSING_REQUIRED_FIELDS');
    }
    return new Role(props);
  }

  /**
   * Callers: [PrismaRoleRepository.toDomain]
   * Callees: [Role.constructor]
   * Description: Static factory method reconstituting a Role entity from database state.
   * Keywords: load, factory, role, domain, reconstitute
   */
  public static load(props: RoleProps): Role {
    return new Role(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get name(): string { return this.props.name; }
  public get description(): string | null { return this.props.description; }
  public get permissions(): Permission[] { return [...this.props.permissions]; }

  // --- Domain Behaviors ---

  /**
   * Callers: [RoleApplicationService.updateRole]
   * Callees: []
   * Description: Updates the core details of the role.
   * Keywords: update, details, role, identity
   */
  public updateDetails(name: string, description: string | null): void {
    if (!name) {
      throw new Error('ERR_ROLE_NAME_CANNOT_BE_EMPTY');
    }
    this.props.name = name;
    this.props.description = description;
  }

  /**
   * Callers: [RoleApplicationService.assignPermissionToRole]
   * Callees: []
   * Description: Assigns a new permission to the role. Prevents duplicate assignments.
   * Keywords: assign, permission, role, identity
   */
  public assignPermission(permission: Permission): void {
    const exists = this.props.permissions.some(p => p.id === permission.id);
    if (!exists) {
      this.props.permissions.push(permission);
    }
  }

  /**
   * Callers: [RoleApplicationService.revokePermissionFromRole]
   * Callees: []
   * Description: Revokes a permission from the role.
   * Keywords: revoke, permission, role, identity
   */
  public revokePermission(permissionId: string): void {
    this.props.permissions = this.props.permissions.filter(p => p.id !== permissionId);
  }
}