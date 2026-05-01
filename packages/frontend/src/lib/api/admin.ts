import { fetcher } from './fetcher';

export interface AuditLogEntry {
  id: string;
  operatorId: string;
  permissionGroup: string;
  operationType: string;
  requestPath: string;
  payload: Record<string, unknown>;
  ip: string;
  createdAt: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
}

/**
 * 获取用户列表
 * @param query 可选的搜索关键字
 * @returns 用户列表
 */
export const getUsers = (query?: string) => {
  const url = query ? `/api/admin/users?q=${encodeURIComponent(query)}` : '/api/admin/users';
  return fetcher(url);
};

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
export const updateDbConfig = (data: Record<string, unknown>) =>
  fetcher('/api/admin/db-config', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getDomainConfig = () => fetcher('/api/admin/domain-config');

export const getAuditLogs = (params?: {
  skip?: number;
  take?: number;
  operatorId?: string;
  operationType?: string;
}): Promise<AuditLogResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params?.take !== undefined) searchParams.set('take', String(params.take));
  if (params?.operatorId) searchParams.set('operatorId', params.operatorId);
  if (params?.operationType) searchParams.set('operationType', params.operationType);
  const qs = searchParams.toString();
  return fetcher(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
};

export const updateDomainConfig = (data: Record<string, unknown>) =>
  fetcher('/api/admin/domain-config', {
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

export interface RouteWhitelist {
  id: string;
  path: string;
  isPrefix: boolean;
  minRole?: string | null;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const getRouteWhitelist = () => fetcher('/api/admin/routing-whitelist');
export const addRouteWhitelist = (data: { path: string; isPrefix: boolean; minRole?: string | null; description?: string }) => 
  fetcher('/api/admin/routing-whitelist', { method: 'POST', body: JSON.stringify(data) });
export const updateRouteWhitelist = (id: string, data: { path: string; isPrefix: boolean; minRole?: string | null; description?: string }) => 
  fetcher(`/api/admin/routing-whitelist/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRouteWhitelist = (id: string) => 
  fetcher(`/api/admin/routing-whitelist/${id}`, { method: 'DELETE' });

// ── Email Configuration ──

export const getEmailConfig = (): Promise<{
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
  templates: Array<{
    type: string;
    subject: string;
    textBody: string;
    htmlBody: string;
  }>;
}> => fetcher('/api/admin/email-config');

export const updateEmailConfig = (data: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}) =>
  fetcher('/api/admin/email-config', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateEmailTemplate = (data: {
  type: string;
  subject: string;
  textBody: string;
  htmlBody: string;
}) =>
  fetcher('/api/admin/email-config/templates/' + data.type, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const sendTestEmail = (targetEmail: string, smtpConfig?: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}) =>
  fetcher('/api/admin/email-config/test', {
    method: 'POST',
    body: JSON.stringify({ targetEmail, smtpConfig }),
  });
