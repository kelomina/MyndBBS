'use client'
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from '../TranslationProvider'
import { HumanVerification } from './HumanVerification'
import type { VerificationPurpose } from '../../lib/human-verification/client'
export function HumanVerificationDialog({
  isOpen,
  onClose,
  onVerified,
  purpose,
}: {
  isOpen: boolean
  onClose: () => void
  onVerified: (token: string) => void | Promise<void>
  purpose: VerificationPurpose
}) {
  const text = useTranslation().humanVerification
  const panel = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),iframe,[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0)
      const first = controls[0],
        last = controls.at(-1)
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel.current)
      ) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target))
        panel.current?.focus()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('focusin', focus)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', key)
      document.removeEventListener('focusin', focus)
      if (previous?.isConnected) previous.focus()
    }
  }, [isOpen])
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={text.title}
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full min-w-0 max-w-[398px] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-6"
      >
        <h2 className="mb-4 pr-10 text-lg font-semibold [overflow-wrap:anywhere]">{text.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={text.cancel}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
        <HumanVerification purpose={purpose} onVerified={onVerified} onCancel={onClose} />
      </div>
    </div>
  )
}
