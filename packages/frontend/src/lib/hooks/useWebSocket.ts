'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type RealtimeMessageType =
  | 'notification'
  | 'new_message'
  | 'post_updated'
  | 'message_removed'
  | 'message_expired'
  | 'post_approved'
  | 'post_rejected'
  | 'friend_request'
  | 'server_shutdown'

interface RealtimeMessage {
  type: RealtimeMessageType
  data?: unknown
}

interface UseWebSocketOptions {
  onMessage?: (message: RealtimeMessage) => void
  enabled?: boolean
}

interface SSEEvent {
  id: string
  type: RealtimeMessageType
  payload: unknown
  timestamp: number
}

// 兼容旧调用名。BFF 架构下浏览器不再直连后端 WebSocket，
// 实时通知统一走同源的 Server-Sent Events 通道。
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { onMessage, enabled = true } = options
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  const connectRef = useRef<() => void>(() => {})

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    setConnected(false)
  }, [])

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return

    try {
      const source = new EventSource('/api/v1/events/stream')
      eventSourceRef.current = source

      source.onopen = () => {
        setConnected(true)
      }

      source.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SSEEvent
          onMessageRef.current?.({ type: parsed.type, data: parsed.payload })
        } catch {
          // 忽略无法解析的实时消息，避免单条坏消息拖垮页面。
        }
      }

      source.onerror = () => {
        source.close()
        eventSourceRef.current = null
        setConnected(false)

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connectRef.current()
          }, 3000 + Math.random() * 2000)
        }
      }
    } catch {
      setConnected(false)
    }
  }, [enabled])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const sendMessage = useCallback((message: RealtimeMessage) => {
    void message
    // SSE 是服务器单向推送；前端发送消息继续使用已有 HTTP API。
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      connectRef.current()
    }, 0)
    return () => {
      clearTimeout(timer)
      disconnect()
    }
  }, [disconnect])

  return { connected, sendMessage, reconnect: connect, disconnect }
}
