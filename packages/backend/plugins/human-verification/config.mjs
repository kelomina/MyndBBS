// Callers: plugin.activate. Callees: local validation only.
// Missing values preserve protection; explicit invalid values never coerce or disable it.
export const PURPOSES = Object.freeze([
  'registration',
  'post',
  'comment',
  'friendRequest',
  'rateLimitUnlock',
])
const SURFACES = PURPOSES.slice(0, 4)
const KINDS = ['slider', 'geometry', 'pow']
const STRENGTHS = ['low', 'normal', 'strict']
const invalid = () => {
  throw new Error('ERR_INVALID_PLUGIN_CONFIG')
}
const object = (value, keys) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    invalid()
  return value
}
const boolean = (value, fallback) => {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') invalid()
  return value
}
const integer = (value, fallback, min, max) => {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < min || value > max) invalid()
  return value
}
const choice = (value, fallback, options) => {
  if (value === undefined) return fallback
  if (!options.includes(value)) invalid()
  return value
}
function freeze(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freeze(child)
  }
  return Object.freeze(value)
}
export function normalizeConfig(value = {}) {
  const raw = object(value, ['enabled', 'surfaces', 'sliderStrength', 'federal'])
  const surfaces = object(raw.surfaces === undefined ? {} : raw.surfaces, SURFACES)
  const federal = object(raw.federal === undefined ? {} : raw.federal, [
    'enabled',
    'kinds',
    'defaultKind',
    'geometryLevel',
    'powBits',
    'timeoutSec',
    'strictTimeoutSec',
  ])
  const kinds = object(federal.kinds === undefined ? {} : federal.kinds, KINDS)
  const config = {
    enabled: boolean(raw.enabled, true),
    surfaces: Object.fromEntries(SURFACES.map((key) => [key, boolean(surfaces[key], true)])),
    sliderStrength: choice(raw.sliderStrength, 'low', STRENGTHS),
    federal: {
      enabled: boolean(federal.enabled, true),
      kinds: Object.fromEntries(KINDS.map((key) => [key, boolean(kinds[key], true)])),
      defaultKind: choice(federal.defaultKind, 'slider', KINDS),
      geometryLevel: integer(federal.geometryLevel, 1, 1, 3),
      powBits: integer(federal.powBits, 16, 8, 24),
      timeoutSec: integer(federal.timeoutSec, 10, 5, 60),
      strictTimeoutSec: integer(federal.strictTimeoutSec, 15, 5, 60),
    },
  }
  // The manifest subset cannot express this cross-field invariant.
  if (!Object.values(config.federal.kinds).some(Boolean)) invalid()
  return freeze(config)
}
export function selectKind(config, purpose) {
  // Core owns requires()/bypass; the plugin never turns an issue call into a proof.
  if (purpose !== 'rateLimitUnlock' || !config.federal.enabled) return 'slider'
  const { kinds, defaultKind } = config.federal
  return kinds[defaultKind] ? defaultKind : KINDS.find((kind) => kinds[kind])
}
