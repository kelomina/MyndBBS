import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
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
