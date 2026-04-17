import type { Request } from 'express';

export type SupportedLocale = 'en' | 'zh';

type ErrorDictionary = Record<string, string>;

const EN_ERRORS: ErrorDictionary = {
  ERR_INTERNAL_SERVER_ERROR: 'Internal server error',
  ERR_BAD_REQUEST: 'Bad request',
  ERR_UNAUTHORIZED: 'Unauthorized',
  ERR_FORBIDDEN: 'Forbidden',
  ERR_NOT_FOUND: 'Not found',
  ERR_CORS_NOT_ALLOWED: 'Origin not allowed by CORS policy',
  ERR_CSRF_TOKEN_MISSING_OR_INVALID: 'CSRF token missing or invalid',
  ERR_MISSING_DATABASE_URL: 'Missing DATABASE_URL',
  ERR_INSTALL_TOKEN_INVALID_OR_MISSING: 'Invalid or missing install token',
  ERR_MISSING_REQUIRED_INSTALL_FIELDS: 'Missing required installation fields',
  ERR_DB_CONNECTION_FAILED: 'Database connection failed',
  ERR_INVALID_DOMAIN_CONFIG: 'Invalid domain configuration',
  ERR_FAILED_TO_FETCH_ROUTE_WHITELIST: 'Failed to fetch route whitelist',
  ERR_ROUTE_WHITELIST_PATH_REQUIRED: 'Path is required',
  ERR_FAILED_TO_ADD_ROUTE_WHITELIST: 'Failed to add route whitelist',
  ERR_FAILED_TO_UPDATE_ROUTE_WHITELIST: 'Failed to update route whitelist',
  ERR_FAILED_TO_DELETE_ROUTE_WHITELIST: 'Failed to delete route whitelist',
};

const ZH_ERRORS: ErrorDictionary = {
  ERR_INTERNAL_SERVER_ERROR: '内部服务器错误',
  ERR_BAD_REQUEST: '请求参数错误',
  ERR_UNAUTHORIZED: '未授权',
  ERR_FORBIDDEN: '无权限',
  ERR_NOT_FOUND: '资源不存在',
  ERR_CORS_NOT_ALLOWED: '跨域请求被拒绝',
  ERR_CSRF_TOKEN_MISSING_OR_INVALID: 'CSRF 校验失败',
  ERR_MISSING_DATABASE_URL: '缺少 DATABASE_URL',
  ERR_INSTALL_TOKEN_INVALID_OR_MISSING: '未授权：安装令牌无效或缺失',
  ERR_MISSING_REQUIRED_INSTALL_FIELDS: '缺少安装必填字段',
  ERR_DB_CONNECTION_FAILED: '数据库连接失败，请检查连接或权限',
  ERR_INVALID_DOMAIN_CONFIG: '无效的域名配置',
  ERR_FAILED_TO_FETCH_ROUTE_WHITELIST: '获取路由白名单失败',
  ERR_ROUTE_WHITELIST_PATH_REQUIRED: '缺少 path',
  ERR_FAILED_TO_ADD_ROUTE_WHITELIST: '新增路由白名单失败',
  ERR_FAILED_TO_UPDATE_ROUTE_WHITELIST: '更新路由白名单失败',
  ERR_FAILED_TO_DELETE_ROUTE_WHITELIST: '删除路由白名单失败',
};

const DICTS: Record<SupportedLocale, ErrorDictionary> = {
  en: EN_ERRORS,
  zh: ZH_ERRORS,
};

/**
 * Callers: [i18nErrorTranslationMiddleware]
 * Callees: [cookie, toLowerCase, split, includes]
 * Description: Resolves the best-effort locale for a request based on headers/cookies.
 * Keywords: i18n, locale, request, resolve
 */
export function resolveRequestLocale(req: Request): SupportedLocale {
  const headerLocaleRaw = req.headers['x-locale'];
  const headerLocale = Array.isArray(headerLocaleRaw) ? headerLocaleRaw[0] : headerLocaleRaw;

  const cookieLocaleRaw = (req as any).cookies?.NEXT_LOCALE;
  const cookieLocale = typeof cookieLocaleRaw === 'string' ? cookieLocaleRaw : undefined;

  const acceptLanguage = typeof req.headers['accept-language'] === 'string' ? req.headers['accept-language'] : '';

  const candidates = [headerLocale, cookieLocale, acceptLanguage]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => v.toLowerCase());

  for (const candidate of candidates) {
    if (candidate === 'zh' || candidate.startsWith('zh-')) return 'zh';
    if (candidate === 'en' || candidate.startsWith('en-')) return 'en';
  }

  return 'en';
}

/**
 * Callers: [i18nErrorTranslationMiddleware]
 * Callees: []
 * Description: Translates an error code into a localized message (fallbacks to code).
 * Keywords: i18n, error, translate
 */
export function translateErrorCode(errorCode: string, locale: SupportedLocale): string {
  return DICTS[locale]?.[errorCode] ?? errorCode;
}

