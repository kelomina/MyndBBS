import { WikiQueryService } from '../src/queries/wiki/WikiQueryService';

jest.mock('../src/db', () => ({
  prisma: {
    wiki: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    wikiPage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    wikiCollaborator: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../src/db';

describe('WikiQueryService', () => {
  let service: WikiQueryService;

  beforeEach(() => {
    service = new WikiQueryService();
    jest.clearAllMocks();
  });

  const accessibleWiki = (overrides: Record<string, unknown> = {}) => ({
    id: 'wiki-1',
    title: 'Test Wiki',
    isPublic: true,
    ownerId: 'user-1',
    status: 'ACTIVE',
    minReadLevel: 0,
    ...overrides,
  });

  describe('listPublicWikis()', () => {
    it('should return public active wikis with owner info', async () => {
      const mockWikis = [
        { id: 'wiki-1', title: 'Public Wiki 1', owner: { id: 'u1', username: 'owner1' } },
        { id: 'wiki-2', title: 'Public Wiki 2', owner: { id: 'u2', username: 'owner2' } },
      ];
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue(mockWikis);

      const result = await service.listPublicWikis();

      expect(result).toEqual(mockWikis);
      expect(prisma.wiki.findMany).toHaveBeenCalledWith({
        where: { isPublic: true, status: 'ACTIVE', minReadLevel: 0 },
        include: { owner: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no public wikis exist', async () => {
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listPublicWikis();

      expect(result).toEqual([]);
    });
  });

  describe('listWikisForUser()', () => {
    it('should return accessible wikis for user', async () => {
      const mockWikis = [
        { id: 'wiki-1', title: 'My Wiki', owner: { id: 'user-1', username: 'user1' } },
      ];
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue(mockWikis);

      const result = await service.listWikisForUser('user-1', 5);

      expect(result).toEqual(mockWikis);
      expect(prisma.wiki.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          OR: [
            { isPublic: true, minReadLevel: { lte: 5 } },
            { ownerId: 'user-1' },
            { collaborators: { some: { userId: 'user-1' } } },
          ],
        },
        include: { owner: { select: { id: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by user level', async () => {
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue([]);

      await service.listWikisForUser('user-1', 2);

      const callArgs = (prisma.wiki.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.OR).toContainEqual({ isPublic: true, minReadLevel: { lte: 2 } });
      expect(callArgs.where.OR).not.toContainEqual({ minReadLevel: { lte: 2 } });
    });
  });

  describe('listOwnedWikis()', () => {
    it('should return wikis owned by user excluding deleted', async () => {
      const mockWikis = [
        { id: 'wiki-1', title: 'My Wiki' },
      ];
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue(mockWikis);

      const result = await service.listOwnedWikis('user-1');

      expect(result).toEqual(mockWikis);
      expect(prisma.wiki.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-1', status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getWikiDetails()', () => {
    it('should return wiki details when found', async () => {
      const mockWiki = accessibleWiki();
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(mockWiki);

      const result = await service.getWikiDetails('wiki-1');

      expect(result).toEqual(mockWiki);
    });

    it('should return null when wiki not found', async () => {
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getWikiDetails('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for non-public wiki when user is not owner or collaborator', async () => {
      const mockWiki = accessibleWiki({
        title: 'Private Wiki',
        isPublic: false,
        ownerId: 'owner-1',
        minReadLevel: 0,
      });
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(mockWiki);
      (prisma.wikiCollaborator.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getWikiDetails('wiki-1', 'random-user');

      expect(result).toBeNull();
    });

    it('should return wiki when user is owner of non-public wiki', async () => {
      const mockWiki = accessibleWiki({
        title: 'Private Wiki',
        isPublic: false,
        ownerId: 'user-1',
        minReadLevel: 1,
      });
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(mockWiki);

      const result = await service.getWikiDetails('wiki-1', 'user-1');

      expect(result).toEqual(mockWiki);
    });

    it('should return wiki when user is collaborator on non-public wiki', async () => {
      const mockWiki = accessibleWiki({
        title: 'Private Wiki',
        isPublic: false,
        ownerId: 'owner-1',
        minReadLevel: 1,
      });
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(mockWiki);
      (prisma.wikiCollaborator.findUnique as jest.Mock).mockResolvedValue({ userId: 'collaborator-1' });

      const result = await service.getWikiDetails('wiki-1', 'collaborator-1');

      expect(result).toEqual(mockWiki);
    });
  });

  describe('getWikiPages()', () => {
    it('should return page tree structure', async () => {
      const mockPages = [
        { id: 'page-1', title: 'Root Page', parentId: null, children: [] },
        { id: 'page-2', title: 'Child Page', parentId: 'page-1', children: [] },
      ];
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findMany as jest.Mock).mockResolvedValue(mockPages);

      const result = await service.getWikiPages('wiki-1');

      expect(prisma.wikiPage.findMany).toHaveBeenCalledWith({
        where: { wikiId: 'wiki-1', status: 'PUBLISHED' },
        include: { author: { select: { id: true, username: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should only include published pages in the page tree', async () => {
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findMany as jest.Mock).mockResolvedValue([]);

      await service.getWikiPages('wiki-1');

      const callArgs = (prisma.wikiPage.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.status).toBe('PUBLISHED');
    });
  });

  describe('getWikiPage()', () => {
    it('should return page by wikiId and slug', async () => {
      const mockPage = {
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Test Page',
      };
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findFirst as jest.Mock).mockResolvedValue(mockPage);

      const result = await service.getWikiPage('wiki-1', 'test-page');

      expect(result).toEqual(mockPage);
      expect(prisma.wikiPage.findFirst).toHaveBeenCalledWith({
        where: { wikiId: 'wiki-1', slug: 'test-page', status: 'PUBLISHED' },
        include: {
          author: { select: { id: true, username: true } },
          lastEditor: { select: { id: true, username: true } },
        },
      });
    });

    it('should return null when page not found', async () => {
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getWikiPage('wiki-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getWikiPageById()', () => {
    it('should return page by pageId', async () => {
      const mockPage = {
        id: 'page-1',
        wikiId: 'wiki-1',
        title: 'Test Page',
      };
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findFirst as jest.Mock).mockResolvedValue(mockPage);

      const result = await service.getWikiPageById('wiki-1', 'page-1');

      expect(result).toEqual(mockPage);
      expect(prisma.wikiPage.findFirst).toHaveBeenCalledWith({
        where: { id: 'page-1', wikiId: 'wiki-1', status: 'PUBLISHED' },
        include: {
          author: { select: { id: true, username: true } },
          lastEditor: { select: { id: true, username: true } },
        },
      });
    });
  });

  describe('getWikiCollaborators()', () => {
    it('should return collaborators with user info', async () => {
      const mockCollaborators = [
        { id: 'c1', wikiId: 'wiki-1', userId: 'user-1', user: { id: 'user-1', username: 'user1' } },
        { id: 'c2', wikiId: 'wiki-1', userId: 'user-2', user: { id: 'user-2', username: 'user2' } },
      ];
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiCollaborator.findMany as jest.Mock).mockResolvedValue(mockCollaborators);

      const result = await service.getWikiCollaborators('wiki-1');

      expect(result).toEqual(mockCollaborators);
      expect(prisma.wikiCollaborator.findMany).toHaveBeenCalledWith({
        where: { wikiId: 'wiki-1' },
        include: { user: { select: { id: true, username: true } } },
      });
    });
  });

  describe('buildPageTree()', () => {
    it('should build hierarchical tree structure', async () => {
      const pages = [
        { id: 'p1', parentId: null, title: 'Root', children: [] },
        { id: 'p2', parentId: 'p1', title: 'Child 1', children: [] },
        { id: 'p3', parentId: 'p1', title: 'Child 2', children: [] },
        { id: 'p4', parentId: 'p2', title: 'Grandchild', children: [] },
      ];
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findMany as jest.Mock).mockResolvedValue(pages);

      const result = await service.getWikiPages('wiki-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].children).toHaveLength(1);
    });

    it('should handle orphan children (parent not in list)', async () => {
      const pages = [
        { id: 'orphan', parentId: 'non-existent', title: 'Orphan Page', children: [] },
        { id: 'root', parentId: null, title: 'Root', children: [] },
      ];
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(accessibleWiki());
      (prisma.wikiPage.findMany as jest.Mock).mockResolvedValue(pages);

      const result = await service.getWikiPages('wiki-1');

      expect(result).toHaveLength(2);
      const orphan = result.find(p => p.id === 'orphan');
      expect(orphan).toBeDefined();
    });
  });
});
