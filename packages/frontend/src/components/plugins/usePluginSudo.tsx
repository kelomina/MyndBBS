'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchWithAuth } from '../../lib/api/fetcher'
import { ReauthModal } from '../ReauthModal'

// Reuse the site's password/TOTP/passkey modal; cancellation never executes the queued mutation.
export function usePluginSudo() {
  const [open, setOpen] = useState(false)
  const pending = useRef<((confirmed: boolean) => void) | null>(null)
  useEffect(() => () => { pending.current?.(false); pending.current = null }, [])
  const confirm = () => new Promise<boolean>((resolve) => { pending.current = resolve; setOpen(true) })
  const finish = (confirmed: boolean) => { const resolve = pending.current; pending.current = null; setOpen(false); resolve?.(confirmed) }
  const run = async (action: () => Promise<unknown>) => {
    const response = await fetchWithAuth('/api/v1/user/sudo/check', { cache: 'no-store' })
    if (!response.ok) throw new Error('ERR_SUDO_REQUIRED')
    const data = await response.json() as { isSudo?: boolean }
    if (!data.isSudo && !await confirm()) return false
    try { await action() }
    catch (error) {
      if (!(error instanceof Error) || error.message !== 'ERR_SUDO_REQUIRED') throw error
      if (!await confirm()) return false
      await action()
    }
    return true
  }
  return { run, modal: <ReauthModal isOpen={open} onClose={() => finish(false)} onSuccess={() => finish(true)} /> }
}
