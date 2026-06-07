import { PrismaWikiRepository } from '../../../src/infrastructure/repositories/PrismaWikiRepository';
import { Wiki, WikiStatus } from '../../../src/domain/wiki/Wiki';

jest.mock('../../../src/db', () => ({
  prisma: {
    wiki: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../../../src/db';

describe('PrismaWikiRepository', () => {
  let repository: PrismaWikiRepository;

  beforeEach(() => {
    repository = new PrismaWikiRepository();
    jest.clearAllMocks();
  });

  describe('findById()', () => {
    it('should return Wiki when found', async () => {
      const mockRaw = {
        id: 'wiki-1',
        title: 'Test Wiki',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
        status: WikiStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(mockRaw);

      const result = await repository.findById('wiki-1');

      expect(result).toBeInstanceOf(Wiki);
      expect(result?.id).toBe('wiki-1');
      expect(prisma.wiki.findUnique).toHaveBeenCalledWith({ where: { id: 'wiki-1' } });
    });

    it('should return null when not found', async () => {
      (prisma.wiki.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByOwner()', () => {
    it('should return active wikis for owner', async () => {
      const mockRaws = [
        {
          id: 'wiki-1',
          title: 'Wiki 1',
          description: 'Desc',
          coverUrl: null,
          ownerId: 'user-1',
          minReadLevel: 0,
          minEditLevel: 1,
          isPublic: true,
          status: WikiStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue(mockRaws);

      const result = await repository.findByOwner('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Wiki);
      expect(prisma.wiki.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-1', status: WikiStatus.ACTIVE },
      });
    });

    it('should return empty array when no wikis found', async () => {
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByOwner('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('findAll()', () => {
    it('should return all active wikis', async () => {
      const mockRaws = [
        {
          id: 'wiki-1',
          title: 'Wiki 1',
          description: 'Desc',
          coverUrl: null,
          ownerId: 'user-1',
          minReadLevel: 0,
          minEditLevel: 1,
          isPublic: true,
          status: WikiStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (prisma.wiki.findMany as jest.Mock).mockResolvedValue(mockRaws);

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.wiki.findMany).toHaveBeenCalledWith({
        where: { status: WikiStatus.ACTIVE },
      });
    });
  });

  describe('save()', () => {
    it('should upsert wiki with all fields on create', async () => {
      const wiki = Wiki.create({
        id: 'wiki-new',
        title: 'New Wiki',
        description: 'New Description',
        coverUrl: 'https://example.com/cover.png',
        ownerId: 'user-1',
        minReadLevel: 1,
        minEditLevel: 2,
        isPublic: false,
      });

      await repository.save(wiki);

      expect(prisma.wiki.upsert).toHaveBeenCalledWith({
        where: { id: 'wiki-new' },
        create: expect.objectContaining({
          id: 'wiki-new',
          title: 'New Wiki',
          description: 'New Description',
          coverUrl: 'https://example.com/cover.png',
          ownerId: 'user-1',
          minReadLevel: 1,
          minEditLevel: 2,
          isPublic: false,
        }),
        update: expect.not.objectContaining({
          ownerId: expect.anything(),
          id: expect.anything(),
        }),
      });
    });

    it('should not include id and ownerId in update', async () => {
      const wiki = Wiki.create({
        id: 'wiki-1',
        title: 'Updated Wiki',
        description: 'Updated',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });

      await repository.save(wiki);

      const updateCall = (prisma.wiki.upsert as jest.Mock).mock.calls[0][0].update;
      expect(updateCall).not.toHaveProperty('id');
      expect(updateCall).not.toHaveProperty('ownerId');
    });
  });

  describe('delete()', () => {
    it('should delete wiki by id', async () => {
      await repository.delete('wiki-1');

      expect(prisma.wiki.delete).toHaveBeenCalledWith({ where: { id: 'wiki-1' } });
    });
  });
});
