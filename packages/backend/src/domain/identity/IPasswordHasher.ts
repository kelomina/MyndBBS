/**
 * 接口名称：IPasswordHasher
 *
 * 函数作用：
 *   密码哈希器接口——定义密码哈希和验证的契约。
 * Purpose:
 *   Password hasher interface — defines the contract for hashing and verifying passwords.
 *
 * 中文关键词：
 *   密码，哈希，接口
 * English keywords:
 *   password, hash, interface
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
