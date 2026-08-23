'use client'
import { useToast } from '../../../components/ui/Toast'
import { useTranslation } from '../../../components/TranslationProvider'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { useCurrentUser } from '../../../lib/hooks'
import {
  getBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  getUsers,
  grantBadgeToUser,
  revokeBadgeFromUser,
  getBadgeHolders,
  runBadgeEvaluation,
  type CreateBadgePayload,
} from '../../../lib/api/admin'
import { BADGE_COLORS } from '@myndbbs/shared'
import type {
  BadgeDto,
  BadgeConditionJson,
  BadgeHolder,
} from '../../../types/badges'
import { resolveBadgeName } from '../../../components/BadgeChip'
import { Award, Pencil, Plus, RefreshCw, Trash2, UserCheck } from 'lucide-react'

interface AdminUserRow {
  id: string
  username: string
  email: string
}

type ConditionKind = NonNullable<BadgeConditionJson['kind']>

const AUTO_CONDITION_KINDS: ConditionKind[] = [
  'user_level',
  'post_count',
  'comment_count',
  'content_count',
  'night_activity',
]

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  icon: '',
  color: 'blue' as string,
  grantType: 'MANUAL' as 'AUTO' | 'MANUAL',
  kind: 'manual' as ConditionKind,
  threshold: 10,
  startHour: 0,
  endHour: 6,
}

export default function BadgesPage() {
  const { toast } = useToast()
  const dict = useTranslation()
  const { user: currentUser } = useCurrentUser()
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN'

  const [badges, setBadges] = useState<BadgeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 编辑表单（新建/编辑共用）
  const [formOpen, setFormOpen] = useState(false)
  const [editingBadge, setEditingBadge] = useState<BadgeDto | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formLoading, setFormLoading] = useState(false)

  const [deletingBadge, setDeletingBadge] = useState<BadgeDto | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 授予流程
  const [grantingBadge, setGrantingBadge] = useState<BadgeDto | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userResults, setUserResults] = useState<AdminUserRow[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)
  const [grantReason, setGrantReason] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)

  // 持有人查看
  const [holdersBadge, setHoldersBadge] = useState<BadgeDto | null>(null)
  const [holders, setHolders] = useState<BadgeHolder[]>([])
  const [holderSearch, setHolderSearch] = useState('')
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)

  const loadBadges = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setBadges(await getBadges())
      setError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToLoadBadges ||
          'Failed to load badges',
      )
    } finally {
      setLoading(false)
    }
  }, [dict])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadBadges()
    }, 0)
    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadBadges])

  // 授予弹窗中的用户防抖搜索
  useEffect(() => {
    if (!grantingBadge) return
    const timerId = window.setTimeout(async () => {
      const query = userSearchQuery.trim()
      if (!query || selectedUser) {
        if (!selectedUser) setUserResults([])
        return
      }
      try {
        const users = await getUsers(query)
        setUserResults(users.slice(0, 8))
      } catch {
        setUserResults([])
      }
    }, 300)
    return () => {
      window.clearTimeout(timerId)
    }
  }, [grantingBadge, userSearchQuery, selectedUser])

  const openCreateForm = () => {
    setEditingBadge(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEditForm = (badge: BadgeDto) => {
    setEditingBadge(badge)
    setForm({
      code: badge.code,
      name: badge.name,
      description: badge.description ?? '',
      icon: badge.icon ?? '',
      color: badge.color ?? 'gray',
      grantType: badge.grantType,
      kind: badge.condition?.kind ?? 'manual',
      threshold: badge.condition?.threshold ?? 10,
      startHour: badge.condition?.startHour ?? 0,
      endHour: badge.condition?.endHour ?? 6,
    })
    setFormOpen(true)
  }

  const handleToggleActive = async (badge: BadgeDto) => {
    try {
      await updateBadge(badge.id, { isActive: !badge.isActive })
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToUpdateBadge ||
          'Failed to update badge',
        'error',
      )
    }
  }

  const handleSubmitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setFormLoading(true)
      const condition = buildCondition(form)
      if (editingBadge) {
        await updateBadge(editingBadge.id, { ...buildBasePayload(form), condition })
        toast(dict.admin?.badgeUpdated || 'Badge updated', 'success')
      } else {
        await createBadge({
          code: form.code,
          ...buildBasePayload(form),
          condition,
        })
        toast(dict.admin?.badgeCreated || 'Badge created', 'success')
      }
      setFormOpen(false)
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          (editingBadge ? dict.admin?.failedToUpdateBadge : dict.admin?.failedToCreateBadge) ||
          'Failed to save badge',
        'error',
      )
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingBadge) return
    try {
      setDeleteLoading(true)
      await deleteBadge(deletingBadge.id)
      toast(dict.admin?.badgeDeleted || 'Badge deleted', 'success')
      setDeletingBadge(null)
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToDeleteBadge ||
          'Failed to delete badge',
        'error',
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleGrant = async () => {
    if (!grantingBadge || !selectedUser) return
    try {
      setGrantLoading(true)
      await grantBadgeToUser(grantingBadge.id, selectedUser.id, grantReason || undefined)
      toast(dict.admin?.badgeGranted || 'Badge granted', 'success')
      closeGrantModal()
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToGrantBadge ||
          'Failed to grant badge',
        'error',
      )
    } finally {
      setGrantLoading(false)
    }
  }

  const openHolders = async (badge: BadgeDto) => {
    setHoldersBadge(badge)
    setHolderSearch('')
    try {
      setHolders(await getBadgeHolders(badge.id))
    } catch {
      setHolders([])
    }
  }

  const searchHolders = async (query: string) => {
    if (!holdersBadge) return
    setHolderSearch(query)
    try {
      setHolders(await getBadgeHolders(holdersBadge.id, query || undefined))
    } catch {
      setHolders([])
    }
  }

  const handleRevoke = async (userId: string) => {
    if (!holdersBadge) return
    try {
      setRevokingUserId(userId)
      await revokeBadgeFromUser(holdersBadge.id, userId)
      toast(dict.admin?.badgeRevoked || 'Badge revoked', 'success')
      setHolders(await getBadgeHolders(holdersBadge.id, holderSearch || undefined))
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] ||
          msg ||
          dict.admin?.failedToRevokeBadge ||
          'Failed to revoke badge',
        'error',
      )
    } finally {
      setRevokingUserId(null)
    }
  }

  const handleRunEvaluation = async () => {
    try {
      const result = await runBadgeEvaluation()
      toast(`${dict.admin?.evaluationDone || 'Evaluation finished'} (+${result.grantedCount})`, 'success')
      await loadBadges()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast((dict.apiErrors as Record<string, string>)?.[msg] || msg || 'Failed', 'error')
    }
  }

  const closeGrantModal = () => {
    setGrantingBadge(null)
    setUserSearchQuery('')
    setUserResults([])
    setSelectedUser(null)
    setGrantReason('')
  }

  /** 条件的人类可读描述 */
  const describeCondition = (condition: BadgeConditionJson | null): string => {
    if (!condition || condition.kind === 'manual') {
      return dict.admin?.condManual || 'Manual grant only'
    }
    switch (condition.kind) {
      case 'user_level':
        return `${dict.admin?.condUserLevel || 'Level'} ≥ ${condition.threshold}`
      case 'post_count':
        return `${dict.admin?.condPostCount || 'Posts'} ≥ ${condition.threshold}`
      case 'comment_count':
        return `${dict.admin?.condCommentCount || 'Comments'} ≥ ${condition.threshold}`
      case 'content_count':
        return `${dict.admin?.condContentCount || 'Total posts + comments'} ≥ ${condition.threshold}`
      case 'night_activity': {
        const label = dict.admin?.condNightActivity || 'Night contents'
        return `${label} (${String(condition.startHour).padStart(2, '0')}:00–${String(condition.endHour).padStart(2, '0')}:00 UTC${(condition.utcOffsetHours ?? 8) >= 0 ? '+' : ''}${condition.utcOffsetHours ?? 8}) ≥ ${condition.threshold}`
      }
      default:
        return '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-6 w-6" />
            {dict.admin?.badgeManagement || 'Badge Management'}
          </h1>
          <p className="text-muted">{dict.admin?.badgeDesc || 'Manage user badges.'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={handleRunEvaluation}>
              {dict.admin?.runEvaluation || 'Run evaluation'}
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateForm}>
              {dict.admin?.createBadge || 'Create badge'}
            </Button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted">
          {dict.admin?.moderatorBadgeHint || 'You can grant or revoke badges but cannot manage definitions.'}
        </div>
      )}

      {error ? (
        <div className="p-8 text-center text-red-500">{error}</div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.admin?.badgeName || 'Name'}</TableHead>
                <TableHead>{dict.admin?.badgeType || 'Type'}</TableHead>
                <TableHead>{dict.admin?.grantTypeLabel || 'How to obtain'}</TableHead>
                <TableHead>{dict.admin?.holderCount || 'Holders'}</TableHead>
                <TableHead>{dict.admin?.status || 'Status'}</TableHead>
                <TableHead>{dict.admin?.actions || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && badges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted">
                    {dict.common?.loading || 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : badges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted">
                    {dict.common?.noData || 'No badges'}
                  </TableCell>
                </TableRow>
              ) : (
                badges.map((badge) => (
                  <TableRow key={badge.id}>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          badge.isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500'
                        }`}
                      >
                        {badge.icon && <span aria-hidden>{badge.icon}</span>}
                        {resolveBadgeName(badge, dict)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-muted">{badge.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{badge.type === 'SYSTEM' ? dict.admin?.typeSystem || 'Built-in' : dict.admin?.typeCustom || 'Custom'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span
                          className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-xs ${
                            badge.grantType === 'AUTO'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {badge.grantType === 'AUTO' ? dict.admin?.grantTypeAuto || 'Auto' : dict.admin?.grantTypeManual || 'Manual'}
                        </span>
                        <span className="text-muted">{describeCondition(badge.condition)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{badge.holderCount}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => void handleToggleActive(badge)}
                        disabled={!isAdmin}
                        title={isAdmin ? undefined : dict.admin?.systemBadgeHint || 'Admin only'}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium disabled:cursor-not-allowed ${
                          badge.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {badge.isActive ? dict.admin?.activeBadge || 'Active' : dict.admin?.inactiveBadge || 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <button
                          onClick={() => void openHolders(badge)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                        >
                          {dict.admin?.viewHolders || 'Holders'}
                        </button>
                        <button
                          onClick={() => {
                            setGrantingBadge(badge)
                            setSelectedUser(null)
                            setGrantReason('')
                          }}
                          className="inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-500 dark:text-green-400"
                        >
                          <UserCheck className="h-4 w-4" />
                          {dict.admin?.grantAction || 'Grant'}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEditForm(badge)}
                              disabled={badge.type === 'SYSTEM'}
                              title={badge.type === 'SYSTEM' ? dict.admin?.systemBadgeHint || 'Built-in badges are read-only' : undefined}
                              className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingBadge(badge)}
                              disabled={badge.type === 'SYSTEM'}
                              title={badge.type === 'SYSTEM' ? dict.admin?.systemBadgeHint || 'Built-in badges cannot be deleted' : undefined}
                              className="text-red-600 hover:text-red-500 dark:text-red-400 disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 新建 / 编辑徽章 */}
      <Modal
        isOpen={formOpen}
        onClose={() => {
          if (!formLoading) setFormOpen(false)
        }}
        title={editingBadge ? dict.admin?.editBadge || 'Edit badge' : dict.admin?.createBadge || 'Create badge'}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {!editingBadge && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="badge-code">
                {dict.admin?.badgeCode || 'Code'}
              </label>
              <input
                id="badge-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="super_fan"
                pattern="[a-z0-9_]{2,64}"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <p className="text-xs text-muted">a-z / 0-9 / _</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="badge-name">
              {dict.admin?.badgeName || 'Name'}
            </label>
            <input
              id="badge-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              maxLength={64}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="badge-icon">
                {dict.admin?.badgeIcon || 'Icon'}
              </label>
              <input
                id="badge-icon"
                type="text"
                value={form.icon}
                onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                placeholder="🏆"
                maxLength={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="badge-color">
                {dict.admin?.badgeColor || 'Color'}
              </label>
              <select
                id="badge-color"
                value={form.color}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {BADGE_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="badge-description">
              {dict.admin?.badgeDescription || 'Description'}
            </label>
            <textarea
              id="badge-description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              maxLength={500}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="badge-grant-type">
              {dict.admin?.grantTypeLabel || 'How to obtain'}
            </label>
            <select
              id="badge-grant-type"
              value={form.grantType}
              onChange={(e) => setForm((prev) => ({ ...prev, grantType: e.target.value as 'AUTO' | 'MANUAL' }))}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="MANUAL">{dict.admin?.grantTypeManual || 'Granted by staff'}</option>
              <option value="AUTO">{dict.admin?.grantTypeAuto || 'Auto-granted on condition'}</option>
            </select>
          </div>

          {form.grantType === 'AUTO' && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="badge-cond-kind">
                  {dict.admin?.conditionKind || 'Condition'}
                </label>
                <select
                  id="badge-cond-kind"
                  value={form.kind === 'manual' ? 'user_level' : form.kind}
                  onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as ConditionKind }))}
                  className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {AUTO_CONDITION_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {describeCondition({ kind })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="badge-threshold">
                  {dict.admin?.threshold || 'Threshold'}
                </label>
                <input
                  id="badge-threshold"
                  type="number"
                  min={1}
                  max={1000000}
                  value={form.threshold}
                  onChange={(e) => setForm((prev) => ({ ...prev, threshold: Number(e.target.value) }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              {form.kind === 'night_activity' && (
                <p className="text-xs text-muted">
                  {`${String(form.startHour).padStart(2, '0')}:00 – ${String(form.endHour).padStart(2, '0')}:00 (UTC+8)`}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={formLoading} onClick={() => setFormOpen(false)}>
              {dict.common?.cancel || 'Cancel'}
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingBadge ? dict.common?.save || 'Save' : dict.admin?.createBadge || 'Create badge'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 删除确认 */}
      <Modal
        isOpen={Boolean(deletingBadge)}
        onClose={() => {
          if (!deleteLoading) setDeletingBadge(null)
        }}
        title={dict.admin?.deleteBadge || 'Delete badge'}
      >
        <div className="space-y-4">
          <p className="text-sm">
            {(dict.admin?.confirmDeleteBadge || 'Delete badge "{name}"? Holders will lose it.')
              .replace('{name}', deletingBadge?.name ?? '')}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={deleteLoading} onClick={() => setDeletingBadge(null)}>
              {dict.common?.cancel || 'Cancel'}
            </Button>
            <Button type="button" variant="destructive" loading={deleteLoading} onClick={handleDelete}>
              {dict.admin?.deleteBadge || 'Delete badge'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 授予徽章 */}
      <Modal
        isOpen={Boolean(grantingBadge)}
        onClose={() => {
          if (!grantLoading) closeGrantModal()
        }}
        title={`${dict.admin?.grantAction || 'Grant'} · ${grantingBadge ? resolveBadgeName(grantingBadge, dict) : ''}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              placeholder={dict.common?.searchPlaceholder || 'Search users...'}
              value={selectedUser ? selectedUser.username : userSearchQuery}
              onChange={(e) => {
                setSelectedUser(null)
                setUserSearchQuery(e.target.value)
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {selectedUser ? (
              <div className="rounded-md border border-border px-3 py-2 text-sm">
                {selectedUser.username} <span className="text-muted">({selectedUser.email})</span>
              </div>
            ) : (
              userResults.length > 0 && (
                <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
                  {userResults.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                      >
                        {user.username} <span className="text-muted">({user.email})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="grant-reason">
              {dict.admin?.reasonOptional || 'Reason (optional)'}
            </label>
            <input
              id="grant-reason"
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              maxLength={200}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={grantLoading} onClick={closeGrantModal}>
              {dict.common?.cancel || 'Cancel'}
            </Button>
            <Button
              type="button"
              disabled={!selectedUser}
              loading={grantLoading}
              onClick={() => void handleGrant()}
            >
              {dict.admin?.grantAction || 'Grant'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 持有人管理 */}
      <Modal
        isOpen={Boolean(holdersBadge)}
        onClose={() => setHoldersBadge(null)}
        title={`${dict.admin?.holders || 'Holders'} · ${holdersBadge ? resolveBadgeName(holdersBadge, dict) : ''}`}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder={dict.common?.search || 'Search...'}
            value={holderSearch}
            onChange={(e) => void searchHolders(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {holders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{dict.common?.noData || 'No data'}</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
              {holders.map((holder) => (
                <li key={holder.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <span className="font-medium">{holder.username}</span>
                    {holder.grantedByUsername && (
                      <span className="ml-2 text-xs text-muted">
                        ← {holder.grantedByUsername}
                      </span>
                    )}
                    <div className="text-xs text-muted">
                      {new Date(holder.grantedAt).toLocaleDateString()}
                      {holder.reason ? ` · ${holder.reason}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleRevoke(holder.userId)}
                    disabled={revokingUserId === holder.userId}
                    className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                  >
                    {dict.admin?.revokeBadge || 'Revoke'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  )
}

function buildBasePayload(form: typeof EMPTY_FORM): Omit<CreateBadgePayload, 'code' | 'condition'> {
  return {
    name: form.name,
    description: form.description || null,
    icon: form.icon || null,
    color: form.color,
    grantType: form.grantType,
  }
}

/** 根据表单状态构造条件对象；MANUAL 时为 undefined（后端落为 manual） */
function buildCondition(form: typeof EMPTY_FORM): CreateBadgePayload['condition'] {
  if (form.grantType !== 'AUTO') return undefined
  const kind = form.kind === 'manual' ? ('user_level' as const) : form.kind
  return {
    kind,
    threshold: form.threshold,
    ...(kind === 'night_activity'
      ? { startHour: form.startHour, endHour: form.endHour, utcOffsetHours: 8 }
      : {}),
  }
}
