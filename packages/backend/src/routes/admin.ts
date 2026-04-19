import { Router } from 'express';
import { requireAuth, requireAbility } from '../middleware/auth';
import { getAuditLogs } from '../controllers/auditLog';
import {
  getModeratedWords, addModeratedWord, deleteModeratedWord,
  getPendingPosts, approvePendingPost, rejectPendingPost,
  getPendingComments, approvePendingComment, rejectPendingComment
} from '../controllers/moderation';
import {
  getUsers, updateUserRole, updateUserStatus,
  getCategories, createCategory, updateCategory, deleteCategory,
  assignCategoryModerator, removeCategoryModerator,
  getPosts, updatePostStatus,
  getDeletedPosts, getDeletedComments, restorePost, hardDeletePost, restoreComment, hardDeleteComment,
  getDbConfig, updateDbConfig,
  getDomainConfig, updateDomainConfig,
  getRouteWhitelist, addRouteWhitelist, updateRouteWhitelist, deleteRouteWhitelist
} from '../controllers/admin';

const router: Router = Router();

// Public endpoint for proxy to fetch whitelist
router.get('/routing-whitelist', getRouteWhitelist);

router.use(requireAuth);

// Audit logs (SUPER_ADMIN only, handled in controller)
router.get('/audit-logs', getAuditLogs);

// User Management routes
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.patch('/users/:id/role', requireAbility('manage', 'User'), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), updateUserStatus);

// Category Structure routes
router.post('/categories', requireAbility('manage', 'Category'), createCategory);
router.put('/categories/:id', requireAbility('manage', 'Category'), updateCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), removeCategoryModerator);

// Content Management routes
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), updatePostStatus);

// Recycle Bin routes
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts);
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments);
router.post('/recycle/posts/:id/restore', requireAbility('read', 'AdminPanel'), restorePost);
router.delete('/recycle/posts/:id', requireAbility('read', 'AdminPanel'), hardDeletePost);
router.post('/recycle/comments/:id/restore', requireAbility('read', 'AdminPanel'), restoreComment);
router.delete('/recycle/comments/:id', requireAbility('read', 'AdminPanel'), hardDeleteComment);

// Database Config routes (SUPER_ADMIN only)
router.get('/db-config', getDbConfig);
router.post('/db-config', updateDbConfig);

// Domain Config routes (SUPER_ADMIN only)
router.get('/domain-config', getDomainConfig);
router.post('/domain-config', updateDomainConfig);


// Moderation routes
router.get('/moderation/words', requireAbility('manage', 'AdminPanel'), getModeratedWords);
router.post('/moderation/words', requireAbility('manage', 'AdminPanel'), addModeratedWord);
router.delete('/moderation/words/:id', requireAbility('manage', 'AdminPanel'), deleteModeratedWord);

router.get('/moderation/posts', requireAbility('read', 'AdminPanel'), getPendingPosts);
router.post('/moderation/posts/:id/approve', requireAbility('update_status', 'Post'), approvePendingPost);
router.post('/moderation/posts/:id/reject', requireAbility('update_status', 'Post'), rejectPendingPost);

router.get('/moderation/comments', requireAbility('read', 'AdminPanel'), getPendingComments);
router.post('/moderation/comments/:id/approve', requireAbility('update_status', 'Post'), approvePendingComment);
router.post('/moderation/comments/:id/reject', requireAbility('update_status', 'Post'), rejectPendingComment);


// Routing Whitelist management
router.post('/routing-whitelist', requireAbility('manage', 'AdminPanel'), addRouteWhitelist);
router.put('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), updateRouteWhitelist);
router.delete('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), deleteRouteWhitelist);

export default router;
