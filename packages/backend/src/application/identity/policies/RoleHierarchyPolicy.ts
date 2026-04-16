export type RoleName = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export class RoleHierarchyPolicy {
  private readonly roleLevels: Record<RoleName, number> = {
    USER: 1,
    MODERATOR: 2,
    ADMIN: 3,
    SUPER_ADMIN: 4,
  };

  public assertRoleName(role: string): asserts role is RoleName {
    if (!['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new Error('ERR_INVALID_ROLE');
    }
  }

  public compare(a: RoleName, b: RoleName): number {
    return this.roleLevels[a] - this.roleLevels[b];
  }

  public isAtLeast(a: RoleName, b: RoleName): boolean {
    return this.compare(a, b) >= 0;
  }
}
