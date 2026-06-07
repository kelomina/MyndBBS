import { Role } from '../src/domain/identity/Role';
import { Permission } from '../src/domain/identity/Permission';

describe('Role Domain Entity', () => {
  const defaultProps = {
    id: 'role-123',
    name: 'MODERATOR',
    description: 'Forum moderator',
    permissions: []
  };

  describe('create', () => {
    it('should create a valid Role', () => {
      const role = Role.create(defaultProps);

      expect(role.id).toBe('role-123');
      expect(role.name).toBe('MODERATOR');
      expect(role.description).toBe('Forum moderator');
      expect(role.permissions).toEqual([]);
    });

    it('should throw error when name is missing', () => {
      expect(() => Role.create({
        id: 'role-123',
        name: '',
        description: 'Test role',
        permissions: []
      })).toThrow('ERR_ROLE_MISSING_REQUIRED_FIELDS');
    });

    it('should create role with null description', () => {
      const role = Role.create({
        id: 'role-123',
        name: 'GUEST',
        description: null,
        permissions: []
      });

      expect(role.description).toBeNull();
    });
  });

  describe('load', () => {
    it('should load a Role from database state', () => {
      const role = Role.load(defaultProps);

      expect(role.id).toBe('role-123');
      expect(role.name).toBe('MODERATOR');
    });
  });

  describe('updateDetails', () => {
    it('should update name and description', () => {
      const role = Role.create(defaultProps);

      role.updateDetails('ADMIN', 'System administrator');

      expect(role.name).toBe('ADMIN');
      expect(role.description).toBe('System administrator');
    });

    it('should throw error when updating to empty name', () => {
      const role = Role.create(defaultProps);

      expect(() => role.updateDetails('', 'New description')).toThrow('ERR_ROLE_NAME_CANNOT_BE_EMPTY');
    });

    it('should update description to null', () => {
      const role = Role.create(defaultProps);

      role.updateDetails('MODERATOR', null);

      expect(role.description).toBeNull();
    });
  });

  describe('assignPermission', () => {
    it('should add a permission to the role', () => {
      const role = Role.create(defaultProps);
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });

      role.assignPermission(permission);

      expect(role.permissions).toHaveLength(1);
      expect(role.permissions[0].id).toBe('perm-1');
    });

    it('should not add duplicate permissions', () => {
      const role = Role.create(defaultProps);
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });

      role.assignPermission(permission);
      role.assignPermission(permission);

      expect(role.permissions).toHaveLength(1);
    });
  });

  describe('revokePermission', () => {
    it('should remove a permission from the role', () => {
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      const role = Role.create({
        ...defaultProps,
        permissions: [permission]
      });

      role.revokePermission('perm-1');

      expect(role.permissions).toHaveLength(0);
    });

    it('should do nothing when permission does not exist', () => {
      const permission = Permission.create({
        id: 'perm-1',
        action: 'manage',
        subject: 'Post',
        conditions: null
      });
      const role = Role.create({
        ...defaultProps,
        permissions: [permission]
      });

      role.revokePermission('perm-non-existent');

      expect(role.permissions).toHaveLength(1);
      expect(role.permissions[0].id).toBe('perm-1');
    });
  });
});