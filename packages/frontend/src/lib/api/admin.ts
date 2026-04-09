export const fetcher = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

export const getUsers = () => fetcher('/api/admin/users');

export const updateUserRole = (id: string, role: string) =>
  fetcher(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

export const updateUserStatus = (id: string, status: string) =>
  fetcher(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const updatePostStatus = (id: string, status: string) =>
  fetcher(`/api/admin/posts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const getDeletedPosts = () => fetcher('/api/admin/recycle/posts');
export const getDeletedComments = () => fetcher('/api/admin/recycle/comments');
export const restorePost = (id: string) => fetcher(`/api/admin/recycle/posts/${id}/restore`, { method: 'POST' });
export const hardDeletePost = (id: string) => fetcher(`/api/admin/recycle/posts/${id}`, { method: 'DELETE' });
export const restoreComment = (id: string) => fetcher(`/api/admin/recycle/comments/${id}/restore`, { method: 'POST' });
export const hardDeleteComment = (id: string) => fetcher(`/api/admin/recycle/comments/${id}`, { method: 'DELETE' });

export const getDbConfig = () => fetcher('/api/admin/db-config');
export const updateDbConfig = (data: any) =>
  fetcher('/api/admin/db-config', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getCategories = () => fetcher('/api/admin/categories');

export const createCategory = (data: { name: string; description?: string; order?: number }) =>
  fetcher('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteCategory = (id: string) =>
  fetcher(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  });

export const assignCategoryModerator = (categoryId: string, userId: string) =>
  fetcher(`/api/admin/categories/${categoryId}/moderators/${userId}`, {
    method: 'POST',
  });

export const removeCategoryModerator = (categoryId: string, userId: string) =>
  fetcher(`/api/admin/categories/${categoryId}/moderators/${userId}`, {
    method: 'DELETE',
  });
