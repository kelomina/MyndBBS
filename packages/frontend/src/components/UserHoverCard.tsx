'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { Avatar } from './Avatar'
import { BadgeChip } from './BadgeChip'
import { useTranslation } from './TranslationProvider'
import type { ProfileBadge, PublicUserProfile } from '../types'

const HOVER_OPEN_DELAY_MS = 300
const HOVER_CLOSE_GRACE_MS = 150

/** 会话内公开资料缓存（username → 资料） */
const profileCache = new Map<string, PublicUserProfile>()

interface UserHoverCardProps {
  username: string
  children: React.ReactNode
}

/**
 * Hover 用户卡：悬停用户名 300ms 后展示资料浮层
 * （头像/徽章 ≤4/bio 一行/加入时间/帖子数），数据来自公开资料接口。
 */
export function UserHoverCard({ username, children }: UserHoverCardProps) {
  const dict = useTranslation()
  const [profile, setProfile] = useState<PublicUserProfile | null>(
    profileCache.get(username.toLowerCase()) ?? null
  )
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const handleEnter = () => {
    clearTimers()
    openTimerRef.current = window.setTimeout(async () => {
      let data = profileCache.get(username.toLowerCase()) ?? null
      if (!data) {
        setLoading(true)
        try {
          const res = await fetch(`/api/v1/user/public/${encodeURIComponent(username)}`)
          if (res.ok) {
            const json = await res.json()
            data = (json.user ?? null) as PublicUserProfile | null
            if (data) profileCache.set(username.toLowerCase(), data)
          }
        } catch {
          // 静默：hover 卡是增强功能
        } finally {
          setLoading(false)
        }
      }
      setProfile(data)
      setVisible(true)
    }, HOVER_OPEN_DELAY_MS)
  }

  const handleLeave = () => {
    clearTimers()
    closeTimerRef.current = window.setTimeout(() => setVisible(false), HOVER_CLOSE_GRACE_MS)
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {visible && (
        <span className="absolute left-0 top-full z-40 mt-2 block w-72 rounded-xl border border-border bg-card p-4 text-left shadow-lg">
          {loading && !profile ? (
            <span className="block text-xs text-muted">{dict.common?.loading || 'Loading...'}</span>
          ) : profile ? (
            <>
              <span className="flex items-center gap-3">
                <Avatar src={profile.avatarUrl} username={profile.username} size={40} />
                <span className="min-w-0">
                  <Link
                    href={`/u/${encodeURIComponent(profile.username)}`}
                    onClick={() => setVisible(false)}
                    className="block truncate font-semibold text-foreground hover:underline"
                  >
                    @{profile.username}
                  </Link>
                  {Array.isArray(profile.badges) && profile.badges.length > 0 && (
                    <span className="mt-1 inline-flex flex-wrap items-center gap-1">
                      {profile.badges.slice(0, 4).map((b: ProfileBadge) => (
                        <BadgeChip key={b.id} badge={b} dict={dict} compact />
                      ))}
                    </span>
                  )}
                </span>
              </span>
              {typeof profile.bio === 'string' && profile.bio.trim() !== '' && (
                <span className="mt-2 block line-clamp-2 text-xs text-muted">{profile.bio}</span>
              )}
              <span className="mt-2 block text-xs text-muted">
                {(dict.userCard?.joined || 'Joined {date}').replace(
                  '{date}',
                  new Date(profile.createdAt).toLocaleDateString(navigator.language || 'en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                )}
                {' · '}
                {(dict.userCard?.posts || '{count} posts').replace(
                  '{count}',
                  String(profile._count?.posts ?? 0)
                )}
              </span>
            </>
          ) : (
            <span className="block text-xs text-muted">@{username}</span>
          )}
        </span>
      )}
    </span>
  )
}
