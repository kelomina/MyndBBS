'use client';

/**
 * 联邦验证 BFF 相对路径封装（冻结契约 API-SPEC-TAG-CAPTCHA-NOTIFY.yaml v1.0.0 + 02:00 演示批准增量）。
 * 浏览器统一走相对 /api/* 经 BFF 代理，禁直拼后端 URL；BFF 零改（自定义头自然透传）。
 * solution 形状以后者为准：geometry {microSlot:0–1559, behaviorSamples:[{t,x,y}]}（02:00 增量，替代契约 angleDeg）。
 */

export type FederalKind = 'slider' | 'geometry' | 'pow';

export interface FederalSliderIssue {
  captchaId: string;
  kind: 'slider';
  image: string;
  strength?: 'low' | 'normal' | 'strict';
  expiresInSec: number;
}

export interface FederalGeometryPuzzle {
  svg: string;
  targetHint?: string;
  /** 02:00 增量假设字段（后端增量透出；缺失则前端回落 slider-low，见 channel-api CONSULT）： */
  targetHour?: number;
  perm?: number[];
}

export interface FederalGeometryIssue {
  captchaId: string;
  kind: 'geometry';
  puzzleType: 'rotation';
  puzzle: FederalGeometryPuzzle;
  geometryLevel: number;
  strength: 'low' | 'normal' | 'strict';
  expiresInSec: number;
}

export interface FederalPowIssue {
  captchaId: string;
  kind: 'pow';
  challenge: string;
  bits: number;
  expiresInSec: number;
  expiresAt: string;
}

export type FederalIssueResponse = FederalSliderIssue | FederalGeometryIssue | FederalPowIssue;

export interface BehaviorSample {
  t: number;
  x: number;
  y: number;
}

export interface FederalGeometrySolution {
  /** 一周 1560 微槽（字面值，130/数字），0–1559 整数 */
  microSlot: number;
  /** 拖动行为采样（t,x,y），服务端重算不可信客户端结论，前端不做判定 */
  behaviorSamples: BehaviorSample[];
}

export type FederalVerifyRequest =
  | { captchaId: string; kind: 'geometry'; solution: FederalGeometrySolution }
  | { captchaId: string; kind: 'pow'; nonce: string }
  | {
      captchaId: string;
      kind: 'slider';
      dragPath: { x: number; y: number; t: number }[];
      totalDragTime: number;
      finalPosition: number;
    };

export interface FederalVerifySuccess {
  success: true;
  captchaId: string;
  kind: FederalKind;
}

export class FederalIssueError extends Error {
  readonly status: number;
  readonly retryAfterSec: number;
  constructor(message = 'ERR_VERIFICATION_FAILED', status = 400, retryAfterSec = 60) {
    super(message);
    this.name = 'FederalIssueError';
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export class FederalVerifyError extends Error {
  readonly status: number;
  constructor(message = 'ERR_VERIFICATION_FAILED', status = 400) {
    super(message);
    this.name = 'FederalVerifyError';
    this.status = status;
  }
}

function readRetryAfter(res: Response): number {
  const v = res.headers.get('Retry-After');
  const n = v !== null ? Number(v) : NaN;
  if (Number.isFinite(n) && (n as number) >= 0) return Math.floor(n as number);
  return 60;
}

function testHeaders(): Record<string, string> {
  // X-Test-Reset-Federal 仅 NODE_ENV=test 下发送（生产永不发送，生产携此头后端 404）
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return {};
  }
  return {};
}

/** 服务端驱动颁发：不传 kind 按 effectiveKind；传 kind 仅为受限换一种 hint（已关→400）。 */
export async function issueFederalCaptcha(
  kind?: FederalKind,
  opts?: { testFixed?: boolean },
): Promise<FederalIssueResponse> {
  const body: Record<string, unknown> = {};
  if (kind) body.kind = kind;
  // testFixed 仅测试环境发送（testFixedFederalGeometry/Pow 固定解，生产不可达）
  if (opts?.testFixed && typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    body.testFixed = 1;
  }
  const res = await fetch('/api/v1/auth/captcha/federal/issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...testHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = (await res.json().catch(() => null)) as FederalIssueResponse | null;
    if (data && typeof (data as { captchaId?: unknown }).captchaId === 'string') return data;
    throw new FederalIssueError('ERR_VERIFICATION_FAILED', 400);
  }
  if (res.status === 429) throw new FederalIssueError('ERR_RATE_LIMITED', 429, readRetryAfter(res));
  const errBody = (await res.json().catch(() => ({}))) as { error?: string };
  throw new FederalIssueError(
    typeof errBody.error === 'string' ? errBody.error : 'ERR_VERIFICATION_FAILED',
    res.status,
  );
}

/** 按 kind 判别校验（验证+原子消费，一次一题一动作）。 */
export async function verifyFederalCaptcha(req: FederalVerifyRequest): Promise<FederalVerifySuccess> {
  const res = await fetch('/api/v1/auth/captcha/federal/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...testHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(req),
  });
  if (res.ok) {
    const data = (await res.json().catch(() => null)) as FederalVerifySuccess | null;
    if (data && (data as { success?: unknown }).success === true) return data as FederalVerifySuccess;
    throw new FederalVerifyError('ERR_VERIFICATION_FAILED', 400);
  }
  if (res.status === 429) throw new FederalVerifyError('ERR_RATE_LIMITED', 429);
  const errBody = (await res.json().catch(() => ({}))) as { error?: string };
  throw new FederalVerifyError(
    typeof errBody.error === 'string' ? errBody.error : 'ERR_VERIFICATION_FAILED',
    res.status,
  );
}

export function isFederalKind(v: unknown): v is FederalKind {
  return v === 'slider' || v === 'geometry' || v === 'pow';
}

/** geometry puzzle 是否含可交互所需的 targetHour/perm（缺失则调用方回落 slider-low）。 */
export function hasGeometryInteractable(puzzle: FederalGeometryPuzzle | null | undefined): boolean {
  if (!puzzle) return false;
  return (
    typeof puzzle.targetHour === 'number' &&
    puzzle.targetHour >= 1 &&
    puzzle.targetHour <= 12 &&
    Array.isArray(puzzle.perm) &&
    puzzle.perm.length === 12
  );
}
