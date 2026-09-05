'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Loader2, PenSquare, Mail } from 'lucide-react';
import { Avatar } from '../Avatar';
import { fetchWithAuth } from '../../lib/api/fetcher';
import { useWebSocket } from '../../lib/hooks/useWebSocket';

function formatTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}

/**
 * 通知徽标合计（先徽标合计，收件箱另立项）。
 * - 并行拉取私信 /api/v1/messages/unread + 通知 /api/notifications/unread-count 求和（不混表）。
 * - 99+ 封顶；aria-label 拆分（{dm}条私信·{n}条通知）+ tooltip 拆分；WS notification 分流刷新。
 * - notifications-read 事件 + 现有 30s 轮询复用（未连时）；401 未登录隐藏徽标；不做收件箱页。
 * - i18n 经 props 注入（RSC Header 经 getPublicDictionary 透出 notifications.badgeAria/badgeTooltip），
 *   缺省回退 en 模板；不直连 TranslationProvider（UserNav 为无 provider 岛）。
 */
export function UserNav({
  title,
  newPostText,
  messagesText,
  badgeAriaTemplate,
  badgeTooltipTemplate,
}: {
  title: string;
  newPostText?: string;
  messagesText?: string;
  badgeAriaTemplate?: string;
  badgeTooltipTemplate?: string;
}) {
  const [user, setUser] = useState<{ username: string; avatarUrl?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dmUnread, setDmUnread] = useState(0);
  const [notifyUnread, setNotifyUnread] = useState(0);

  const fetchUnreadCount = useCallback(() => {
    // 并行求和：任一 401/失败按 0 计（未登录隐藏徽标由 user==null 保证）
    const dmReq = fetchWithAuth('/api/v1/messages/unread?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => (typeof d.count === 'number' && d.count > 0 ? Math.floor(d.count) : 0))
      .catch(() => 0);
    const notifyReq = fetchWithAuth('/api/notifications/unread-count?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => (typeof d.count === 'number' && d.count > 0 ? Math.floor(d.count) : 0))
      .catch(() => 0);
    void Promise.all([dmReq, notifyReq]).then(([dm, n]) => {
      setDmUnread(dm);
      setNotifyUnread(n);
    });
  }, []);

  const fetchDmOnly = useCallback(() => {
    fetchWithAuth('/api/v1/messages/unread?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setDmUnread(typeof d.count === 'number' && d.count > 0 ? Math.floor(d.count) : 0))
      .catch(() => setDmUnread(0));
  }, []);

  const fetchNotifyOnly = useCallback(() => {
    fetchWithAuth('/api/notifications/unread-count?t=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setNotifyUnread(typeof d.count === 'number' && d.count > 0 ? Math.floor(d.count) : 0))
      .catch(() => setNotifyUnread(0));
  }, []);

  const { connected } = useWebSocket({
    enabled: !!user,
    onMessage: (message) => {
      // WS 分流：notification→刷通知数，new_message→刷私信数（旧同刷私信已拆分）
      if (message.type === 'notification') {
        fetchNotifyOnly();
        window.dispatchEvent(new Event('notifications-received'));
      } else if (message.type === 'new_message') {
        fetchDmOnly();
        window.dispatchEvent(new Event('messages-received'));
      }
    },
  });

  useEffect(() => {
    fetchUnreadCount()
    const interval = connected ? null : setInterval(fetchUnreadCount, 30000)
    const handleDmUpdate = () => fetchDmOnly();
    const handleNotifyUpdate = () => fetchNotifyOnly();
    window.addEventListener('messages-read', handleDmUpdate);
    window.addEventListener('messages-received', handleDmUpdate);
    window.addEventListener('notifications-read', handleNotifyUpdate);
    window.addEventListener('notifications-received', handleNotifyUpdate);

    return () => {
      if (interval) clearInterval(interval)
      window.removeEventListener('messages-read', handleDmUpdate);
      window.removeEventListener('messages-received', handleDmUpdate);
      window.removeEventListener('notifications-read', handleNotifyUpdate);
      window.removeEventListener('notifications-received', handleNotifyUpdate);
    };
  }, [connected, fetchUnreadCount, fetchDmOnly, fetchNotifyOnly]);

  useEffect(() => {
    fetchWithAuth('/api/v1/user/profile')
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        throw new Error('Not authenticated');
      })

      .then(data => {
        setUser(data.user);
        fetchUnreadCount();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ avatarUrl?: string | null }>;
      setUser(prev => prev ? { ...prev, avatarUrl: customEvent.detail?.avatarUrl ?? null } : prev);
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, []);

  if (loading) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (user) {
    const total = dmUnread + notifyUnread;
    const display = total > 99 ? '99+' : String(total);
    const ariaLabel = formatTemplate(badgeAriaTemplate || '{dm} DMs · {n} notifications', {
      dm: dmUnread,
      n: notifyUnread,
    });
    const tooltip = formatTemplate(badgeTooltipTemplate || 'DMs {dm} · Notifications {n}', {
      dm: dmUnread,
      n: notifyUnread,
    });
    void messagesText;
    return (
      <>
        {newPostText && (
          <Link
            href="/compose"
            className="hidden sm:flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            {newPostText}
          </Link>
        )}
        <Link
          href="/messages"
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
          title={tooltip}
          aria-label={ariaLabel}
        >
          <Mail className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {display}
            </span>
          )}
        </Link>
        <Link
          href={`/u/${user.username}`}
          className="transition-transform hover:scale-105"
          title={title}
        >
          <Avatar src={user.avatarUrl} username={user.username} size={36} className="border-2 border-primary" />
        </Link>
      </>
    );
  }

  return (
    <Link
      href="/login"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:bg-background hover:text-foreground"
      title={title}
    >
      <User className="h-5 w-5" />
      <span className="sr-only">{title}</span>
    </Link>
  );
}
