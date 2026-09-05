'use client';

/**
 * POST /api/v1/auth/captcha/unlock 兑换助手（F1）。
 * 冻结契约 API-SPEC v1.0.2：入参 { captchaId, dragPath, totalDragTime, finalPosition }，
 * 成功 { unlockToken, exemptMinutes, expiresAt }；失败统一 400 ERR_VERIFICATION_FAILED；
 * 自身超限 429 为通用体 { error: ERR_RATE_LIMITED }（无 unlockRequired，不进解锁循环）。
 * 浏览器统一走相对 /api/* 经 BFF 代理，禁止直拼后端 URL。
 */

export interface UnlockDragPoint {
  x: number;
  y: number;
  t: number;
}

export interface UnlockRequest {
  captchaId: string;
  dragPath: UnlockDragPoint[];
  totalDragTime: number;
  finalPosition: number;
}

export interface UnlockSuccess {
  unlockToken: string;
  exemptMinutes: number;
  expiresAt: string;
}

export class UnlockFailedError extends Error {
  constructor(message = 'ERR_VERIFICATION_FAILED') {
    super(message);
    this.name = 'UnlockFailedError';
  }
}

export class UnlockCooldownError extends Error {
  readonly retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super('ERR_RATE_LIMITED');
    this.name = 'UnlockCooldownError';
    this.retryAfterSec = retryAfterSec;
  }
}

function readRetryAfter(res: Response): number {
  const v = res.headers.get('Retry-After');
  const n = v !== null ? Number(v) : NaN;
  if (Number.isFinite(n) && (n as number) >= 0) return Math.floor(n as number);
  return 60;
}

export async function postUnlock(payload: UnlockRequest): Promise<UnlockSuccess> {
  const res = await fetch('/api/v1/auth/captcha/unlock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<UnlockSuccess>;
    if (
      typeof data.unlockToken === 'string' &&
      typeof data.expiresAt === 'string' &&
      typeof data.exemptMinutes === 'number'
    ) {
      return {
        unlockToken: data.unlockToken,
        exemptMinutes: data.exemptMinutes,
        expiresAt: data.expiresAt,
      };
    }
    throw new UnlockFailedError('ERR_VERIFICATION_FAILED');
  }
  if (res.status === 429) {
    // 兑换端点自身超限：通用限流体，不含 unlockRequired，进入 cooldown 态
    throw new UnlockCooldownError(readRetryAfter(res));
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new UnlockFailedError(typeof body.error === 'string' ? body.error : 'ERR_VERIFICATION_FAILED');
}
