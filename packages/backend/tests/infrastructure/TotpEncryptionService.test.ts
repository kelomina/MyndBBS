import { TotpEncryptionService } from '../../src/infrastructure/services/identity/TotpEncryptionService'

describe('TotpEncryptionService', () => {
  const originalJwtSecret = process.env.JWT_SECRET

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-for-totp-encryption-tests'
  })

  afterAll(() => {
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret
    } else {
      delete process.env.JWT_SECRET
    }
  })

  describe('encrypt / decrypt', () => {
    it('should encrypt a plaintext secret and decrypt it back', () => {
      const service = new TotpEncryptionService()
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const encrypted = service.encrypt(plaintext)
      const decrypted = service.decrypt(encrypted)

      expect(encrypted).not.toBe(plaintext)
      expect(encrypted).toMatch(/^v1:[0-9a-f]+$/)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertexts for the same plaintext (unique IV)', () => {
      const service = new TotpEncryptionService()
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const result1 = service.encrypt(plaintext)
      const result2 = service.encrypt(plaintext)

      expect(result1).not.toBe(result2)
      // Both should decrypt to the same value
      expect(service.decrypt(result1)).toBe(plaintext)
      expect(service.decrypt(result2)).toBe(plaintext)
    })

    it('should handle standard TOTP base32 secrets', () => {
      const service = new TotpEncryptionService()
      const secrets = ['JBSWY3DPEHPK3PXP', 'AAAAAAAAAAAAAAAA', 'KRUGS4ZANFZSA3LBMFWWK===', 'ONSWG4TFOQ======']

      for (const secret of secrets) {
        const encrypted = service.encrypt(secret)
        const decrypted = service.decrypt(encrypted)
        expect(decrypted).toBe(secret)
      }
    })
  })

  describe('isEncrypted', () => {
    it('should return true for v1: prefixed values', () => {
      const service = new TotpEncryptionService()
      expect(service.isEncrypted('v1:abcdef1234567890')).toBe(true)
    })

    it('should return false for null or empty values', () => {
      const service = new TotpEncryptionService()
      expect(service.isEncrypted(null)).toBe(false)
      expect(service.isEncrypted('')).toBe(false)
    })

    it('should return false for plaintext (legacy) values', () => {
      const service = new TotpEncryptionService()
      expect(service.isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false)
    })

    it('should return false for values starting with other prefixes', () => {
      const service = new TotpEncryptionService()
      expect(service.isEncrypted('v2:abcdef')).toBe(false)
      expect(service.isEncrypted('AES:abcdef')).toBe(false)
    })
  })

  describe('decrypt with legacy plaintext', () => {
    it('should return plaintext values as-is (backward compatibility)', () => {
      const service = new TotpEncryptionService()
      const legacy = 'JBSWY3DPEHPK3PXP'
      expect(service.decrypt(legacy)).toBe(legacy)
    })

    it('should return null for null input', () => {
      const service = new TotpEncryptionService()
      expect(service.decrypt(null)).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should throw on corrupt ciphertext', () => {
      const service = new TotpEncryptionService()
      expect(() => service.decrypt('v1:0000')).toThrow('ERR_TOTP_DECRYPTION_FAILED')
    })

    it('should throw on tampered ciphertext', () => {
      const service = new TotpEncryptionService()
      const encrypted = service.encrypt('JBSWY3DPEHPK3PXP')
      // Tamper with the hex data by flipping a character
      const tampered = encrypted.slice(0, 10) + (encrypted[10] === 'a' ? 'b' : 'a') + encrypted.slice(11)
      expect(() => service.decrypt(tampered)).toThrow('ERR_TOTP_DECRYPTION_FAILED')
    })

    it('should throw if JWT_SECRET is not set', () => {
      const savedSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET
      try {
        const service = new TotpEncryptionService()
        expect(() => service.encrypt('test')).toThrow('ERR_TOTP_ENCRYPTION_KEY_MISSING')
      } finally {
        process.env.JWT_SECRET = savedSecret
      }
    })
  })

  describe('idempotency', () => {
    it('should not double-encrypt an already encrypted value (callers should check isEncrypted)', () => {
      const service = new TotpEncryptionService()
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const encrypted = service.encrypt(plaintext)

      // Simulating what would happen if someone encrypts an encrypted value
      // This is caller's responsibility, but document the behavior
      const doubleEncrypted = service.encrypt(encrypted)
      expect(service.isEncrypted(doubleEncrypted)).toBe(true)
      // doubleEncrypted decrypts to the original encrypted string, not the plaintext
      const decrypted = service.decrypt(doubleEncrypted)
      expect(decrypted).toBe(encrypted)
      expect(decrypted).not.toBe(plaintext)
    })
  })
})
