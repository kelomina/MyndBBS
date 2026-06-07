import { COLLABORATOR_ONLY_EDIT_LEVEL, WikiApplicationService } from '../../src/application/wiki/WikiApplicationService';
import { Wiki } from '../../src/domain/wiki/Wiki';
import { WikiCollaborator, CollaboratorRole } from '../../src/domain/wiki/WikiCollaborator';
import { subject } from '@casl/ability';

jest.mock('../../src/db', () => ({
  prisma: {
    wikiCreationLimit: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/db';

describe('WikiApplicationService', () => {
  let wikiRepository: any;
  let collaboratorRepository: any;
  let service: WikiApplicationService;

  beforeEach(() => {
    wikiRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    collaboratorRepository = {
      findByWikiAndUser: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    service = new WikiApplicationService({ wikiRepository, collaboratorRepository });

    jest.clearAllMocks();
  });

  describe('createWiki()', () => {
    it('should create a wiki when user has sufficient level', async () => {
      (prisma.wikiCreationLimit.findUnique as jest.Mock).mockResolvedValue(null);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };
      const result = await service.createWiki(
        'Test Wiki',
        'Test Description',
        null,
        'user-1',
        2
      );

      expect(result).toBeInstanceOf(Wiki);
      expect(result.title).toBe('Test Wiki');
      expect(result.minEditLevel).toBe(COLLABORATOR_ONLY_EDIT_LEVEL);
      expect(wikiRepository.save).toHaveBeenCalled();
    });

    it('should throw when user has insufficient level', async () => {
      await expect(
        service.createWiki('Test Wiki', 'Test Description', null, 'user-1', 1)
      ).rejects.toThrow('ERR_INSUFFICIENT_LEVEL_TO_CREATE_WIKI');
    });

    it('should apply rate limit based on user level', async () => {
      (prisma.wikiCreationLimit.findUnique as jest.Mock).mockResolvedValue({
        creationTimes: [
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        ],
      });

      await expect(
        service.createWiki('Test Wiki', 'Test Description', null, 'user-1', 2)
      ).rejects.toThrow('ERR_WIKI_CREATION_LIMIT_EXCEEDED');
    });

    it('should allow creation when under rate limit', async () => {
      (prisma.wikiCreationLimit.findUnique as jest.Mock).mockResolvedValue({
        creationTimes: [
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
        ],
      });

      const result = await service.createWiki(
        'Test Wiki',
        'Test Description',
        null,
        'user-1',
        2
      );

      expect(result).toBeInstanceOf(Wiki);
    });
  });

  describe('updateWiki()', () => {
    it('should update wiki details when user has permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Old Title',
        description: 'Old Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = {
        can: jest.fn().mockReturnValue(true),
      };

      await service.updateWiki(
        mockAbility as any,
        'wiki-1',
        'New Title',
        'New Description',
        null
      );

      expect(mockWiki.title).toBe('New Title');
      expect(mockWiki.description).toBe('New Description');
      expect(wikiRepository.save).toHaveBeenCalledWith(mockWiki);
    });

    it('should throw when wiki not found', async () => {
      wikiRepository.findById.mockResolvedValue(null);

      const mockAbility = { can: jest.fn() };

      await expect(
        service.updateWiki(mockAbility as any, 'wiki-unknown', 'Title', 'Desc', null)
      ).rejects.toThrow('ERR_WIKI_NOT_FOUND');
    });

    it('should throw when user lacks permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Old Title',
        description: 'Old Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(false) };

      await expect(
        service.updateWiki(mockAbility as any, 'wiki-1', 'Title', 'Desc', null)
      ).rejects.toThrow('ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('updateWikiPermissions()', () => {
    it('should update permissions when user has manage permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.updateWikiPermissions(
        mockAbility as any,
        'wiki-1',
        5,
        3,
        false
      );

      expect(mockWiki.minReadLevel).toBe(5);
      expect(mockWiki.minEditLevel).toBe(3);
      expect(mockWiki.isPublic).toBe(false);
      expect(wikiRepository.save).toHaveBeenCalled();
    });
  });

  describe('archiveWiki()', () => {
    it('should archive wiki when user has manage permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.archiveWiki(mockAbility as any, 'wiki-1');

      expect(mockWiki.status).toBe('ARCHIVED');
      expect(wikiRepository.save).toHaveBeenCalled();
    });
  });

  describe('restoreWiki()', () => {
    it('should restore archived wiki', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      mockWiki.archive();
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.restoreWiki(mockAbility as any, 'wiki-1');

      expect(mockWiki.status).toBe('ACTIVE');
      expect(wikiRepository.save).toHaveBeenCalled();
    });
  });

  describe('deleteWiki()', () => {
    it('should delete wiki when user has permission', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.deleteWiki(mockAbility as any, 'wiki-1');

      expect(mockWiki.status).toBe('DELETED');
      expect(wikiRepository.save).toHaveBeenCalled();
    });
  });

  describe('addCollaborator()', () => {
    it('should add a collaborator to wiki', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.addCollaborator(
        mockAbility as any,
        'wiki-1',
        'user-2',
        CollaboratorRole.EDIT
      );

      expect(collaboratorRepository.save).toHaveBeenCalled();
    });

    it('should throw when collaborator already exists', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(
        WikiCollaborator.create({
          id: 'collab-1',
          wikiId: 'wiki-1',
          userId: 'user-2',
          role: CollaboratorRole.VIEW,
        })
      );

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await expect(
        service.addCollaborator(mockAbility as any, 'wiki-1', 'user-2', CollaboratorRole.EDIT)
      ).rejects.toThrow('ERR_COLLABORATOR_ALREADY_EXISTS');
    });
  });

  describe('updateCollaboratorRole()', () => {
    it('should update collaborator role', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockCollaborator = WikiCollaborator.create({
        id: 'collab-1',
        wikiId: 'wiki-1',
        userId: 'user-2',
        role: CollaboratorRole.VIEW,
      });
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(mockCollaborator);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.updateCollaboratorRole(
        mockAbility as any,
        'wiki-1',
        'user-2',
        CollaboratorRole.ADMIN
      );

      expect(mockCollaborator.role).toBe(CollaboratorRole.ADMIN);
      expect(collaboratorRepository.save).toHaveBeenCalledWith(mockCollaborator);
    });

    it('should throw when collaborator not found', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);
      collaboratorRepository.findByWikiAndUser.mockResolvedValue(null);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await expect(
        service.updateCollaboratorRole(mockAbility as any, 'wiki-1', 'user-unknown', CollaboratorRole.EDIT)
      ).rejects.toThrow('ERR_COLLABORATOR_NOT_FOUND');
    });
  });

  describe('removeCollaborator()', () => {
    it('should remove a collaborator from wiki', async () => {
      const mockWiki = Wiki.create({
        id: 'wiki-1',
        title: 'Title',
        description: 'Description',
        coverUrl: null,
        ownerId: 'user-1',
        minReadLevel: 0,
        minEditLevel: 1,
        isPublic: true,
      });
      wikiRepository.findById.mockResolvedValue(mockWiki);

      const mockAbility = { can: jest.fn().mockReturnValue(true) };

      await service.removeCollaborator(mockAbility as any, 'wiki-1', 'user-2');

      expect(collaboratorRepository.delete).toHaveBeenCalledWith('wiki-1', 'user-2');
    });
  });
});
