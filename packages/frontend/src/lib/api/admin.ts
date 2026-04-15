import { fetcher } from './fetcher';

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get users logic for the application.
 * Keywords: getusers, get, users, auto-annotated
 */
export const getUsers = () => fetcher('/api/admin/users');

/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the update user role logic for the application.
 * Keywords: updateuserrole, update, user, role, auto-annotated
 */
export const updateUserRole = (id: string, role: string) =>
  fetcher(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the update user status logic for the application.
 * Keywords: updateuserstatus, update, user, status, auto-annotated
 */
export const updateUserStatus = (id: string, status: string) =>
  fetcher(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the update post status logic for the application.
 * Keywords: updatepoststatus, update, post, status, auto-annotated
 */
export const updatePostStatus = (id: string, status: string) =>
  fetcher(`/api/admin/posts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get deleted posts logic for the application.
 * Keywords: getdeletedposts, get, deleted, posts, auto-annotated
 */
export const getDeletedPosts = () => fetcher('/api/admin/recycle/posts');
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get deleted comments logic for the application.
 * Keywords: getdeletedcomments, get, deleted, comments, auto-annotated
 */
export const getDeletedComments = () => fetcher('/api/admin/recycle/comments');
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the restore post logic for the application.
 * Keywords: restorepost, restore, post, auto-annotated
 */
export const restorePost = (id: string) => fetcher(`/api/admin/recycle/posts/${id}/restore`, { method: 'POST' });
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the hard delete post logic for the application.
 * Keywords: harddeletepost, hard, delete, post, auto-annotated
 */
export const hardDeletePost = (id: string) => fetcher(`/api/admin/recycle/posts/${id}`, { method: 'DELETE' });
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the restore comment logic for the application.
 * Keywords: restorecomment, restore, comment, auto-annotated
 */
export const restoreComment = (id: string) => fetcher(`/api/admin/recycle/comments/${id}/restore`, { method: 'POST' });
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the hard delete comment logic for the application.
 * Keywords: harddeletecomment, hard, delete, comment, auto-annotated
 */
export const hardDeleteComment = (id: string) => fetcher(`/api/admin/recycle/comments/${id}`, { method: 'DELETE' });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get db config logic for the application.
 * Keywords: getdbconfig, get, db, config, auto-annotated
 */
export const getDbConfig = () => fetcher('/api/admin/db-config');
/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the update db config logic for the application.
 * Keywords: updatedbconfig, update, db, config, auto-annotated
 */
export const updateDbConfig = (data: any) =>
  fetcher('/api/admin/db-config', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getDomainConfig = () => fetcher('/api/admin/domain-config');

export const updateDomainConfig = (data: any) =>
  fetcher('/api/admin/domain-config', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get categories logic for the application.
 * Keywords: getcategories, get, categories, auto-annotated
 */
export const getCategories = () => fetcher('/api/admin/categories');

/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the create category logic for the application.
 * Keywords: createcategory, create, category, auto-annotated
 */
export const createCategory = (data: { name: string; description?: string; order?: number }) =>
  fetcher('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the delete category logic for the application.
 * Keywords: deletecategory, delete, category, auto-annotated
 */
export const deleteCategory = (id: string) =>
  fetcher(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the assign category moderator logic for the application.
 * Keywords: assigncategorymoderator, assign, category, moderator, auto-annotated
 */
export const assignCategoryModerator = (categoryId: string, userId: string) =>
  fetcher(`/api/admin/categories/${categoryId}/moderators/${userId}`, {
    method: 'POST',
  });

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the remove category moderator logic for the application.
 * Keywords: removecategorymoderator, remove, category, moderator, auto-annotated
 */
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

/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the get route whitelist logic for the application.
 * Keywords: getroutewhitelist, get, route, whitelist, auto-annotated
 */
export const getRouteWhitelist = () => fetcher('/api/admin/routing-whitelist');
/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the add route whitelist logic for the application.
 * Keywords: addroutewhitelist, add, route, whitelist, auto-annotated
 */
export const addRouteWhitelist = (data: { path: string; isPrefix: boolean; minRole?: string | null; description?: string }) => 
  fetcher('/api/admin/routing-whitelist', { method: 'POST', body: JSON.stringify(data) });
/**
 * Callers: []
 * Callees: [fetcher, stringify]
 * Description: Handles the update route whitelist logic for the application.
 * Keywords: updateroutewhitelist, update, route, whitelist, auto-annotated
 */
export const updateRouteWhitelist = (id: string, data: { path: string; isPrefix: boolean; minRole?: string | null; description?: string }) => 
  fetcher(`/api/admin/routing-whitelist/${id}`, { method: 'PUT', body: JSON.stringify(data) });
/**
 * Callers: []
 * Callees: [fetcher]
 * Description: Handles the delete route whitelist logic for the application.
 * Keywords: deleteroutewhitelist, delete, route, whitelist, auto-annotated
 */
export const deleteRouteWhitelist = (id: string) => 
  fetcher(`/api/admin/routing-whitelist/${id}`, { method: 'DELETE' });
