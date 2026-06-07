import type { ServerResponse } from 'http';
import { getEventBus } from '../events/EventBusFactory';
import type { IDomainEvent } from '../../domain/shared/events/IEventBus';

type SSEEventType =
  | 'notification'
  | 'new_message'
  | 'message_removed'
  | 'message_expired'
  | 'post_approved'
  | 'post_rejected'
  | 'friend_request'
  | 'server_shutdown';

interface SSEEvent {
  id: string;
  type: SSEEventType;
  payload: unknown;
  timestamp: number;
}

const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTION_AGE_MS = 30 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;
let eventCounter = 0;

export class SSEConnectionManager {
  private connections = new Map<string, Set<ServerResponse>>();
  private connectionTimestamps = new Map<string, number>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
    this.startEventConsumer();
  }

  registerConnection(userId: string, res: ServerResponse): void {
    const userConns = this.connections.get(userId) || new Set();
    if (userConns.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = [...userConns][0];
      if (oldest) this.removeConnection(userId, oldest);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    userConns.add(res);
    this.connections.set(userId, userConns);
    this.connectionTimestamps.set(this.getConnectionKey(userId, res), Date.now());

    res.on('close', () => {
      this.removeConnection(userId, res);
    });
  }

  removeConnection(userId: string, res: ServerResponse): void {
    const userConns = this.connections.get(userId);
    if (userConns) {
      userConns.delete(res);
      if (userConns.size === 0) {
        this.connections.delete(userId);
      }
    }
    this.connectionTimestamps.delete(this.getConnectionKey(userId, res));
    if (!res.writableEnded) {
      res.end();
    }
  }

  pushToUser(userId: string, event: SSEEvent): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;

    const data = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of userConns) {
      if (!res.writableEnded) {
        res.write(data);
      }
    }
  }

  broadcastShutdown(): void {
    const event: SSEEvent = {
      id: String(++eventCounter),
      type: 'server_shutdown',
      payload: { message: 'Server is shutting down' },
      timestamp: Date.now(),
    };

    for (const [userId] of this.connections) {
      this.pushToUser(userId, event);
    }
  }

  getConnectionCount(): number {
    let count = 0;
    for (const conns of this.connections.values()) {
      count += conns.size;
    }
    return count;
  }

  getUserConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size ?? 0;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, conns] of this.connections) {
        const toRemove: ServerResponse[] = [];
        for (const res of conns) {
          const key = this.getConnectionKey(userId, res);
          const connectedAt = this.connectionTimestamps.get(key);
          if (connectedAt && now - connectedAt > MAX_CONNECTION_AGE_MS) {
            toRemove.push(res);
            continue;
          }
          if (!res.writableEnded) {
            res.write(': heartbeat\n\n');
          }
        }
        for (const res of toRemove) {
          this.removeConnection(userId, res);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startEventConsumer(): void {
    const eventMapping: Record<string, SSEEventType> = {
      PostCreated: 'post_approved',
      PostRejected: 'post_rejected',
      PostReplied: 'notification',
      CommentCreated: 'notification',
      FriendRequested: 'friend_request',
      FriendRequestAccepted: 'notification',
      PrivateMessageSentEvent: 'new_message',
      MessageRemovedEvent: 'message_removed',
      MessageExpiredEvent: 'message_expired',
    };

    for (const [domainEvent, sseType] of Object.entries(eventMapping)) {
      getEventBus().subscribe(domainEvent, (event: IDomainEvent) => {
        const sseEvent: SSEEvent = {
          id: String(++eventCounter),
          type: sseType,
          payload: event,
          timestamp: Date.now(),
        };

        const payload = event as unknown as Record<string, unknown>;
        const targetUserId = typeof payload.targetUserId === 'string'
          ? payload.targetUserId
          : typeof payload.receiverId === 'string'
            ? payload.receiverId
            : typeof payload.senderId === 'string'
              ? payload.senderId
              : undefined;
        if (targetUserId) {
          this.pushToUser(targetUserId, sseEvent);
        }
      });
    }
  }

  private getConnectionKey(userId: string, res: ServerResponse): string {
    return `${userId}:${res.socket?.remotePort ?? 'unknown'!}`;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.broadcastShutdown();
    for (const [userId, conns] of this.connections) {
      for (const res of conns) {
        if (!res.writableEnded) {
          res.end();
        }
      }
    }
    this.connections.clear();
    this.connectionTimestamps.clear();
  }
}

export const sseConnectionManager = new SSEConnectionManager();
