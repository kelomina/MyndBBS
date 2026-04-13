import { Passkey } from './Passkey';

/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: The repository interface for managing the persistence of WebAuthn Passkeys associated with users.
 * Keywords: passkey, webauthn, repository, interface, contract, domain
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
