export type AdminUserListDTO = {
  id: string;
  username: string;
  email: string;
  status: string;
  level: number;
  role: { id: string; name: string } | null;
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
