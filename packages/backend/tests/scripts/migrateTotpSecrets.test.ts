import { TotpEncryptionService } from '../../src/infrastructure/services/identity/TotpEncryptionService'

describe('migrateTotpSecrets — encryption filter logic', () => {
  const originalJwtSecret = process.env.JWT_SECRET

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-migration-jwt-secret-for-unit-tests'
  })

  afterAll(() => {
    if (originalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret
    } else {
      delete process.env.JWT_SECRET
    }
  })

  let encryptionService: TotpEncryptionService

  beforeEach(() => {
    encryptionService = new TotpEncryptionService()
  })

  describe('isEncrypted — plaintext detection', () => {
    it('should detect plaintext (non-v1: prefix) as unencrypted', () => {
      expect(encryptionService.isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false)
      expect(encryptionService.isEncrypted('KRUGS4ZANFZSA3LBMFWWK===')).toBe(false)
      expect(encryptionService.isEncrypted('ONSWG4TFOQ======')).toBe(false)
    })

    it('should detect v1: prefixed values as encrypted', () => {
      const encrypted = encryptionService.encrypt('JBSWY3DPEHPK3PXP')
      expect(encryptionService.isEncrypted(encrypted)).toBe(true)
    })

    it('should treat null as not encrypted', () => {
      expect(encryptionService.isEncrypted(null)).toBe(false)
    })

    it('should treat empty string as not encrypted', () => {
      expect(encryptionService.isEncrypted('')).toBe(false)
    })
  })

  describe('encrypt → decrypt round-trip (migration simulation)', () => {
    it('should encrypt a plaintext secret and successfully decrypt it back', () => {
      const plaintext = 'KRUGS4ZANFZSA3LBMFWWK==='
      const encrypted = encryptionService.encrypt(plaintext)
      expect(encrypted).toMatch(/^v1:[0-9a-f]+$/)
      expect(encryptionService.isEncrypted(encrypted)).toBe(true)
      expect(encryptionService.decrypt(encrypted)).toBe(plaintext)
    })

    it('should NOT re-encrypt an already-encrypted value', () => {
      const original = encryptionService.encrypt('JBSWY3DPEHPK3PXP')
      expect(encryptionService.isEncrypted(original)).toBe(true)

      // Simulating the check that migration script does: skip if already encrypted
      if (encryptionService.isEncrypted(original)) {
        // This is the "skipped" path — no re-encryption
        expect(encryptionService.decrypt(original)).toBe('JBSWY3DPEHPK3PXP')
      }
    })

    it('should correctly identify users needing migration from a mock result set', () => {
      // Simulate a query result from Prisma
      const mockUsers = [
        { id: '1', totpSecret: 'JBSWY3DPEHPK3PXP' }, // plaintext → needs migration
        { id: '2', totpSecret: encryptionService.encrypt('KRUGS4ZANFZSA3LBMFWWK===') }, // already encrypted → skip
        { id: '3', totpSecret: null }, // null → skip
        { id: '4', totpSecret: 'ONSWG4TFOQ======' }, // plaintext → needs migration
        { id: '5', totpSecret: encryptionService.encrypt('AAAAAAAAAAAAAAAA') }, // already encrypted → skip
      ]

      const needsMigration: typeof mockUsers = []
      const skipEncrypted: typeof mockUsers = []

      for (const user of mockUsers) {
        if (!user.totpSecret) continue
        if (encryptionService.isEncrypted(user.totpSecret)) {
          skipEncrypted.push(user)
        } else {
          needsMigration.push(user)
        }
      }

      expect(needsMigration).toHaveLength(2)
      expect(needsMigration.map((u) => u.id)).toEqual(['1', '4'])
      expect(skipEncrypted).toHaveLength(2)
      expect(skipEncrypted.map((u) => u.id)).toEqual(['2', '5'])

      // Verify encryption of identified plaintext users
      for (const user of needsMigration) {
        const encrypted = encryptionService.encrypt(user.totpSecret!)
        expect(encrypted).toMatch(/^v1:[0-9a-f]+$/)
        expect(encryptionService.isEncrypted(encrypted)).toBe(true)
        expect(encryptionService.decrypt(encrypted)).toBe(user.totpSecret)
      }

      // Verify already-encrypted users are untouched
      for (const user of skipEncrypted) {
        expect(encryptionService.isEncrypted(user.totpSecret!)).toBe(true)
      }
    })
  })

  describe('migration error handling', () => {
    it('should produce distinct ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP'
      const results = new Set<string>()
      for (let i = 0; i < 10; i++) {
        results.add(encryptionService.encrypt(plaintext))
      }
      // All should be unique due to random IV
      expect(results.size).toBe(10)
      // All should decrypt back
      for (const encrypted of results) {
        expect(encryptionService.decrypt(encrypted)).toBe(plaintext)
      }
    })

    it('should handle special base32 characters correctly', () => {
      const secrets = [
        'JBSWY3DPEHPK3PXP',
        'KRUGS4ZANFZSA3LBMFWWK===',
        'ONSWG4TFOQ======',
        'AAAAAAAAAAAAAAAA',
      ]

      for (const secret of secrets) {
        const encrypted = encryptionService.encrypt(secret)
        expect(encryptionService.decrypt(encrypted)).toBe(secret)
      }
    })
  })
})
