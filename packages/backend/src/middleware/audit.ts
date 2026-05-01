/**
 * 中间件模块：Audit
 *
 * 函数作用：
 *   审计日志中间件——为管理端写操作提供兜底审计日志记录。
 *   包含脱敏辅助函数，确保审计负载中不包含明文密码、令牌等敏感信息。
 * Purpose:
 *   Audit logging middleware — provides fallback audit logging for admin write operations.
 *   Includes sanitization helpers to ensure audit payloads contain no plain-text passwords or tokens.
 *
 * 中文关键词：
 *   审计，日志，脱敏，管理操作，兜底
 * English keywords:
 *   audit, logging, sanitize, admin operation, fallback
 */
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditApplicationService } from '../registry';
import { RoleName } from '../application/identity/policies/RoleHierarchyPolicy';

const AUDITED_ROLE_NAMES = new Set<RoleName>(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);
const MUTATING_HTTP_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const FALLBACK_AUDIT_OPERATION_KEYS = new Set([
  'POST /api/admin/domain-config',
  'POST /api/admin/routing-whitelist',
  'PUT /api/admin/routing-whitelist/:id',
  'DELETE /api/admin/routing-whitelist/:id',
  'POST /api/admin/moderation/posts/:id/approve',
  'POST /api/admin/moderation/posts/:id/reject',
  'POST /api/admin/moderation/comments/:id/approve',
  'POST /api/admin/moderation/comments/:id/reject',
]);

/**
 * Callers: [shouldWriteFallbackAudit, auditMiddleware]
 * Callees: []
 * Description: Builds a normalized route path using `baseUrl` and the matched Express route path when available.
 * 描述：优先使用 `baseUrl` 与匹配到的 Express 路由模板，构造规范化的请求路径。
 * Variables: `req.baseUrl` 表示路由挂载前缀；`req.route.path` 表示匹配到的路由模板；`normalizedRoutePath` 表示拼接后的路径。
 * 变量：`req.baseUrl` 是挂载前缀；`req.route.path` 是路由模板；`normalizedRoutePath` 是规范化后的路径。
 * Integration: Use this helper before matching audit allowlists or persisting route-level audit metadata.
 * 接入方式：在匹配审计白名单或写入路由级审计元数据前调用本函数。
 * Error Handling: Falls back to `req.path` when Express has not yet attached a matched route template.
 * 错误处理：当 Express 尚未挂载匹配路由模板时，自动回退到 `req.path`。
 * Keywords: audit path, express route, baseUrl, normalize, middleware, 审计路径, 路由模板, 前缀, 规范化, 中间件
 */
function getAuditRoutePath(req: AuthRequest): string {
  const matchedRoutePath = typeof req.route?.path === 'string' ? req.route.path : '';
  const normalizedRoutePath = matchedRoutePath
    ? `${req.baseUrl || ''}${matchedRoutePath}`.replace(/\/{2,}/g, '/')
    : req.path;

  return normalizedRoutePath || req.path;
}

/**
 * Callers: [auditMiddleware]
 * Callees: []
 * Description: Produces a scrubbed request body snapshot that masks sensitive credential-like fields.
 * 描述：生成已脱敏的请求体快照，屏蔽密码和凭证类字段。
 * Variables: `body` 表示原始请求体；`sanitizedBody` 表示脱敏后的请求体副本；`sensitiveField` 表示需要屏蔽的字段名。
 * 变量：`body` 是原始请求体；`sanitizedBody` 是脱敏后的请求体副本；`sensitiveField` 是需要屏蔽的字段名。
 * Integration: Use this helper before serializing request bodies into audit payloads.
 * 接入方式：在把请求体写入审计负载之前调用本函数。
 * Error Handling: Non-object and array payloads are normalized to an empty object to avoid unsafe serialization.
 * 错误处理：非对象或数组请求体会被规范成空对象，避免不安全的序列化行为。
 * Keywords: sanitize, payload, request body, secret, audit, 脱敏, 负载, 请求体, 密钥, 审计
 */
function sanitizeAuditBody(body: unknown): Record<string, unknown> {
  const sanitizedBody =
    body && typeof body === 'object' && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>) }
      : {};

  for (const sensitiveField of ['password', 'oldPassword', 'newPassword', 'token', 'secret']) {
    if (sensitiveField in sanitizedBody) {
      sanitizedBody[sensitiveField] = '***';
    }
  }

  return sanitizedBody;
}

/**
 * Callers: [sanitizeAuditBody]
 * Callees: []
 * Description: Redacts the value of a sensitive field by replacing it with a mask string.
 * 描述：将敏感字段的值替换为脱敏标记字符串。
 * Variables: `sanitized` 表示要修改的脱敏参数对象；`field` 表示字段名。
 * 变量：`sanitized` 是脱敏参数对象；`field` 是字段名。
 * Keywords: redact, sanitize, field, param, mask, 脱敏, 参数, 字段, 屏蔽, 审计
 */
function redactSensitiveField(sanitized: Record<string, unknown>, field: string): void {
  sanitized[field] = '***';
}

/**
 * Callers: [auditMiddleware]
 * Callees: [redactSensitiveField]
 * Description: Produces a scrubbed params snapshot that masks sensitive credential-like fields in query and route params.
 * 描述：生成已脱敏的参数快照，屏蔽查询参数和路由参数中的凭证类字段。
 * Variables: `params` 表示原始参数对象；`sanitized` 表示脱敏后的参数副本；`sensitiveField` 表示需脱敏的字段名列表。
 * 变量：`params` 表示原始参数；`sanitized` 表示脱敏后的副本；`sensitiveField` 表示需脱敏的字段名。
 * Integration: Use this helper before serializing query or route params into audit payloads.
 * 接入方式：在将查询参数或路由参数序列化到审计负载前调用本函数。
 * Error Handling: Non-object params are normalized to an empty object; never throws.
 * 错误处理：非对象参数会被规范化为空对象，不会抛出异常。
 * Keywords: sanitize, params, query, route, audit, mask, 脱敏, 查询参数, 路由参数, 审计
 */
function sanitizeAuditParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...params };

  for (const sensitiveField of ['token', 'secret', 'key', 'accessToken', 'refreshToken', 'password', 'oldPassword', 'newPassword']) {
    if (sensitiveField in sanitized) {
      redactSensitiveField(sanitized, sensitiveField);
    }
  }

  return sanitized;
}
/**
 * Callers: [auditMiddleware]
 * Callees: [getAuditRoutePath]
 * Description: Determines whether the current admin request still needs middleware-level fallback auditing.
 * 描述：判断当前管理端请求是否仍然需要中间件层的兜底审计。
 * Variables: `role` 表示当前用户角色；`routePath` 表示规范化路由路径；`operationKey` 表示 HTTP 方法与路由组合键。
 * 变量：`role` 表示当前用户角色；`routePath` 表示规范化后的路由路径；`operationKey` 表示 HTTP 方法与路由的组合键。
 * Integration: Keep the allowlist limited to admin mutations that are not already audited by domain events or application services.
 * 接入方式：仅把没有被领域事件或应用服务审计覆盖的管理写接口加入允许列表。
 * Error Handling: Returns `false` for non-admin, non-mutating, or already-covered routes instead of throwing.
 * 错误处理：对于非管理端、非写请求或已覆盖的路由直接返回 `false`，不抛异常。
 * Keywords: fallback audit, dedupe, admin route, allowlist, middleware, 兜底审计, 去重, 管理路由, 允许列表, 中间件
 */
function shouldWriteFallbackAudit(req: AuthRequest): boolean {
  const role = req.user?.role as RoleName | undefined;
  if (!role || !AUDITED_ROLE_NAMES.has(role)) {
    return false;
  }

  if (!MUTATING_HTTP_METHODS.has(req.method)) {
    return false;
  }

  const routePath = getAuditRoutePath(req);
  const operationKey = `${req.method} ${routePath}`;
  return FALLBACK_AUDIT_OPERATION_KEYS.has(operationKey);
}

/**
 * Callers: [Express app]
 * Callees: [shouldWriteFallbackAudit, getAuditRoutePath, sanitizeAuditBody, auditApplicationService.logAudit]
 * Description: Writes fallback audit logs only for admin write routes that are not already covered elsewhere.
 * 描述：仅为尚未被其他层覆盖的管理端写操作写入兜底审计日志。
 * Variables: `routePath` 表示规范化路由路径；`operationType` 表示方法与路由组合；`payload` 表示写入审计的上下文负载（body/query/params 均已脱敏）；`ip` 表示请求来源 IP。
 * 变量：`routePath` 是规范化路由路径；`operationType` 是方法与路由组合；`payload` 是审计上下文负载（body/query/params 均已脱敏）；`ip` 是请求来源 IP。
 * Integration: Register this middleware globally before route mounting so it can observe every finished admin response.
 * 接入方式：将本中间件在路由挂载前全局注册，使其可以观察所有管理端请求完成后的响应。
 * Error Handling: Suppresses audit write failures after logging to stderr so admin operations themselves are not blocked.
 * 错误处理：审计写入失败只记录 stderr，不阻断原始管理操作响应。
 * Keywords: audit middleware, admin operation, fallback, dedupe, payload, 审计中间件, 管理操作, 兜底, 去重, 负载
 */
export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  res.on('finish', () => {
    try {
      if (!shouldWriteFallbackAudit(req) || !req.user?.role) {
        return;
      }

      const routePath = getAuditRoutePath(req);
      const operationType = `${req.method} ${routePath}`;
      const payload = {
        body: sanitizeAuditBody(req.body),
        query: sanitizeAuditParams(req.query as Record<string, unknown>),
        params: sanitizeAuditParams(req.params as Record<string, unknown>),
        statusCode: res.statusCode,
      };
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const role = req.user.role as RoleName;

      auditApplicationService.logAudit(
        req.user.userId,
        operationType,
        `Route: ${routePath}`,
        role,
        req.originalUrl,
        ip,
        payload
      ).catch((err) => {
        console.error('Failed to log audit:', err);
      });
    } catch (err) {
      console.error('Audit middleware error:', err);
    }
  });

  next();
};
