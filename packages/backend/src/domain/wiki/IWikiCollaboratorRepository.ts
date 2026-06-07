import { WikiCollaborator } from './WikiCollaborator';

export interface IWikiCollaboratorRepository {
  findByWiki(wikiId: string): Promise<WikiCollaborator[]>;
  findByUser(userId: string): Promise<WikiCollaborator[]>;
  findByWikiAndUser(wikiId: string, userId: string): Promise<WikiCollaborator | null>;
  save(collaborator: WikiCollaborator): Promise<void>;
  delete(wikiId: string, userId: string): Promise<void>;
}
