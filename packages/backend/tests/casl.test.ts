import { defineAbilityForContext } from '../src/lib/casl';
import { AccessContextDTO, RuleDescriptorDTO } from '../src/application/identity/contracts/AbilityContracts';
import { PostStatus } from '@myndbbs/shared';

describe('CASL Ability Builder', () => {
  describe('Guest (unauthenticated) permissions', () => {
    it('should define guest read permissions for posts', () => {
      const ability = defineAbilityForContext();

      expect(ability.can('read', 'Post')).toBe(true);
    });

    it('should define guest read permissions for categories', () => {
      const ability = defineAbilityForContext();

      expect(ability.can('read', 'Category')).toBe(true);
    });

    it('should define guest read permissions for public wikis', () => {
      const ability = defineAbilityForContext();

      expect(ability.can('read', 'Wiki')).toBe(true);
    });

    it('should require guest-readable wikis to be public and level 0', () => {
      const ability = defineAbilityForContext();

      expect(ability.rules).toEqual(expect.arrayContaining([
        expect.objectContaining({
          action: 'read',
          subject: 'Wiki',
          conditions: { isPublic: true, status: 'ACTIVE', minReadLevel: { $lte: 0 } },
        }),
        expect.objectContaining({
          action: 'read',
          subject: 'WikiPage',
          conditions: {
            'wiki.isPublic': true,
            'wiki.status': 'ACTIVE',
            'wiki.minReadLevel': { $lte: 0 },
          },
        }),
      ]));
    });

    it('should not allow guests to create posts', () => {
      const ability = defineAbilityForContext();

      expect(ability.can('create', 'Post')).toBe(false);
    });

    it('should not allow guests to manage all', () => {
      const ability = defineAbilityForContext();

      expect(ability.can('manage', 'all')).toBe(false);
    });
  });

  describe('Authenticated user permissions', () => {
    const userContext: AccessContextDTO = {
      userId: 'user-1',
      roleName: 'USER',
      level: 1,
      moderatedCategoryIds: []
    };

    it('should allow reading posts', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('read', 'Post')).toBe(true);
    });

    it('should allow creating posts', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('create', 'Post')).toBe(true);
    });

    it('should allow creating comments', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('create', 'Comment')).toBe(true);
    });

    it('should allow creating wikis when level >= 2', () => {
      const level2Context: AccessContextDTO = {
        ...userContext,
        level: 2
      };
      const ability = defineAbilityForContext(level2Context);

      expect(ability.can('create', 'Wiki')).toBe(true);
    });

    it('should allow reading wikis', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('read', 'Wiki')).toBe(true);
    });

    it('should allow reading wiki pages', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('read', 'WikiPage')).toBe(true);
    });
  });

  describe('Role-based permissions', () => {
    it('should grant SUPER_ADMIN full permissions', () => {
      const context: AccessContextDTO = {
        userId: 'admin-1',
        roleName: 'SUPER_ADMIN',
        level: 3,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('manage', 'all')).toBe(true);
      expect(ability.can('read', 'AdminPanel')).toBe(true);
    });

    it('should grant ADMIN full permissions', () => {
      const context: AccessContextDTO = {
        userId: 'admin-2',
        roleName: 'ADMIN',
        level: 3,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('should grant MODERATOR admin panel access without global read-all', () => {
      const context: AccessContextDTO = {
        userId: 'mod-1',
        roleName: 'MODERATOR',
        level: 2,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('read', 'all')).toBe(false);
      expect(ability.can('read', 'AdminPanel')).toBe(true);
    });

    it('should not grant regular user admin panel access', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('read', 'AdminPanel')).toBe(false);
    });
  });

  describe('Category Moderator permissions', () => {
    it('should grant manage permissions for moderated categories', () => {
      const context: AccessContextDTO = {
        userId: 'mod-1',
        roleName: 'MODERATOR',
        level: 2,
        moderatedCategoryIds: ['cat-1', 'cat-2']
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('manage', 'Post')).toBe(true);
      expect(ability.can('manage', 'Comment')).toBe(true);
      expect(ability.can('manage', 'ModeratedWord')).toBe(true);
    });

    it('should restrict manage permissions to moderated categories and owned resources', () => {
      const context: AccessContextDTO = {
        userId: 'mod-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: ['cat-1']
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('manage', 'Wiki')).toBe(true);
      expect(ability.can('manage', 'User')).toBe(false);
    });

    it('should not grant moderator permissions without moderated categories', () => {
      const context: AccessContextDTO = {
        userId: 'user-1',
        roleName: 'USER',
        level: 1,
        moderatedCategoryIds: []
      };
      const ability = defineAbilityForContext(context);

      expect(ability.can('manage', 'Post')).toBe(false);
    });
  });

  describe('Dynamic database-driven rules', () => {
    const context: AccessContextDTO = {
      userId: 'user-1',
      roleName: 'USER',
      level: 1,
      moderatedCategoryIds: []
    };

    it('should handle action:subject format', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'create:Category', subject: '' }
      ];
      const ability = defineAbilityForContext(context, rules);

      expect(ability.can('create', 'Category')).toBe(true);
    });

    it('should handle rules without conditions', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'read', subject: 'AdminPanel' }
      ];
      const ability = defineAbilityForContext(context, rules);

      expect(ability.can('read', 'AdminPanel')).toBe(true);
    });

    it('should handle rules with conditions', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'manage', subject: 'Wiki', conditions: { ownerId: 'user-1' } }
      ];
      const ability = defineAbilityForContext(context, rules);

      expect(ability.can('manage', 'Wiki')).toBe(true);
    });

    it('should handle stringified JSON conditions', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'read', subject: 'WikiPage', conditions: JSON.stringify({ 'wiki.ownerId': 'user-1' }) }
      ];
      const ability = defineAbilityForContext(context, rules);

      expect(ability.can('read', 'WikiPage')).toBe(true);
    });

    it('should handle malformed JSON conditions gracefully', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'read', subject: 'Wiki', conditions: '{ invalid json }' }
      ];
      expect(() => defineAbilityForContext(context, rules)).not.toThrow();
    });

    it('should handle mixed rule formats', () => {
      const rules: RuleDescriptorDTO[] = [
        { action: 'create', subject: 'Wiki' },
        { action: 'read:WikiPage', subject: '', conditions: { 'wiki.ownerId': 'user-1' } }
      ];
      const ability = defineAbilityForContext(context, rules);

      expect(ability.can('create', 'Wiki')).toBe(true);
      expect(ability.can('read', 'WikiPage')).toBe(true);
    });
  });

  describe('Wiki permissions', () => {
    const userContext: AccessContextDTO = {
      userId: 'user-1',
      roleName: 'USER',
      level: 1,
      moderatedCategoryIds: []
    };

    it('should allow reading public wikis', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('read', 'Wiki')).toBe(true);
    });

    it('should allow managing own wikis', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('manage', 'Wiki')).toBe(true);
    });

    it('should allow creating wikis when level < 2 without object check', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('create', 'Wiki')).toBe(true);
    });

    it('should allow reading wiki pages for accessible wikis', () => {
      const ability = defineAbilityForContext(userContext);

      expect(ability.can('read', 'WikiPage')).toBe(true);
    });
  });
});
