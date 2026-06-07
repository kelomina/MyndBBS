'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

type SSEEventType =
  | 'notification'
  | 'new_message'
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

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  fallbackIntervalMs?: number;
  enabled?: boolean;
}

export function useSSE(options: UseSSEOptions = {}) {
  const { onEvent, fallbackIntervalMs = 30000, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const scheduleReconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const es = new EventSource('/api/v1/events/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        if (fallbackRef.current) {
          clearInterval(fallbackRef.current);
          fallbackRef.current = null;
        }
      };

      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as SSEEvent;
          onEventRef.current?.(event);
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        eventSourceRef.current = null;

        if (!fallbackRef.current) {
          fallbackRef.current = setInterval(() => {
            onEventRef.current?.({
              id: 'fallback',
              type: 'notification',
              payload: { source: 'polling' },
              timestamp: Date.now(),
            });
          }, fallbackIntervalMs);
        }

        scheduleReconnectRef.current();
      };
    } catch {
      if (!fallbackRef.current) {
        fallbackRef.current = setInterval(() => {
          onEventRef.current?.({
            id: 'fallback',
            type: 'notification',
            payload: { source: 'polling' },
            timestamp: Date.now(),
          });
        }, fallbackIntervalMs);
      }
    }
  }, [enabled, fallbackIntervalMs]);

  useEffect(() => {
    scheduleReconnectRef.current = () => {
      if (reconnectTimeoutRef.current) return;
      const delay = 3000 + Math.random() * 2000;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (enabled) connect();
      }, delay);
    };
  }, [connect, enabled]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, reconnect: connect, disconnect };
}
