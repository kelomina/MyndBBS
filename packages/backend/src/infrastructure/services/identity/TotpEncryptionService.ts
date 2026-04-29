import * as crypto from 'crypto'

const V1_PREFIX = 'v1:'
const AES_KEY_LENGTH = 32
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const ALGORITHM = 'aes-256-gcm'

/**
 * 函数名称：TotpEncryptionService
 *
 * 函数作用：使用 AES-256-GCM 对 TOTP base32 密钥进行透明加密/解密。
 *          加密密钥通过 HKDF-SHA256 从 JWT_SECRET 派生，无需新增环境变量。
 *          密文格式：`v1:` + hex(IV(12B) + ciphertext + authTag(16B))。
 *          `v1:` 前缀用于区分已加密数据和明文遗留数据，确保向后兼容。
 *
 * Function purpose: Transparently encrypt/decrypt TOTP base32 secrets using AES-256-GCM.
 *          The encryption key is derived from JWT_SECRET via HKDF-SHA256 (no new env vars).
 *          Ciphertext format: `v1:` + hex(IV(12B) + ciphertext + authTag(16B)).
 *          The `v1:` prefix distinguishes encrypted data from legacy plaintext, ensuring backward compatibility.
 *
 * 调用方：PrismaUserRepository, RedisSessionCache, PrismaUserSecurityReadModel, IdentityQueryService
 * Called by: PrismaUserRepository, RedisSessionCache, PrismaUserSecurityReadModel, IdentityQueryService
 *
 * 被调用方：crypto.hkdfSync, crypto.randomBytes, crypto.createCipheriv, crypto.createDecipheriv
 * Calls: crypto.hkdfSync, crypto.randomBytes, crypto.createCipheriv, crypto.createDecipheriv
 *
 * 参数说明：无构造函数参数（密钥从 process.env.JWT_SECRET 自动读取）
 * Parameters: No constructor params (key derived from process.env.JWT_SECRET automatically)
 *
 * 返回值说明：
 *  - encrypt(plaintext): string — 以 `v1:` 为前缀的 hex 编码密文
 *  - decrypt(ciphertext): string — 解密后的 base32 TOTP 密钥
 *  - isEncrypted(value): boolean — 判断值是否以 `v1:` 前缀开头（已加密）
 * Returns:
 *  - encrypt(plaintext): string — hex-encoded ciphertext with `v1:` prefix
 *  - decrypt(ciphertext): string — decrypted base32 TOTP secret
 *  - isEncrypted(value): boolean — whether the value has `v1:` prefix (is encrypted)
 *
 * 接入方式：在 registry.ts 中实例化单例，注入到所有需要读/写 totpSecret 的类中。
 * Integration: Instantiate as singleton in registry.ts, inject into all classes that read/write totpSecret.
 *
 * 错误处理：encrypt 在密钥未设置时抛出 ERR_TOTP_ENCRYPTION_KEY_MISSING；
 *          decrypt 在格式无效或认证失败时抛出 ERR_TOTP_DECRYPTION_FAILED。
 * Error handling: encrypt throws ERR_TOTP_ENCRYPTION_KEY_MISSING if secret not set;
 *          decrypt throws ERR_TOTP_DECRYPTION_FAILED on invalid format or auth failure.
 *
 * 副作用：无（纯加密函数，无数据库/文件/网络操作）
 * Side effects: None (pure encryption, no database/file/network operations)
 *
 * 中文关键词：TOTP加密, AES-256-GCM, HKDF密钥派生, v1前缀, 向后兼容, 透明加密, 明文迁移, 认证标签, IV, base32密钥
 * English keywords: TOTP encryption, AES-256-GCM, HKDF key derivation, v1 prefix, backward compatibility, transparent encryption, plaintext migration, auth tag, IV, base32 secret
 */
export class TotpEncryptionService {
  private encryptionKey: Buffer | null = null

  private getKey(): Buffer {
    if (this.encryptionKey) return this.encryptionKey

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error('ERR_TOTP_ENCRYPTION_KEY_MISSING')
    }

    const derived = crypto.hkdfSync(
      'sha256',
      jwtSecret,
      'myndbbs-totp-encryption-salt',
      'totp-secret-v1',
      AES_KEY_LENGTH
    )
    this.encryptionKey = Buffer.from(derived)
    return this.encryptionKey
  }

  /**
   * 判断一个值是否已被加密（以 v1: 前缀开头）。
   * Returns true if the value has been encrypted (starts with v1: prefix).
   */
  public isEncrypted(value: string | null): boolean {
    if (!value) return false
    return value.startsWith(V1_PREFIX)
  }

  /**
   * 使用 AES-256-GCM 加密 TOTP base32 密钥。
   * Encrypts a TOTP base32 secret using AES-256-GCM.
   */
  public encrypt(plaintext: string): string {
    const key = this.getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    if (!authTag) {
      throw new Error('ERR_TOTP_ENCRYPTION_FAILED')
    }

    const combined = Buffer.concat([iv, encrypted, authTag])
    return V1_PREFIX + combined.toString('hex')
  }

  /**
   * 解密 AES-256-GCM 密文。已解密的（明文）值直接返回。
   * Decrypts an AES-256-GCM ciphertext. Already-decrypted (plaintext) values are returned as-is.
   */
  public decrypt(value: string | null): string | null {
    if (!value) return null
    if (!this.isEncrypted(value)) return value

    try {
      const hexData = value.slice(V1_PREFIX.length)
      const combined = Buffer.from(hexData, 'hex')

      if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error('ERR_TOTP_DECRYPTION_FAILED')
      }

      const iv = combined.subarray(0, IV_LENGTH)
      const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
      const encrypted = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

      const key = this.getKey()
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
      return decrypted.toString('utf8')
    } catch {
      throw new Error('ERR_TOTP_DECRYPTION_FAILED')
    }
  }
}
