'use client'
import { useEffect, useRef } from 'react'
import { HumanVerificationDialog } from './human-verification/HumanVerificationDialog'
import { postUnlock } from '../lib/rate-limit/unlock'
import { saveUnlockToken } from '../lib/rate-limit/unlock-token'
import type { Dictionary } from '../types'
export type UnlockModalState = 'idle' | 'verifying' | 'success' | 'error' | 'cooldown'
interface Props {
  isOpen: boolean
  onClose: () => void
  retryAfterSec: number
  onUnlocked: (info: { exemptMinutes: number; expiresAt: string }) => void
  dict?: Dictionary
}
export function RateLimitUnlockModal({ isOpen, onClose, onUnlocked }: Props) {
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    const epoch = ++generation.current
    return () => {
      generation.current = epoch + 1
      controller.current?.abort()
    }
  }, [isOpen])
  const close = () => {
    generation.current++
    controller.current?.abort()
    onClose()
  }
  const verified = async (verificationToken: string) => {
    const current = generation.current
    controller.current = new AbortController()
    const result = await postUnlock({ verificationToken }, controller.current.signal)
    if (current !== generation.current) return
    saveUnlockToken(result)
    onUnlocked({ exemptMinutes: result.exemptMinutes, expiresAt: result.expiresAt })
  }
  return (
    <HumanVerificationDialog
      isOpen={isOpen}
      onClose={close}
      purpose="rateLimitUnlock"
      onVerified={verified}
    />
  )
}
