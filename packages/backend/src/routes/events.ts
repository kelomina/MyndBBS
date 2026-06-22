import { Router, Request, Response, type Router as RouterType } from 'express';
import { sseConnectionManager } from '../infrastructure/sse/SSEConnectionManager';
import { verifySessionCookie } from '../middleware/auth';
import { AUTH_SESSION_COOKIE_NAME } from '../lib/authCookies';

function extractSessionId(req: Request): string | null {
  return req.cookies?.[AUTH_SESSION_COOKIE_NAME] ?? null;
}

const router: RouterType = Router();

router.get('/stream', async (req: Request, res: Response) => {
  const sessionId = extractSessionId(req);

  if (!sessionId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let verified;
  try {
    verified = await verifySessionCookie(sessionId);
  } catch {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  if (sseConnectionManager.getUserConnectionCount(verified.userId) >= 5) {
    res.status(429).json({ error: 'Too many connections' });
    return;
  }

  sseConnectionManager.registerConnection(verified.userId, res as unknown as import('http').ServerResponse);
});

export default router;
