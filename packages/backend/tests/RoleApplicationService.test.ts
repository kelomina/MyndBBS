import { RoleApplicationService } from '../src/application/identity/RoleApplicationService';
import { Role } from '../src/domain/identity/Role';
import { Permission } from '../src/domain/identity/Permission';

describe('RoleApplicationService', () => {
  let service: RoleApplicationService;
  let roleRepository: {
    findById: jest.Mock;
    save: jest.Mock;
  };
  let permissionRepository: {
    findById: jest.Mock;
    save: jest.Mock;
  };
  let userRepository: { findByRoleId: jest.Mock };
  let abilityCache: { invalidateUsersRules: jest.Mock };
  let unitOfWork: { execute: jest.Mock };

  beforeEach(() => {
    roleRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined)
    };
    permissionRepository = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined)
    };
    userRepository = {
      findByRoleId: jest.fn().mockResolvedValue([])
    };
    abilityCache = {
      invalidateUsersRules: jest.fn().mockResolvedValue(undefined)
    };
    unitOfWork = {
      execute: jest.fn().mockImplementation((work) => work())
    };

    service = new RoleApplicationService({
      roleRepository,
      permissionRepository,
      userRepository,
      abilityCache,
      unitOfWork,
    } as any);
  });

  describe('createRole', () => {
    it('should create a new role', async () => {
      const result = await service.createRole('MODERATOR', 'Forum moderator');

      expect(result.name).toBe('MODERATOR');
      expect(result.description).toBe('Forum moderator');
      expect(result.permissions).toEqual([]);
      expect(roleRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should create role with null description', async () => {
      const result = await service.createRole('GUEST', null);

      expect(result.name).toBe('GUEST');
      expect(result.description).toBeNull();
    });
  });

  describe('updateRole', () => {
    it('should update existing role details', async () => {
      const role = Role.create({
        id: 'role-1',
        name: 'OLD_NAME',
        description: 'Old description',
        permissions: []
      });
      
      roleRepository.findById.mockResolvedValue(role);

      const result = await service.updateRole('role-1', 'NEW_NAME', 'New description');

      expect(result.name).toBe('NEW_NAME');
      expect(result.description).toBe('New description');
      expect(roleRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if role not found', async () => {
      roleRepository.findById.mockResolvedValue(null);

      await expect(service.updateRole('role-1', 'NEW_NAME', 'New description'))
        .rejects.toThrow('ERR_ROLE_NOT_FOUND');
    });
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const result = await service.createPermission(
        'manage',
        'Post',
        JSON.stringify({ categoryId: 'cat-1' })
      );

      expect(result.action).toBe('manage');
      expect(result.subject).toBe('Post');
      expect(result.conditions).toBe(JSON.stringify({ categoryId: 'cat-1' }));
      expect(permissionRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should create permission with null conditions', async () => {
      const result = await service.createPermission('read', 'Wiki', null);

      expect(result.conditions).toBeNull();
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role', async () => {
      const role = Role.create({
        id: 'role-1',
        name: 'MODERATOR',
        description: 'Moderator',
        permissions: []
      });
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      
      roleRepository.findById.mockResolvedValue(role);
      permissionRepository.findById.mockResolvedValue(permission);

      const result = await service.assignPermissionToRole('role-1', 'perm-1');

      expect(result.permissions).toContainEqual(permission);
      expect(roleRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw error if role not found', async () => {
      roleRepository.findById.mockResolvedValue(null);

      await expect(service.assignPermissionToRole('role-1', 'perm-1'))
        .rejects.toThrow('ERR_ROLE_NOT_FOUND');
    });

    it('should throw error if permission not found', async () => {
      const role = Role.create({
        id: 'role-1',
        name: 'MODERATOR',
        description: 'Moderator',
        permissions: []
      });
      
      roleRepository.findById.mockResolvedValue(role);
      permissionRepository.findById.mockResolvedValue(null);

      await expect(service.assignPermissionToRole('role-1', 'perm-1'))
        .rejects.toThrow('ERR_PERMISSION_NOT_FOUND');
    });

    it('should invalidate users cache when permission assigned', async () => {
      const role = Role.create({
        id: 'role-1',
        name: 'MODERATOR',
        description: 'Moderator',
        permissions: []
      });
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      
      roleRepository.findById.mockResolvedValue(role);
      permissionRepository.findById.mockResolvedValue(permission);
      userRepository.findByRoleId.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' }
      ]);

      await service.assignPermissionToRole('role-1', 'perm-1');

      expect(abilityCache.invalidateUsersRules).toHaveBeenCalledWith(['user-1', 'user-2']);
    });
  });

  describe('revokePermissionFromRole', () => {
    it('should revoke permission from role', async () => {
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      const role = Role.create({
        id: 'role-1',
        name: 'MODERATOR',
        description: 'Moderator',
        permissions: [permission]
      });
      
      roleRepository.findById.mockResolvedValue(role);

      const result = await service.revokePermissionFromRole('role-1', 'perm-1');

      expect(result.permissions).not.toContainEqual(permission);
      expect(result.permissions).toHaveLength(0);
    });

    it('should throw error if role not found', async () => {
      roleRepository.findById.mockResolvedValue(null);

      await expect(service.revokePermissionFromRole('role-1', 'perm-1'))
        .rejects.toThrow('ERR_ROLE_NOT_FOUND');
    });

    it('should invalidate users cache when permission revoked', async () => {
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      const role = Role.create({
        id: 'role-1',
        name: 'MODERATOR',
        description: 'Moderator',
        permissions: [permission]
      });
      
      roleRepository.findById.mockResolvedValue(role);
      userRepository.findByRoleId.mockResolvedValue([{ id: 'user-1' }]);

      await service.revokePermissionFromRole('role-1', 'perm-1');

      expect(abilityCache.invalidateUsersRules).toHaveBeenCalledWith(['user-1']);
    });
  });
});
