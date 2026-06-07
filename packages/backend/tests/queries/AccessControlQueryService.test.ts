import { AccessControlQueryService } from '../../src/queries/identity/AccessControlQueryService';

jest.mock('../../src/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/lib/redis', () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
}));

describe('AccessControlQueryService', () => {
  let service: AccessControlQueryService;
  let mockRedis: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockRedis = require('../../src/lib/redis');
    mockPrisma = require('../../src/db').prisma;

    jest.clearAllMocks();

    service = new AccessControlQueryService();
  });

  describe('getAbilityRulesForUser', () => {
    const mockUser = {
      id: 'user-1',
      level: 2,
      role: {
        name: 'MODERATOR',
        permissions: [
          { permission: { action: 'manage:Post' } },
          { permission: { action: 'delete:Comment' } },
        ],
      },
      moderatedCategories: [
        { categoryId: 'cat-1' },
        { categoryId: 'cat-2' },
      ],
    };

    it('should return cached rules when available', async () => {
      const cachedData = JSON.stringify({
        context: {
          userId: 'user-1',
          roleName: 'MODERATOR',
          level: 2,
          moderatedCategoryIds: ['cat-1', 'cat-2'],
        },
        rules: [
          { action: 'manage', subject: 'Post' },
          { action: 'delete', subject: 'Comment' },
        ],
      });
      mockRedis.get.mockResolvedValue(cachedData);

      const result = await service.getAbilityRulesForUser('user-1');

      expect(mockRedis.get).toHaveBeenCalledWith('ability_rules:user:user-1');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(JSON.parse(cachedData));
    });

    it('should query database when cache is empty', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getAbilityRulesForUser('user-1');

      expect(mockRedis.get).toHaveBeenCalledWith('ability_rules:user:user-1');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
          moderatedCategories: true,
        },
      });
      expect(mockRedis.set).toHaveBeenCalled();
      expect(result).toEqual({
        context: {
          userId: 'user-1',
          roleName: 'MODERATOR',
          level: 2,
          moderatedCategoryIds: ['cat-1', 'cat-2'],
        },
        rules: [
          { action: 'manage', subject: 'Post' },
          { action: 'delete', subject: 'Comment' },
        ],
      });
    });

    it('should return null when user not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getAbilityRulesForUser('user-not-found');

      expect(result).toBeNull();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should handle malformed cached JSON gracefully', async () => {
      mockRedis.get.mockResolvedValue('{ invalid json }');
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getAbilityRulesForUser('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should handle user without role', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        level: 1,
        role: null,
        moderatedCategories: [],
      });

      const result = await service.getAbilityRulesForUser('user-2');

      expect(result).toEqual({
        context: {
          userId: 'user-2',
          roleName: null,
          level: 1,
          moderatedCategoryIds: [],
        },
        rules: [],
      });
    });

    it('should handle empty permissions array', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-3',
        level: 1,
        role: { name: 'USER', permissions: [] },
        moderatedCategories: [],
      });

      const result = await service.getAbilityRulesForUser('user-3');

      expect(result!.rules).toEqual([]);
    });

    it('should parse permissions with colons in subject', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-4',
        level: 3,
        role: {
          name: 'ADMIN',
          permissions: [{ permission: { action: 'manage:AdminPanel:Settings' } }],
        },
        moderatedCategories: [],
      });

      const result = await service.getAbilityRulesForUser('user-4');

      expect(result!.rules).toEqual([
        { action: 'manage', subject: 'AdminPanel:Settings' },
      ]);
    });

    it('should skip malformed permission strings', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-5',
        level: 1,
        role: {
          name: 'USER',
          permissions: [
            { permission: { action: 'invalid' } },
            { permission: { action: 'create:Post' } },
          ],
        },
        moderatedCategories: [],
      });

      const result = await service.getAbilityRulesForUser('user-5');

      expect(result!.rules).toEqual([{ action: 'create', subject: 'Post' }]);
    });
  });
});