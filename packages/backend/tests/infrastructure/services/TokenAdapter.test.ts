import { TokenAdapter } from '../../../src/infrastructure/services/identity/TokenAdapter';
import jwt from 'jsonwebtoken';

describe('TokenAdapter', () => {
  let adapter: TokenAdapter;

  beforeEach(() => {
    adapter = new TokenAdapter();
  });

  describe('sign', () => {
    it('should sign a token with payload', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1', role: 'ADMIN' };
      const token = adapter.sign(payload, secret, '1h');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should sign token with different expiration times', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1' };

      const token1h = adapter.sign(payload, secret, '1h');
      const token1d = adapter.sign(payload, secret, '1d');
      const token5m = adapter.sign(payload, secret, '5m');

      expect(token1h).toBeDefined();
      expect(token1d).toBeDefined();
      expect(token5m).toBeDefined();
    });

    it('should sign token with empty payload', () => {
      const secret = 'test-secret';
      const token = adapter.sign({}, secret, '1h');

      expect(token).toBeDefined();
    });

    it('should sign token with numeric expiration', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1' };
      const token = adapter.sign(payload, secret, '3600');

      expect(token).toBeDefined();
    });
  });

  describe('verify', () => {
    it('should verify a valid token', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1', role: 'ADMIN' };
      const token = adapter.sign(payload, secret, '1h');

      const decoded = adapter.verify(token, secret);

      expect(decoded).toHaveProperty('userId', 'user-1');
      expect(decoded).toHaveProperty('role', 'ADMIN');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });

    it('should throw error for invalid token', () => {
      const secret = 'test-secret';
      const invalidToken = 'invalid.token.here';

      expect(() => {
        adapter.verify(invalidToken, secret);
      }).toThrow();
    });

    it('should throw error for token signed with different secret', () => {
      const secret1 = 'secret-1';
      const secret2 = 'secret-2';
      const payload = { userId: 'user-1' };
      const token = adapter.sign(payload, secret1, '1h');

      expect(() => {
        adapter.verify(token, secret2);
      }).toThrow();
    });

    it('should throw error for expired token', (done) => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1' };
      const token = adapter.sign(payload, secret, '1ms');

      setTimeout(() => {
        expect(() => {
          adapter.verify(token, secret);
        }).toThrow();
        done();
      }, 10);
    }, 50);

    it('should verify token with options', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1' };
      const token = adapter.sign(payload, secret, '1h');

      const decoded = adapter.verify(token, secret, { algorithms: ['HS256'] });

      expect(decoded).toHaveProperty('userId', 'user-1');
    });

    it('should reject tokens signed with an unexpected algorithm by default', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1' };
      const token = jwt.sign(payload, secret, { algorithm: 'HS384', expiresIn: '1h' });

      expect(() => {
        adapter.verify(token, secret);
      }).toThrow();
    });

    it('should handle verification with issuer option', () => {
      const secret = 'test-secret';
      const payload = { userId: 'user-1', iss: 'myapp' };
      const token = adapter.sign(payload, secret, '1h');

      const decoded = adapter.verify(token, secret, { issuer: 'myapp' });

      expect(decoded).toHaveProperty('userId', 'user-1');
    });
  });
});
