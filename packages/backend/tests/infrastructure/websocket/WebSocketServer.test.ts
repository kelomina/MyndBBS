import jwt from 'jsonwebtoken';
import {
  extractWebSocketAccessToken,
  isWebSocketOriginAllowed,
  verifyWebSocketToken,
} from '../../../src/infrastructure/websocket/WebSocketServer';

describe('WebSocket security helpers', () => {
  it('rejects tokens signed with an unexpected algorithm', () => {
    const token = jwt.sign({ userId: 'user-1' }, 'test-secret', { algorithm: 'HS384', expiresIn: '1h' });

    expect(verifyWebSocketToken(token, 'test-secret')).toBeNull();
  });

  it('extracts accessToken from cookie header instead of URL query string', () => {
    const req = {
      headers: { cookie: 'theme=dark; accessToken=cookie-token; other=value' },
      url: '/ws?token=query-token',
    } as any;

    expect(extractWebSocketAccessToken(req)).toBe('cookie-token');
  });

  it('does not accept URL query string tokens', () => {
    const req = {
      headers: {},
      url: '/ws?token=query-token',
    } as any;

    expect(extractWebSocketAccessToken(req)).toBeNull();
  });

  it('allows WebSocket handshakes from configured origins', () => {
    const req = {
      headers: { origin: 'https://forum.example.com' },
    } as any;

    expect(isWebSocketOriginAllowed(req, ['https://forum.example.com'])).toBe(true);
  });

  it('rejects WebSocket handshakes from untrusted browser origins', () => {
    const req = {
      headers: { origin: 'https://evil.example' },
    } as any;

    expect(isWebSocketOriginAllowed(req, ['https://forum.example.com'])).toBe(false);
  });

  it('allows non-browser WebSocket clients without an Origin header', () => {
    const req = {
      headers: {},
    } as any;

    expect(isWebSocketOriginAllowed(req, ['https://forum.example.com'])).toBe(true);
  });
});
