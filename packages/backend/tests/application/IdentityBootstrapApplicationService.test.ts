import { IdentityBootstrapApplicationService } from '../../src/application/identity/IdentityBootstrapApplicationService';
import { User } from '../../src/domain/identity/User';
import { Role } from '../../src/domain/identity/Role';
import { UserStatus } from '@myndbbs/shared';

describe('IdentityBootstrapApplicationService', () => {
  let service: IdentityBootstrapApplicationService;
  let mocks: any;

  beforeEach(() => {
    mocks = {
      userRepository: {
        findByUsername: jest.fn(),
        findByEmail: jest.fn(),
        save: jest.fn(),
        findById: jest.fn(),
      },
      roleRepository: {
        findByName: jest.fn(),
        save: jest.fn(),
        findById: jest.fn(),
      },
      passwordHasher: {
        hash: jest.fn().mockResolvedValue('hashed-password'),
      },
      unitOfWork: {
        execute: jest.fn((fn: any) => fn()),
      },
    };

    service = new IdentityBootstrapApplicationService({
      userRepository: mocks.userRepository,
      roleRepository: mocks.roleRepository,
      passwordHasher: mocks.passwordHasher,
      unitOfWork: mocks.unitOfWork,
    });

    jest.clearAllMocks();
  });

  describe('bootstrapSuperAdmin', () => {
    it('should create super admin when roles and users do not exist', async () => {
      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null) // SUPER_ADMIN
        .mockResolvedValueOnce(null); // ADMIN
      mocks.userRepository.findByUsername.mockResolvedValue(null); // system user
      mocks.userRepository.findByEmail.mockResolvedValue(null); // admin user

      const userId = await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      expect(userId).toBeDefined();
      expect(mocks.roleRepository.save).toHaveBeenCalledTimes(2);
      expect(mocks.userRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should use existing roles when they exist', async () => {
      const superAdminRole = Role.create({
        id: 'role-super',
        name: 'SUPER_ADMIN',
        description: 'System Administrator',
        permissions: [],
      });
      const adminRole = Role.create({
        id: 'role-admin',
        name: 'ADMIN',
        description: 'Administrator',
        permissions: [],
      });

      mocks.roleRepository.findByName
        .mockResolvedValueOnce(superAdminRole) // SUPER_ADMIN
        .mockResolvedValueOnce(adminRole); // ADMIN
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      expect(mocks.roleRepository.save).not.toHaveBeenCalled();
    });

    it('should use existing system user when it exists', async () => {
      const systemUser = User.create({
        id: 'user-system',
        username: 'system',
        email: 'system@localhost',
        password: 'hashed',
        roleId: 'role-admin',
        status: UserStatus.ACTIVE,
        level: 4,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: null,
        createdAt: new Date(),
      });

      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername
        .mockResolvedValueOnce(systemUser) // system user exists
        .mockResolvedValueOnce(null); // admin user doesn't exist
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      expect(mocks.userRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should update existing admin user instead of creating new', async () => {
      const existingUser = User.create({
        id: 'user-admin',
        username: 'old-admin',
        email: 'old@example.com',
        password: 'old-hashed',
        roleId: 'old-role',
        status: UserStatus.ACTIVE,
        level: 1,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: null,
        createdAt: new Date(),
      });

      const superAdminRole = Role.create({
        id: 'role-super',
        name: 'SUPER_ADMIN',
        description: 'System Administrator',
        permissions: [],
      });

      mocks.roleRepository.findByName
        .mockResolvedValueOnce(superAdminRole)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(existingUser);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      const userId = await service.bootstrapSuperAdmin('admin', 'new@example.com', 'new-password');

      expect(userId).toBe('user-admin');
      expect(existingUser.email).toBe('new@example.com');
      expect(existingUser.username).toBe('admin');
    });

    it('should find existing user by email when username not found', async () => {
      const existingUser = User.create({
        id: 'user-admin',
        username: 'admin',
        email: 'admin@example.com',
        password: 'hashed',
        roleId: 'old-role',
        status: UserStatus.ACTIVE,
        level: 1,
        isPasskeyMandatory: false,
        totpSecret: null,
        isTotpEnabled: false,
        avatarUrl: null,
        createdAt: new Date(),
      });

      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(existingUser);

      const userId = await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      expect(userId).toBe('user-admin');
    });

    it('should set proper level for admin user', async () => {
      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      const savedUser = (mocks.userRepository.save as jest.Mock).mock.calls[1][0];
      expect(savedUser.level).toBe(4);
    });

    it('should set proper level for system user', async () => {
      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      const systemUser = (mocks.userRepository.save as jest.Mock).mock.calls[0][0];
      expect(systemUser.username).toBe('system');
      expect(systemUser.level).toBe(4);
    });

    it('should set user status to ACTIVE', async () => {
      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      const savedUser = (mocks.userRepository.save as jest.Mock).mock.calls[1][0];
      expect(savedUser.status).toBe(UserStatus.ACTIVE);
    });

    it('should hash the password before saving', async () => {
      mocks.roleRepository.findByName
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mocks.userRepository.findByUsername.mockResolvedValue(null);
      mocks.userRepository.findByEmail.mockResolvedValue(null);

      await service.bootstrapSuperAdmin('admin', 'admin@example.com', 'password');

      expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('password');
    });
  });
});
