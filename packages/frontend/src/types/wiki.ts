export interface Wiki {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  ownerId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    username: string;
  };
}

export interface WikiPage {
  id: string;
  wikiId: string;
  title: string;
  content: string;
  slug: string;
  parentId: string | null;
  order: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author?: {
    id: string;
    username: string;
  };
}

export interface WikiPageHistory {
  id: string;
  pageId: string;
  title: string;
  content: string;
  editorId: string;
  editor?: {
    id: string;
    username: string;
  };
  createdAt: string;
}

export interface WikiCollaborator {
  id: string;
  wikiId: string;
  userId: string;
  role: 'VIEW' | 'EDIT' | 'ADMIN';
  user?: {
    id: string;
    username: string;
  };
}

export interface WikiWithStats extends Wiki {
  pageCount: number;
  collaboratorCount: number;
}

export interface WikiPageWithChildren extends WikiPage {
  children: WikiPageWithChildren[];
}

export interface CreateWikiData {
  title: string;
  description: string;
  coverUrl?: string;
}

export interface UpdateWikiData {
  title?: string;
  description?: string;
  coverUrl?: string;
}

export interface CreateWikiPageData {
  title: string;
  content: string;
  slug?: string;
  parentId?: string;
}

export interface UpdateWikiPageData {
  title?: string;
  content?: string;
  slug?: string;
  parentId?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface AddCollaboratorData {
  userId: string;
  role: 'VIEW' | 'EDIT' | 'ADMIN';
}

export interface UpdateCollaboratorData {
  role: 'VIEW' | 'EDIT' | 'ADMIN';
}

export interface WikiCreationLimitInfo {
  canCreate: boolean;
  currentCount: number;
  maxCount: number;
  reason?: string;
}
