/**
 * 路由模块：Admin
 *
 * 函数作用：
 *   管理后台 API 路由，包括用户管理、分类管理、内容审核、系统配置等。
 *   所有路由要求认证（requireAuthHidden），并通过 CASL ability 进行细粒度权限控制。
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
 *   - requireAuthHidden（全部路由，未认证时统一 404）
 *   - adminLimiter（请求频率限制）
 *   - requireAbility（按端点分别控制）
 *
 * 中文关键词：
 *   管理后台，用户管理，分类管理，审核，系统配置，路由
 * English keywords:
 *   admin panel, user management, category management, moderation, system config, routes
 */
import { Router } from 'express';
import { requireAuthHidden, requireAbility, requireSudo } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
  changeUserRoleSchema,
  changeUserStatusSchema,
  createTestAccountSchema,
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
  getUsers, updateUserRole, updateUserStatus, deleteUser, createTestAccount,
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

router.use(requireAuthHidden);
router.use(adminLimiter);

// Audit logs (SUPER_ADMIN only, handled in controller)
router.get('/audit-logs', requireAbility('manage', 'all'), getAuditLogs);

// ── 审计日志（仅 SUPER_ADMIN，控制器内部校验） ──

// ── 用户管理 ──
router.get('/users', requireAbility('manage', 'User'), getUsers);
router.post('/users/test-account', requireAbility('manage', 'all'), requireSudo, validate(createTestAccountSchema), createTestAccount);
router.patch('/users/:id/role', requireAbility('manage', 'User'), requireSudo, validate(changeUserRoleSchema), updateUserRole);
router.patch('/users/:id/status', requireAbility('manage', 'User'), requireSudo, validate(changeUserStatusSchema), updateUserStatus);
router.delete('/users/:id', requireAbility('manage', 'User'), requireSudo, deleteUser);

// ── 分类管理 ──
router.post('/categories', requireAbility('manage', 'Category'), requireSudo, validate(createCategorySchema), createCategory);
router.put('/categories/:id', requireAbility('manage', 'Category'), requireSudo, validate(updateCategorySchema), updateCategory);
router.delete('/categories/:id', requireAbility('manage', 'Category'), requireSudo, deleteCategory);
router.post('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), requireSudo, assignCategoryModerator);
router.delete('/categories/:categoryId/moderators/:userId', requireAbility('manage', 'Category'), requireSudo, removeCategoryModerator);

// ── 内容管理 ──
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories);
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts);
router.patch('/posts/:id/status', requireAbility('update_status', 'Post'), validate(updatePostStatusSchema), updatePostStatus);

// ── 回收站 ──
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts);
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments);
router.post('/recycle/posts/:id/restore', requireAbility('manage', 'AdminPanel'), requireSudo, restorePost);
router.delete('/recycle/posts/:id', requireAbility('manage', 'AdminPanel'), requireSudo, hardDeletePost);
router.post('/recycle/comments/:id/restore', requireAbility('manage', 'AdminPanel'), requireSudo, restoreComment);
router.delete('/recycle/comments/:id', requireAbility('manage', 'AdminPanel'), requireSudo, hardDeleteComment);

// ── 数据库配置（仅 SUPER_ADMIN） ──
router.get('/db-config', requireAbility('manage', 'all'), getDbConfig);
router.post('/db-config', requireAbility('manage', 'all'), requireSudo, validate(dbConfigSchema), updateDbConfig);

// ── 域名配置（仅 SUPER_ADMIN） ──
router.get('/domain-config', requireAbility('manage', 'all'), getDomainConfig);
router.post('/domain-config', requireAbility('manage', 'all'), requireSudo, validate(domainConfigSchema), updateDomainConfig);

// ── 邮件配置（仅 SUPER_ADMIN） ──
router.get('/email-config', requireAbility('manage', 'all'), getEmailConfig);
router.post('/email-config', requireAbility('manage', 'all'), requireSudo, validate(emailConfigSchema), updateEmailConfig);
router.put('/email-config/templates/:type', requireAbility('manage', 'all'), requireSudo, validate(emailTemplateSchema), updateEmailTemplate);
router.post('/email-config/test', requireAbility('manage', 'all'), requireSudo, validate(testEmailSchema), sendTestEmail);

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
router.get('/routing-whitelist', requireAbility('manage', 'all'), getRouteWhitelist);
router.post('/routing-whitelist', requireAbility('manage', 'AdminPanel'), requireSudo, addRouteWhitelist);
router.put('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), requireSudo, updateRouteWhitelist);
router.delete('/routing-whitelist/:id', requireAbility('manage', 'AdminPanel'), requireSudo, deleteRouteWhitelist);

export default router;
