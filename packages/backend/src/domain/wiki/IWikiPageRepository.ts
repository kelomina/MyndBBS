import { WikiPage } from './WikiPage';

export interface IWikiPageRepository {
  findById(id: string): Promise<WikiPage | null>;
  findByWiki(wikiId: string): Promise<WikiPage[]>;
  findBySlug(wikiId: string, slug: string): Promise<WikiPage | null>;
  save(page: WikiPage): Promise<void>;
  delete(id: string): Promise<void>;
}
