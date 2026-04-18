import { isValidPassword } from '@myndbbs/shared';

/**
 * Callers: [AuthApplicationService]
 * Callees: [isValidPassword]
 * Description: Domain entity representing a User Password. Validates password policy.
 * Keywords: password, identity, entity, validation, policy
 */
export class Password {
  /**
   * Callers: [Password.createHashed]
   * Callees: []
   * Description: Private constructor to enforce instantiation via static factory methods.
   * Keywords: constructor, password, entity, instantiation
   */
  private constructor(public readonly value: string) {}

  /**
   * Callers: [AuthApplicationService.registerUser, AuthApplicationService.changePasswordWithVerification]
   * Callees: [Password.constructor]
   * Description: Static factory method creating a Password entity from an already hashed string.
   * Keywords: create, factory, password, hashed
   */
  public static createHashed(hashedPassword: string): Password {
    if (!hashedPassword || hashedPassword.trim() === '') {
      throw new Error('ERR_INVALID_PASSWORD');
    }
    return new Password(hashedPassword);
  }

  /**
   * Callers: [AuthApplicationService.registerUser, AuthApplicationService.changePasswordWithVerification]
   * Callees: [isValidPassword]
   * Description: Validates a plain text password against the system's password policy. Throws an error with an i18n key if validation fails.
   * Keywords: validate, policy, password, check, strength
   */
  public static validatePolicy(password: string): void {

    if (password.length < 8 || password.length > 128) {
      throw new Error('ERR_PASSWORD_MUST_BE_BETWEEN_8_AND_128_CHARACTERS');
    }
    if (!isValidPassword(password)) {
      throw new Error('ERR_PASSWORD_MUST_CONTAIN_UPPERCASE_LOWERCASE_NUMBER_AND_SPECIAL_CHARACTER');
    }
    if (!/^[ -~]+$/.test(password)) {
      throw new Error('ERR_PASSWORD_CONTAINS_INVALID_CHARACTERS');
    }
  }
}
