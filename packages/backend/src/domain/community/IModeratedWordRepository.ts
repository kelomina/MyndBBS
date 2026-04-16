import { ModeratedWord } from './ModeratedWord';

/**
 * Callers: [ModerationApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of ModeratedWord Aggregates.
 * Keywords: moderatedword, repository, interface, contract, domain
 */
export interface IModeratedWordRepository {
  findById(id: string): Promise<ModeratedWord | null>;
  findAll(): Promise<ModeratedWord[]>;
  save(word: ModeratedWord): Promise<void>;
  delete(id: string): Promise<void>;
}
