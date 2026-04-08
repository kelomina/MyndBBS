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
