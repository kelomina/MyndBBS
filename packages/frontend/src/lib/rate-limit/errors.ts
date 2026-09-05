/**
 * 结构化限流错误（F2）。
 * 仅当后端返回 429 + { error:'ERR_RATE_LIMITED_NEEDS_CAPTCHA', unlockRequired:true } 时抛出，
 * 保留 status / Retry-After / retryAfterSec / unlockRequired / unlockEndpoint，供限流卡与解锁弹窗使用。
 * POST /unlock 自身 429 为通用体 { error:'ERR_RATE_LIMITED' }（无 unlockRequired），
 * 必须走普通 Error 分支，避免误入解锁循环。
 */

export const UNLOCK_ENDPOINT = '/api/v1/auth/captcha/unlock';
export const UNLOCK_REQUIRED_CODE = 'ERR_RATE_LIMITED_NEEDS_CAPTCHA';

export interface RateLimitErrorDetails {
  status: number;
  /** 后端体 retryAfterSec（秒），回退为 Retry-After 头，再回退 60 */
  retryAfterSec: number;
  unlockRequired: true;
  unlockEndpoint: string;
  /** 原始 Retry-After 头（可能缺失） */
  retryAfterHeader: string | null;
}

export class RateLimitError extends Error {
  readonly status = 429;
  readonly code = UNLOCK_REQUIRED_CODE;
  readonly retryAfterSec: number;
  readonly unlockRequired = true as const;
  readonly unlockEndpoint: string;
  readonly retryAfterHeader: string | null;

  constructor(details: Omit<RateLimitErrorDetails, 'status' | 'unlockRequired'> & { status?: number }) {
    super(UNLOCK_REQUIRED_CODE);
    this.name = 'RateLimitError';
    this.retryAfterSec = details.retryAfterSec;
    this.unlockEndpoint = details.unlockEndpoint;
    this.retryAfterHeader = details.retryAfterHeader;
    if (details.status !== undefined) {
      (this as { status: number }).status = details.status;
    }
  }
}

export function isRateLimitError(err: unknown): err is RateLimitError {
  return err instanceof RateLimitError;
}

/** 从 429 Response + 已解析 body 中提取 unlockRequired 限流细节；非解锁型返回 null。 */
export function parseRateLimitDetails(
  res: Response,
  body: Record<string, unknown> | null | undefined,
): RateLimitErrorDetails | null {
  if (res.status !== 429) return null;
  if (!body || body.error !== UNLOCK_REQUIRED_CODE || body.unlockRequired !== true) return null;
  const headerVal = res.headers.get('Retry-After');
  const fromHeader = headerVal !== null ? Number(headerVal) : NaN;
  const fromBody = typeof body.retryAfterSec === 'number' ? body.retryAfterSec : Number(body.retryAfterSec);
  const retryAfterSec =
    Number.isFinite(fromBody) && (fromBody as number) >= 0
      ? Math.floor(fromBody as number)
      : Number.isFinite(fromHeader) && fromHeader >= 0
        ? Math.floor(fromHeader)
        : 60;
  const unlockEndpoint =
    typeof body.unlockEndpoint === 'string' && body.unlockEndpoint.length > 0
      ? body.unlockEndpoint
      : UNLOCK_ENDPOINT;
  return {
    status: res.status,
    retryAfterSec,
    unlockRequired: true,
    unlockEndpoint,
    retryAfterHeader: headerVal,
  };
}
