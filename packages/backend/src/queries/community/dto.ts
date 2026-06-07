import { PostStatus } from '@myndbbs/shared';

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
  author: { id: string; username: string; avatarUrl: string | null };
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
  author: { id: string; username: string; avatarUrl: string | null };
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
  author: { id: string; username: string; avatarUrl: string | null };
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
