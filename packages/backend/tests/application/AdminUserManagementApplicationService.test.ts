import { AdminUserManagementApplicationService } from '../../src/application/identity/AdminUserManagementApplicationService';
import { IUserRepository } from '../../src/domain/identity/IUserRepository';
import { IEventBus } from '../../src/domain/shared/events/IEventBus';
import { User } from '../../src/domain/identity/User';
import { UserStatus } from '@myndbbs/shared';

jest.mock('../../src/db', () => ({
  prisma: {
    passkey: { deleteMany: jest.fn() },
    userKey: { deleteMany: jest.fn() },
    notification: { deleteMany: jest.fn() },
    friendship: { findMany: jest.fn(), deleteMany: jest.fn() },
    conversationSetting: { deleteMany: jest.fn() },
    privateMessage: { deleteMany: jest.fn() },
    upvote: { deleteMany: jest.fn() },
    bookmark: { deleteMany: jest.fn() },
    commentUpvote: { deleteMany: jest.fn() },
    commentBookmark: { deleteMany: jest.fn() },
    categoryModerator: { deleteMany: jest.fn() },
    wikiCollaborator: { deleteMany: jest.fn() },
    wikiCreationLimit: { deleteMany: jest.fn() },
    user: { update: jest.fn() },
  },
}));

import { prisma } from '../../src/db';

const mockAbilityCache = {
  invalidateUserRules: jest.fn().mockResolvedValue(undefined),
};

const mockEmailRegistrationTicketRepository = {
  findByEmail: jest.fn().mockResolvedValue(null),
  findByUsername: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue(undefined),
};

const mockPasswordResetTicketRepository = {
  findByUserId: jest.fn().mockResolvedValue(null),
  findByEmail: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue(undefined),
};

const mockPasswordHasher = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
};

const createUser = (overrides: Partial<{
  id: string;
  email: string;
  username: string;
  password: string | null;
  roleId: string | null;
  status: UserStatus;
  level: number;
  isPasskeyMandatory: boolean;
  totpSecret: string | null;
  isTotpEnabled: boolean;
  avatarUrl: string | null;
  cookiePreferences: any;
}> = {}) => User.create({
  id: overrides.id ?? 'target1',
  email: overrides.email ?? 'target@example.com',
  username: overrides.username ?? 'target',
  password: overrides.password ?? 'hashed-password',
  roleId: overrides.roleId ?? null,
  status: overrides.status ?? UserStatus.ACTIVE,
  level: overrides.level ?? 1,
  isPasskeyMandatory: overrides.isPasskeyMandatory ?? true,
  totpSecret: overrides.totpSecret ?? 'totp-secret',
  isTotpEnabled: overrides.isTotpEnabled ?? true,
  avatarUrl: overrides.avatarUrl ?? '/uploads/avatars/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png',
  cookiePreferences: overrides.cookiePreferences ?? { analytics: true },
  createdAt: new Date(),
});

const createDeletionService = (overrides: Partial<ConstructorParameters<typeof AdminUserManagementApplicationService>[0]> = {}) => {
  const userRepository = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    save: jest.fn(),
    findByRoleId: jest.fn(),
  };
  const roleRepository = {
    findById: jest.fn(),
    findByName: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const sessionRepository = {
    findByUserId: jest.fn().mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]),
    deleteManyByUserId: jest.fn().mockResolvedValue(undefined),
  };
  const sessionCache = {
    revokeSession: jest.fn().mockResolvedValue(undefined),
    markSessionRequiresRefresh: jest.fn().mockResolvedValue(undefined),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() };
  const emailRegistrationTicketRepository = {
    findByEmail: jest.fn().mockResolvedValue(null),
    findByUsername: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const passwordResetTicketRepository = {
    findByUserId: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const deps = {
    userRepository,
    roleRepository,
    passkeyRepository: {} as any,
    sessionRepository,
    sessionCache,
    passwordHasher: {
      hash: jest.fn().mockResolvedValue('hashed-test-password'),
      verify: jest.fn().mockResolvedValue(true),
    },
    roleHierarchyPolicy: {
      assertRoleName: jest.fn(),
      isAtLeast: jest.fn().mockReturnValue(false),
      compare: jest.fn(),
    },
    eventBus,
    unitOfWork: { execute: jest.fn((w: any) => w()) },
    abilityCache: { invalidateUserRules: jest.fn().mockResolvedValue(undefined) },
    emailRegistrationTicketRepository,
    passwordResetTicketRepository,
    storagePort: { deleteAvatar: jest.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as any;

  return { service: new AdminUserManagementApplicationService(deps), deps };
};

describe('AdminUserManagementApplicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const delegate of Object.values(prisma as any)) {
      if (delegate && typeof delegate === 'object') {
        for (const fn of Object.values(delegate as any)) {
          if (typeof fn === 'function' && 'mockResolvedValue' in fn) {
            (fn as jest.Mock).mockResolvedValue({ count: 0 });
          }
        }
      }
    }
    (prisma.friendship.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('should create an active level-1 USER test account for super admins', async () => {
    const { service, deps } = createDeletionService();
    deps.roleRepository.findByName.mockResolvedValue({ id: 'role-user', name: 'USER' });
    deps.passwordHasher.hash.mockResolvedValue('hashed-TestPass1!');

    const result = await service.createTestAccount(
      { userId: 'super-admin-1', role: 'SUPER_ADMIN' },
      {
        username: 'test_qa01',
        email: 'TEST_QA01@EXAMPLE.TEST',
        password: 'TestPass1!',
      },
    );

    expect(result).toEqual({
      id: expect.any(String),
      username: 'test_qa01',
      email: 'test_qa01@example.test',
      role: 'USER',
      status: UserStatus.ACTIVE,
      level: 1,
    });
    expect(deps.userRepository.findByEmail).toHaveBeenCalledWith('test_qa01@example.test');
    expect(deps.userRepository.findByUsername).toHaveBeenCalledWith('test_qa01');
    expect(deps.passwordHasher.hash).toHaveBeenCalledWith('TestPass1!');
    const savedUser = deps.userRepository.save.mock.calls[0][0];
    expect(savedUser.username).toBe('test_qa01');
    expect(savedUser.email).toBe('test_qa01@example.test');
    expect(savedUser.password).toBe('hashed-TestPass1!');
    expect(savedUser.roleId).toBe('role-user');
    expect(savedUser.status).toBe(UserStatus.ACTIVE);
    expect(savedUser.level).toBe(1);
    expect(deps.eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'TestAccountCreatedEvent',
      targetUserId: result.id,
      operatorId: 'super-admin-1',
    }));
  });

  it('should reject test account creation for non-super-admin operators', async () => {
    const { service, deps } = createDeletionService();

    await expect(
      service.createTestAccount(
        { userId: 'admin-1', role: 'ADMIN' },
        {
          username: 'test_qa01',
          email: 'test_qa01@example.test',
          password: 'TestPass1!',
        },
      ),
    ).rejects.toThrow('ERR_FORBIDDEN_SUPER_ADMIN_ONLY');

    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('should reject identities occupied by pending email registrations', async () => {
    const { service, deps } = createDeletionService();
    deps.emailRegistrationTicketRepository.findByEmail.mockResolvedValue({
      id: 'pending-registration',
      email: 'test_qa01@example.test',
      username: 'test_qa01',
    });

    await expect(
      service.createTestAccount(
        { userId: 'super-admin-1', role: 'SUPER_ADMIN' },
        {
          username: 'test_qa01',
          email: 'test_qa01@example.test',
          password: 'TestPass1!',
        },
      ),
    ).rejects.toThrow('ERR_EMAIL_ALREADY_EXISTS');

    expect(deps.userRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6 if level is invalid', async () => {
    const service = new AdminUserManagementApplicationService({
      userRepository: {} as any,
      roleRepository: {} as any,
      passkeyRepository: {} as any,
      sessionRepository: {} as any,
      sessionCache: {} as any,
      roleHierarchyPolicy: {} as any,
      eventBus: {} as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });
    await expect(service.changeUserLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 0)).rejects.toThrow('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
    await expect(service.changeUserLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 7)).rejects.toThrow('ERR_LEVEL_MUST_BE_BETWEEN_1_AND_6');
  });

  it('should throw ERR_INVALID_STATUS if status is invalid', async () => {
    const service = new AdminUserManagementApplicationService({
      userRepository: {} as any,
      roleRepository: {} as any,
      passkeyRepository: {} as any,
      sessionRepository: {} as any,
      sessionCache: {} as any,
      roleHierarchyPolicy: {} as any,
      eventBus: {} as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });
    await expect(service.changeUserStatus({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'INVALID_STATUS' as any)).rejects.toThrow('ERR_INVALID_STATUS');
  });

  it('should throw ERR_INVALID_ROLE if role is invalid', async () => {
    const service = new AdminUserManagementApplicationService({
      userRepository: {} as any,
      roleRepository: {} as any,
      passkeyRepository: {} as any,
      sessionRepository: {} as any,
      sessionCache: {} as any,
      roleHierarchyPolicy: {} as any,
      eventBus: {} as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });
    await expect(service.changeUserRole({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'INVALID_ROLE' as any)).rejects.toThrow('ERR_INVALID_ROLE');
  });

  it('should auto-disable root when another user gets SUPER_ADMIN', async () => {
    const mockRootUser = { id: 'rootId', username: 'root', status: UserStatus.ACTIVE, changeStatus: jest.fn() };
    const mockTargetUser = { id: 'target1', username: 'other', roleId: 'oldRole', changeRole: jest.fn() };

    const mockUserRepo = {
      findById: jest.fn().mockImplementation((id) => id === 'target1' ? Promise.resolve(mockTargetUser) : Promise.resolve(mockRootUser)),
      findByUsername: jest.fn().mockImplementation((username) => username === 'root' ? Promise.resolve(mockRootUser) : Promise.resolve(null)),
      save: jest.fn()
    } as unknown as IUserRepository;

    const mockRoleRepo = {
      findById: jest.fn().mockResolvedValue({ name: 'USER' }),
      findByName: jest.fn().mockResolvedValue({ id: 'newRole' })
    };

    const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() } as unknown as IEventBus;

    const mockRolePolicy = {
      assertRoleName: jest.fn(),
      isAtLeast: jest.fn().mockReturnValue(false),
      compare: jest.fn().mockReturnValue(-1)
    };

    const mockSessionRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      deleteManyByUserId: jest.fn().mockResolvedValue(undefined)
    };

    const mockSessionCache = {
      markSessionRequiresRefresh: jest.fn(),
      revokeSession: jest.fn()
    };

    const service = new AdminUserManagementApplicationService({
      userRepository: mockUserRepo,
      roleRepository: mockRoleRepo as any,
      passkeyRepository: null as any,
      sessionRepository: mockSessionRepo as any,
      sessionCache: mockSessionCache as any,
      roleHierarchyPolicy: mockRolePolicy as any,
      eventBus: mockEventBus as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });

    await service.changeUserRole({ userId: 'operator1', role: 'SUPER_ADMIN' as any }, 'target1', 'SUPER_ADMIN' as any);

    expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('root');
    expect(mockRootUser.changeStatus).toHaveBeenCalledWith(UserStatus.BANNED);
    expect(mockUserRepo.save).toHaveBeenCalledWith(mockRootUser);
  });

  it('should automatically log audit when changing user role', async () => {
    const mockUserRepo = {
      findById: jest.fn().mockResolvedValue({
        roleId: 'oldRole',
        changeRole: jest.fn()
      }),
      save: jest.fn()
    } as unknown as IUserRepository;

    const mockRoleRepo = {
      findById: jest.fn().mockResolvedValue({ name: 'USER' }),
      findByName: jest.fn().mockResolvedValue({ id: 'newRole' })
    };

    const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined), subscribe: jest.fn() } as unknown as IEventBus;

    const mockRolePolicy = {
      assertRoleName: jest.fn(),
      isAtLeast: jest.fn().mockReturnValue(false),
      compare: jest.fn().mockReturnValue(-1)
    };

    const mockSessionRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      deleteManyByUserId: jest.fn().mockResolvedValue(undefined)
    };

    const mockSessionCache = {
      markSessionRequiresRefresh: jest.fn()
    };

    const service = new AdminUserManagementApplicationService({
      userRepository: mockUserRepo,
      roleRepository: mockRoleRepo as any,
      passkeyRepository: null as any,
      sessionRepository: mockSessionRepo as any,
      sessionCache: mockSessionCache as any,
      roleHierarchyPolicy: mockRolePolicy as any,
      eventBus: mockEventBus as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });

    await service.changeUserRole({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', 'MODERATOR' as any);
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should change user role and level in a single operation', async () => {
    const service = new AdminUserManagementApplicationService({
      userRepository: {} as any,
      roleRepository: {} as any,
      passkeyRepository: {} as any,
      sessionRepository: {} as any,
      sessionCache: {} as any,
      roleHierarchyPolicy: {} as any,
      eventBus: {} as any,
      unitOfWork: { execute: async (w: any) => w() } as any,
      abilityCache: mockAbilityCache as any,
      passwordHasher: mockPasswordHasher as any,
      emailRegistrationTicketRepository: mockEmailRegistrationTicketRepository as any,
      passwordResetTicketRepository: mockPasswordResetTicketRepository as any,
      storagePort: { deleteAvatar: jest.fn() } as any,
    });
    service.changeUserLevel = jest.fn();
    service.changeUserRole = jest.fn();

    await service.changeUserRoleAndLevel({ userId: 'operator1', role: 'ADMIN' as any }, 'target1', { role: 'MODERATOR' as any, level: 3 });

    expect(service.changeUserLevel).toHaveBeenCalledWith({ userId: 'operator1', role: 'ADMIN' }, 'target1', 3);
    expect(service.changeUserRole).toHaveBeenCalledWith({ userId: 'operator1', role: 'ADMIN' }, 'target1', 'MODERATOR');
  });

  it('should anonymize a user and clean related personal data', async () => {
    const { service, deps } = createDeletionService();
    const target = createUser({ id: '11111111-2222-3333-4444-555555555555' });
    deps.userRepository.findById.mockResolvedValue(target);
    deps.emailRegistrationTicketRepository.findByEmail.mockResolvedValue({ id: 'registration-ticket' });
    deps.passwordResetTicketRepository.findByUserId.mockResolvedValue({ id: 'reset-ticket' });
    (prisma.friendship.findMany as jest.Mock).mockResolvedValue([{ id: 'friendship-1' }]);

    const result = await service.anonymizeUser(
      { userId: 'operator1', role: 'SUPER_ADMIN' },
      target.id,
    );

    expect(result).toEqual({
      id: target.id,
      username: 'deleted-user-111111112222',
      email: 'deleted-11111111222233334444555555555555@deleted.local',
      status: UserStatus.INACTIVE,
    });
    expect(target.username).toBe('deleted-user-111111112222');
    expect(target.email).toBe('deleted-11111111222233334444555555555555@deleted.local');
    expect(target.password).toBeNull();
    expect(target.roleId).toBeNull();
    expect(target.level).toBe(0);
    expect(target.avatarUrl).toBeNull();
    expect(target.totpSecret).toBeNull();
    expect(target.isTotpEnabled).toBe(false);
    expect(target.isPasskeyMandatory).toBe(false);
    expect(target.cookiePreferences).toBeNull();
    expect(deps.userRepository.save).toHaveBeenCalledWith(target);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: target.id },
      data: { registeredIp: null },
    });
    expect(deps.sessionCache.revokeSession).toHaveBeenCalledWith('session-1');
    expect(deps.sessionCache.revokeSession).toHaveBeenCalledWith('session-2');
    expect(deps.sessionRepository.deleteManyByUserId).toHaveBeenCalledWith(target.id);
    expect(prisma.friendship.findMany).toHaveBeenCalledWith({
      where: { OR: [{ requesterId: target.id }, { addresseeId: target.id }] },
      select: { id: true },
    });
    expect(prisma.privateMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        isSystem: true,
        OR: [{ encryptedContent: { contains: 'friendship-1' } }],
      },
    });
    expect(prisma.privateMessage.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ senderId: target.id }, { receiverId: target.id }] },
    });
    expect(prisma.passkey.deleteMany).toHaveBeenCalledWith({ where: { userId: target.id } });
    expect(prisma.userKey.deleteMany).toHaveBeenCalledWith({ where: { userId: target.id } });
    expect(deps.emailRegistrationTicketRepository.delete).toHaveBeenCalledWith('registration-ticket');
    expect(deps.passwordResetTicketRepository.delete).toHaveBeenCalledWith('reset-ticket');
    expect(deps.abilityCache.invalidateUserRules).toHaveBeenCalledWith(target.id);
    expect(deps.eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'UserDeletedEvent',
      targetUserId: target.id,
      operatorId: 'operator1',
    }));
  });

  it('should reject deleting self', async () => {
    const { service } = createDeletionService();

    await expect(
      service.anonymizeUser({ userId: 'target1', role: 'SUPER_ADMIN' }, 'target1'),
    ).rejects.toThrow('ERR_FORBIDDEN_CANNOT_DELETE_SELF');
  });

  it('should reject deleting same or higher role users for non-super-admin operators', async () => {
    const { service, deps } = createDeletionService();
    const target = createUser({ roleId: 'admin-role' });
    deps.userRepository.findById.mockResolvedValue(target);
    deps.roleRepository.findById.mockResolvedValue({ name: 'ADMIN' });
    deps.roleHierarchyPolicy.isAtLeast.mockReturnValue(true);

    await expect(
      service.anonymizeUser({ userId: 'operator1', role: 'ADMIN' }, target.id),
    ).rejects.toThrow('ERR_FORBIDDEN_CANNOT_MANAGE_USER_WITH_EQUAL_OR_HIGHER_ROLE');
  });

  it('should be idempotent when the target is already anonymized', async () => {
    const { service, deps } = createDeletionService();
    const target = createUser({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      username: 'deleted-user-aaaaaaaabbbb',
      email: 'deleted-aaaaaaaabbbbccccddddeeeeeeeeeeee@deleted.local',
      status: UserStatus.INACTIVE,
    });
    deps.userRepository.findById.mockResolvedValue(target);

    const result = await service.anonymizeUser(
      { userId: 'operator1', role: 'SUPER_ADMIN' },
      target.id,
    );

    expect(result).toEqual({
      id: target.id,
      username: target.username,
      email: target.email,
      status: UserStatus.INACTIVE,
    });
    expect(deps.userRepository.save).not.toHaveBeenCalled();
    expect(prisma.passkey.deleteMany).not.toHaveBeenCalled();
    expect(deps.eventBus.publish).not.toHaveBeenCalled();
  });
});
