import { RoleHierarchyPolicy } from '../src/application/identity/policies/RoleHierarchyPolicy';

describe('RoleHierarchyPolicy', () => {
  let policy: RoleHierarchyPolicy;

  beforeEach(() => {
    policy = new RoleHierarchyPolicy();
  });

  describe('assertRoleName', () => {
    it('should not throw for valid role names', () => {
      expect(() => policy.assertRoleName('USER')).not.toThrow();
      expect(() => policy.assertRoleName('MODERATOR')).not.toThrow();
      expect(() => policy.assertRoleName('ADMIN')).not.toThrow();
      expect(() => policy.assertRoleName('SUPER_ADMIN')).not.toThrow();
    });

    it('should throw for invalid role names', () => {
      expect(() => policy.assertRoleName('INVALID' as any)).toThrow('ERR_INVALID_ROLE');
      expect(() => policy.assertRoleName('user' as any)).toThrow('ERR_INVALID_ROLE');
      expect(() => policy.assertRoleName('ADMINISTRATOR' as any)).toThrow('ERR_INVALID_ROLE');
      expect(() => policy.assertRoleName('' as any)).toThrow('ERR_INVALID_ROLE');
    });
  });

  describe('compare', () => {
    it('should return negative when first role is lower than second', () => {
      expect(policy.compare('USER', 'MODERATOR')).toBeLessThan(0);
      expect(policy.compare('USER', 'ADMIN')).toBeLessThan(0);
      expect(policy.compare('USER', 'SUPER_ADMIN')).toBeLessThan(0);
      expect(policy.compare('MODERATOR', 'ADMIN')).toBeLessThan(0);
      expect(policy.compare('MODERATOR', 'SUPER_ADMIN')).toBeLessThan(0);
      expect(policy.compare('ADMIN', 'SUPER_ADMIN')).toBeLessThan(0);
    });

    it('should return positive when first role is higher than second', () => {
      expect(policy.compare('MODERATOR', 'USER')).toBeGreaterThan(0);
      expect(policy.compare('ADMIN', 'USER')).toBeGreaterThan(0);
      expect(policy.compare('ADMIN', 'MODERATOR')).toBeGreaterThan(0);
      expect(policy.compare('SUPER_ADMIN', 'USER')).toBeGreaterThan(0);
      expect(policy.compare('SUPER_ADMIN', 'MODERATOR')).toBeGreaterThan(0);
      expect(policy.compare('SUPER_ADMIN', 'ADMIN')).toBeGreaterThan(0);
    });

    it('should return zero when roles are equal', () => {
      expect(policy.compare('USER', 'USER')).toBe(0);
      expect(policy.compare('MODERATOR', 'MODERATOR')).toBe(0);
      expect(policy.compare('ADMIN', 'ADMIN')).toBe(0);
      expect(policy.compare('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(0);
    });
  });

  describe('isAtLeast', () => {
    it('should return true when first role is equal or higher', () => {
      expect(policy.isAtLeast('USER', 'USER')).toBe(true);
      expect(policy.isAtLeast('MODERATOR', 'USER')).toBe(true);
      expect(policy.isAtLeast('ADMIN', 'USER')).toBe(true);
      expect(policy.isAtLeast('ADMIN', 'MODERATOR')).toBe(true);
      expect(policy.isAtLeast('SUPER_ADMIN', 'ADMIN')).toBe(true);
      expect(policy.isAtLeast('SUPER_ADMIN', 'USER')).toBe(true);
    });

    it('should return false when first role is lower', () => {
      expect(policy.isAtLeast('USER', 'MODERATOR')).toBe(false);
      expect(policy.isAtLeast('USER', 'ADMIN')).toBe(false);
      expect(policy.isAtLeast('USER', 'SUPER_ADMIN')).toBe(false);
      expect(policy.isAtLeast('MODERATOR', 'ADMIN')).toBe(false);
      expect(policy.isAtLeast('MODERATOR', 'SUPER_ADMIN')).toBe(false);
      expect(policy.isAtLeast('ADMIN', 'SUPER_ADMIN')).toBe(false);
    });
  });
});