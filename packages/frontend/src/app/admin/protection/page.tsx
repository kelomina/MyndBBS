'use client'
import { useToast } from '../../../components/ui/Toast'
import { useTranslation } from '../../../components/TranslationProvider'

import React, { useCallback, useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { RateLimitPolicySection } from '../../../components/RateLimitPolicySection'
import { FederalCaptchaSection } from '../../../components/FederalCaptchaSection'
import {
  getIpBans,
  createIpBan,
  deleteIpBan,
  getAntiSpamPolicy,
  updateAntiSpamPolicy,
  getSiteSettings,
  updateSiteSettings,
} from '../../../lib/api/admin'
import type { BannedIpItem, AntiSpamPolicy } from '../../../types/protection'
import type { SiteSettings as SiteSettingsType } from '../../../lib/api/admin'
import { Ban, Plus, ShieldAlert } from 'lucide-react'

const EMPTY_BAN_FORM = { ip: '', scope: 'ALL' as 'ALL' | 'REGISTRATION', reason: '', expiresInDays: '' }

export default function ProtectionPage() {
  const { toast } = useToast()
  const dict = useTranslation()

  const [bans, setBans] = useState<BannedIpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [banFormOpen, setBanFormOpen] = useState(false)
  const [banForm, setBanForm] = useState(EMPTY_BAN_FORM)
  const [banLoading, setBanLoading] = useState(false)

  const [policy, setPolicy] = useState<AntiSpamPolicy | null>(null)
  const [policySaving, setPolicySaving] = useState(false)
  const [siteSettings, setSiteSettings] = useState<SiteSettingsType | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const loadAll = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const [ipBans, antiSpam, siteCfg] = await Promise.all([
        getIpBans(),
        getAntiSpamPolicy(),
        getSiteSettings(),
      ])
      setBans(ipBans)
      setPolicy(antiSpam)
      setSiteSettings(siteCfg)
      setError('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError((dict.apiErrors as Record<string, string>)?.[msg] || msg || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [dict])

  useEffect(() => {
    const id = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(id)
  }, [loadAll])

  const handleCreateBan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setBanLoading(true)
      await createIpBan({
        ip: banForm.ip.trim(),
        scope: banForm.scope,
        reason: banForm.reason.trim() || undefined,
        ...(banForm.expiresInDays ? { expiresInDays: Number(banForm.expiresInDays) } : {}),
      })
      toast(dict.admin?.ipBanCreated || 'IP banned', 'success')
      setBanFormOpen(false)
      await loadAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] || msg || dict.admin?.failedToBanIp || 'Failed',
        'error',
      )
    } finally {
      setBanLoading(false)
    }
  }

  const handleSaveSiteSettings = async () => {
    if (!siteSettings) return
    try {
      setSettingsSaving(true)
      const saved = await updateSiteSettings({
        siteName: siteSettings.siteName,
        announcement: siteSettings.announcement,
        registrationDisabled: siteSettings.registrationDisabled,
      })
      setSiteSettings(saved)
      toast(dict.admin?.settingsSaved || 'Site settings saved', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] || msg || dict.admin?.failedToSaveSettings || 'Failed',
        'error',
      )
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleUnban = async (id: string) => {
    try {
      await deleteIpBan(id)
      toast(dict.admin?.ipUnbanned || 'IP unbanned', 'success')
      await loadAll()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] || msg || dict.admin?.failedToUnbanIp || 'Failed',
        'error',
      )
    }
  }

  const handleSavePolicy = async () => {
    if (!policy) return
    try {
      setPolicySaving(true)
      const saved = await updateAntiSpamPolicy(policy)
      setPolicy(saved)
      toast(dict.admin?.policySaved || 'Policy saved', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      toast(
        (dict.apiErrors as Record<string, string>)?.[msg] || msg || dict.admin?.failedToSavePolicy || 'Failed',
        'error',
      )
    } finally {
      setPolicySaving(false)
    }
  }

  const updatePolicyField = (field: keyof AntiSpamPolicy, raw: string) => {
    if (!policy) return
    const num = Math.max(0, Math.floor(Number(raw) || 0))
    setPolicy({ ...policy, [field]: num })
  }

  const numberInput = (
    field: keyof AntiSpamPolicy,
    label: string,
    hint: string
  ) => (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={`policy-${field}`}>{label}</label>
      <input
        id={`policy-${field}`}
        type="number"
        min={0}
        value={policy ? String(policy[field]) : '0'}
        onChange={(e) => updatePolicyField(field, e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="h-6 w-6" />
          {dict.admin?.protectionTitle || 'Protection & Anti-spam'}
        </h1>
        <p className="text-muted">{dict.admin?.protectionDesc || 'Manage IP bans and new-account anti-spam rules.'}</p>
      </div>

      {/* ── 防灌水策略 ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{dict.admin?.antiSpamTitle || 'New-account anti-spam rules'}</h2>
        {policy && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {numberInput(
                'accountAgeDays',
                dict.admin?.accountAgeDays || 'New-user window (days)',
                dict.admin?.accountAgeDaysHint || '0 disables all rules below'
              )}
              {numberInput(
                'cooldownMinutes',
                dict.admin?.cooldownMinutes || 'Registration cooldown (minutes)',
                dict.admin?.cooldownHint || 'Blocks posting right after registration'
              )}
              {numberInput(
                'maxNewContentsPerHour',
                dict.admin?.maxPerHour || 'Max posts/hour for new users',
                dict.admin?.maxPerHourHint || 'Posts + comments combined; 0 = unlimited'
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSavePolicy()} loading={policySaving}>
                {dict.common?.save || 'Save'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── 读接口限流与解锁（F4 新增第四节前置：与防灌水/站点设置/IP封禁并列） ── */}
      <RateLimitPolicySection />

      {/* ── 联邦验证题型与难度（第五节进站：沿 RateLimitPolicySection，6 字段 strict） ── */}
      <FederalCaptchaSection />

      {/* ── 站点设置 ── */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">{dict.admin?.siteSettingsTitle || 'Site settings'}</h2>
        {siteSettings && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="site-name">{dict.admin?.siteName || 'Site name'}</label>
              <input
                id="site-name"
                type="text"
                value={siteSettings.siteName}
                onChange={(e) => setSiteSettings({ ...siteSettings, siteName: e.target.value })}
                maxLength={64}
                placeholder="MyndBBS"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted">{dict.admin?.siteNameHint || 'Shown in the header. Empty = default MyndBBS.'}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="announcement">{dict.admin?.announcement || 'Announcement'}</label>
              <textarea
                id="announcement"
                rows={2}
                maxLength={500}
                value={siteSettings.announcement}
                onChange={(e) => setSiteSettings({ ...siteSettings, announcement: e.target.value })}
                placeholder={dict.admin?.announcementPlaceholder || 'Shown as a banner on every page'}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={!siteSettings.registrationDisabled}
                onChange={(e) => setSiteSettings({ ...siteSettings, registrationDisabled: !e.target.checked })}
                className="accent-primary"
              />
              {dict.admin?.registrationOpen || 'Open registration'}
            </label>

            <div className="flex justify-end">
              <Button onClick={() => void handleSaveSiteSettings()} loading={settingsSaving}>
                {dict.common?.save || 'Save'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── IP 封禁 ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{dict.admin?.ipBanTitle || 'Banned IPs'}</h2>
          <Button
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setBanFormOpen(true)}
          >
            {dict.admin?.addIpBan || 'Add ban'}
          </Button>
        </div>

        {error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-muted">{dict.common?.loading || 'Loading...'}</div>
        ) : bans.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
            {dict.admin?.noIpBans || 'No banned IPs'}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP</TableHead>
                  <TableHead>{dict.admin?.badgeType || 'Type'}</TableHead>
                  <TableHead>{dict.admin?.reasonLabel || 'Reason'}</TableHead>
                  <TableHead>{dict.admin?.expires || 'Expires'}</TableHead>
                  <TableHead>{dict.admin?.actions || 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bans.map((ban) => (
                  <TableRow key={ban.id}>
                    <TableCell className="font-mono">{ban.ip}</TableCell>
                    <TableCell>
                      {ban.scope === 'ALL'
                        ? dict.admin?.scopeAll || 'Site-wide'
                        : dict.admin?.scopeRegistration || 'Registration only'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{ban.reason || '-'}</TableCell>
                    <TableCell className="text-sm text-muted">
                      {ban.expiresAt ? new Date(ban.expiresAt).toLocaleString() : dict.admin?.permanent || 'Permanent'}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => void handleUnban(ban.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                      >
                        {dict.admin?.unbanAction || 'Unban'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 新增封禁弹窗 */}
      <Modal
        isOpen={banFormOpen}
        onClose={() => {
          if (!banLoading) setBanFormOpen(false)
        }}
        title={dict.admin?.addIpBan || 'Add IP ban'}
      >
        <form onSubmit={handleCreateBan} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ban-ip">{dict.admin?.ipAddress || 'IP address'}</label>
            <input
              id="ban-ip"
              type="text"
              value={banForm.ip}
              onChange={(e) => setBanForm((prev) => ({ ...prev, ip: e.target.value }))}
              placeholder="203.0.113.7"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ban-scope">{dict.admin?.banScope || 'Scope'}</label>
            <select
              id="ban-scope"
              value={banForm.scope}
              onChange={(e) => setBanForm((prev) => ({ ...prev, scope: e.target.value as 'ALL' | 'REGISTRATION' }))}
              className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{dict.admin?.scopeAll || 'Site-wide (register + login)'}</option>
              <option value="REGISTRATION">{dict.admin?.scopeRegistration || 'Registration only'}</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ban-reason">{dict.admin?.reasonOptional || 'Reason (optional)'}</label>
            <input
              id="ban-reason"
              type="text"
              value={banForm.reason}
              onChange={(e) => setBanForm((prev) => ({ ...prev, reason: e.target.value }))}
              maxLength={200}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="ban-days">{dict.admin?.expiresInDays || 'Expires in days (empty = permanent)'}</label>
            <input
              id="ban-days"
              type="number"
              min={1}
              max={3650}
              value={banForm.expiresInDays}
              onChange={(e) => setBanForm((prev) => ({ ...prev, expiresInDays: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted">
            <Ban className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{dict.admin?.ipBanNotice || 'Site-wide bans block both registration and login from this address.'}</span>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={banLoading} onClick={() => setBanFormOpen(false)}>
              {dict.common?.cancel || 'Cancel'}
            </Button>
            <Button type="submit" loading={banLoading}>
              {dict.admin?.addIpBan || 'Add ban'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
