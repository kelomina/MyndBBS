import { Router } from 'express';
import { requireAuth, requireAbility } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  changeUserRoleSchema,
  changeUserStatusSchema,
  createCategorySchema,
  updateCategorySchema,
  dbConfigSchema,
  domainConfigSchema,
  updatePostStatusSchema,
} from '../lib/validation/schemas';
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
import { rateLimit } from 'express-rate-limit';
import { getClientIp } from '../lib/rateLimit';

const router: Router = Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'Too many admin requests from this IP, please try again later.' },
});

router.use(requireAuth);
router.use(adminLimiter);

// Audit logs (SUPER_ADMIN only, handled in controller)
router.get('/audit-logs', requireAbility('manage', 'all'), getAuditLogs);

// User Management routes
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.patch('/users/:id/role', requireAbility('manage', 'User'), validate(changeUserRoleSchema), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), validate(changeUserStatusSchema), updateUserStatus);

// Category Structure routes
router.post('/categories', requireAbility('manage', 'Category'), validate(createCategorySchema), createCategory);
router.put('/categories/:id', requireAbility('manage', 'Category'), validate(updateCategorySchema), updateCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), removeCategoryModerator);

// Content Management routes
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), validate(updatePostStatusSchema), updatePostStatus);

// Recycle Bin routes
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts);
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments);
router.post('/recycle/posts/:id/restore', requireAbility('manage', 'AdminPanel'), restorePost);
router.delete('/recycle/posts/:id', requireAbility('manage', 'AdminPanel'), hardDeletePost);
router.post('/recycle/comments/:id/restore', requireAbility('manage', 'AdminPanel'), restoreComment);
router.delete('/recycle/comments/:id', requireAbility('manage', 'AdminPanel'), hardDeleteComment);

// Database Config routes (SUPER_ADMIN only)
router.get('/db-config', requireAbility('manage', 'all'), getDbConfig);
router.post('/db-config', requireAbility('manage', 'all'), validate(dbConfigSchema), updateDbConfig);

// Domain Config routes (SUPER_ADMIN only)
router.get('/domain-config', requireAbility('manage', 'all'), getDomainConfig);
router.post('/domain-config', requireAbility('manage', 'all'), validate(domainConfigSchema), updateDomainConfig);


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
router.get('/routing-whitelist', requireAbility('read', 'AdminPanel'), getRouteWhitelist);
router.post('/routing-whitelist', requireAbility('manage', 'AdminPanel'), addRouteWhitelist);
router.put('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), updateRouteWhitelist);
router.delete('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), deleteRouteWhitelist);

export default router;
