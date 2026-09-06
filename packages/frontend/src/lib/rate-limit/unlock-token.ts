/**
 * 读限流解锁凭证（unlockToken）的前端持久化。
 * B1 生产修复：localStorage + Cookie 双写、兼容读，使 SSR 与客户端同状态。
 * - 冻结载体仍为请求头 X-RateLimit-Unlock 唯一（Cookie 仅为同源持久化手段，不作为后端鉴别载体；
 *   SSR 经 serverFetch 读 Cookie 再附头，后端仍只认头，BFF 零改）。
 * - 存储：localStorage（header-only，主）+ document.cookie（SSR 可读，Max-Age 随 expiresAt）+ 内存回退；
 *   附带 expiresAt 过期自洁；读侧 localStorage 优先、Cookie 兼容回填（老用户 localStorage 仅存时自动补 Cookie）。
 */

const STORAGE_KEY = 'myndbbs_ratelimit_unlock';
const HEADER_NAME = 'X-RateLimit-Unlock';

/** SSR 可读的同源持久化 Cookie 名（与 STORAGE_KEY 同值，单源见 UNLOCK_COOKIE_NAME）。 */
export const UNLOCK_COOKIE_NAME = STORAGE_KEY;

interface StoredUnlock {
  token: string;
  expiresAt: string;
  exemptMinutes: number;
}

let memoryFallback: StoredUnlock | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isExpiredRecord(record: StoredUnlock): boolean {
  const exp = Date.parse(record.expiresAt);
  return Number.isNaN(exp) || exp <= Date.now();
}

function parseStoredRecord(raw: string): StoredUnlock | null {
  try {
    const parsed = JSON.parse(raw) as StoredUnlock;
    if (parsed && typeof parsed.token === 'string' && typeof parsed.expiresAt === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** 读 document.cookie 中本键原始值（未找到返回 null；SSR 下恒 null）。 */
function readCookieRaw(): string | null {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') return null;
  const prefix = `${UNLOCK_COOKIE_NAME}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

/** 写同源 Cookie（Max-Age 随 expiresAt，Path=/ + SameSite=Lax；JS 可读写，不设服务端独占标记）。 */
function writeCookieRecord(record: StoredUnlock): void {
  if (typeof document === 'undefined') return;
  try {
    const exp = Date.parse(record.expiresAt);
    const maxAgeSec = Number.isFinite(exp) ? Math.max(0, Math.floor((exp - Date.now()) / 1000)) : 0;
    if (maxAgeSec <= 0) {
      deleteCookieRecord();
      return;
    }
    const encoded = encodeURIComponent(JSON.stringify(record));
    document.cookie = `${UNLOCK_COOKIE_NAME}=${encoded}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
  } catch {
    // Cookie 写失败时仅保留 localStorage/内存，不抛错
  }
}

/** 删同源 Cookie（过期自洁/登出清理用）。 */
function deleteCookieRecord(): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${UNLOCK_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    // 忽略清理失败
  }
}

export function getUnlockHeaderName(): string {
  return HEADER_NAME;
}

export function saveUnlockToken(input: { unlockToken: string; expiresAt: string; exemptMinutes: number }): void {
  const record: StoredUnlock = {
    token: input.unlockToken,
    expiresAt: input.expiresAt,
    exemptMinutes: input.exemptMinutes,
  };
  memoryFallback = record;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 配额/隐私模式失败时仅保留内存回退，不抛错
  }
  // B1 双写：同步写 Cookie 供下次 SSR（serverFetch 经 Cookie 附头），老端仅读 localStorage 仍兼容
  writeCookieRecord(record);
}

export function loadUnlockToken(): StoredUnlock | null {
  let record: StoredUnlock | null = memoryFallback;
  let localValid: StoredUnlock | null = null;
  let cookieValid: StoredUnlock | null = null;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseStoredRecord(raw);
        if (parsed && !isExpiredRecord(parsed)) {
          localValid = parsed;
          memoryFallback = parsed;
        }
      }
    } catch {
      // 解析失败则视为无凭证
    }
    // Cookie 兼容读：localStorage 缺失/过期时回填；localStorage 有效但 Cookie 缺失时补写（老用户迁移）
    try {
      const cookieRaw = readCookieRaw();
      if (cookieRaw) {
        const decoded = decodeURIComponent(cookieRaw);
        const parsed = parseStoredRecord(decoded);
        if (parsed && !isExpiredRecord(parsed)) {
          cookieValid = parsed;
        }
      }
    } catch {
      // 解析失败则视为无凭证
    }
    if (localValid && !isExpiredRecord(localValid)) {
      record = localValid;
      // 迁移补写：Cookie 缺失/过期但 localStorage 有效时补 Cookie，使下次 SSR 同状态
      if (!cookieValid) {
        writeCookieRecord(localValid);
      }
    } else if (cookieValid && !isExpiredRecord(cookieValid)) {
      record = cookieValid;
      memoryFallback = cookieValid;
      // 回填 localStorage，保持双端一致
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cookieValid));
      } catch {
        // 忽略回填失败
      }
    } else if (record && !isExpiredRecord(record)) {
      // 双端均无有效值时保留内存回退（仍有效才用）
    } else {
      record = null;
    }
  }
  if (!record) return null;
  if (isExpiredRecord(record)) {
    clearUnlockToken();
    return null;
  }
  return record;
}

/** 取出可直接附到读请求头的有效 token，无效/过期返回 null。 */
export function getValidUnlockToken(): string | null {
  return loadUnlockToken()?.token ?? null;
}

export function clearUnlockToken(): void {
  memoryFallback = null;
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略清理失败
  }
  // B1 双写清理：同步清 Cookie，避免 SSR 仍附旧头
  deleteCookieRecord();
}
