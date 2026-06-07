import { Router, Request, Response, type Router as RouterType } from 'express';
import { sseConnectionManager } from '../infrastructure/sse/SSEConnectionManager';
import { verifyAccessTokenSession } from '../middleware/auth';

function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies?.accessToken ?? null;
}

const router: RouterType = Router();

router.get('/stream', async (req: Request, res: Response) => {
  const token = extractAccessToken(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let verified;
  try {
    verified = await verifyAccessTokenSession(token);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (sseConnectionManager.getUserConnectionCount(verified.userId) >= 5) {
    res.status(429).json({ error: 'Too many connections' });
    return;
  }

  sseConnectionManager.registerConnection(verified.userId, res as unknown as import('http').ServerResponse);
});

export default router;
