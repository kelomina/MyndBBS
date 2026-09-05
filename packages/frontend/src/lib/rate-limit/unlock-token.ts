/**
 * 读限流解锁凭证（unlockToken）的前端持久化。
 * 冻结载体：请求头 X-RateLimit-Unlock 唯一，不引入 Cookie（API-SPEC x-unlock-token.carrierFrozen）。
 * 存储：localStorage（header-only，SSR 不可用时内存回退）；附带 expiresAt 过期自洁。
 */

const STORAGE_KEY = 'myndbbs_ratelimit_unlock';
const HEADER_NAME = 'X-RateLimit-Unlock';

interface StoredUnlock {
  token: string;
  expiresAt: string;
  exemptMinutes: number;
}

let memoryFallback: StoredUnlock | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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
}

export function loadUnlockToken(): StoredUnlock | null {
  let record: StoredUnlock | null = memoryFallback;
  if (isBrowser()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUnlock;
        if (parsed && typeof parsed.token === 'string' && typeof parsed.expiresAt === 'string') {
          record = parsed;
          memoryFallback = parsed;
        }
      }
    } catch {
      // 解析失败则视为无凭证
    }
  }
  if (!record) return null;
  const exp = Date.parse(record.expiresAt);
  if (Number.isNaN(exp) || exp <= Date.now()) {
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
}
