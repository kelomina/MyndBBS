import {
  DEFAULT_FEDERAL_PROTECTION_POLICY,
  parseFederalProtectionPolicy,
  resolveEffectiveKind,
  isKindEnabled,
} from '../src/domain/system/FederalProtection'
import { federalProtectionSchema } from '../src/lib/validation/schemas'

describe('FederalProtection policy', () => {
  it('exposes frozen defaults (powBits 16, level 1, timeout 10, strictTimeout 15)', () => {
    expect(DEFAULT_FEDERAL_PROTECTION_POLICY.powBits).toBe(16)
    expect(DEFAULT_FEDERAL_PROTECTION_POLICY.geometryLevel).toBe(1)
    expect(DEFAULT_FEDERAL_PROTECTION_POLICY.timeoutSec).toBe(10)
    expect(DEFAULT_FEDERAL_PROTECTION_POLICY.strictTimeoutSec).toBe(15)
    expect(DEFAULT_FEDERAL_PROTECTION_POLICY.defaultKind).toBe('slider')
  })

  it('parse fills missing keys with defaults without coercion', () => {
    const parsed = parseFederalProtectionPolicy({})
    expect(parsed).toEqual(DEFAULT_FEDERAL_PROTECTION_POLICY)
    // 数字字符串不归一 → 默认（读路径容错；写路径 zod 直接 400）
    const coerced = parseFederalProtectionPolicy({ powBits: '16' })
    expect(coerced.powBits).toBe(16)
  })

  it('resolves effectiveKind with slider->geometry->pow fallback', () => {
    const base = {
      ...DEFAULT_FEDERAL_PROTECTION_POLICY,
      kinds: { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds },
    }
    expect(resolveEffectiveKind(base)).toBe('slider')
    const noSlider = {
      ...base,
      kinds: { sliderEnabled: false, geometryEnabled: true, powEnabled: true },
      defaultKind: 'slider' as const,
    }
    expect(resolveEffectiveKind(noSlider)).toBe('geometry')
    expect(isKindEnabled(noSlider, 'slider')).toBe(false)
  })

  it('returns null when all kinds disabled (PUT must 400, runtime 400)', () => {
    const allOff = {
      ...DEFAULT_FEDERAL_PROTECTION_POLICY,
      kinds: { sliderEnabled: false, geometryEnabled: false, powEnabled: false },
    }
    expect(resolveEffectiveKind(allOff)).toBeNull()
  })

  describe('zod strict matrix (no coerce, out-of-range 400, old value unchanged)', () => {
    const valid = {
      ...DEFAULT_FEDERAL_PROTECTION_POLICY,
      kinds: { ...DEFAULT_FEDERAL_PROTECTION_POLICY.kinds },
    }

    it('accepts valid full policy', () => {
      expect(federalProtectionSchema.safeParse(valid).success).toBe(true)
    })

    it('rejects powBits out of range and numeric strings', () => {
      for (const powBits of [7, 25, '16', 1.5, null]) {
        const r = federalProtectionSchema.safeParse({ ...valid, powBits })
        expect(r.success).toBe(false)
      }
    })

    it('rejects geometryLevel out of range and strings', () => {
      for (const geometryLevel of [0, 4, '1', null]) {
        const r = federalProtectionSchema.safeParse({ ...valid, geometryLevel })
        expect(r.success).toBe(false)
      }
    })

    it('rejects timeoutSec out of range and strings', () => {
      for (const timeoutSec of [4, 61, '10', null]) {
        const r = federalProtectionSchema.safeParse({ ...valid, timeoutSec })
        expect(r.success).toBe(false)
      }
    })

    it('rejects strictTimeoutSec out of range and strings', () => {
      for (const strictTimeoutSec of [4, 61, '15', null]) {
        const r = federalProtectionSchema.safeParse({ ...valid, strictTimeoutSec })
        expect(r.success).toBe(false)
      }
    })

    it('rejects missing fields (PUT must not fill defaults)', () => {
      const { powBits: _omit, ...rest } = valid as Record<string, unknown>
      void _omit
      expect(federalProtectionSchema.safeParse(rest).success).toBe(false)
    })

    it('rejects unknown fields (additionalProperties:false)', () => {
      expect(federalProtectionSchema.safeParse({ ...valid, unknownField: 1 }).success).toBe(false)
    })

    it('rejects all kinds off (at least one required)', () => {
      const r = federalProtectionSchema.safeParse({
        ...valid,
        kinds: { sliderEnabled: false, geometryEnabled: false, powEnabled: false },
      })
      expect(r.success).toBe(false)
    })

    it('rejects defaultKind pointing to disabled kind', () => {
      const r = federalProtectionSchema.safeParse({
        ...valid,
        kinds: { sliderEnabled: true, geometryEnabled: false, powEnabled: true },
        defaultKind: 'geometry',
      })
      expect(r.success).toBe(false)
    })
  })
})
