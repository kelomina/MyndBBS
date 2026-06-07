import { WikiPage, PageStatus, WikiPageProps, CreateWikiPageProps } from '../../src/domain/wiki/WikiPage';

describe('WikiPage Entity', () => {
  const validProps: CreateWikiPageProps = {
    id: 'page-1',
    wikiId: 'wiki-1',
    slug: 'test-page',
    title: 'Test Page',
    content: 'Test Content',
    parentId: null,
    authorId: 'user-1',
    sortOrder: 0,
  };

  describe('create()', () => {
    it('should create a published wiki page', () => {
      const page = WikiPage.create(validProps);

      expect(page.id).toBe(validProps.id);
      expect(page.wikiId).toBe(validProps.wikiId);
      expect(page.slug).toBe(validProps.slug);
      expect(page.title).toBe(validProps.title);
      expect(page.content).toBe(validProps.content);
      expect(page.parentId).toBeNull();
      expect(page.authorId).toBe(validProps.authorId);
      expect(page.sortOrder).toBe(0);
      expect(page.status).toBe(PageStatus.PUBLISHED);
      expect(page.lastEditorId).toBe(validProps.authorId);
      expect(page.createdAt).toBeInstanceOf(Date);
      expect(page.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a page with parent', () => {
      const propsWithParent = { ...validProps, parentId: 'parent-page-1' };
      const page = WikiPage.create(propsWithParent);

      expect(page.parentId).toBe('parent-page-1');
    });

    it('should throw an error if title is empty', () => {
      expect(() => WikiPage.create({ ...validProps, title: '' })).toThrow('ERR_WIKI_PAGE_TITLE_CANNOT_BE_EMPTY');
      expect(() => WikiPage.create({ ...validProps, title: '   ' })).toThrow('ERR_WIKI_PAGE_TITLE_CANNOT_BE_EMPTY');
    });

    it('should throw an error if slug is empty', () => {
      expect(() => WikiPage.create({ ...validProps, slug: '' })).toThrow('ERR_WIKI_PAGE_SLUG_CANNOT_BE_EMPTY');
      expect(() => WikiPage.create({ ...validProps, slug: '   ' })).toThrow('ERR_WIKI_PAGE_SLUG_CANNOT_BE_EMPTY');
    });

    it('should throw an error if content is empty', () => {
      expect(() => WikiPage.create({ ...validProps, content: '' })).toThrow('ERR_WIKI_PAGE_CONTENT_CANNOT_BE_EMPTY');
      expect(() => WikiPage.create({ ...validProps, content: '   ' })).toThrow('ERR_WIKI_PAGE_CONTENT_CANNOT_BE_EMPTY');
    });
  });

  describe('load()', () => {
    it('should reconstitute a WikiPage entity from existing props', () => {
      const existingProps: WikiPageProps = {
        ...validProps,
        status: PageStatus.DRAFT,
        lastEditorId: 'editor-1',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      };

      const page = WikiPage.load(existingProps);

      expect(page.id).toBe(existingProps.id);
      expect(page.status).toBe(PageStatus.DRAFT);
      expect(page.lastEditorId).toBe('editor-1');
    });
  });

  describe('updateContent()', () => {
    it('should update content and set lastEditorId', () => {
      const page = WikiPage.create(validProps);
      page.updateContent('New Title', 'New Content', 'new-slug', 'editor-2');

      expect(page.title).toBe('New Title');
      expect(page.content).toBe('New Content');
      expect(page.slug).toBe('new-slug');
      expect(page.lastEditorId).toBe('editor-2');
    });

    it('should trim updated values', () => {
      const page = WikiPage.create(validProps);
      page.updateContent('  Trimmed Title  ', '  Trimmed Content  ', '  new-slug  ', 'editor-2');

      expect(page.title).toBe('Trimmed Title');
      expect(page.content).toBe('Trimmed Content');
      expect(page.slug).toBe('new-slug');
    });

    it('should ignore empty string updates', () => {
      const page = WikiPage.create(validProps);
      const originalTitle = page.title;
      const originalContent = page.content;
      const originalSlug = page.slug;
      page.updateContent('', '   ', '', 'editor-2');

      expect(page.title).toBe(originalTitle);
      expect(page.content).toBe(originalContent);
      expect(page.slug).toBe(originalSlug);
    });
  });

  describe('move()', () => {
    it('should move page to new parent and position', () => {
      const page = WikiPage.create(validProps);
      page.move('new-parent', 5);

      expect(page.parentId).toBe('new-parent');
      expect(page.sortOrder).toBe(5);
    });

    it('should move page to root level', () => {
      const page = WikiPage.create({ ...validProps, parentId: 'old-parent' });
      page.move(null, 10);

      expect(page.parentId).toBeNull();
      expect(page.sortOrder).toBe(10);
    });
  });

  describe('publish()', () => {
    it('should publish a draft page', () => {
      const page = WikiPage.load({ ...validProps, status: PageStatus.DRAFT });
      expect(page.status).toBe(PageStatus.DRAFT);

      page.publish();

      expect(page.status).toBe(PageStatus.PUBLISHED);
    });

    it('should throw an error when publishing a non-draft page', () => {
      const page = WikiPage.create(validProps);

      expect(() => page.publish()).toThrow('ERR_WIKI_PAGE_NOT_DRAFT');
    });
  });

  describe('archive()', () => {
    it('should archive a published page', () => {
      const page = WikiPage.create(validProps);
      expect(page.status).toBe(PageStatus.PUBLISHED);

      page.archive();

      expect(page.status).toBe(PageStatus.ARCHIVED);
    });

    it('should throw an error when archiving a deleted page', () => {
      const page = WikiPage.create(validProps);
      page.delete();

      expect(() => page.archive()).toThrow('ERR_WIKI_PAGE_ALREADY_DELETED');
    });
  });

  describe('restore()', () => {
    it('should restore an archived page to published', () => {
      const page = WikiPage.load({ ...validProps, status: PageStatus.ARCHIVED });
      expect(page.status).toBe(PageStatus.ARCHIVED);

      page.restore();

      expect(page.status).toBe(PageStatus.PUBLISHED);
    });

    it('should throw an error when restoring a non-archived page', () => {
      const page = WikiPage.create(validProps);

      expect(() => page.restore()).toThrow('ERR_WIKI_PAGE_NOT_ARCHIVED');
    });
  });

  describe('delete()', () => {
    it('should soft delete a page', () => {
      const page = WikiPage.create(validProps);
      expect(page.status).toBe(PageStatus.PUBLISHED);

      page.delete();

      expect(page.status).toBe(PageStatus.DELETED);
    });
  });

  describe('toJSON()', () => {
    it('should return a copy of props', () => {
      const page = WikiPage.create(validProps);
      const json = page.toJSON();

      expect(json).toEqual(expect.objectContaining({
        id: page.id,
        title: page.title,
        status: page.status,
      }));
    });
  });
});
