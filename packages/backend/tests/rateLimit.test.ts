import { getClientIp } from '../src/lib/rateLimit';

describe('getClientIp', () => {
  it('should use Express-calculated req.ip instead of raw X-Forwarded-For', () => {
    const request = {
      ip: '198.51.100.10',
      socket: { remoteAddress: '203.0.113.10' },
      headers: { 'x-forwarded-for': '1.1.1.1' },
    };

    expect(getClientIp(request as never)).toBe('198.51.100.10');
  });
});
