import {
  extractWebSocketSessionId,
  isWebSocketOriginAllowed,
} from '../../../src/infrastructure/websocket/WebSocketServer';

describe('WebSocket security helpers', () => {
  it('extracts sessionId from cookie header instead of URL query string', () => {
    const req = {
      headers: { cookie: 'theme=dark; sessionId=session-1; other=value' },
      url: '/ws?token=query-token',
    } as any;

    expect(extractWebSocketSessionId(req)).toBe('session-1');
  });

  it('does not accept URL query string session values', () => {
    const req = {
      headers: {},
      url: '/ws?sessionId=query-session',
    } as any;

    expect(extractWebSocketSessionId(req)).toBeNull();
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
