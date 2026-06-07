import { Wiki } from './Wiki';

export interface IWikiRepository {
  findById(id: string): Promise<Wiki | null>;
  findByOwner(ownerId: string): Promise<Wiki[]>;
  findAll(): Promise<Wiki[]>;
  save(wiki: Wiki): Promise<void>;
  delete(id: string): Promise<void>;
}
