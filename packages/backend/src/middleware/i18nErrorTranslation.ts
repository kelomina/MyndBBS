/**
 * 中间件模块：i18nErrorTranslation
 *
 * 函数作用：
 *   拦截 res.json()，自动将以 ERR_ 开头的 error 字段通过 i18next 翻译为用户友好消息。
 * Purpose:
 *   Intercepts res.json() to automatically translate ERR_-prefixed error fields via i18next.
 *
 * 中文关键词：
 *   国际化，错误翻译，中间件，i18n
 * English keywords:
 *   i18n, error translation, middleware
 */
import { Request, Response, NextFunction } from 'express';

/**
 * 函数名称：i18nErrorTranslationMiddleware
 *
 * 函数作用：
 *   重写 res.json 方法——当响应体包含 ERR_ 前缀的错误码且 req.t 可用时，
 *   自动从 i18next 错误字典中获取翻译原文，附加到 body.message 字段。
 * Purpose:
 *   Overrides res.json — when the response body contains an ERR_-prefixed error code
 *   and req.t is available, automatically looks up the translation from i18next
 *   error dictionary and attaches it to body.message.
 *
 * 调用方 / Called by:
 *   Express app（全局注册在 index.ts）
 *
 * 被调用方 / Calls:
 *   - req.t（i18next 翻译函数）
 *   - res.json（原始 JSON 方法）
 *
 * 参数说明 / Parameters:
 *   - req: Request, Express 请求对象（含 req.t 翻译函数）
 *   - res: Response, Express 响应对象
 *   - next: NextFunction, Express 下一步
 *
 * 返回值说明 / Returns:
 *   void——通过 next() 继续中间件链
 *
 * 错误处理 / Error handling:
 *   翻译失败时保留原始错误码，不阻断响应
 *
 * 副作用 / Side effects:
 *   修改 res.json 的行为——在响应体中插入翻译后的 message 字段
 *
 * 中文关键词：
 *   国际化，错误翻译，res.json，i18next，中间件
 * English keywords:
 *   i18n, error translation, res.json, i18next, middleware
 */
export function i18nErrorTranslationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: any): Response => {
    if (
      body &&
      typeof body === 'object' &&
      typeof body.error === 'string' &&
      body.error.startsWith('ERR_') &&
      typeof req.t === 'function'
    ) {
      if (!body.message) {
        const translated = req.t(body.error, { ns: 'errors' });
        // i18next returns the key if no translation is found. 
        body.message = translated !== body.error ? translated : body.error;
      }
    }

    return originalJson(body);
  };

  next();
}
