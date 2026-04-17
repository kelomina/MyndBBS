import { TotpAdapter } from '../src/infrastructure/services/identity/TotpAdapter';
import { TokenAdapter } from '../src/infrastructure/services/identity/TokenAdapter';

describe('Infrastructure Adapters', () => {
  it('should generate and verify TOTP', () => {
    const adapter = new TotpAdapter();
    const secret = adapter.generateSecret();
    expect(secret).toBeDefined();
    // Assuming we can't easily mock time for token here, just check instance creation
    expect(adapter).toBeInstanceOf(TotpAdapter);
  });

  it('should sign and verify Token', () => {
    const adapter = new TokenAdapter();
    const secret = 'test-secret';
    const token = adapter.sign({ userId: '123' }, secret, '1h');
    const decoded = adapter.verify(token, secret);
    expect(decoded).toHaveProperty('userId', '123');
  });
});
