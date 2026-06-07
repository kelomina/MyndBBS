import { PrismaWikiCollaboratorRepository } from '../../../src/infrastructure/repositories/PrismaWikiCollaboratorRepository';
import { WikiCollaborator, CollaboratorRole } from '../../../src/domain/wiki/WikiCollaborator';

jest.mock('../../../src/db', () => ({
  prisma: {
    wikiCollaborator: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../../../src/db';

describe('PrismaWikiCollaboratorRepository', () => {
  let repository: PrismaWikiCollaboratorRepository;

  beforeEach(() => {
    repository = new PrismaWikiCollaboratorRepository();
    jest.clearAllMocks();
  });

  describe('findByWiki()', () => {
    it('should return collaborators for wiki', async () => {
      const mockRaws = [
        { id: 'c1', wikiId: 'wiki-1', userId: 'user-1', role: CollaboratorRole.VIEW, addedAt: new Date() },
        { id: 'c2', wikiId: 'wiki-1', userId: 'user-2', role: CollaboratorRole.EDIT, addedAt: new Date() },
      ];
      (prisma.wikiCollaborator.findMany as jest.Mock).mockResolvedValue(mockRaws);

      const result = await repository.findByWiki('wiki-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(WikiCollaborator);
      expect(result[0].role).toBe(CollaboratorRole.VIEW);
      expect(prisma.wikiCollaborator.findMany).toHaveBeenCalledWith({ where: { wikiId: 'wiki-1' } });
    });

    it('should return empty array when no collaborators found', async () => {
      (prisma.wikiCollaborator.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repository.findByWiki('wiki-1');

      expect(result).toEqual([]);
    });
  });

  describe('findByUser()', () => {
    it('should return all collaborations for user', async () => {
      const mockRaws = [
        { id: 'c1', wikiId: 'wiki-1', userId: 'user-1', role: CollaboratorRole.EDIT, addedAt: new Date() },
        { id: 'c2', wikiId: 'wiki-2', userId: 'user-1', role: CollaboratorRole.ADMIN, addedAt: new Date() },
      ];
      (prisma.wikiCollaborator.findMany as jest.Mock).mockResolvedValue(mockRaws);

      const result = await repository.findByUser('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.wikiCollaborator.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('findByWikiAndUser()', () => {
    it('should return collaborator when found', async () => {
      const mockRaw = {
        id: 'c1',
        wikiId: 'wiki-1',
        userId: 'user-1',
        role: CollaboratorRole.EDIT,
        addedAt: new Date(),
      };
      (prisma.wikiCollaborator.findUnique as jest.Mock).mockResolvedValue(mockRaw);

      const result = await repository.findByWikiAndUser('wiki-1', 'user-1');

      expect(result).toBeInstanceOf(WikiCollaborator);
      expect(result?.role).toBe(CollaboratorRole.EDIT);
      expect(prisma.wikiCollaborator.findUnique).toHaveBeenCalledWith({
        where: { wikiId_userId: { wikiId: 'wiki-1', userId: 'user-1' } },
      });
    });

    it('should return null when not found', async () => {
      (prisma.wikiCollaborator.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByWikiAndUser('wiki-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('save()', () => {
    it('should upsert collaborator with correct composite key', async () => {
      const collaborator = WikiCollaborator.create({
        id: 'c1',
        wikiId: 'wiki-1',
        userId: 'user-1',
        role: CollaboratorRole.EDIT,
      });

      await repository.save(collaborator);

      expect(prisma.wikiCollaborator.upsert).toHaveBeenCalledWith({
        where: { wikiId_userId: { wikiId: 'wiki-1', userId: 'user-1' } },
        create: expect.objectContaining({
          id: 'c1',
          wikiId: 'wiki-1',
          userId: 'user-1',
          role: CollaboratorRole.EDIT,
        }),
        update: expect.objectContaining({
          role: CollaboratorRole.EDIT,
        }),
      });
    });

    it('should update role on existing collaborator', async () => {
      const collaborator = WikiCollaborator.create({
        id: 'c1',
        wikiId: 'wiki-1',
        userId: 'user-1',
        role: CollaboratorRole.ADMIN,
      });

      await repository.save(collaborator);

      const updateCall = (prisma.wikiCollaborator.upsert as jest.Mock).mock.calls[0][0].update;
      expect(updateCall).not.toHaveProperty('id');
      expect(updateCall.role).toBe(CollaboratorRole.ADMIN);
    });
  });

  describe('delete()', () => {
    it('should delete collaborator by composite key', async () => {
      await repository.delete('wiki-1', 'user-1');

      expect(prisma.wikiCollaborator.delete).toHaveBeenCalledWith({
        where: { wikiId_userId: { wikiId: 'wiki-1', userId: 'user-1' } },
      });
    });
  });
});
