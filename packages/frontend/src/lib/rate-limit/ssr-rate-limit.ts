/**
 * SSR 429 解析助手（F2/F3，服务端安全，无浏览器 API）。
 * 仅当 status 429 + 体 { error:'ERR_RATE_LIMITED_NEEDS_CAPTCHA', unlockRequired:true } 时返回限流信息，
 * 其余（正常/通用 429/其他错误）返回 null，调用方回落原空态/错误态。
 * 注意：会消费 Response body（仅在 !res.ok 分支调用，不影响正常 posts 解析）。
 */

export interface SsrRateLimitInfo {
  retryAfterSec: number;
}

function toRetryAfterSec(bodyRetry: unknown, headerVal: string | null): number {
  const fromBody = typeof bodyRetry === 'number' ? bodyRetry : Number(bodyRetry);
  if (Number.isFinite(fromBody) && (fromBody as number) >= 0) return Math.floor(fromBody as number);
  const fromHeader = headerVal !== null ? Number(headerVal) : NaN;
  if (Number.isFinite(fromHeader) && fromHeader >= 0) return Math.floor(fromHeader);
  return 60;
}

export async function getSsrRateLimitInfo(res: Response): Promise<SsrRateLimitInfo | null> {
  if (res.status !== 429) return null;
  const retryHeader = res.headers.get('Retry-After');
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (body?.error !== 'ERR_RATE_LIMITED_NEEDS_CAPTCHA' || body?.unlockRequired !== true) {
      return null;
    }
    return { retryAfterSec: toRetryAfterSec(body.retryAfterSec, retryHeader) };
  } catch {
    // 体不可解析时不判为解锁型限流（避免误弹），回落空态；若需按头展示倒计时，调用方可自行用头
    // 为稳妥：若状态 429 但体不可读，仍返回按头计算的限流信息？冻结契约要求体必含 unlockRequired，
    // 无体则不进解锁流程，返回 null。
    return null;
  }
}
