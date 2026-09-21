'use client'

import { useEffect, useState } from 'react'

export type CaptchaSurface = 'registration' | 'post' | 'comment' | 'friendRequest'

export interface CaptchaRequirements {
  registration: boolean
  post: boolean
  comment: boolean
  friendRequest: boolean
}

export const DEFAULT_CAPTCHA_REQUIREMENTS: CaptchaRequirements = {
  registration: true,
  post: true,
  comment: true,
  friendRequest: true,
}

export async function getCaptchaRequirements(): Promise<CaptchaRequirements> {
  const response = await fetch('/api/v1/auth/captcha/requirements', {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`CAPTCHA_REQUIREMENTS_${response.status}`)
  const data = (await response.json()) as Partial<CaptchaRequirements>
  if (
    typeof data.registration !== 'boolean' ||
    typeof data.post !== 'boolean' ||
    typeof data.comment !== 'boolean' ||
    typeof data.friendRequest !== 'boolean'
  ) {
    throw new Error('ERR_INVALID_CAPTCHA_REQUIREMENTS')
  }
  return {
    registration: data.registration,
    post: data.post,
    comment: data.comment,
    friendRequest: data.friendRequest,
  }
}

export function useCaptchaRequirement(surface: CaptchaSurface): boolean {
  const [requirements, setRequirements] = useState(DEFAULT_CAPTCHA_REQUIREMENTS)

  useEffect(() => {
    let cancelled = false
    void getCaptchaRequirements()
      .then((next) => {
        if (!cancelled) setRequirements(next)
      })
      .catch(() => {
        // Fail closed: the initial all-true state remains in effect.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return requirements[surface]
}
