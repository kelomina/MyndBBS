import { PostStatus } from '@myndbbs/shared';

/** 作者徽章的公开展示字段（与 PublicProfileBadgeDTO 同构） */
export type AuthorBadgeDTO = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'SYSTEM' | 'CUSTOM';
};

export type AuthorSummaryDTO = {
  username: string;
  avatarUrl: string | null;
  badges: AuthorBadgeDTO[];
};

export type CategoryListItemDTO = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  minLevel: number;
};

export type PostListItemDTO = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  status: PostStatus;
  author: { username: string; avatarUrl: string | null };
  category: { id: string; name: string; description: string | null };
  _count: { comments: number; upvotes: number };
  highlight?: { title?: string; content?: string };
};

export type PostDetailDTO = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  status: PostStatus;
  author: AuthorSummaryDTO;
  category: { id: string; name: string; description: string | null };
  _count: { comments: number; upvotes: number; bookmarks: number };
};

export type PostInteractionDTO = { upvoted: boolean; bookmarked: boolean };

export type CommentListItemDTO = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  isPending: boolean;
  parentId: string | null;
  author: AuthorSummaryDTO;
  _count: { upvotes: number; bookmarks: number; replies: number };
  hasUpvoted?: boolean;
  hasBookmarked?: boolean;
};

export type ListPostsParams = {
  ability: import('../../lib/casl').AppAbility;
  category?: string;
  sortBy?: string;
  take?: number;
};

export type GetPostParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
};

export type ListPostCommentsParams = {
  ability: import('../../lib/casl').AppAbility;
  postId: string;
  currentUserId?: string;
  parentId?: string | null;
  skip?: number;
  take?: number;
};

export type PaginatedCommentsDTO = {
  data: CommentListItemDTO[];
  total: number;
};
