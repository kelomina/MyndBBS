import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries.en();
};
