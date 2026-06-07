import { fetcher } from './fetcher';
import type {
  Wiki,
  WikiPage,
  WikiPageHistory,
  WikiCollaborator,
  WikiWithStats,
  WikiPageWithChildren,
  CreateWikiData,
  UpdateWikiData,
  CreateWikiPageData,
  UpdateWikiPageData,
  AddCollaboratorData,
  UpdateCollaboratorData,
  WikiCreationLimitInfo,
} from '../../types';

export const wikiApi = {
  async getAllWikis(): Promise<WikiWithStats[]> {
    return fetcher('/api/wikis');
  },

  async getMyWikis(): Promise<WikiWithStats[]> {
    return fetcher('/api/wikis/my');
  },

  async getWikiById(id: string): Promise<WikiWithStats> {
    return fetcher(`/api/wikis/${id}`);
  },

  async getWikiCreationLimit(): Promise<WikiCreationLimitInfo> {
    return fetcher('/api/wikis/creation-limit');
  },

  async createWiki(data: CreateWikiData): Promise<Wiki> {
    return fetcher('/api/wikis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateWiki(id: string, data: UpdateWikiData): Promise<Wiki> {
    return fetcher(`/api/wikis/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteWiki(id: string): Promise<void> {
    return fetcher(`/api/wikis/${id}`, {
      method: 'DELETE',
    });
  },

  async archiveWiki(id: string): Promise<Wiki> {
    return fetcher(`/api/wikis/${id}/archive`, {
      method: 'POST',
    });
  },

  async restoreWiki(id: string): Promise<Wiki> {
    return fetcher(`/api/wikis/${id}/restore`, {
      method: 'POST',
    });
  },

  async getWikiPages(wikiId: string): Promise<WikiPageWithChildren[]> {
    return fetcher(`/api/wikis/${wikiId}/pages`);
  },

  async getWikiPage(wikiId: string, pageId: string): Promise<WikiPage> {
    return fetcher(`/api/wikis/${wikiId}/pages/${pageId}`);
  },

  async getWikiPageBySlug(wikiId: string, slug: string): Promise<WikiPage> {
    return fetcher(`/api/wikis/${wikiId}/pages/slug/${slug}`);
  },

  async createWikiPage(wikiId: string, data: CreateWikiPageData): Promise<WikiPage> {
    return fetcher(`/api/wikis/${wikiId}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateWikiPage(wikiId: string, pageId: string, data: UpdateWikiPageData): Promise<WikiPage> {
    return fetcher(`/api/wikis/${wikiId}/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteWikiPage(wikiId: string, pageId: string): Promise<void> {
    return fetcher(`/api/wikis/${wikiId}/pages/${pageId}`, {
      method: 'DELETE',
    });
  },

  async getWikiPageHistory(wikiId: string, pageId: string): Promise<WikiPageHistory[]> {
    return fetcher(`/api/wikis/${wikiId}/pages/${pageId}/history`);
  },

  async revertWikiPageToVersion(
    wikiId: string,
    pageId: string,
    versionId: string
  ): Promise<WikiPage> {
    return fetcher(`/api/wikis/${wikiId}/pages/${pageId}/history/${versionId}/restore`, {
      method: 'POST',
    });
  },

  async getWikiCollaborators(wikiId: string): Promise<WikiCollaborator[]> {
    return fetcher(`/api/wikis/${wikiId}/collaborators`);
  },

  async addWikiCollaborator(
    wikiId: string,
    data: AddCollaboratorData
  ): Promise<WikiCollaborator> {
    return fetcher(`/api/wikis/${wikiId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateWikiCollaborator(
    wikiId: string,
    collaboratorId: string,
    data: UpdateCollaboratorData
  ): Promise<WikiCollaborator> {
    return fetcher(`/api/wikis/${wikiId}/collaborators/${collaboratorId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async removeWikiCollaborator(wikiId: string, collaboratorId: string): Promise<void> {
    return fetcher(`/api/wikis/${wikiId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
  },
};
