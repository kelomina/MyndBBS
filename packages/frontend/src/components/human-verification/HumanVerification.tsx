'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { useTranslation } from '../TranslationProvider'
import {
  getVerificationRequirements,
  issueVerification,
  verifyAnswer,
  VerificationError,
  type VerificationPurpose,
} from '../../lib/human-verification/client'
import { isVerificationReady, parseVerificationMessage } from '../../lib/human-verification/channel'

interface Props {
  purpose: VerificationPurpose
  onVerified: (token: string) => void | Promise<void>
  onCancel?: () => void
  onInvalidated?: () => void
}
/** Neutral bridge only. Challenge JSON belongs to the signed provider, never to core UI. */
export function HumanVerification({ purpose, onVerified, onCancel, onInvalidated }: Props) {
  const text = useTranslation().humanVerification
  const [attempt, setAttempt] = useState(0)
  const [frame, setFrame] = useState<{ nonce: string } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'verifying' | 'success' | 'error'>(
    'loading',
  )
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [height, setHeight] = useState(256)
  const cooling = cooldown > 0
  const iframe = useRef<HTMLIFrameElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const callbacks = useRef({ onVerified, onCancel, onInvalidated })
  const cleanup = useRef<() => void>(() => undefined)
  useEffect(() => {
    callbacks.current = { onVerified, onCancel, onInvalidated }
  }, [onVerified, onCancel, onInvalidated])
  useEffect(() => {
    if (!cooling) return
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooling])
  useEffect(() => {
    let live = true,
      connected = false,
      answered = false,
      challengeId = '',
      deadline = 0,
      loads = 0
    let port: MessagePort | undefined, otherPort: MessagePort | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined,
      expiry: ReturnType<typeof setTimeout> | undefined
    let challenge: Record<string, unknown> = {}
    let messages = 0,
      windowStart = Date.now()
    const nonce = crypto.randomUUID()
    const controller = new AbortController()
    const closePorts = () => {
      if (port) {
        port.onmessage = null
        port.close()
      }
      otherPort?.close()
    }
    const dispose = () => {
      live = false
      controller.abort()
      closePorts()
      clearTimeout(timeout)
      clearTimeout(expiry)
    }
    cleanup.current = dispose
    const fail = (cause: unknown) => {
      if (!live) return
      live = false
      controller.abort()
      closePorts()
      clearTimeout(timeout)
      clearTimeout(expiry)
      setFrame(null)
      setState('error')
      callbacks.current.onInvalidated?.()
      setError(
        cause instanceof VerificationError && cause.status !== 503
          ? text.invalid
          : text.unavailable,
      )
      if (cause instanceof VerificationError && cause.status === 429)
        setCooldown(cause.retryAfterSec || 60)
    }
    const receive = (event: MessageEvent<unknown>) => {
      if (
        !live ||
        connected ||
        event.source !== iframe.current?.contentWindow ||
        event.origin !== 'null' ||
        !isVerificationReady(event.data, nonce)
      )
        return
      connected = true
      clearTimeout(timeout)
      const channel = new MessageChannel()
      port = channel.port1
      otherPort = channel.port2
      port.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!live) return
        if (Date.now() - windowStart > 1000) {
          messages = 0
          windowStart = Date.now()
        }
        if (++messages > 60) {
          fail(new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400))
          return
        }
        const message = parseVerificationMessage(data, nonce, challengeId)
        if (!message) return
        if (message.type === 'cancel') {
          dispose()
          setFrame(null)
          callbacks.current.onInvalidated?.()
          callbacks.current.onCancel?.()
          setState('error')
          setError(text.invalid)
          return
        }
        if (message.type === 'resize') {
          setHeight(Math.max(240, Math.min(640, Math.ceil(message.height))))
          return
        }
        if (message.type === 'focus-boundary') {
          const scope =
            container.current?.closest('[role="dialog"]') ??
            container.current?.closest('form') ??
            container.current?.parentElement
          const controls = scope
            ? Array.from(
                scope.querySelectorAll<HTMLElement>(
                  'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),iframe,[tabindex="0"]',
                ),
              ).filter((el) => el.getClientRects().length > 0)
            : []
          const index = controls.indexOf(iframe.current!)
          if (index >= 0 && controls.length)
            controls[
              (index + (message.direction === 'forward' ? 1 : -1) + controls.length) %
                controls.length
            ]?.focus()
          return
        }
        if (answered || Date.now() >= deadline) return
        answered = true
        setState('verifying')
        void (async () => {
          try {
            const proof = await verifyAnswer(challengeId, message.solution, controller.signal)
            if (!live) return
            clearTimeout(expiry)
            closePorts()
            setFrame(null)
            await callbacks.current.onVerified(proof.verificationToken)
            if (!live) return
            setState('success')
            expiry = setTimeout(() => {
              if (live) {
                callbacks.current.onInvalidated?.()
                setState('error')
                setError(text.expired)
              }
            }, proof.expiresInSec * 1000)
          } catch (e) {
            fail(e)
          }
        })()
      }
      port.start()
      iframe.current?.contentWindow?.postMessage(
        {
          type: 'myndbbs:verification:init',
          nonce,
          locale: text.locale,
          purpose,
          challengeId,
          challenge,
        },
        '*',
        [channel.port2],
      )
      setState('ready')
    }
    window.addEventListener('message', receive)
    // The listener is installed before the HTTP frame can execute its inline ready message.
    const begin = setTimeout(() => {
      setFrame(null)
      setState('loading')
      setError('')
      setHeight(256)
      callbacks.current.onInvalidated?.()
      void (async () => {
        try {
          // Establish the first-party binding before issuing a challenge; frame GET never sets it.
          const requirements = await getVerificationRequirements(controller.signal)
          if (!requirements.available)
            throw new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)
          const issuedAt = Date.now()
          const issued = await issueVerification(purpose, controller.signal)
          if (!live) return
          challengeId = issued.challengeId
          challenge = issued.challenge
          deadline = issuedAt + issued.expiresInSec * 1000
          setFrame({ nonce })
          timeout = setTimeout(
            () => fail(new VerificationError('ERR_HUMAN_VERIFICATION_UNAVAILABLE', 503)),
            5000,
          )
          expiry = setTimeout(
            () => {
              if (live) {
                fail(new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400))
                setError(text.expired)
              }
            },
            Math.max(0, deadline - Date.now()),
          )
        } catch (e) {
          fail(e)
        }
      })()
    }, 0)
    // A second document load must never inherit an already transferred port.
    const onLoad = () => {
      if (++loads > 1) fail(new VerificationError('ERR_HUMAN_VERIFICATION_INVALID', 400))
    }
    container.current?.addEventListener('load', onLoad, true)
    const owner = container.current
    return () => {
      clearTimeout(begin)
      dispose()
      window.removeEventListener('message', receive)
      owner?.removeEventListener('load', onLoad, true)
    }
  }, [attempt, purpose, text])
  return (
    <div
      ref={container}
      className="min-w-0 space-y-3 [overflow-wrap:anywhere]"
      aria-busy={state === 'loading' || state === 'verifying'}
      data-human-verification={state}
    >
      <p className="text-sm text-muted-foreground">{text[purpose]}</p>
      {(state === 'loading' || state === 'verifying' || state === 'success') && (
        <p role="status" className="text-sm">
          {state === 'loading'
            ? text.loading
            : state === 'verifying'
              ? text.verifying
              : text.verified}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {cooldown > 0 && (
        <p className="text-sm">{text.cooldown.replace('{seconds}', String(cooldown))}</p>
      )}
      {frame && (
        <iframe
          key={frame.nonce}
          ref={iframe}
          src={'/api/human-verification/ui#nonce=' + frame.nonce}
          title={text.frameTitle}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          height={height}
          className="block w-full min-w-0 max-h-[60dvh] rounded-xl border-0"
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {state === 'error' && (
          <Button
            className="h-auto min-h-11 whitespace-normal"
            type="button"
            variant="outline"
            disabled={cooldown > 0}
            onClick={() => {
              cleanup.current()
              setAttempt((v) => v + 1)
            }}
          >
            {text.retry}
          </Button>
        )}
        {onCancel && (
          <Button
            className="h-auto min-h-11 whitespace-normal"
            ref={cancel}
            type="button"
            variant="ghost"
            onClick={() => {
              cleanup.current()
              callbacks.current.onInvalidated?.()
              onCancel()
            }}
          >
            {text.cancel}
          </Button>
        )}
      </div>
    </div>
  )
}
