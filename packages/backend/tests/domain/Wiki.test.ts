import { Wiki, WikiStatus, WikiProps, CreateWikiProps } from '../../src/domain/wiki/Wiki';

describe('Wiki Aggregate Root', () => {
  const validProps: CreateWikiProps = {
    id: 'wiki-1',
    title: 'Test Wiki',
    description: 'Test Description',
    coverUrl: null,
    ownerId: 'user-1',
    minReadLevel: 0,
    minEditLevel: 1,
    isPublic: true,
  };

  describe('create()', () => {
    it('should create a wiki with ACTIVE status', () => {
      const wiki = Wiki.create(validProps);

      expect(wiki.id).toBe(validProps.id);
      expect(wiki.title).toBe(validProps.title);
      expect(wiki.description).toBe(validProps.description);
      expect(wiki.coverUrl).toBeNull();
      expect(wiki.ownerId).toBe(validProps.ownerId);
      expect(wiki.minReadLevel).toBe(0);
      expect(wiki.minEditLevel).toBe(1);
      expect(wiki.isPublic).toBe(true);
      expect(wiki.status).toBe(WikiStatus.ACTIVE);
      expect(wiki.createdAt).toBeInstanceOf(Date);
      expect(wiki.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a wiki with cover URL', () => {
      const propsWithCover = { ...validProps, coverUrl: 'https://example.com/cover.png' };
      const wiki = Wiki.create(propsWithCover);

      expect(wiki.coverUrl).toBe('https://example.com/cover.png');
    });

    it('should throw an error if title is empty', () => {
      expect(() => Wiki.create({ ...validProps, title: '' })).toThrow('ERR_WIKI_TITLE_CANNOT_BE_EMPTY');
      expect(() => Wiki.create({ ...validProps, title: '   ' })).toThrow('ERR_WIKI_TITLE_CANNOT_BE_EMPTY');
    });

    it('should throw an error if description is empty', () => {
      expect(() => Wiki.create({ ...validProps, description: '' })).toThrow('ERR_WIKI_DESCRIPTION_CANNOT_BE_EMPTY');
      expect(() => Wiki.create({ ...validProps, description: '   ' })).toThrow('ERR_WIKI_DESCRIPTION_CANNOT_BE_EMPTY');
    });
  });

  describe('load()', () => {
    it('should reconstitute a Wiki entity from existing props', () => {
      const existingProps: WikiProps = {
        ...validProps,
        status: WikiStatus.ARCHIVED,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      };

      const wiki = Wiki.load(existingProps);

      expect(wiki.id).toBe(existingProps.id);
      expect(wiki.status).toBe(WikiStatus.ARCHIVED);
      expect(wiki.createdAt).toEqual(new Date('2023-01-01'));
    });
  });

  describe('updateDetails()', () => {
    it('should update title, description, and coverUrl', () => {
      const wiki = Wiki.create(validProps);
      wiki.updateDetails('New Title', 'New Description', 'https://example.com/new-cover.png');

      expect(wiki.title).toBe('New Title');
      expect(wiki.description).toBe('New Description');
      expect(wiki.coverUrl).toBe('https://example.com/new-cover.png');
    });

    it('should trim updated title and description', () => {
      const wiki = Wiki.create(validProps);
      wiki.updateDetails('  Trimmed Title  ', '  Trimmed Description  ', null);

      expect(wiki.title).toBe('Trimmed Title');
      expect(wiki.description).toBe('Trimmed Description');
    });

    it('should ignore empty string updates for title and description', () => {
      const wiki = Wiki.create(validProps);
      const originalTitle = wiki.title;
      const originalDescription = wiki.description;
      wiki.updateDetails('', '   ', null);

      expect(wiki.title).toBe(originalTitle);
      expect(wiki.description).toBe(originalDescription);
    });

    it('should set coverUrl to null when explicitly passed', () => {
      const wiki = Wiki.create({ ...validProps, coverUrl: 'https://example.com/cover.png' });
      wiki.updateDetails('New Title', 'New Description', null);

      expect(wiki.coverUrl).toBeNull();
    });
  });

  describe('updatePermissions()', () => {
    it('should update permission settings', () => {
      const wiki = Wiki.create(validProps);
      wiki.updatePermissions(5, 3, false);

      expect(wiki.minReadLevel).toBe(5);
      expect(wiki.minEditLevel).toBe(3);
      expect(wiki.isPublic).toBe(false);
    });
  });

  describe('archive()', () => {
    it('should archive an active wiki', () => {
      const wiki = Wiki.create(validProps);
      expect(wiki.status).toBe(WikiStatus.ACTIVE);

      wiki.archive();

      expect(wiki.status).toBe(WikiStatus.ARCHIVED);
    });

    it('should throw an error when archiving a deleted wiki', () => {
      const wiki = Wiki.create(validProps);
      wiki.delete();

      expect(() => wiki.archive()).toThrow('ERR_WIKI_ALREADY_DELETED');
    });
  });

  describe('restore()', () => {
    it('should restore an archived wiki to active', () => {
      const wiki = Wiki.create(validProps);
      wiki.archive();
      expect(wiki.status).toBe(WikiStatus.ARCHIVED);

      wiki.restore();

      expect(wiki.status).toBe(WikiStatus.ACTIVE);
    });

    it('should throw an error when restoring a non-archived wiki', () => {
      const wiki = Wiki.create(validProps);

      expect(() => wiki.restore()).toThrow('ERR_WIKI_NOT_ARCHIVED');
    });
  });

  describe('delete()', () => {
    it('should soft delete a wiki', () => {
      const wiki = Wiki.create(validProps);
      expect(wiki.status).toBe(WikiStatus.ACTIVE);

      wiki.delete();

      expect(wiki.status).toBe(WikiStatus.DELETED);
    });
  });

  describe('toJSON()', () => {
    it('should return a copy of props', () => {
      const wiki = Wiki.create(validProps);
      const json = wiki.toJSON();

      expect(json).toEqual(expect.objectContaining({
        id: wiki.id,
        title: wiki.title,
        status: wiki.status,
      }));
    });
  });
});
