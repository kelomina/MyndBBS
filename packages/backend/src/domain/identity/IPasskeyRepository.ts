import { Passkey } from './Passkey';

/**
 * 接口名称：IPasskeyRepository
 *
 * 函数作用：
 *   Passkey 聚合的仓储接口——定义 WebAuthn Passkey 持久化的契约。
 * Purpose:
 *   Repository interface for Passkey aggregates — defines the persistence contract for WebAuthn credentials.
 *
 * 中文关键词：
 *   Passkey，WebAuthn，仓储接口
 * English keywords:
 *   passkey, WebAuthn, repository interface
 */
export interface IPasskeyRepository {
  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Retrieves a Passkey by its unique identifier (credential ID).
   * Keywords: find, by, id, passkey, repository
   */
  findById(id: string): Promise<Passkey | null>;

  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Retrieves all Passkeys associated with a specific User ID.
   * Keywords: find, by, user, passkeys, repository
   */
  findByUserId(userId: string): Promise<Passkey[]>;

  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Persists a Passkey entity to the database.
   * Keywords: save, create, update, passkey, repository
   */
  save(passkey: Passkey): Promise<void>;

  /**
   * Callers: [AuthApplicationService]
   * Callees: []
   * Description: Removes a Passkey from the database.
   * Keywords: delete, remove, passkey, repository
   */
  delete(id: string): Promise<void>;
}
