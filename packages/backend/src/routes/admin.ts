/**
 * 路由模块：Admin
 *
 * 函数作用：
 *   管理后台 API 路由，包括用户管理、分类管理、内容审核、系统配置等。
 *   所有路由要求认证（requireAuth），并通过 CASL ability 进行细粒度权限控制。
 *
 * Purpose:
 *   Admin panel API routes including user management, category management,
 *   content moderation, and system configuration. All routes require authentication
 *   and use CASL ability for fine-grained access control.
 *
 * 路由前缀 / Route prefix:
 *   /api/admin（在 index.ts 中挂载）
 *
 * 中间件 / Middleware:
 *   - requireAuth（全部路由）
 *   - adminLimiter（请求频率限制）
 *   - requireAbility（按端点分别控制）
 *
 * 中文关键词：
 *   管理后台，用户管理，分类管理，审核，系统配置，路由
 * English keywords:
 *   admin panel, user management, category management, moderation, system config, routes
 */
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
  emailConfigSchema,
  emailTemplateSchema,
  testEmailSchema,
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
  getRouteWhitelist, addRouteWhitelist, updateRouteWhitelist, deleteRouteWhitelist,
  getEmailConfig, updateEmailConfig, updateEmailTemplate, sendTestEmail
} from '../controllers/admin';
import { rateLimit } from 'express-rate-limit';
import { getClientIp } from '../lib/rateLimit';

const router: Router = Router();

/**
 * 管理后台请求频率限制器
 * 每 IP 每 15 分钟最多 100 次请求
 */
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

// ── 审计日志（仅 SUPER_ADMIN，控制器内部校验） ──

// ── 用户管理 ──
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.patch('/users/:id/role', requireAbility('manage', 'User'), validate(changeUserRoleSchema), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), validate(changeUserStatusSchema), updateUserStatus);

// ── 分类管理 ──
router.post('/categories', requireAbility('manage', 'Category'), validate(createCategorySchema), createCategory);
router.put('/categories/:id', requireAbility('manage', 'Category'), validate(updateCategorySchema), updateCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), removeCategoryModerator);

// ── 内容管理 ──
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), validate(updatePostStatusSchema), updatePostStatus);

// ── 回收站 ──
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts);
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments);
router.post('/recycle/posts/:id/restore', requireAbility('manage', 'AdminPanel'), restorePost);
router.delete('/recycle/posts/:id', requireAbility('manage', 'AdminPanel'), hardDeletePost);
router.post('/recycle/comments/:id/restore', requireAbility('manage', 'AdminPanel'), restoreComment);
router.delete('/recycle/comments/:id', requireAbility('manage', 'AdminPanel'), hardDeleteComment);

// ── 数据库配置（仅 SUPER_ADMIN） ──
router.get('/db-config', requireAbility('manage', 'all'), getDbConfig);
router.post('/db-config', requireAbility('manage', 'all'), validate(dbConfigSchema), updateDbConfig);

// ── 域名配置（仅 SUPER_ADMIN） ──
router.get('/domain-config', requireAbility('manage', 'all'), getDomainConfig);
router.post('/domain-config', requireAbility('manage', 'all'), validate(domainConfigSchema), updateDomainConfig);

// ── 邮件配置（仅 SUPER_ADMIN） ──
router.get('/email-config', requireAbility('manage', 'all'), getEmailConfig);
router.post('/email-config', requireAbility('manage', 'all'), validate(emailConfigSchema), updateEmailConfig);
router.put('/email-config/templates/:type', requireAbility('manage', 'all'), validate(emailTemplateSchema), updateEmailTemplate);
router.post('/email-config/test', requireAbility('manage', 'all'), validate(testEmailSchema), sendTestEmail);

// ── 审核管理 ──
router.get('/moderation/words', requireAbility('manage', 'AdminPanel'), getModeratedWords);
router.post('/moderation/words', requireAbility('manage', 'AdminPanel'), addModeratedWord);
router.delete('/moderation/words/:id', requireAbility('manage', 'AdminPanel'), deleteModeratedWord);

router.get('/moderation/posts', requireAbility('read', 'AdminPanel'), getPendingPosts);
router.post('/moderation/posts/:id/approve', requireAbility('update_status', 'Post'), approvePendingPost);
router.post('/moderation/posts/:id/reject', requireAbility('update_status', 'Post'), rejectPendingPost);

router.get('/moderation/comments', requireAbility('read', 'AdminPanel'), getPendingComments);
router.post('/moderation/comments/:id/approve', requireAbility('update_status', 'Post'), approvePendingComment);
router.post('/moderation/comments/:id/reject', requireAbility('update_status', 'Post'), rejectPendingComment);

// ── 路由白名单管理 ──
router.get('/routing-whitelist', requireAbility('read', 'AdminPanel'), getRouteWhitelist);
router.post('/routing-whitelist', requireAbility('manage', 'AdminPanel'), addRouteWhitelist);
router.put('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), updateRouteWhitelist);
router.delete('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), deleteRouteWhitelist);

export default router;
