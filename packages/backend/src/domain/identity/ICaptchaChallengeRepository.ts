import { CaptchaChallenge } from './CaptchaChallenge';

/**
 * 接口名称：ICaptchaChallengeRepository
 *
 * 函数作用：
 *   滑块验证码挑战的仓储接口。
 * Purpose:
 *   Repository interface for CaptchaChallenge aggregates.
 *
 * 中文关键词：
 *   验证码，挑战，仓储接口
 * English keywords:
 *   captcha, challenge, repository interface
 */
export interface ICaptchaChallengeRepository {
  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Retrieves a CaptchaChallenge by its unique identifier.
   * Keywords: find, by, id, captcha, repository
   */
  findById(id: string): Promise<CaptchaChallenge | null>;

  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Persists a CaptchaChallenge entity to the database.
   * Keywords: save, create, update, captcha, repository
   */
  save(challenge: CaptchaChallenge): Promise<void>;

  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Removes a CaptchaChallenge from the database (e.g., upon consumption).
   * Keywords: delete, remove, consume, captcha, repository
   */
  delete(id: string): Promise<void>;

  /**
   * 联邦增量：持久化几何尝试计数（失败递增，成功删行；与滑块 verified 路径互斥）。
   */
  updateAttempts(id: string, attempts: number): Promise<void>;

  /**
   * 联邦增量（仅 NODE_ENV=test 调用）：清联邦挑战行（geometry/pow）供单测隔离。
   * 生产不可达（调用方必须先判 NODE_ENV）。
   */
  deleteManyFederalForTest(): Promise<number>;
}
