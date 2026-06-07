'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

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
  type: WSMessageType
  data?: unknown
}

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void
  enabled?: boolean
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, enabled = true } = options
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const scheduleReconnectRef = useRef<() => void>(() => {})

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }))
            return
          }
          onMessageRef.current?.(message)
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnected(false)
        wsRef.current = null
        scheduleReconnectRef.current()
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      scheduleReconnectRef.current()
    }
  }, [enabled])

  useEffect(() => {
    scheduleReconnectRef.current = () => {
      if (reconnectTimeoutRef.current) return
      const delay = 3000 + Math.random() * 2000
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        if (enabled) connect()
      }, delay)
    }
  }, [connect, enabled])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setConnected(false)
  }, [])

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { connected, sendMessage, reconnect: connect, disconnect }
}
