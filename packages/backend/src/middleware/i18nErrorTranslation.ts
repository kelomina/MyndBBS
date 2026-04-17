import type { NextFunction, Request, Response } from 'express';
import { resolveRequestLocale, translateErrorCode } from '../i18n/errors';

/**
 * Callers: [src/index.ts]
 * Callees: [resolveRequestLocale, translateErrorCode, bind]
 * Description: Adds a localized `message` for JSON error responses that contain `error` codes.
 * Keywords: i18n, middleware, error, translation, express
 */
export function i18nErrorTranslationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = ((body?: unknown) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const maybeError = (body as any).error;
      const maybeMessage = (body as any).message;

      if (typeof maybeError === 'string' && (!maybeMessage || typeof maybeMessage !== 'string')) {
        const locale = resolveRequestLocale(req);
        const translated = translateErrorCode(maybeError, locale);
        return originalJson({ ...(body as any), message: translated });
      }
    }

    return originalJson(body as any);
  }) as any;

  next();
}

