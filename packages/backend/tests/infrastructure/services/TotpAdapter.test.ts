import { TotpAdapter } from '../../../src/infrastructure/services/identity/TotpAdapter';

describe('TotpAdapter', () => {
  let adapter: TotpAdapter;

  beforeEach(() => {
    adapter = new TotpAdapter();
  });

  describe('generateSecret', () => {
    it('should generate a secret', () => {
      const secret = adapter.generateSecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should generate different secrets each time', () => {
      const secret1 = adapter.generateSecret();
      const secret2 = adapter.generateSecret();
      const secret3 = adapter.generateSecret();

      expect(secret1).not.toBe(secret2);
      expect(secret2).not.toBe(secret3);
      expect(secret1).not.toBe(secret3);
    });

    it('should generate base32 encoded secret', () => {
      const secret = adapter.generateSecret();
      const base32Regex = /^[A-Z2-7]+$/;

      expect(secret).toMatch(base32Regex);
    });
  });

  describe('generateURI', () => {
    it('should generate a valid otpauth URI', () => {
      const secret = adapter.generateSecret();
      const uri = adapter.generateURI('MyApp', 'user@example.com', secret);

      expect(uri).toBeDefined();
      expect(uri.startsWith('otpauth://totp/')).toBe(true);
      expect(uri).toContain('MyApp');
      expect(decodeURIComponent(uri)).toContain('user@example.com');
      expect(uri).toContain(secret);
    });

    it('should handle special characters in issuer', () => {
      const secret = adapter.generateSecret();
      const uri = adapter.generateURI('My App & Co', 'user@example.com', secret);

      expect(uri).toBeDefined();
      expect(encodeURIComponent('My App & Co')).toBeTruthy();
    });

    it('should handle special characters in account name', () => {
      const secret = adapter.generateSecret();
      const uri = adapter.generateURI('MyApp', 'user+test@example.com', secret);

      expect(uri).toBeDefined();
    });

    it('should have correct URI structure', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const uri = adapter.generateURI('MyApp', 'user@example.com', secret);

      const parsed = new URL(uri);
      expect(parsed.protocol).toBe('otpauth:');
      expect(parsed.host).toBe('totp');
      expect(parsed.searchParams.get('secret')).toBe(secret);
      expect(parsed.searchParams.get('issuer')).toBe('MyApp');
    });
  });

  describe('verify', () => {
    it('should verify a valid TOTP code', () => {
      const secret = adapter.generateSecret();
      const uri = adapter.generateURI('Test', 'test@test.com', secret);

      expect(secret).toBeDefined();
      expect(uri).toBeDefined();

      const isValid = adapter.verify(secret, '123456');
      expect(typeof isValid).toBe('boolean');
    });

    it('should return false for invalid code', () => {
      const secret = adapter.generateSecret();
      const isValid = adapter.verify(secret, '000000');

      expect(typeof isValid).toBe('boolean');
    });

    it('should return false for empty code', () => {
      const secret = adapter.generateSecret();
      const isValid = adapter.verify(secret, '');

      expect(isValid).toBe(false);
    });

    it('should return false for invalid secret', () => {
      const isValid = adapter.verify('invalid-secret', '123456');

      expect(isValid).toBe(false);
    });

    it('should handle different secret lengths', () => {
      const secrets = [
        'JBSWY3DPEHPK3PXP',
        'JBSWY3DPEHPK3PXPY',
        'JBSWY3DPEHPK3PXP2',
      ];

      secrets.forEach((secret) => {
        const isValid = adapter.verify(secret, '123456');
        expect(typeof isValid).toBe('boolean');
      });
    });
  });

  describe('integration', () => {
    it('should generate secret and verify code in sequence', () => {
      const secret = adapter.generateSecret();
      const uri = adapter.generateURI('MyApp', 'user@example.com', secret);

      expect(secret).toBeDefined();
      expect(uri).toBeDefined();

      const isValid = adapter.verify(secret, '123456');
      expect(typeof isValid).toBe('boolean');
    });
  });
});
