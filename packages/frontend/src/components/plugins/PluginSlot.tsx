'use client'

import { useEffect, useState } from 'react'
import { getPlugins, type PluginAdminDto } from '../../lib/api/admin'
import { useTranslation } from '../TranslationProvider'
import { PluginUiFrame } from './PluginUiFrame'
import { Button } from '../ui/Button'

export type PluginSlotName = 'admin.sidebar' | 'admin.dashboard' | 'admin.detail'
export function PluginSlot({ slot, plugins }: { slot: PluginSlotName; plugins?: PluginAdminDto[] }) {
  const dict = useTranslation()
  const [rows, setRows] = useState<PluginAdminDto[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (plugins) return
    let live = true
    void getPlugins().then((data) => { if (live) { setRows(data); setError(false) } }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [plugins, attempt])
  const active = plugins ?? rows
  if (!active && !error) return <p role="status" className="text-xs text-muted-foreground">{dict.pluginPlatform.loading}</p>
  if (error) return <div role="alert" className="space-y-2 text-xs"><p>{dict.pluginPlatform.uiError}</p><Button size="sm" variant="ghost" onClick={() => setAttempt((value) => value + 1)}>{dict.pluginPlatform.retry}</Button></div>
  return <div data-plugin-slot={slot} className="min-w-0 space-y-3">{active?.filter((plugin) => plugin.desiredState === 'ACTIVE' && ['ACTIVE', 'ROLLED_BACK'].includes(plugin.runtimeState)).flatMap((plugin) => plugin.uiMounts.filter((mount) => mount.slot === slot).map((mount) => <PluginUiFrame key={`${plugin.pluginId}:${plugin.currentVersion}:${mount.path}`} pluginId={plugin.pluginId} mount={mount} routes={(plugin.routeCapabilities ?? []).filter((route) => route.methods.includes('GET')).map((route) => ({ method: 'GET', path: route.path }))} />))}</div>
}
