import fs from 'fs'
import path from 'path'

describe('federal route wiring (regression guard)', () => {
  const authSource = fs.readFileSync(path.join(__dirname, '../src/routes/auth.ts'), 'utf8')
  const adminSource = fs.readFileSync(path.join(__dirname, '../src/routes/admin.ts'), 'utf8')
  const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8')
  const notificationSource = fs.readFileSync(
    path.join(__dirname, '../src/routes/notification.ts'),
    'utf8',
  )

  it('mounts federal issue/verify before global authLimiter (no stacking)', () => {
    const source = authSource.replace(/\s+/g, '')
    const issueIndex = source.indexOf("router.post('/captcha/federal/issue'".replace(/\s+/g, ''))
    const verifyIndex = source.indexOf("router.post('/captcha/federal/verify'".replace(/\s+/g, ''))
    const authLimiterIndex = source.indexOf('router.use(authLimiter)'.replace(/\s+/g, ''))
    expect(issueIndex).toBeGreaterThanOrEqual(0)
    expect(verifyIndex).toBeGreaterThanOrEqual(0)
    expect(authLimiterIndex).toBeGreaterThanOrEqual(0)
    expect(issueIndex).toBeLessThan(authLimiterIndex)
    expect(verifyIndex).toBeLessThan(authLimiterIndex)
  })

  it('applies independent federalIssueLimiter (30/15min, no unlockRequired)', () => {
    const rateLimitSource = fs.readFileSync(path.join(__dirname, '../src/lib/rateLimit.ts'), 'utf8')
    expect(rateLimitSource).toContain('federalIssueLimiter')
    expect(rateLimitSource).toContain('max: 30')
    expect(rateLimitSource).toContain('15 * 60 * 1000')
    // 超限通用体，不含 unlockRequired
    expect(rateLimitSource).toContain("error: 'ERR_RATE_LIMITED'")
  })

  it('restricts federal admin to manage all (anonymous 404 via requireAuthHidden, MODERATOR 403)', () => {
    const source = adminSource.replace(/\s+/g, '')
    expect(source).toContain(
      "router.get('/protection/federal',requireAbility('manage','all'),getFederalProtection)".replace(
        /\s+/g,
        '',
      ),
    )
    expect(source).toContain(
      "router.put('/protection/federal',requireAbility('manage','all'),updateFederalProtection)".replace(
        /\s+/g,
        '',
      ),
    )
  })

  it('keeps write limiters and searchLimiter unchanged (ban zone)', () => {
    const rateLimitSource = fs.readFileSync(path.join(__dirname, '../src/lib/rateLimit.ts'), 'utf8')
    // 写限流：post 10/5min、upload 5/10min、friend 20/h、report 10/15min
    expect(rateLimitSource).toContain('windowMs: 5 * 60 * 1000')
    expect(rateLimitSource).toContain('max: 10')
    expect(rateLimitSource).toContain('windowMs: 10 * 60 * 1000')
    // searchLimiter 20/min 旧体
    expect(rateLimitSource).toContain('searchLimiter')
    expect(rateLimitSource).toContain('max: 20')
  })

  it('mounts notifications unread-count with requireAuth (anonymous 401, not hidden 404)', () => {
    expect(notificationSource).toContain('requireAuth')
    expect(notificationSource).not.toContain('requireAuthHidden')
    expect(notificationSource).toContain('/unread-count')
    expect(indexSource).toContain('/api/notifications')
  })

  it('federal controllers never use Math.random (RNG frozen to crypto)', () => {
    const serviceSource = fs.readFileSync(
      path.join(__dirname, '../src/application/identity/FederalCaptchaService.ts'),
      'utf8',
    )
    expect(serviceSource).not.toContain('Math.random(')
    const geometrySource = fs.readFileSync(
      path.join(__dirname, '../src/domain/identity/FederalGeometry.ts'),
      'utf8',
    )
    expect(geometrySource).not.toContain('Math.random(')
    const powSource = fs.readFileSync(path.join(__dirname, '../src/lib/federalPow.ts'), 'utf8')
    expect(powSource).not.toContain('Math.random(')
  })
})
