import { Request, Response, NextFunction } from 'express';

/**
 * Callers: [App Router]
 * Callees: [res.json, req.t]
 * Description: Intercepts res.json() to automatically translate 'error' fields using i18next if they start with 'ERR_'.
 * Keywords: i18n, error, translation, middleware
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
