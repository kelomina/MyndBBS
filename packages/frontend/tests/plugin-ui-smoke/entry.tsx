import React from 'react'
import { createRoot } from 'react-dom/client'
import { TranslationProvider } from '../../src/components/TranslationProvider'
import { ToastProvider } from '../../src/components/ui/Toast'
import PluginAdminClient from '../../src/app/admin/plugins/PluginAdminClient'
import { PluginSlot } from '../../src/components/plugins/PluginSlot'
import { PluginUiFrame } from '../../src/components/plugins/PluginUiFrame'
import en from '../../src/i18n/dictionaries/en.json'
import zh from '../../src/i18n/dictionaries/zh.json'

const query = new URLSearchParams(location.search)
const dict = query.get('lang') === 'zh' ? zh : en
function Harness() {
  return <TranslationProvider dict={dict}><ToastProvider>
    {query.has('bridge') ? <div className="max-w-lg p-4"><PluginUiFrame pluginId="sample" mount={{slot: 'admin.detail',path: 'panel.html'}} routes={[{method:'GET',path:'/status'}]} /></div> : <div className="flex min-h-screen min-w-0"><aside className="hidden w-64 shrink-0 border-r border-border p-4 sm:block"><h2 className="mb-3 font-semibold">Admin</h2><PluginSlot slot="admin.sidebar" /></aside><main className="min-w-0 flex-1 space-y-6 p-4 sm:p-6"><PluginAdminClient /><PluginSlot slot="admin.dashboard" /></main></div>}
  </ToastProvider></TranslationProvider>
}
const root = createRoot(document.getElementById('root')!)
root.render(<Harness />)
Object.assign(window, { unmountPluginSmoke: () => root.unmount() })
