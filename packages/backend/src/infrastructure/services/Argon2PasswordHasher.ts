import * as argon2 from 'argon2';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';

/**
 * Callers: []
 * Callees: [argon2.hash, argon2.verify]
 * Description: Argon2 implementation of the IPasswordHasher interface.
 * Keywords: argon2, password, hasher, service, infrastructure
 */
export class Argon2PasswordHasher implements IPasswordHasher {
  /**
   * Hashes a plain text password using Argon2.
   * @param password The plain text password to hash.
   * @returns A promise that resolves to the Argon2 hashed password string.
   */
  async hash(password: string): Promise<string> {
    return await argon2.hash(password);
  }

  /**
   * Verifies a plain text password against an Argon2 hash.
   * @param hash The Argon2 hashed password string.
   * @param plain The plain text password to verify.
   * @returns A promise that resolves to true if the password matches, false otherwise.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    return await argon2.verify(hash, plain);
  }
}
