'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle2, Trash2, Download, Pause, Play, RefreshCw, RotateCcw, Save, ShieldCheck, UploadCloud } from 'lucide-react'
import { useTranslation } from '../../../components/TranslationProvider'
import { useToast } from '../../../components/ui/Toast'
import { Button } from '../../../components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import { PluginConfigFields, type ConfigSchema } from '../../../components/plugins/PluginConfigFields'
import { PluginSlot } from '../../../components/plugins/PluginSlot'
import { usePluginSudo } from '../../../components/plugins/usePluginSudo'
import { Modal } from '../../../components/ui/Modal'
import { configIsValid, supportedSchema } from '../../../components/plugins/configValidation'
import { useCurrentUser } from '../../../lib/hooks'
import {
  activatePlugin,
  approvePluginRelease,
  deactivatePlugin,
  removePlugin,
  getPluginConfig,
  getPluginHealth,
  getPluginEventBacklog,
  getPlugins,
  reloadPlugin,
  rollbackPlugin,
  updatePluginConfig,
  uploadPluginRelease,
  type PluginAdminDto,
  type PluginEventBacklog,

} from '../../../lib/api/admin'

function statusClass(status: string): string {
  if (status === 'ACTIVE' || status === 'APPROVED') return 'text-emerald-600'
  if (status === 'UNHEALTHY' || status === 'FAILED') return 'text-red-600'
  return 'text-amber-600'
}

export default function PluginAdminClient() {
  const dict = useTranslation()
  const { toast } = useToast()
  const text = dict.pluginPlatform
  const sudo = usePluginSudo()
  const mutationLock = useRef(false)
  const configRequest = useRef(0)
  const [deleteTarget, setDeleteTarget] = useState<PluginAdminDto | null>(null)
  const { user } = useCurrentUser()
  const admin = (dict.admin ?? {}) as unknown as Record<string, string | undefined>
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [plugins, setPlugins] = useState<PluginAdminDto[]>([])
  const [backlog, setBacklog] = useState<Record<string, PluginEventBacklog | null>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [healthLoading, setHealthLoading] = useState<string | null>(null)
  const [healthErrors, setHealthErrors] = useState<Record<string, boolean>>({})
  const [artifact, setArtifact] = useState<File | null>(null)
  const [signature, setSignature] = useState('')
  const [uploading, setUploading] = useState(false)
  const [configPlugin, setConfigPlugin] = useState<string | null>(null)
  const [configValue, setConfigValue] = useState<Record<string, unknown>>({})
  const [secretPaths, setSecretPaths] = useState<string[]>([])
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState('')
  const [configRevision, setConfigRevision] = useState(0)
  const [configSchema, setConfigSchema] = useState<ConfigSchema | null>(null)
  const [configSaving, setConfigSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await getPlugins()
      setPlugins(rows)
      const pairs = await Promise.all(rows.map(async (plugin) => [plugin.pluginId, await getPluginEventBacklog(plugin.pluginId).catch(() => null)] as const))
      setBacklog(Object.fromEntries(pairs))
      setError('')
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      setError((dict.apiErrors as Record<string, string>)?.[code] || code || admin.failedToLoadPlugins || 'Failed to load plugins')
    } finally {
      setLoading(false)
    }
  }, [admin.failedToLoadPlugins, dict.apiErrors])

  useEffect(() => {
    if (!isAdmin) return
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load, isAdmin])

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    if (!isSuperAdmin || mutationLock.current) return
    mutationLock.current = true
    setBusy(key)
    try {
      const done = await sudo.run(action)
      if (done) {
        await load()
        toast(admin.actionCompleted || 'Plugin action completed', 'success')
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast((dict.apiErrors as Record<string, string>)?.[code] || code || admin.actionFailed || 'Plugin action failed', 'error')
    } finally { setBusy(null); mutationLock.current = false }
  }

  const checkHealth = async (pluginId: string) => {
    setHealthLoading(pluginId)
    setHealthErrors((current) => ({ ...current, [pluginId]: false }))
    try {
      await getPluginHealth(pluginId)
      // DTO remains the source of displayed health and lastHealthAt after the probe.
      await load()
    } catch { setHealthErrors((current) => ({ ...current, [pluginId]: true })) }
    finally { setHealthLoading(null) }
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!artifact || !signature.trim()) return
    // Capture DOM and immutable inputs before awaiting sudo; synthetic currentTarget expires.
    const input = event.currentTarget.elements.namedItem('artifact') as HTMLInputElement | null
    const file = artifact
    const signed = signature
    setUploading(true)
    await runAction('upload', async () => {
      await uploadPluginRelease(file, signed)
      setArtifact(null); setSignature('')
      if (input) input.value = ''
    })
    setUploading(false)
  }

  const openConfig = async (plugin: PluginAdminDto) => {
    const request = ++configRequest.current
    setConfigPlugin(plugin.pluginId); setConfigLoading(true); setConfigError(''); setConfigSchema(null)
    try {
      const result = await getPluginConfig(plugin.pluginId)
      if (request !== configRequest.current) return
      setConfigValue(result.config); setConfigSchema(result.schema as ConfigSchema | null)
      setSecretPaths(result.secretPaths); setConfigRevision((value) => value + 1)
    } catch { if (request === configRequest.current) setConfigError(text.configError) }
    finally { if (request === configRequest.current) setConfigLoading(false) }
  }

  const saveConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!configPlugin || !configSchema || !configIsValid(configValue, configSchema, secretPaths)) return
    const id = configPlugin
    const request = configRequest.current
    setConfigSaving(true); setConfigError('')
    await runAction(`${id}:config`, async () => {
      try {
        const saved = await updatePluginConfig(id, configValue)
        if (request === configRequest.current) {
          setConfigValue(saved.config); setSecretPaths(saved.secretPaths)
          setConfigSchema(saved.schema as ConfigSchema | null); setConfigRevision((value) => value + 1)
        }
      } catch (error) { setConfigError(text.saveError); throw error }
    })
    setConfigSaving(false)
  }

  if (!isAdmin) return <div className="p-10 text-center text-muted-foreground">{dict.forbidden?.title || 'Not found'}</div>
  if (loading && plugins.length === 0) return <div className="p-10 text-center text-muted-foreground">{dict.common?.loading || 'Loading...'}</div>
  if (error && plugins.length === 0) return <div role="alert" className="space-y-3 rounded-lg border border-border p-6"><p>{error}</p><Button onClick={() => void load()}>{text.retry}</Button></div>

  return (
    <div className="min-w-0 space-y-6">
      {sudo.modal}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!isSuperAdmin && <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm">{text.readOnly}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{admin.pluginsTitle || 'Plugin platform'}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{admin.pluginsDesc || 'Signed v2 plugins run outside the backend process.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} leftIcon={<RefreshCw className="h-4 w-4" />}>{admin.refresh || 'Refresh'}</Button>
      </div>

      {isSuperAdmin && (
        <form onSubmit={handleUpload} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 font-semibold"><UploadCloud className="h-5 w-5" />{admin.uploadRelease || 'Upload signed release'}</div>
          <p className="text-xs text-muted-foreground">{admin.uploadHint || 'The release is verified and placed in quarantine until approval.'}</p>
          <fieldset disabled={Boolean(busy)} className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="min-w-0 text-sm">{admin.archive || 'tar.gz archive'}<input name="artifact" type="file" accept=".tar.gz,.tgz,application/gzip" className="mt-1 block w-full min-w-0 text-sm" onChange={(event) => setArtifact(event.target.files?.[0] ?? null)} /></label>
            <label className="text-sm">{admin.signatureBase64 || 'Detached signature (base64)'}<textarea value={signature} onChange={(event) => setSignature(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs" placeholder="base64" /></label>
            <Button type="submit" loading={uploading} disabled={!artifact || !signature.trim()} leftIcon={<Download className="h-4 w-4" />}>{admin.upload || 'Upload'}</Button>
          </fieldset>
        </form>
      )}

      {plugins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">{admin.noPlugins || 'No plugins registered.'}</div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{admin.plugin || 'Plugin'}</TableHead><TableHead>{admin.version || 'Version'}</TableHead><TableHead>{admin.runtime || 'Runtime'}</TableHead><TableHead>{text.health}</TableHead><TableHead>{admin.events || 'Events'}</TableHead><TableHead>{admin.actions || 'Actions'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {plugins.map((plugin) => {
                const pending = plugin.releases.find((release) => release.state === 'QUARANTINED')
                const approved = plugin.releases.find((release) => release.state === 'APPROVED')
                const previous = plugin.releases.find((release) => release.state === 'RETIRED')
                const counts = backlog[plugin.pluginId]
                return <TableRow key={plugin.pluginId}>
                  <TableCell className="max-w-64 break-words"><div className="font-medium">{plugin.displayName || plugin.pluginId}</div><div className="text-xs text-muted-foreground">{plugin.pluginId}</div>{plugin.lastError && <div className="max-w-xs truncate text-xs text-red-600">{plugin.lastError}</div>}</TableCell>
                  <TableCell>{plugin.currentVersion || '—'}<div className="text-xs text-muted-foreground">{plugin.releases.length} {admin.releases || 'releases'}</div></TableCell>
                  <TableCell className={statusClass(plugin.runtimeState)}>{plugin.runtimeState}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1"><Activity className="h-4 w-4" />{healthLoading === plugin.pluginId ? text.loading : healthErrors[plugin.pluginId] ? text.unknown : plugin.healthy === true ? text.healthy : plugin.healthy === false ? text.unhealthy : text.unknown}</span><p className="text-xs text-muted-foreground">{text.lastHealthAt}: {plugin.lastHealthAt ? new Date(plugin.lastHealthAt).toLocaleString() : '—'}</p><Button size="sm" variant="ghost" loading={healthLoading === plugin.pluginId} disabled={Boolean(healthLoading) || Boolean(busy)} onClick={() => void checkHealth(plugin.pluginId)}>{text.checkHealth}</Button>{healthErrors[plugin.pluginId] && <p role="alert" className="text-xs text-destructive">{text.healthError}</p>}</TableCell>
                  <TableCell><span className={counts?.failed || counts?.deadLetter ? 'text-red-600' : 'text-muted-foreground'}>{counts ? `${counts.pending}/${counts.failed}/${counts.deadLetter}` : text.backlogUnknown}</span></TableCell>
                  <TableCell><fieldset disabled={Boolean(busy)} className="flex min-w-48 flex-wrap gap-2">
                    {isSuperAdmin && pending && <Button size="sm" variant="outline" loading={busy === `${plugin.pluginId}:approve`} onClick={() => void runAction(`${plugin.pluginId}:approve`, () => approvePluginRelease(plugin.pluginId, pending.id))} leftIcon={<CheckCircle2 className="h-3 w-3" />}>{admin.approve || 'Approve'}</Button>}
                    {isSuperAdmin && approved && <Button size="sm" loading={busy === `${plugin.pluginId}:activate`} onClick={() => void runAction(`${plugin.pluginId}:activate`, () => activatePlugin(plugin.pluginId, approved.version))} leftIcon={<Play className="h-3 w-3" />}>{admin.activate || 'Activate'}</Button>}
                    {isSuperAdmin && plugin.desiredState === 'ACTIVE' && <Button size="sm" variant="outline" loading={busy === `${plugin.pluginId}:deactivate`} onClick={() => void runAction(`${plugin.pluginId}:deactivate`, () => deactivatePlugin(plugin.pluginId))} leftIcon={<Pause className="h-3 w-3" />}>{admin.deactivate || 'Deactivate'}</Button>}
                    {isSuperAdmin && plugin.desiredState === 'ACTIVE' && <Button size="sm" variant="outline" loading={busy === `${plugin.pluginId}:reload`} onClick={() => void runAction(`${plugin.pluginId}:reload`, () => reloadPlugin(plugin.pluginId))} leftIcon={<RefreshCw className="h-3 w-3" />}>{admin.reload || 'Reload'}</Button>}
                    {isSuperAdmin && previous && <Button size="sm" variant="outline" loading={busy === `${plugin.pluginId}:rollback`} onClick={() => void runAction(`${plugin.pluginId}:rollback`, () => rollbackPlugin(plugin.pluginId, previous.version))} leftIcon={<RotateCcw className="h-3 w-3" />}>{admin.rollback || 'Rollback'}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => void openConfig(plugin)} leftIcon={<Save className="h-3 w-3" />}>{text.details}</Button>
                    {isSuperAdmin && <Button size="sm" variant="destructive" disabled={plugin.desiredState !== 'DISABLED'} title={text.deleteHint} onClick={() => setDeleteTarget(plugin)} leftIcon={<Trash2 className="h-3 w-3" />}>{text.delete}</Button>}
                  </fieldset></TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title={text.deleteTitle}>
        <p className="break-words text-sm">{deleteTarget?.pluginId}</p><p className="mt-2 text-sm text-muted-foreground">{text.deleteHint}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setDeleteTarget(null)}>{text.cancel}</Button><Button variant="destructive" onClick={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (target) void runAction(`${target.pluginId}:delete`, () => removePlugin(target.pluginId))
        }}>{text.delete}</Button></div>
      </Modal>
      {configPlugin && (
        <section className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-all font-semibold">{text.details} · {configPlugin}</h2><Button size="sm" variant="ghost" disabled={configSaving} onClick={() => { configRequest.current++; setConfigPlugin(null) }}>{text.close}</Button></div>
          {configLoading ? <p role="status">{text.loading}</p> : <>
            {configError && <p role="alert" className="text-sm text-destructive">{configError}</p>}
            {!configSchema ? <div className="space-y-2"><p className="text-sm text-muted-foreground">{text.noSchema}</p><Button size="sm" onClick={() => { const plugin = plugins.find((row) => row.pluginId === configPlugin); if (plugin) void openConfig(plugin) }}>{text.retry}</Button></div> : <form onSubmit={saveConfig} className="min-w-0 space-y-4">
              <PluginConfigFields key={`${configPlugin}:${configRevision}`} schema={configSchema} value={configValue} onChange={(value) => setConfigValue(value as Record<string, unknown>)} secretPaths={secretPaths} labels={text} disabled={!isSuperAdmin || Boolean(busy) || !supportedSchema(configSchema)} />
              {!supportedSchema(configSchema) ? <p role="alert">{text.unsupported}</p> : !configIsValid(configValue, configSchema, secretPaths) && <p role="alert" className="text-sm text-destructive">{text.invalid}</p>}
              {isSuperAdmin && <Button type="submit" disabled={Boolean(busy) || !supportedSchema(configSchema) || !configIsValid(configValue, configSchema, secretPaths)} loading={configSaving} leftIcon={<Save className="h-4 w-4" />}>{text.save}</Button>}
            </form>}
          </>}
          <h3 className="text-sm font-semibold">{text.releases}</h3>
          <ul className="space-y-2 text-sm">{plugins.find((row) => row.pluginId === configPlugin)?.releases.map((release) => <li key={release.id} className="min-w-0 break-all rounded border border-border p-3"><strong>{release.version}</strong> · {release.state}<p className="text-xs text-muted-foreground">SHA-256: {release.artifactSha256}</p><p className="text-xs text-muted-foreground">{admin.approve || 'Approve'}: {release.approvedAt ? new Date(release.approvedAt).toLocaleString() : '—'}</p></li>)}</ul>
          <PluginSlot slot="admin.detail" plugins={plugins.filter((row) => row.pluginId === configPlugin)} />
        </section>
      )}
    </div>
  )
}
