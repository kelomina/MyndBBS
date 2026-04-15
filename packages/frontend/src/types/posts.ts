import type { Dictionary } from './i18n';

export type CurrentUserRole = 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export type CurrentUser = {
  username: string;
  role?: CurrentUserRole;
};

export type CommentAuthor = { username?: string | null };

export type PostComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  parentId?: string | null;
  author?: CommentAuthor | null;
  _count?: { upvotes?: number };
  hasUpvoted?: boolean;
  hasBookmarked?: boolean;
};

export type CommentNode = PostComment & { children: CommentNode[] };

export type EditablePost = { id: string; title: string; content: string; categoryId: string };

export type PostListPost = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author?: { username?: string | null } | null;
  category?: { name?: string | null } | null;
  _count?: { upvotes?: number; comments?: number };
};

export type ProfilePost = { id: string; title: string; content: string; createdAt: string; category?: { name?: string } | null };
export type ProfileUser = { username: string; _count: { posts: number }; posts?: ProfilePost[] | null };

export type CommentBookmark = {
  type: 'comment';
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  bookmarkedAt: string;
  author?: { username?: string } | null;
  post?: { title?: string } | null;
  deletedAt?: string | null;
};

export type PostBookmark = {
  type: 'post';
  id: string;
  title: string;
  content: string;
  createdAt: string;
  bookmarkedAt: string;
  category?: { name?: string } | null;
  status?: string | null;
};

export type BookmarkItem = CommentBookmark | PostBookmark;

export type DictApiErrors = Dictionary['apiErrors'] & Record<string, string | undefined>;
