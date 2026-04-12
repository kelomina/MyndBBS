import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  /**
   * Callers: [getDictionary]
   * Callees: [import, then]
   * Description: Dynamically imports the English dictionary.
   * Keywords: dictionary, english, i18n, import
   */
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  /**
   * Callers: [getDictionary]
   * Callees: [import, then]
   * Description: Dynamically imports the Chinese dictionary.
   * Keywords: dictionary, chinese, i18n, import
   */
  zh: () => import('./dictionaries/zh.json').then((module) => module.default),
};

/**
 * Callers: []
 * Callees: [en]
 * Description: Handles the get dictionary logic for the application.
 * Keywords: getdictionary, get, dictionary, auto-annotated
 */
export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries.en();
};
