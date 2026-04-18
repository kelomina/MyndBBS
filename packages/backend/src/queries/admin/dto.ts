/**
 * Data Transfer Object for listing users in the admin panel.
 */
export type AdminUserListDTO = {
  id: string;
  username: string;
  email: string;
  status: string;
  level: number;
  role: string | null;
  createdAt: Date;
};

export type AdminPostListDTO = {
  id: string;
  title: string;
  status: string;
  author: { id: string; username: string };
  category: { id: string; name: string };
  createdAt: Date;
};

export type AdminDeletedPostListDTO = AdminPostListDTO;

export type AdminDeletedCommentListDTO = {
  id: string;
  content: string;
  author: { id: string; username: string };
  post: { id: string; title: string };
  createdAt: Date;
};

export type AdminCategoryListDTO = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  minLevel: number;
};

export type AdminPostDTO = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  categoryId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCommentDTO = {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  isPending: boolean;
};

export type AdminCommentWithPostDTO = AdminCommentDTO & {
  post: AdminPostDTO;
};

export type AdminModeratorScopeDTO = {
  isSuperAdmin: boolean;
  categoryIds?: string[];
};

export type AdminModeratedWordDTO = {
  id: string;
  word: string;
  categoryId: string | null;
  createdAt: Date;
};

export type AdminModeratedWordListDTO = AdminModeratedWordDTO & {
  category: { name: string } | null;
};

export type AdminPendingPostListDTO = {
  id: string;
  title: string;
  content: string;
  status: string;
  author: { username: string };
  category: { name: string };
  createdAt: Date;
};

export type AdminPendingCommentListDTO = {
  id: string;
  content: string;
  author: { username: string };
  post: { id: string; title: string };
  createdAt: Date;
};

export type AdminRoleDTO = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminUserDTO = {
  id: string;
  email: string;
  username: string;
  status: string;
  level: number;
  roleId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

