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
    captcha: {
      ...pick(dict.captcha, [
        'securityVerification',
        'verified',
        'networkError',
        'verificationFailed',
        'serverError',
        'refresh',
      ]),
      // 联邦验证公开子键（匿名解题必需；沿 21:30 门禁精确白名单思想，仅公开解题渲染所需键）
      geometry: pick(
        (dict.captcha as unknown as Record<string, Record<string, string>[]>)
          .geometry as unknown as Record<string, string>,
        [
          'title',
          'desc',
          'target',
          'current',
          'tolerance',
          'idleCountdown',
          'dragHint',
          'verify',
          'newChallenge',
          'idle',
          'solving',
          'success',
          'failed',
          'timeout',
          'degraded',
          'retry',
          'again',
          'faceValue',
          'targetValue',
        ] as const,
      ),
      pow: pick(
        (dict.captcha as unknown as Record<string, Record<string, string>>)
          .pow as unknown as Record<string, string>,
        [
          'title',
          'desc',
          'bits',
          'bitsHint',
          'start',
          'cancel',
          'downgrade',
          'mining',
          'success',
          'failed',
          'timeout',
          'degraded',
          'fallbackTitle',
          'fallbackGo',
          'expected',
          'challenge',
          'idle',
        ] as const,
      ),
      federal: pick(
        (dict.captcha as unknown as Record<string, Record<string, string>>)
          .federal as unknown as Record<string, string>,
        [
          'modalTitle',
          'modalDesc',
          'switchKind',
          'switchDisabledTip',
          'kindSlider',
          'kindGeometry',
          'kindPow',
          'strengthHint',
          'fallbackToSlider',
          'degradedNote',
          'timeoutNote',
          'loading',
          'verifying',
        ] as const,
      ),
    },
    rateLimitUnlock: pick(dict.rateLimitUnlock, [
      'cardTitle',
      'cardDesc',
      'retryAfter',
      'verifyToUnlock',
      'retryNow',
      'modalTitle',
      'modalDesc',
      'refreshChallenge',
      'unlockSuccess',
      'unlockFailedRetry',
      'exemptedHint',
      'waitWithoutUnlock',
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
    // 公开字典 apiErrors 精确白名单（QA门禁 2026-09-05 [REJECTED] 首选方案a）：
    // 仅透出 3 个匿名可达的限流/验证错误码 —— ERR_VERIFICATION_FAILED /
    // ERR_RATE_LIMITED_NEEDS_CAPTCHA / ERR_RATE_LIMITED。
    // Rationale：3 码本就经匿名 429/400 响应体明文下发（无新增披露），公开字典透出是
    // 匿名双语限流卡（RateLimitCard/UnlockModal SSR+Client）所必需；其余特权码
    //（如 DB 连接失败/CSRF 缺失类）仍禁止透出，
    // 见 tests/rscDictionaryLeak.test.mjs 精确白名单断言。
    // as unknown 兼容 Dictionary 全量类型。
    apiErrors: pick(
      dict.apiErrors as unknown as Record<string, string>,
      ['ERR_VERIFICATION_FAILED', 'ERR_RATE_LIMITED_NEEDS_CAPTCHA', 'ERR_RATE_LIMITED'] as const,
    ) as unknown as Dictionary['apiErrors'],
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
    // 通知徽标合计公开键（登录后 UserNav 求和 tooltip/aria-label 所需；收件箱另立项，不透列表体）
    notifications: pick(dict.notifications, [
      'title',
      'unreadTitle',
      'badgeLabel',
      'badgeAria',
      'badgeTooltip',
    ]),
    messages: pick(dict.messages, ['title']),
    search: pick(dict.search, ['resultsFor', 'noResults', 'users', 'posts']),
    consent: dict.consent,
  } as unknown as Dictionary
}
