import { WikiCollaborator, CollaboratorRole, WikiCollaboratorProps, CreateWikiCollaboratorProps } from '../../src/domain/wiki/WikiCollaborator';

describe('WikiCollaborator Entity', () => {
  const validProps: CreateWikiCollaboratorProps = {
    id: 'collab-1',
    wikiId: 'wiki-1',
    userId: 'user-1',
    role: CollaboratorRole.VIEW,
  };

  describe('create()', () => {
    it('should create a wiki collaborator with VIEW role', () => {
      const collaborator = WikiCollaborator.create(validProps);

      expect(collaborator.id).toBe(validProps.id);
      expect(collaborator.wikiId).toBe(validProps.wikiId);
      expect(collaborator.userId).toBe(validProps.userId);
      expect(collaborator.role).toBe(CollaboratorRole.VIEW);
      expect(collaborator.addedAt).toBeInstanceOf(Date);
    });

    it('should create a collaborator with EDIT role', () => {
      const propsWithEdit = { ...validProps, role: CollaboratorRole.EDIT };
      const collaborator = WikiCollaborator.create(propsWithEdit);

      expect(collaborator.role).toBe(CollaboratorRole.EDIT);
    });

    it('should create a collaborator with ADMIN role', () => {
      const propsWithAdmin = { ...validProps, role: CollaboratorRole.ADMIN };
      const collaborator = WikiCollaborator.create(propsWithAdmin);

      expect(collaborator.role).toBe(CollaboratorRole.ADMIN);
    });
  });

  describe('load()', () => {
    it('should reconstitute a WikiCollaborator entity from existing props', () => {
      const existingProps: WikiCollaboratorProps = {
        ...validProps,
        role: CollaboratorRole.ADMIN,
        addedAt: new Date('2023-01-01'),
      };

      const collaborator = WikiCollaborator.load(existingProps);

      expect(collaborator.id).toBe(existingProps.id);
      expect(collaborator.role).toBe(CollaboratorRole.ADMIN);
      expect(collaborator.addedAt).toEqual(new Date('2023-01-01'));
    });
  });

  describe('updateRole()', () => {
    it('should update role from VIEW to EDIT', () => {
      const collaborator = WikiCollaborator.create(validProps);
      expect(collaborator.role).toBe(CollaboratorRole.VIEW);

      collaborator.updateRole(CollaboratorRole.EDIT);

      expect(collaborator.role).toBe(CollaboratorRole.EDIT);
    });

    it('should update role from EDIT to ADMIN', () => {
      const collaborator = WikiCollaborator.create({ ...validProps, role: CollaboratorRole.EDIT });

      collaborator.updateRole(CollaboratorRole.ADMIN);

      expect(collaborator.role).toBe(CollaboratorRole.ADMIN);
    });

    it('should update role from ADMIN to VIEW', () => {
      const collaborator = WikiCollaborator.create({ ...validProps, role: CollaboratorRole.ADMIN });

      collaborator.updateRole(CollaboratorRole.VIEW);

      expect(collaborator.role).toBe(CollaboratorRole.VIEW);
    });
  });

  describe('CollaboratorRole enum', () => {
    it('should have VIEW role', () => {
      expect(CollaboratorRole.VIEW).toBe('VIEW');
    });

    it('should have EDIT role', () => {
      expect(CollaboratorRole.EDIT).toBe('EDIT');
    });

    it('should have ADMIN role', () => {
      expect(CollaboratorRole.ADMIN).toBe('ADMIN');
    });
  });

  describe('toJSON()', () => {
    it('should return a copy of props', () => {
      const collaborator = WikiCollaborator.create(validProps);
      const json = collaborator.toJSON();

      expect(json).toEqual(expect.objectContaining({
        id: collaborator.id,
        wikiId: collaborator.wikiId,
        userId: collaborator.userId,
        role: collaborator.role,
      }));
    });
  });
});
