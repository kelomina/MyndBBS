export type CookiePreferences = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

export type CookiePreferenceSource = 'remote' | 'local' | 'none';

export type CookiePreferenceReconciliationResult = {
  preferences: CookiePreferences | null;
  shouldOpenModal: boolean;
  source: CookiePreferenceSource;
  accountSyncAttempted: boolean;
};

type RemoteCookiePreferencesResult = {
  isReachable: boolean;
  preferences: CookiePreferences | null;
};

export const COOKIE_CONSENT_STORAGE_KEY = 'myndbbs_cookie_consent';

export const DEFAULT_COOKIE_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

/**
 * Callers: [readStoredCookiePreferences, persistCookiePreferences, saveCookiePreferences, reconcileCookiePreferences, CookieConsentModal, PrivacySettings]
 * Callees: []
 * Description: Normalizes arbitrary preference payloads into the strict cookie-preference shape shared by the consent modal, settings page, browser storage, and account sync API.
 * 描述：把任意偏好载荷归一化为同意弹窗、设置页、浏览器存储和账号同步接口共用的严格 Cookie 偏好结构。
 * Variables: `rawValue` 表示待归一化的输入；`source` 表示对象化后的原始数据。
 * 变量：`rawValue` 表示待归一化的输入；`source` 表示对象化后的原始数据。
 * Integration: Import this helper before writing cookie preferences into React state, localStorage, or API payloads.
 * 接入方式：在把 Cookie 偏好写入 React 状态、localStorage 或接口请求体之前，引入并调用本函数。
 * Error Handling: Non-object inputs degrade to the default preference shape instead of throwing.
 * 错误处理：非对象输入会自动退化为默认偏好结构，不会抛出异常。
 * Keywords: cookie preferences, normalize, shared state, storage, account sync, Cookie 偏好, 归一化, 共享状态, 存储, 账号同步
 */
export function normalizeCookiePreferences(rawValue: unknown): CookiePreferences {
  const source =
    rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? (rawValue as Record<string, unknown>)
      : {};

  return {
    essential: true,
    analytics: Boolean(source.analytics),
    marketing: Boolean(source.marketing),
  };
}

/**
 * Callers: [reconcileCookiePreferences, CookieConsentModal, PrivacySettings]
 * Callees: [normalizeCookiePreferences]
 * Description: Reads the locally stored cookie preferences from browser storage and converts them into the shared UI shape.
 * 描述：从浏览器本地存储读取 Cookie 偏好，并转换成前端共用的界面结构。
 * Variables: `storedValue` 表示 localStorage 中读取到的原始字符串。
 * 变量：`storedValue` 表示 localStorage 中读取到的原始字符串。
 * Integration: Call this helper during client-side cookie reconciliation before deciding whether to open the consent modal.
 * 接入方式：在客户端执行 Cookie 对账流程时，先调用本函数，再决定是否打开同意弹窗。
 * Error Handling: Invalid JSON is removed from localStorage and treated as missing consent data.
 * 错误处理：遇到无效 JSON 时会删除本地存储中的坏数据，并按“未记录偏好”处理。
 * Keywords: local storage, cookie consent, parse, browser, fallback, 本地存储, Cookie 同意, 解析, 浏览器, 回退
 */
export function readStoredCookiePreferences(): CookiePreferences | null {
  const storedValue = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeCookiePreferences(JSON.parse(storedValue));
  } catch {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    return null;
  }
}

/**
 * Callers: [fetchRemoteCookiePreferences, saveCookiePreferences, reconcileCookiePreferences, CookieConsentModal, PrivacySettings]
 * Callees: [normalizeCookiePreferences]
 * Description: Writes normalized cookie preferences into browser storage so the current device reuses the same consent state.
 * 描述：把归一化后的 Cookie 偏好写入浏览器本地存储，让当前设备复用同一份同意状态。
 * Variables: `preferences` 表示需要持久化到浏览器的 Cookie 偏好。
 * 变量：`preferences` 表示需要持久化到浏览器的 Cookie 偏好。
 * Integration: Use this helper when the user saves preferences locally or when account preferences are synchronized down to the device.
 * 接入方式：当用户本地保存偏好，或把账号偏好下行同步到设备时，调用本函数。
 * Error Handling: Relies on browser storage availability inside client components and does not swallow storage exceptions.
 * 错误处理：依赖客户端组件中的浏览器存储能力，不额外吞掉存储异常。
 * Keywords: write storage, cookie consent, device sync, local cache, browser, 写入存储, Cookie 同意, 设备同步, 本地缓存, 浏览器
 */
export function writeStoredCookiePreferences(preferences: CookiePreferences): void {
  localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(normalizeCookiePreferences(preferences))
  );
}

/**
 * Callers: [reconcileCookiePreferences, CookieConsentModal, PrivacySettings]
 * Callees: [fetch, normalizeCookiePreferences]
 * Description: Reads the signed-in account profile and extracts remote cookie preferences when the backend session is reachable.
 * 描述：在后端会话可访问时，读取已登录账号资料并提取远端 Cookie 偏好。
 * Variables: `response` 表示用户资料接口响应；`data` 表示解析后的资料体。
 * 变量：`response` 表示用户资料接口响应；`data` 表示解析后的资料体。
 * Integration: Call this helper before deciding whether local preferences must backfill the account or the consent modal should open.
 * 接入方式：在决定是否用本地偏好回填账号，或者是否打开同意弹窗之前，先调用本函数。
 * Error Handling: Returns `{ isReachable: false }` on network failures or non-2xx responses so callers can safely fall back to local state.
 * 错误处理：网络失败或非 2xx 响应时会返回 `{ isReachable: false }`，调用方可安全回退到本地状态。
 * Keywords: profile fetch, remote preferences, account state, session, fallback, 资料读取, 远端偏好, 账号状态, 会话, 回退
 */
export async function fetchRemoteCookiePreferences(): Promise<RemoteCookiePreferencesResult> {
  try {
    const response = await fetch('/api/v1/user/profile', { credentials: 'include' });
    if (!response.ok) {
      return { isReachable: false, preferences: null };
    }

    const data = await response.json();
    const preferences = data.user?.cookiePreferences
      ? normalizeCookiePreferences(data.user.cookiePreferences)
      : null;

    return {
      isReachable: true,
      preferences,
    };
  } catch {
    return { isReachable: false, preferences: null };
  }
}

/**
 * Callers: [reconcileCookiePreferences, saveCookiePreferences, CookieConsentModal, PrivacySettings]
 * Callees: [fetch, normalizeCookiePreferences]
 * Description: Persists cookie preferences to the signed-in account when the backend session is available.
 * 描述：在后端会话可用时，把 Cookie 偏好持久化到已登录账号。
 * Variables: `preferences` 表示要同步到账号的偏好；`response` 表示接口响应结果。
 * 变量：`preferences` 表示要同步到账号的偏好；`response` 表示接口响应结果。
 * Integration: Call this helper after local consent is recorded or when local consent must backfill an empty server-side profile.
 * 接入方式：在本地记录同意结果之后，或需要用本地偏好回填空白服务端资料时，调用本函数。
 * Error Handling: Returns `false` on network failures or non-2xx responses so callers can safely preserve local-only state.
 * 错误处理：网络失败或非 2xx 响应时返回 `false`，调用方可以安全保留本地状态。
 * Keywords: account sync, cookie API, fetch, persistence, profile, 账号同步, Cookie 接口, 请求, 持久化, 资料
 */
export async function persistCookiePreferences(preferences: CookiePreferences): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/user/cookie-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      body: JSON.stringify({ preferences: normalizeCookiePreferences(preferences) }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Callers: [CookieConsentModal, PrivacySettings]
 * Callees: [readStoredCookiePreferences, fetchRemoteCookiePreferences, writeStoredCookiePreferences, persistCookiePreferences]
 * Description: Reconciles cookie preferences between device storage and the signed-in account, then tells the UI whether a consent modal is still required.
 * 描述：在设备本地存储与登录账号之间对账 Cookie 偏好，并告知界面是否仍需展示同意弹窗。
 * Variables: `localPreferences` 表示设备本地偏好；`remoteResult` 表示远端资料读取结果；`remotePreferences` 表示服务端偏好。
 * 变量：`localPreferences` 表示设备本地偏好；`remoteResult` 表示远端资料读取结果；`remotePreferences` 表示服务端偏好。
 * Integration: Use this helper in client components that need a single source of truth for privacy preferences before rendering.
 * 接入方式：在需要“单一偏好真相源”的客户端组件中调用本函数，再决定渲染状态。
 * Error Handling: Falls back to local preferences when the profile API is unavailable, and only requests the modal when neither local nor remote consent exists.
 * 错误处理：当资料接口不可用时会回退到本地偏好；只有本地和远端都没有有效同意时才要求展示弹窗。
 * Keywords: reconcile, consent modal, local state, remote state, privacy, 对账, 同意弹窗, 本地状态, 远端状态, 隐私
 */
export async function reconcileCookiePreferences(): Promise<CookiePreferenceReconciliationResult> {
  const localPreferences = readStoredCookiePreferences();
  const remoteResult = await fetchRemoteCookiePreferences();
  const remotePreferences = remoteResult.preferences;

  if (remoteResult.isReachable && remotePreferences) {
    writeStoredCookiePreferences(remotePreferences);
    return {
      preferences: remotePreferences,
      shouldOpenModal: false,
      source: 'remote',
      accountSyncAttempted: false,
    };
  }

  if (remoteResult.isReachable && localPreferences) {
    const accountSyncAttempted = await persistCookiePreferences(localPreferences);
    return {
      preferences: localPreferences,
      shouldOpenModal: false,
      source: 'local',
      accountSyncAttempted,
    };
  }

  if (localPreferences) {
    return {
      preferences: localPreferences,
      shouldOpenModal: false,
      source: 'local',
      accountSyncAttempted: false,
    };
  }

  return {
    preferences: null,
    shouldOpenModal: true,
    source: 'none',
    accountSyncAttempted: false,
  };
}

/**
 * Callers: [CookieConsentModal, PrivacySettings]
 * Callees: [normalizeCookiePreferences, writeStoredCookiePreferences, persistCookiePreferences]
 * Description: Saves cookie preferences through the shared local-plus-account flow so every client surface persists consent consistently.
 * 描述：通过统一的“本地加账号”流程保存 Cookie 偏好，确保所有客户端入口都以一致方式持久化同意状态。
 * Variables: `preferences` 表示待保存的偏好；`normalizedPreferences` 表示归一化后的最终保存值。
 * 变量：`preferences` 表示待保存的偏好；`normalizedPreferences` 表示归一化后的最终保存值。
 * Integration: Replace duplicated localStorage plus fetch logic in client components with this helper.
 * 接入方式：用本函数替换客户端组件里重复的 localStorage 加 fetch 保存逻辑。
 * Error Handling: Always writes to local storage first, then returns the remote sync result so callers can decide whether to surface an account-sync warning.
 * 错误处理：总是先写入本地存储，再返回远端同步结果，调用方可据此决定是否提示账号同步失败。
 * Keywords: save preferences, shared flow, browser cache, remote sync, consent, 保存偏好, 共享流程, 浏览器缓存, 远端同步, 同意
 */
export async function saveCookiePreferences(preferences: CookiePreferences): Promise<boolean> {
  const normalizedPreferences = normalizeCookiePreferences(preferences);
  writeStoredCookiePreferences(normalizedPreferences);
  return persistCookiePreferences(normalizedPreferences);
}
