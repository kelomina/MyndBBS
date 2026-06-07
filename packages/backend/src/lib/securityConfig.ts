const DEVELOPMENT_TEMP_TOKEN_SECRET = 'development-temp-token-secret-not-for-production-32chars'

const WEAK_SECRET_VALUES = new Set([
  'change-me',
  'change-me-too',
  'change-me-install',
  'dev-secret',
  'secret',
  'jwt-secret',
  'password',
  'test-secret',
])

type RuntimeEnv = Record<string, string | undefined>

function normalizeSecret(value: string | undefined): string {
  return String(value || '').trim()
}

export function isProductionEnv(env: RuntimeEnv = process.env): boolean {
  return env.NODE_ENV === 'production'
}

function isHttpsUrl(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase().startsWith('https://')
}

export function shouldUseSecureCookies(env: RuntimeEnv = process.env): boolean {
  return (
    env.COOKIE_SECURE === 'true' ||
    isProductionEnv(env) ||
    isHttpsUrl(env.FRONTEND_URL) ||
    isHttpsUrl(env.ORIGIN)
  )
}

export function getAuthCookieOptions(
  maxAge: number,
  sameSite: 'lax' | 'strict' = 'lax',
  env: RuntimeEnv = process.env,
) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(env),
    sameSite,
    maxAge,
  }
}

export function isWeakRuntimeSecret(value: string | undefined): boolean {
  const secret = normalizeSecret(value)
  if (!secret) return true
  if (secret.length < 32) return true
  if (/^<[^>]+>$/.test(secret)) return true
  if (/^(.)\1+$/.test(secret)) return true
  return WEAK_SECRET_VALUES.has(secret.toLowerCase())
}

function assertConfiguredSecret(name: string, value: string | undefined): string {
  const secret = normalizeSecret(value)
  if (!secret) {
    throw new Error(`ERR_${name}_REQUIRED`)
  }
  if (isWeakRuntimeSecret(secret)) {
    throw new Error(`ERR_WEAK_${name}`)
  }
  return secret
}

export function getTempTokenSecret(env: RuntimeEnv = process.env): string {
  const secret = normalizeSecret(env.TEMP_TOKEN_SECRET)
  if (secret) return secret
  if (isProductionEnv(env)) {
    throw new Error('ERR_TEMP_TOKEN_SECRET_REQUIRED')
  }
  return DEVELOPMENT_TEMP_TOKEN_SECRET
}

export function validateRuntimeSecurityConfig(env: RuntimeEnv = process.env): void {
  const isInstalled = env.INSTALL_LOCKED === 'true'
  const isProduction = isProductionEnv(env)

  if (isProduction) {
    const jwtSecret = assertConfiguredSecret('JWT_SECRET', env.JWT_SECRET)
    const jwtRefreshSecret = assertConfiguredSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET)
    const tempTokenSecret = assertConfiguredSecret('TEMP_TOKEN_SECRET', env.TEMP_TOKEN_SECRET)
    if (jwtSecret === jwtRefreshSecret) {
      throw new Error('ERR_JWT_SECRETS_MUST_DIFFER')
    }
    if (tempTokenSecret === jwtSecret || tempTokenSecret === jwtRefreshSecret) {
      throw new Error('ERR_TEMP_TOKEN_SECRET_MUST_DIFFER')
    }
  }

  if (!isInstalled) {
    if (isProduction && env.ALLOW_INSTALL_MODE !== 'true') {
      throw new Error('ERR_INSTALL_MODE_EXPLICIT_ENABLE_REQUIRED')
    }
    return
  }

  const jwtSecret = assertConfiguredSecret('JWT_SECRET', env.JWT_SECRET)
  const jwtRefreshSecret = assertConfiguredSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET)

  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('ERR_JWT_SECRETS_MUST_DIFFER')
  }
}
