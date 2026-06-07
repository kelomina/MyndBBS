import { WikiPageApplicationService } from '../../src/application/wiki/WikiPageApplicationService';
import { WikiPage, PageStatus } from '../../src/domain/wiki/WikiPage';
import { Wiki, WikiStatus } from '../../src/domain/wiki/Wiki';
import { WikiCollaborator, CollaboratorRole } from '../../src/domain/wiki/WikiCollaborator';

jest.mock('../../src/db', () => ({
  prisma: {
    wikiPageHistory: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/db';

describe('WikiPageApplicationService', () => {
  let wikiRepository: any;
  let pageRepository: any;
  let collaboratorRepository: any;
  let service: WikiPageApplicationService;

  beforeEach(() => {
    wikiRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    pageRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    collaboratorRepository = {
      findByWikiAndUser: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    service = new WikiPageApplicationService({
      wikiRepository,
      pageRepository,
      collaboratorRepository,
    });

    jest.clearAllMocks();
  });

  describe('createPage()', () => {
    it('should create a wiki page', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const result = await service.createPage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'wiki-1',
        'Test Page',
        'test-page',
        'Content',
        null,
        'user-1',
        2
      );

      expect(result).toBeInstanceOf(WikiPage);
      expect(result.title).toBe('Test Page');
      expect(result.slug).toBe('test-page');
      expect(pageRepository.save).toHaveBeenCalled();
      expect(prisma.wikiPageHistory.create).toHaveBeenCalled();
    });

    it('should generate slug from title when slug is empty', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const result = await service.createPage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'wiki-1',
        'My Test Page Title',
        '',
        'Content',
        null,
        'user-1',
        2
      );

      expect(result.slug).toBe('my-test-page-title');
    });

    it('should throw when wiki not found', async () => {
      wikiRepository.findById.mockResolvedValue(null);

      await expect(
        service.createPage(
          { can: jest.fn() } as any,
          'wiki-unknown',
          'Title',
          'slug',
          'Content',
          null,
          'user-1',
          2
        )
      ).rejects.toThrow('ERR_WIKI_NOT_FOUND');
    });

    it('should throw when wiki is not active', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      mockWiki.archive();
      wikiRepository.findById.mockResolvedValue(mockWiki);

      await expect(
        service.createPage(
          { can: jest.fn() } as any,
          'wiki-1',
          'Title',
          'slug',
          'Content',
          null,
          'user-1',
          2
        )
      ).rejects.toThrow('ERR_WIKI_NOT_ACTIVE');
    });

    it('should throw when user lacks edit permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'other-user',
        minReadLevel: 0,
        minEditLevel: 10,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      await expect(
        service.createPage(
          { can: jest.fn().mockReturnValue(false) } as any,
          'wiki-1',
          'Title',
          'slug',
          'Content',
          null,
          'user-1',
          1
        )
      ).rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('slugify()', () => {
    it('should slugify a title correctly', () => {
      const slug = WikiPageApplicationService.slugify('My Test Page Title');
      expect(slug).toBe('my-test-page-title');
    });

    it('should handle special characters', () => {
      const slug = WikiPageApplicationService.slugify('Test Page 123!@# Title');
      expect(slug).toBe('test-page-123-title');
    });

    it('should trim and handle whitespace', () => {
      const slug = WikiPageApplicationService.slugify('  Test   Page  ');
      expect(slug).toBe('test-page');
    });

    it('should handle unicode characters', () => {
      const slug = WikiPageApplicationService.slugify('测试页面标题');
      expect(slug).toBe('测试页面标题');
    });
  });

  describe('updatePage()', () => {
    it('should update wiki page content and save history', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Old Title',
        content: 'Old Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.updatePage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'New Title',
        'New Content',
        'new-slug',
        'user-1',
        2,
        'Updated content'
      );

      expect(mockPage.title).toBe('New Title');
      expect(mockPage.content).toBe('New Content');
      expect(mockPage.slug).toBe('new-slug');
      expect(pageRepository.save).toHaveBeenCalled();
      expect(prisma.wikiPageHistory.create).toHaveBeenCalled();
    });

    it('should throw when page not found', async () => {
      pageRepository.findById.mockResolvedValue(null);

      await expect(
        service.updatePage(
          { can: jest.fn() } as any,
          'page-unknown',
          'Title',
          'Content',
          'slug',
          'user-1',
          2
        )
      ).rejects.toThrow('ERR_WIKI_PAGE_NOT_FOUND');
    });
  });

  describe('movePage()', () => {
    it('should move page to new parent', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.movePage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'parent-1',
        5,
        'user-1',
        2
      );

      expect(mockPage.parentId).toBe('parent-1');
      expect(mockPage.sortOrder).toBe(5);
      expect(pageRepository.save).toHaveBeenCalled();
    });
  });

  describe('publishPage()', () => {
    it('should publish a draft page', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.load({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        lastEditorId: 'user-1',
        sortOrder: 0,
        status: PageStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.publishPage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'user-1',
        2
      );

      expect(mockPage.status).toBe(PageStatus.PUBLISHED);
      expect(pageRepository.save).toHaveBeenCalled();
    });
  });

  describe('archivePage()', () => {
    it('should archive a page', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.archivePage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'user-1',
        2
      );

      expect(mockPage.status).toBe(PageStatus.ARCHIVED);
      expect(pageRepository.save).toHaveBeenCalled();
    });
  });

  describe('restorePage()', () => {
    it('should restore an archived page', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.load({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        lastEditorId: 'user-1',
        sortOrder: 0,
        status: PageStatus.ARCHIVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.restorePage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'user-1',
        2
      );

      expect(mockPage.status).toBe(PageStatus.PUBLISHED);
      expect(pageRepository.save).toHaveBeenCalled();
    });
  });

  describe('deletePage()', () => {
    it('should delete a page', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await service.deletePage(
        { can: jest.fn().mockReturnValue(true) } as any,
        'page-1',
        'user-1',
        2
      );

      expect(mockPage.status).toBe(PageStatus.DELETED);
      expect(pageRepository.save).toHaveBeenCalled();
    });
  });

  describe('restorePageHistory()', () => {
    it('should restore page content from history', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        slug: 'test-page',
        title: 'Page',
        content: 'Current Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      (prisma.wikiPageHistory.findUnique as jest.Mock).mockResolvedValue({
        id: 'history-1',
        pageId: 'page-1',
        content: 'Historical Content',
        editorId: 'editor-1',
      });

      await service.restorePageHistory(
        { can: jest.fn().mockReturnValue(true) } as any,
        'history-1',
        'user-1',
        2
      );

      expect(mockPage.content).toBe('Historical Content');
      expect(pageRepository.save).toHaveBeenCalled();
      expect(prisma.wikiPageHistory.create).toHaveBeenCalled();
    });

    it('should throw when history not found', async () => {
      (prisma.wikiPageHistory.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.restorePageHistory(
          { can: jest.fn() } as any,
          'history-unknown',
          'user-1',
          2
        )
      ).rejects.toThrow('ERR_WIKI_PAGE_HISTORY_NOT_FOUND');
    });
  });

  describe('getPageHistory()', () => {
    it('should return page history', async () => {
      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        title: 'Page',
        slug: 'page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      const mockHistory = [
        { id: 'h-1', pageId: 'page-1', content: 'Content v2', editor: { id: 'u1', username: 'user1' } },
        { id: 'h-2', pageId: 'page-1', content: 'Content v1', editor: { id: 'u1', username: 'user1' } },
      ];
      pageRepository.findById.mockResolvedValue(mockPage);
      wikiRepository.findById.mockResolvedValue(Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 10,
        isPublic: true,
      }));
      (prisma.wikiPageHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const result = await service.getPageHistory(
        { can: jest.fn().mockReturnValue(false) } as any,
        'wiki-1',
        'page-1',
        'user-1',
        1
      );

      expect(result).toEqual(mockHistory);
      expect(prisma.wikiPageHistory.findMany).toHaveBeenCalledWith({
        where: { pageId: 'page-1' },
        orderBy: { createdAt: 'desc' },
        include: { editor: { select: { id: true, username: true } } },
      });
    });

    it('should reject history access when the page does not belong to the requested wiki', async () => {
      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'other-wiki',
        title: 'Page',
        slug: 'page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);

      await expect(
        service.getPageHistory(
          { can: jest.fn().mockReturnValue(true) } as any,
          'wiki-1',
          'page-1',
          'user-1',
          10
        )
      ).rejects.toThrow('ERR_WIKI_PAGE_NOT_FOUND');
      expect(prisma.wikiPageHistory.findMany).not.toHaveBeenCalled();
    });

    it('should reject history access without edit permission', async () => {
      const mockPage = WikiPage.create({
        id: 'page-1',
        wikiId: 'wiki-1',
        title: 'Page',
        slug: 'page',
        content: 'Content',
        parentId: null,
        authorId: 'user-1',
        sortOrder: 0,
      });
      pageRepository.findById.mockResolvedValue(mockPage);
      wikiRepository.findById.mockResolvedValue(Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'owner-1',
        minReadLevel: 0,
        minEditLevel: 10,
        isPublic: true,
      }));
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      await expect(
        service.getPageHistory(
          { can: jest.fn().mockReturnValue(false) } as any,
          'wiki-1',
          'page-1',
          'user-2',
          1
        )
      ).rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS');
      expect(prisma.wikiPageHistory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('checkEditPermission()', () => {
    it('should allow owner to edit', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 10,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const hasPermission = await (service as any).checkEditPermission(
        'wiki-1',
        'user-1',
        1,
        { can: jest.fn() }
      );

      expect(hasPermission).toBe(true);
    });

    it('should allow collaborator with EDIT role', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'owner',
        minReadLevel: 0,
        minEditLevel: 10,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(
        WikiCollaborator.create({
          id: 'c-1',
          wikiId: 'wiki-1',
          userId: 'user-1',
          role: CollaboratorRole.EDIT,
        })
      );

      const hasPermission = await (service as any).checkEditPermission(
        'wiki-1',
        'user-1',
        1,
        { can: jest.fn() }
      );

      expect(hasPermission).toBe(true);
    });

    it('should allow user with sufficient level', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'owner',
        minReadLevel: 0,
        minEditLevel: 3,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      const hasPermission = await (service as any).checkEditPermission(
        'wiki-1',
        'user-1',
        5,
        { can: jest.fn() }
      );

      expect(hasPermission).toBe(true);
    });

    it('should not treat legacy minEditLevel 1 as public editing permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'owner',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      const hasPermission = await (service as any).checkEditPermission(
        'wiki-1',
        'user-1',
        5,
        { can: jest.fn().mockReturnValue(false) }
      );

      expect(hasPermission).toBe(false);
    });
  });
});
