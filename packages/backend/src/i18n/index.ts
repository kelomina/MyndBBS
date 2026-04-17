import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';

/**
 * Callers: [App Startup]
 * Callees: [i18next.use, init]
 * Description: Initializes the i18next instance for the application using file system resources.
 * Keywords: i18next, initialize, localization, translation
 */
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
    },
    fallbackLng: 'en',
    preload: ['en', 'zh'],
    ns: ['errors'],
    defaultNS: 'errors',
    detection: {
      order: ['header', 'cookie'],
      lookupHeader: 'x-locale',
      lookupCookie: 'NEXT_LOCALE',
      caches: false
    }
  });

export { i18next, middleware as i18nextMiddleware };
