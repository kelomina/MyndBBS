import { defineAbilityForContext, AppAbility } from '../src/lib/casl';
import { rulesToPrisma } from '../src/lib/rulesToPrisma';
import { AccessContextDTO } from '../src/application/identity/contracts/AbilityContracts';
import { PostStatus } from '@myndbbs/shared';

describe('rulesToPrisma', () => {
  describe('Basic rule conversion', () => {
    it('should return empty array condition when no rules match', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'manage', 'all');
      
      expect(result).toEqual({ id: { in: [] } });
    });

    it('should return empty object when rule has no conditions', () => {
      const context: AccessContextDTO = {
        userId: 'admin-1',
        roleName: 'SUPER_ADMIN',
        level: 3,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'manage', 'all');
      
      expect(result).toEqual({});
    });
  });

  describe('MongoDB to Prisma operator conversion', () => {
    it('should convert $lte operator', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 2,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'read', 'Category');
      
      expect(result).toEqual({ minLevel: { lte: 2 } });
    });

    it('should convert nested field conditions', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 2,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'read', 'Post');
      
      expect(result).toHaveProperty('OR');
      const orConditions = result.OR;
      expect(orConditions).toContainEqual({ 
        status: PostStatus.PUBLISHED, 
        category: { minLevel: { lte: 2 } } 
      });
    });

    it('should convert $in operator', () => {
      const context: AccessContextDTO = {
        userId: 'mod-1',
        roleName: 'USER',
        level: 2,
        moderatedCategoryIds: ['cat-1', 'cat-2']
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'manage', 'Post');
      
      expect(result).toEqual({ categoryId: { in: ['cat-1', 'cat-2'] } });
    });

    it('should convert multiple operators', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 2,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'read', 'Wiki');
      
      expect(result).toHaveProperty('OR');
    });
  });

  describe('OR condition combination', () => {
    it('should combine multiple rules with OR', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'read', 'Post');
      
      expect(result).toHaveProperty('OR');
      expect(Array.isArray(result.OR)).toBe(true);
      expect(result.OR.length).toBeGreaterThan(1);
    });

    it('should return single condition when only one rule matches', () => {
      const context: AccessContextDTO = {
        userId: 'mod-1',
        roleName: 'MODERATOR',
        level: 2,
        moderatedCategoryIds: ['cat-1']
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'manage', 'Post');
      
      expect(result).toEqual({ categoryId: { in: ['cat-1'] } });
      expect(result.OR).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle guest user context', () => {
      const ability = defineAbilityForContext();
      
      const result = rulesToPrisma(ability, 'read', 'Post');
      
      expect(result).toHaveProperty('OR');
    });

    it('should handle inverted rules gracefully', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'delete', 'User');
      
      expect(result).toEqual({ id: { in: [] } });
    });

    it('should handle fallback for unknown operators', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);
      
      const result = rulesToPrisma(ability, 'read', 'Comment');
      
      expect(result).toHaveProperty('OR');
    });
  });
});