'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { useTranslation } from './TranslationProvider'
import {
  getCaptchaProtectionPolicy,
  updateCaptchaProtectionPolicy,
} from '../lib/api/admin'
import type { CaptchaProtectionPolicy } from '../types/protection'

export function CaptchaProtectionSection() {
  const dict = useTranslation()
  const { toast } = useToast()
  const [policy, setPolicy] = useState<CaptchaProtectionPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const admin = useMemo(() => dict.admin ?? {}, [dict.admin])
  const apiErrors = useMemo(
    () => (dict.apiErrors ?? {}) as unknown as Record<string, string | undefined>,
    [dict.apiErrors],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setPolicy(await getCaptchaProtectionPolicy())
    } catch (error: unknown) {
      const key = error instanceof Error ? error.message : ''
      const message = apiErrors[key] || key || admin.captchaProtectionLoadFailed || 'Failed to load protection policy'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [admin.captchaProtectionLoadFailed, apiErrors, toast])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const save = async () => {
    if (!policy) return
    try {
      setSaving(true)
      const result = await updateCaptchaProtectionPolicy(policy)
      setPolicy(result.policy)
      toast(admin.captchaProtectionSaved || 'Policy saved', 'success')
    } catch (error: unknown) {
      const key = error instanceof Error ? error.message : ''
      const translated = apiErrors[key]
      toast(translated || key || admin.captchaProtectionSaveFailed || 'Failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const labels = [
    ['registration', dict.admin?.captchaRegistration || 'Registration'],
    ['post', dict.admin?.captchaPost || 'New posts'],
    ['comment', dict.admin?.captchaComment || 'Comments and replies'],
    ['friendRequest', dict.admin?.captchaFriendRequest || 'Friend requests'],
  ] as const

  return (
    <section data-testid="captcha-protection-section" className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">{admin.captchaProtectionTitle || 'Business human verification'}</h2>
        <p className="mt-1 text-sm text-muted">
          {admin.captchaProtectionDesc || 'Choose which business actions require the slider verification.'}
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted">{dict.common?.loading || 'Loading...'}</p>
      ) : loadError ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm text-red-500">{loadError}</p>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => void load()}>
              {dict.common?.confirm || 'Retry'}
            </Button>
          </div>
        </div>
      ) : policy ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {labels.map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 text-sm" htmlFor={`captcha-protection-${key}`}>
                <input
                  id={`captcha-protection-${key}`}
                  data-testid={`captcha-protection-${key}`}
                  type="checkbox"
                  checked={Boolean(policy.enabled && policy.surfaces[key])}
                  disabled={saving}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      enabled: event.target.checked ? true : policy.enabled,
                      surfaces: { ...policy.surfaces, [key]: event.target.checked },
                    })
                  }
                  className="mt-0.5 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">
            {admin.captchaProtectionManagementHint || 'Read-rate-limit unlock and federal challenge settings remain in their existing sections below.'}
          </p>
          <div className="flex justify-end">
            <Button onClick={() => void save()} loading={saving} disabled={!policy}>
              {dict.common?.save || 'Save'}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
