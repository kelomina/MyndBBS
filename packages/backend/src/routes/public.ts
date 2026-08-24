import { Router } from 'express';
import { getPublicRouteWhitelist } from '../controllers/admin';
import { getPublicSiteSettings } from '../controllers/siteSettings';

const router: Router = Router();

/**
 * Public endpoint for the frontend proxy to fetch the routing whitelist
 * before authentication has completed. This allows the frontend middleware
 * to determine which routes are public vs protected and redirect accordingly.
 *
 * 公开端点供前端代理在认证完成前获取路由白名单，以判断哪些路由公开、哪些需跳转登录。
 *
 * Security: This endpoint intentionally requires no authentication.
 * It only exposes route path patterns and optional minimum role hints,
 * which are non-sensitive access-control metadata.
 *
 * 安全注意：本端点刻意不要求认证，仅暴露路由路径模式和可选最低角色提示，属于非敏感的访问控制元数据。
 */
router.get('/routing-whitelist', getPublicRouteWhitelist);

/**
 * Public site branding/settings for the frontend header and announcement
 * banner. Only non-sensitive display fields are exposed.
 *
 * 公开站点展示设置：仅暴露站点名称与公告等非敏感字段。
 */
router.get('/site-settings', getPublicSiteSettings);

export default router;
