import 'server-only'
import type { Locale } from './config'
import { getDictionary } from './get-dictionary'
import type { Dictionary } from '../types'

function pick<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = source[key]
  }
  return result
}

export const getPublicDictionary = async (locale: Locale): Promise<Dictionary> => {
  const dict = await getDictionary(locale)

  return {
    common: pick(dict.common, [
      'searchPlaceholder',
      'newPost',
      'account',
      'categories',
      'categoryTech',
      'categoryLife',
      'categoryQA',
      'toggleLanguage',
      'toggleTheme',
      'loading',
      'cancel',
      'close',
      'settings',
      'logout',
      'confirm',
      'linkCopied',
      'search',
      'noData',
      'total',
      'previous',
      'next',
    ]),
    nav: pick(dict.nav, ['home', 'popular', 'recent', 'wikis']),
    wiki: {},
    auth: pick(dict.auth, ['networkError', 'pleaseLogin']),
    home: pick(dict.home, ['recentDesc', 'popularDesc']),
    twoFactor: {},
    captcha: pick(dict.captcha, [
      'securityVerification',
      'verified',
      'networkError',
      'verificationFailed',
      'serverError',
    ]),
    post: pick(dict.post, [
      'hoursAgo',
      'comments',
      'reply',
      'edited',
      'editPost',
      'deletePost',
      'confirmDeletePost',
      'postDeletedSuccessfully',
    ]),
    profile: pick(dict.profile, [
      'joined',
      'posts',
      'noPostsYet',
      'uncategorized',
      'bookmarks',
      'noBookmarksYet',
      'removeBookmark',
      'commentDeleted',
      'commentOn',
      'postDeleted',
    ]),
    settings: pick(dict.settings, ['saving', 'saveChanges']),
    admin: {},
    apiErrors: {},
    category: pick(dict.category, [
      'postsTitle',
      'showingPostsFor',
      'noPostsFound',
      'noRecentPostsFound',
      'noPopularPostsFound',
      'noPostsFoundGeneral',
      'noCategories',
    ]),
    reauth: {},
    forbidden: {},
    notifications: {},
    messages: pick(dict.messages, ['title']),
    search: pick(dict.search, ['resultsFor', 'noResults', 'users', 'posts']),
    consent: dict.consent,
  } as unknown as Dictionary
}
