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
  status: PostStatus;
  author: { id: string; username: string };
  category: { id: string; name: string; description: string | null };
  _count: { comments: number; upvotes: number };
};

export type PostDetailDTO = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  status: PostStatus;
  author: { id: string; username: string };
  category: { id: string; name: string; description: string | null };
  _count: { comments: number; upvotes: number; bookmarks: number };
};

export type PostInteractionDTO = { upvoted: boolean; bookmarked: boolean };

export type CommentListItemDTO = {
  id: string;
  content: string;
  createdAt: Date;
  deletedAt: Date | null;
  isPending: boolean;
  author: { id: string; username: string };
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
  take?: number;
};
