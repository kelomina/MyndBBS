/**
 * Callers: [AuthApplicationService, SystemApplicationService, UserController, etc.]
 * Callees: []
 * Description: Interface for hashing and verifying passwords.
 * Keywords: password, hasher, interface, identity
 */
export interface IPasswordHasher {
  /**
   * Hashes a plain text password.
   * @param password The plain text password to hash.
   * @returns A promise that resolves to the hashed password string.
   */
  hash(password: string): Promise<string>;

  /**
   * Verifies a plain text password against a hash.
   * @param hash The hashed password string.
   * @param plain The plain text password to verify.
   * @returns A promise that resolves to true if the password matches, false otherwise.
   */
  verify(hash: string, plain: string): Promise<boolean>;
}
