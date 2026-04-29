import { Router } from 'express';
import { getRouteWhitelist } from '../controllers/admin';

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
router.get('/routing-whitelist', getRouteWhitelist);

export default router;
