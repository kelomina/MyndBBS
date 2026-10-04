'use client'

import Link from 'next/link'
import { useTranslation } from '../TranslationProvider'
import { PluginSlot } from './PluginSlot'

export function PluginDashboard() {
  const dict = useTranslation()
  return <section className="min-w-0 space-y-5"><h1 className="text-2xl font-semibold">{dict.admin.dashboard}</h1><p className="text-sm text-muted-foreground">{dict.pluginPlatform.dashboardHint}</p><Link className="inline-block rounded-md border border-border px-3 py-2 text-sm text-primary" href="/admin/plugins">{dict.pluginPlatform.openPlugins}</Link><PluginSlot slot="admin.dashboard" /></section>
}
