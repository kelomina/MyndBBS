import { CaptchaChallenge } from './CaptchaChallenge';

/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of slider captcha challenges.
 * Keywords: captcha, repository, interface, contract, domain
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
}
