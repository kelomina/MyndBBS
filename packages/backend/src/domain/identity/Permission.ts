export interface PermissionProps {
  id: string;
  action: string;
  subject: string;
  conditions: string | null;
}

/**
 * Callers: [Role, PrismaPermissionRepository]
 * Callees: []
 * Description: Represents a Permission Entity within the Identity domain. Defines an atomic capability in the system.
 * Keywords: permission, entity, domain, identity, rbac, capability
 */
export class Permission {
  private props: PermissionProps;

  /**
   * Callers: [Permission.create, Permission.load]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, permission, entity, instantiation
   */
  private constructor(props: PermissionProps) {
    this.props = { ...props };
  }

  /**
   * Callers: [RoleApplicationService.createPermission]
   * Callees: [Permission.constructor]
   * Description: Static factory method creating a new Permission entity. Validates essential components.
   * Keywords: create, factory, permission, domain, instantiation
   */
  public static create(props: PermissionProps): Permission {
    if (!props.action || !props.subject) {
      throw new Error('ERR_PERMISSION_MISSING_REQUIRED_FIELDS');
    }
    return new Permission(props);
  }

  /**
   * Callers: [PrismaPermissionRepository.toDomain, PrismaRoleRepository.toDomain]
   * Callees: [Permission.constructor]
   * Description: Static factory method reconstituting a Permission entity from database state.
   * Keywords: load, factory, permission, domain, reconstitute
   */
  public static load(props: PermissionProps): Permission {
    return new Permission(props);
  }

  // --- Accessors ---

  public get id(): string { return this.props.id; }
  public get action(): string { return this.props.action; }
  public get subject(): string { return this.props.subject; }
  public get conditions(): string | null { return this.props.conditions; }

  // Permissions are typically immutable once created. If modification is needed, it would be done via a service.
}