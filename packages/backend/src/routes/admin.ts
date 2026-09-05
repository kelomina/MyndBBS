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
import { Router } from 'express'
import { requireAuthHidden, requireAbility, requireSudo } from '../middleware/auth'
import { validate } from '../middleware/validation'
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
  createBadgeSchema,
  updateBadgeSchema,
  grantBadgeSchema,
  handleReportSchema,
  bannedIpSchema,
  antiSpamPolicySchema,
  siteSettingsSchema,
} from '../lib/validation/schemas'
import { getAuditLogs } from '../controllers/auditLog'
import {
  getModeratedWords,
  addModeratedWord,
  deleteModeratedWord,
  getPendingPosts,
  approvePendingPost,
  rejectPendingPost,
  getPendingComments,
  approvePendingComment,
  rejectPendingComment,
} from '../controllers/moderation'
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  createTestAccount,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignCategoryModerator,
  removeCategoryModerator,
  getPosts,
  updatePostStatus,
  getDeletedPosts,
  getDeletedComments,
  restorePost,
  hardDeletePost,
  restoreComment,
  hardDeleteComment,
  getDbConfig,
  updateDbConfig,
  getDomainConfig,
  updateDomainConfig,
  getRouteWhitelist,
  addRouteWhitelist,
  updateRouteWhitelist,
  deleteRouteWhitelist,
  getEmailConfig,
  updateEmailConfig,
  updateEmailTemplate,
  sendTestEmail,
} from '../controllers/admin'
import {
  getBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  grantBadge,
  revokeBadge,
  listBadgeHolders,
  runBadgeEvaluation,
} from '../controllers/badge'
import { getReports, resolveReport, dismissReport } from '../controllers/report'
import {
  listIpBans,
  createIpBan,
  deleteIpBan,
  getAntiSpamPolicy,
  updateAntiSpamPolicy,
} from '../controllers/protection'
import {
  getRateLimitProtection,
  updateRateLimitProtection,
} from '../controllers/rateLimitProtection'
import { getSiteSettings, updateSiteSettings } from '../controllers/siteSettings'
import { statsQueryService } from '../queries/system/StatsQueryService'
import { rateLimit } from 'express-rate-limit'
import { getClientIp } from '../lib/rateLimit'

const router: Router = Router()

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
})

router.use(requireAuthHidden)
router.use(adminLimiter)

// Audit logs (SUPER_ADMIN only, handled in controller)
router.get('/audit-logs', requireAbility('manage', 'all'), getAuditLogs)

// ── 审计日志（仅 SUPER_ADMIN，控制器内部校验） ──

// ── 用户管理 ──
router.get('/users', requireAbility('manage', 'User'), getUsers)
router.post(
  '/users/test-account',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(createTestAccountSchema),
  createTestAccount,
)
router.patch(
  '/users/:id/role',
  requireAbility('manage', 'User'),
  requireSudo,
  validate(changeUserRoleSchema),
  updateUserRole,
)
router.patch(
  '/users/:id/status',
  requireAbility('manage', 'User'),
  requireSudo,
  validate(changeUserStatusSchema),
  updateUserStatus,
)
router.delete('/users/:id', requireAbility('manage', 'User'), requireSudo, deleteUser)

// ── 分类管理 ──
router.post(
  '/categories',
  requireAbility('manage', 'Category'),
  requireSudo,
  validate(createCategorySchema),
  createCategory,
)
router.put(
  '/categories/:id',
  requireAbility('manage', 'Category'),
  requireSudo,
  validate(updateCategorySchema),
  updateCategory,
)
router.delete('/categories/:id', requireAbility('manage', 'Category'), requireSudo, deleteCategory)
router.post(
  '/categories/:categoryId/moderators/:userId',
  requireAbility('manage', 'Category'),
  requireSudo,
  assignCategoryModerator,
)
router.delete(
  '/categories/:categoryId/moderators/:userId',
  requireAbility('manage', 'Category'),
  requireSudo,
  removeCategoryModerator,
)

// ── 内容管理 ──
router.get('/categories', requireAbility('read', 'AdminPanel'), getCategories)
router.get('/posts', requireAbility('read', 'AdminPanel'), getPosts)
router.patch(
  '/posts/:id/status',
  requireAbility('update_status', 'Post'),
  validate(updatePostStatusSchema),
  updatePostStatus,
)

// ── 回收站 ──
router.get('/recycle/posts', requireAbility('read', 'AdminPanel'), getDeletedPosts)
router.get('/recycle/comments', requireAbility('read', 'AdminPanel'), getDeletedComments)
router.post(
  '/recycle/posts/:id/restore',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  restorePost,
)
router.delete(
  '/recycle/posts/:id',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  hardDeletePost,
)
router.post(
  '/recycle/comments/:id/restore',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  restoreComment,
)
router.delete(
  '/recycle/comments/:id',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  hardDeleteComment,
)

// ── 徽章管理 ──
// 定义查看：所有管理面板可见角色；定义增删改：仅 ADMIN+（manage Badge 未授予版主）
// 授予/撤销：ADMIN+ 与全局 MODERATOR（casl.ts 中授予 grant/revoke Badge 能力）
router.get('/badges', requireAbility('read', 'AdminPanel'), getBadges)
router.post('/badges', requireAbility('manage', 'Badge'), validate(createBadgeSchema), createBadge)
router.put(
  '/badges/:id',
  requireAbility('manage', 'Badge'),
  validate(updateBadgeSchema),
  updateBadge,
)
router.delete('/badges/:id', requireAbility('manage', 'Badge'), deleteBadge)
router.get('/badges/:id/grants', requireAbility('read', 'AdminPanel'), listBadgeHolders)
router.post(
  '/badges/:id/grants',
  requireAbility('grant', 'Badge'),
  validate(grantBadgeSchema),
  grantBadge,
)
router.delete('/badges/:id/grants/:userId', requireAbility('revoke', 'Badge'), revokeBadge)
router.post('/badges/evaluate', requireAbility('manage', 'Badge'), runBadgeEvaluation)

// ── 用户举报管理 ──
// 队列查看：MODERATOR+（read AdminPanel / read Report）；处理：handle Report
router.get('/reports', requireAbility('read', 'Report'), getReports)
router.post(
  '/reports/:id/resolve',
  requireAbility('handle', 'Report'),
  validate(handleReportSchema),
  resolveReport,
)
router.post(
  '/reports/:id/dismiss',
  requireAbility('handle', 'Report'),
  validate(handleReportSchema),
  dismissReport,
)

// ── 治理强化（仅 ADMIN+，manage all 守卫）──
router.get('/protection/ip-bans', requireAbility('manage', 'all'), listIpBans)
router.post(
  '/protection/ip-bans',
  requireAbility('manage', 'all'),
  validate(bannedIpSchema),
  createIpBan,
)
router.delete('/protection/ip-bans/:id', requireAbility('manage', 'all'), deleteIpBan)
router.get('/protection/anti-spam', requireAbility('manage', 'all'), getAntiSpamPolicy)
router.put(
  '/protection/anti-spam',
  requireAbility('manage', 'all'),
  validate(antiSpamPolicySchema),
  updateAntiSpamPolicy,
)
// B4 读限流解锁配置（ADMIN+：匿名按 requireAuthHidden→404，MODERATOR 读写均 403；PUT zod 严格由控制器内 400）
// 注意：此处不挂 validate() 中间件，校验在控制器内完成以保证 {success:false, error:ERR_INVALID_RATE_LIMIT_POLICY} 契约体
router.get('/protection/rate-limit', requireAbility('manage', 'all'), getRateLimitProtection)
router.put('/protection/rate-limit', requireAbility('manage', 'all'), updateRateLimitProtection)

// ── 站点设置与统计（仅 ADMIN+）──
router.get('/site-settings', requireAbility('manage', 'all'), getSiteSettings)
router.put(
  '/site-settings',
  requireAbility('manage', 'all'),
  validate(siteSettingsSchema),
  updateSiteSettings,
)
router.get('/stats', requireAbility('manage', 'all'), (_req, res) => {
  void statsQueryService.getSiteStats().then(
    (stats) => res.json(stats),
    (err) => {
      console.error('[admin] stats failed:', err)
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' })
    },
  )
})

// ── 数据库配置（仅 SUPER_ADMIN） ──
router.get('/db-config', requireAbility('manage', 'all'), getDbConfig)
router.post(
  '/db-config',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(dbConfigSchema),
  updateDbConfig,
)

// ── 域名配置（仅 SUPER_ADMIN） ──
router.get('/domain-config', requireAbility('manage', 'all'), getDomainConfig)
router.post(
  '/domain-config',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(domainConfigSchema),
  updateDomainConfig,
)

// ── 邮件配置（仅 SUPER_ADMIN） ──
router.get('/email-config', requireAbility('manage', 'all'), getEmailConfig)
router.post(
  '/email-config',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(emailConfigSchema),
  updateEmailConfig,
)
router.put(
  '/email-config/templates/:type',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(emailTemplateSchema),
  updateEmailTemplate,
)
router.post(
  '/email-config/test',
  requireAbility('manage', 'all'),
  requireSudo,
  validate(testEmailSchema),
  sendTestEmail,
)

// ── 审核管理 ──
router.get('/moderation/words', requireAbility('manage', 'AdminPanel'), getModeratedWords)
router.post('/moderation/words', requireAbility('manage', 'AdminPanel'), addModeratedWord)
router.delete('/moderation/words/:id', requireAbility('manage', 'AdminPanel'), deleteModeratedWord)

router.get('/moderation/posts', requireAbility('read', 'AdminPanel'), getPendingPosts)
router.post(
  '/moderation/posts/:id/approve',
  requireAbility('update_status', 'Post'),
  approvePendingPost,
)
router.post(
  '/moderation/posts/:id/reject',
  requireAbility('update_status', 'Post'),
  rejectPendingPost,
)

router.get('/moderation/comments', requireAbility('read', 'AdminPanel'), getPendingComments)
router.post(
  '/moderation/comments/:id/approve',
  requireAbility('update_status', 'Post'),
  approvePendingComment,
)
router.post(
  '/moderation/comments/:id/reject',
  requireAbility('update_status', 'Post'),
  rejectPendingComment,
)

// ── 路由白名单管理 ──
router.get('/routing-whitelist', requireAbility('manage', 'all'), getRouteWhitelist)
router.post(
  '/routing-whitelist',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  addRouteWhitelist,
)
router.put(
  '/routing-whitelist/:id',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  updateRouteWhitelist,
)
router.delete(
  '/routing-whitelist/:id',
  requireAbility('manage', 'AdminPanel'),
  requireSudo,
  deleteRouteWhitelist,
)

export default router
