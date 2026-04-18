import { AdminUserManagementApplicationService } from '../src/application/identity/AdminUserManagementApplicationService';
import { RoleHierarchyPolicy } from '../src/application/identity/policies/RoleHierarchyPolicy';
import { User } from '../src/domain/identity/User';
import { UserStatus } from '@myndbbs/shared';

class InMemoryUserRepo {
  public users = new Map<string, User>();
  async findById(id: string) { return this.users.get(id) || null; }
  async save(u: User) { this.users.set(u.id, u); }
}

class InMemoryRoleRepo {
  public roles = new Map<string, { id: string; name: any }>();
  async findById(id: string) { return this.roles.get(id) || null; }
  async findByName(name: any) { return [...this.roles.values()].find(r => r.name === name) || null; }
}

class InMemoryPasskeyRepo {
  public byUser = new Map<string, any[]>();
  async findByUserId(userId: string) { return this.byUser.get(userId) || []; }
}

class InMemorySessionRepo {
  public byUser = new Map<string, { id: string; userId: string }[]>();
  async findByUserId(userId: string) { return this.byUser.get(userId) || []; }
  async deleteManyByUserId(userId: string) { this.byUser.set(userId, []); }
}

class InMemorySessionCache {
  public revoked: string[] = [];
  public refresh: string[] = [];
  async revokeSession(id: string) { this.revoked.push(id); }
  async markSessionRequiresRefresh(id: string) { this.refresh.push(id); }
}

describe('AdminUserManagementApplicationService', () => {
  it('rejects promoting level > 1 without passkey', async () => {
    const userRepo = new InMemoryUserRepo();
    const roleRepo = new InMemoryRoleRepo();
    const passkeyRepo = new InMemoryPasskeyRepo();
    const sessionRepo = new InMemorySessionRepo();
    const sessionCache = new InMemorySessionCache();
    const eventBus = { publish: jest.fn(), subscribe: jest.fn() };

    const u = User.create({
      id: 'u1',
      email: 'a@b.com',
      username: 'u',
      password: null,
      roleId: null,
      status: UserStatus.ACTIVE,
      level: 1,
      isPasskeyMandatory: false,
      totpSecret: null,
      isTotpEnabled: false,
      createdAt: new Date(),
    });
    await userRepo.save(u);

    const unitOfWork = { execute: async (w: any) => w() };

    const svc = new AdminUserManagementApplicationService(
      userRepo as any,
      roleRepo as any,
      passkeyRepo as any,
      sessionRepo as any,
      sessionCache as any,
      new RoleHierarchyPolicy(),
      eventBus as any,
      unitOfWork as any
    );

    await expect(
      svc.changeUserLevel({ userId: 'admin', role: 'SUPER_ADMIN' }, 'u1', 2)
    ).rejects.toThrow('ERR_CANNOT_PROMOTE_WITHOUT_PASSKEY');
  });
});
