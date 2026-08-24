'use client'
import { useTranslation } from '../../../components/TranslationProvider'

import React, { useCallback, useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { getSiteStats, type SiteStats } from '../../../lib/api/admin'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-3xl font-bold text-foreground">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

export default function StatsPage() {
  const dict = useTranslation()
  const [stats, setStats] = useState<SiteStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setStats(await getSiteStats())
      setError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError((dict.apiErrors as Record<string, string>)?.[msg] || msg || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [dict])

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  if (loading) {
    return <div className="p-10 text-center text-muted">{dict.common?.loading || 'Loading...'}</div>
  }

  if (error || !stats) {
    return <div className="p-10 text-center text-red-500">{error || 'Failed to load'}</div>
  }

  const t = (key: string, fallback: string) =>
    (dict.admin as unknown as Record<string, string | undefined>)?.[`stat_${key}`] || fallback

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-bold tracking-tight">{dict.admin?.statsTitle || 'Site Statistics'}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('users', 'Users')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('usersTotal', 'Total users')} value={stats.users.total} />
          <StatCard label={dict.admin?.stat_usersToday || 'New today'} value={stats.users.today} />
          <StatCard label={dict.admin?.stat_users7d || 'New in 7 days'} value={stats.users.last7Days} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('posts', 'Posts')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('postsTotal', 'Total posts')} value={stats.posts.total} />
          <StatCard label={dict.admin?.stat_postsToday || 'New today'} value={stats.posts.today} />
          <StatCard label={dict.admin?.stat_posts7d || 'New in 7 days'} value={stats.posts.last7Days} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t('comments', 'Comments')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t('commentsTotal', 'Total comments')} value={stats.comments.total} />
          <StatCard label={dict.admin?.stat_commentsToday || 'New today'} value={stats.comments.today} />
          <StatCard label={dict.admin?.stat_comments7d || 'New in 7 days'} value={stats.comments.last7Days} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {dict.admin?.moderation || 'Moderation'}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={dict.admin?.report_PENDING || 'Pending reports'}
            value={stats.moderation.pendingReports}
          />
        </div>
      </section>
    </div>
  )
}
