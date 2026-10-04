'use client'
import { useEffect, useState } from 'react'
import { getVerificationRequirements, type VerificationSurface } from './client'
export function useHumanVerificationRequirement(surface: VerificationSurface): boolean {
  const [required, setRequired] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    void getVerificationRequirements(controller.signal)
      .then((r) => {
        if (!controller.signal.aborted)
          setRequired(!r.available || (r.enabled && r.surfaces[surface]))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [surface])
  return required
}
