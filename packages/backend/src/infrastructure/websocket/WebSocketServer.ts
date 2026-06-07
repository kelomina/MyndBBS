import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { verify } from 'jsonwebtoken';
import Redis from 'ioredis';

const MAX_CONNECTIONS_PER_USER = 5;
const MAX_GLOBAL_CONNECTIONS = 10000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_PATH = '/ws';

type WSMessageType =
  | 'notification'
  | 'new_message'
  | 'post_updated'
  | 'message_removed'
  | 'message_expired'
  | 'ping'
  | 'pong'
  | 'server_shutdown'

interface WSMessage {
  type: WSMessageType;
  data?: unknown;
}

interface ConnectionMeta {
  ws: WebSocket;
  userId: string;
  connectedAt: number;
  lastActiveAt: number;
  remoteIp: string;
}

export function getWebSocketJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || ['dev-secret', 'change-me', 'change-me-too'].includes(secret)) {
    throw new Error('ERR_JWT_SECRET_NOT_CONFIGURED');
  }
  return secret;
}

export function verifyWebSocketToken(token: string, secret = getWebSocketJwtSecret()): Record<string, unknown> | null {
  try {
    return verify(token, secret, { algorithms: ['HS256'] }) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractWebSocketAccessToken(req: IncomingMessage): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName === 'accessToken') {
      const value = rawValueParts.join('=');
      return value ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

export function getAllowedWebSocketOrigins(): string[] {
  const configuredOrigins = [process.env.FRONTEND_URL, process.env.ORIGIN]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(',');
  const rawOrigins = configuredOrigins || 'http://localhost:3000';
  return Array.from(
    new Set(rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)),
  );
}

export function isWebSocketOriginAllowed(
  req: IncomingMessage,
  allowedOrigins = getAllowedWebSocketOrigins(),
): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

export class WebSocketConnectionManager {
  private wss: WebSocketServer | null = null;
  private userConnections = new Map<string, Set<WebSocket>>();
  private connectionMeta = new Map<WebSocket, ConnectionMeta>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private subscriber: Redis | null = null;

  bootstrap(httpServer: Server): void {
    this.wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });

    this.startHeartbeat();
    this.startRedisSubscriber();
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
      if (!isWebSocketOriginAllowed(req)) {
        ws.close(4003, 'Forbidden origin');
        return;
      }

      const token = extractWebSocketAccessToken(req);

      if (!token) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      let verified;
      try {
        const { verifyAccessTokenSession } = await import('../../middleware/auth');
        verified = await verifyAccessTokenSession(token);
      } catch {
        ws.close(4001, 'Invalid token');
        return;
      }

      const userId = verified.userId;

      if (this.getGlobalConnectionCount() >= MAX_GLOBAL_CONNECTIONS) {
        ws.close(503, 'Server at capacity');
        return;
      }

      const userConns = this.userConnections.get(userId) || new Set();
      if (userConns.size >= MAX_CONNECTIONS_PER_USER) {
        const oldest = [...userConns][0];
        if (oldest) {
          const meta = this.connectionMeta.get(oldest);
          this.removeConnection(oldest, meta?.userId ?? userId);
        }
      }

      userConns.add(ws);
      this.userConnections.set(userId, userConns);
      const remoteIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      this.connectionMeta.set(ws, {
        ws,
        userId,
        connectedAt: Date.now(),
        lastActiveAt: Date.now(),
        remoteIp,
      });

      ws.on('message', (raw) => {
        const meta = this.connectionMeta.get(ws);
        if (meta) meta.lastActiveAt = Date.now();

        try {
          const msg = JSON.parse(raw.toString()) as WSMessage;
          if (msg.type === 'pong') return;
        } catch { /* ignore */ }
      });

      ws.on('close', () => {
        const meta = this.connectionMeta.get(ws);
        this.removeConnection(ws, meta?.userId ?? userId);
      });
  }

  pushToUser(userId: string, message: WSMessage): void {
    const conns = this.userConnections.get(userId);
    if (!conns) return;
    const data = JSON.stringify(message);
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  broadcastShutdown(): void {
    const msg: WSMessage = { type: 'server_shutdown', data: { message: 'Server is shutting down' } };
    for (const [, conns] of this.userConnections) {
      for (const ws of conns) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      }
    }
  }

  getGlobalConnectionCount(): number {
    return this.connectionMeta.size;
  }

  getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size ?? 0;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.broadcastShutdown();
    this.wss?.close();
    if (this.subscriber) {
      this.subscriber.quit();
      this.subscriber = null;
    }
    this.userConnections.clear();
    this.connectionMeta.clear();
  }

  private removeConnection(ws: WebSocket, userId: string): void {
    const conns = this.userConnections.get(userId);
    if (conns) {
      conns.delete(ws);
      if (conns.size === 0) this.userConnections.delete(userId);
    }
    this.connectionMeta.delete(ws);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [ws, meta] of this.connectionMeta) {
        if (now - meta.lastActiveAt > 60_000) {
          this.removeConnection(ws, meta.userId);
          continue;
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startRedisSubscriber(): void {
    if (!process.env.REDIS_URL) return;
    this.subscriber = new Redis(process.env.REDIS_URL);
    this.subscriber.psubscribe('myndbbs:ws-push:*');
    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const userId = channel.replace('myndbbs:ws-push:', '');
      try {
        const msg = JSON.parse(message) as WSMessage;
        this.pushToUser(userId, msg);
      } catch { /* ignore */ }
    });
  }

  private verifyToken(token: string): Record<string, unknown> | null {
    return verifyWebSocketToken(token);
  }
}

export const wsConnectionManager = new WebSocketConnectionManager();
