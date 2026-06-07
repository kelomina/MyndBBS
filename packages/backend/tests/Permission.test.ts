import { Permission } from '../src/domain/identity/Permission';

describe('Permission Domain Entity', () => {
  describe('create', () => {
    it('should create a valid Permission with conditions', () => {
      const permission = Permission.create({
        id: 'perm-123',
        action: 'manage',
        subject: 'Post',
        conditions: JSON.stringify({ categoryId: 'cat-1' })
      });

      expect(permission.id).toBe('perm-123');
      expect(permission.action).toBe('manage');
      expect(permission.subject).toBe('Post');
      expect(permission.conditions).toBe(JSON.stringify({ categoryId: 'cat-1' }));
    });

    it('should create a valid Permission without conditions', () => {
      const permission = Permission.create({
        id: 'perm-123',
        action: 'read',
        subject: 'Wiki',
        conditions: null
      });

      expect(permission.conditions).toBeNull();
    });

    it('should throw error when action is missing', () => {
      expect(() => Permission.create({
        id: 'perm-123',
        action: '',
        subject: 'Post',
        conditions: null
      })).toThrow('ERR_PERMISSION_MISSING_REQUIRED_FIELDS');
    });

    it('should throw error when subject is missing', () => {
      expect(() => Permission.create({
        id: 'perm-123',
        action: 'manage',
        subject: '',
        conditions: null
      })).toThrow('ERR_PERMISSION_MISSING_REQUIRED_FIELDS');
    });
  });

  describe('load', () => {
    it('should load a Permission from database state', () => {
      const permission = Permission.load({
        id: 'perm-456',
        action: 'delete',
        subject: 'Comment',
        conditions: null
      });

      expect(permission.id).toBe('perm-456');
      expect(permission.action).toBe('delete');
      expect(permission.subject).toBe('Comment');
    });
  });
});