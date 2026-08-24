import { fetcher } from './fetcher';
import type { BadgeDto, BadgeHolder } from '../../types/badges';
import type { BannedIpItem, AntiSpamPolicy } from '../../types/protection';

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

export const deleteUser = (id: string) =>
  fetcher(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });

export interface CreateTestAccountPayload {
  username: string;
  email: string;
  password: string;
}

export interface CreatedTestAccount {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  level: number;
}

export const createTestAccount = (payload: CreateTestAccountPayload): Promise<{
  message: string;
  user: CreatedTestAccount;
}> =>
  fetcher('/api/admin/users/test-account', {
    method: 'POST',
    body: JSON.stringify(payload),
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

// ── Badge Management ──

export interface CreateBadgePayload {
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  grantType: 'AUTO' | 'MANUAL';
  condition?: {
    kind:
      | 'manual'
      | 'user_level'
      | 'post_count'
      | 'comment_count'
      | 'content_count'
      | 'night_activity';
    threshold?: number;
    startHour?: number;
    endHour?: number;
    utcOffsetHours?: number;
  };
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateBadgePayload = Partial<Omit<CreateBadgePayload, 'code'>>;

export const getBadges = (): Promise<BadgeDto[]> => fetcher('/api/admin/badges');

export const createBadge = (data: CreateBadgePayload) =>
  fetcher('/api/admin/badges', { method: 'POST', body: JSON.stringify(data) });

export const updateBadge = (id: string, data: UpdateBadgePayload) =>
  fetcher(`/api/admin/badges/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteBadge = (id: string) =>
  fetcher(`/api/admin/badges/${id}`, { method: 'DELETE' });

export const grantBadgeToUser = (badgeId: string, userId: string, reason?: string) =>
  fetcher(`/api/admin/badges/${badgeId}/grants`, {
    method: 'POST',
    body: JSON.stringify({ userId, reason }),
  });

export const revokeBadgeFromUser = (badgeId: string, userId: string) =>
  fetcher(`/api/admin/badges/${badgeId}/grants/${userId}`, { method: 'DELETE' });

export const getBadgeHolders = (badgeId: string, query?: string): Promise<BadgeHolder[]> => {
  const url = query
    ? `/api/admin/badges/${badgeId}/grants?q=${encodeURIComponent(query)}`
    : `/api/admin/badges/${badgeId}/grants`;
  return fetcher(url);
};

export const runBadgeEvaluation = (): Promise<{ message: string; grantedCount: number }> =>
  fetcher('/api/admin/badges/evaluate', { method: 'POST' });

// ── Protection (IP bans + anti-spam policy) ──

export const getIpBans = (): Promise<BannedIpItem[]> => fetcher('/api/admin/protection/ip-bans');

export const createIpBan = (data: {
  ip: string;
  scope: 'ALL' | 'REGISTRATION';
  reason?: string;
  expiresInDays?: number;
}) =>
  fetcher('/api/admin/protection/ip-bans', { method: 'POST', body: JSON.stringify(data) });

export const deleteIpBan = (id: string) =>
  fetcher(`/api/admin/protection/ip-bans/${id}`, { method: 'DELETE' });

export const getAntiSpamPolicy = (): Promise<AntiSpamPolicy> =>
  fetcher('/api/admin/protection/anti-spam');

export const updateAntiSpamPolicy = (policy: AntiSpamPolicy) =>
  fetcher('/api/admin/protection/anti-spam', { method: 'PUT', body: JSON.stringify(policy) });

export interface SiteStats {
  users: { total: number; today: number; last7Days: number };
  posts: { total: number; today: number; last7Days: number };
  comments: { total: number; today: number; last7Days: number };
  moderation: { pendingReports: number };
}

export const getSiteStats = (): Promise<SiteStats> => fetcher('/api/admin/stats');

export interface SiteSettings {
  siteName: string;
  announcement: string;
  registrationDisabled: boolean;
}

export const getSiteSettings = (): Promise<SiteSettings> =>
  fetcher('/api/admin/site-settings');

export const updateSiteSettings = (data: Partial<SiteSettings>) =>
  fetcher('/api/admin/site-settings', { method: 'PUT', body: JSON.stringify(data) });