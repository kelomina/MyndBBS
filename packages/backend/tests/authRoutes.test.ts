import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('auth route rate-limit ordering', () => {
  it('retires algorithm routes without weakening sensitive auth or the neutral bridge limiter', async () => {
    const source = (await fs.readFile(path.join(process.cwd(), 'src/routes/auth.ts'), 'utf8')).replace(/\s+/g, '')
    for (const retired of ["router.get('/captcha'", "router.post('/captcha/verify'", "router.post('/captcha/unlock'"])
      assert.equal(source.includes(retired), false)
    const limiter = source.indexOf('router.use(authLimiter)')
    assert.ok(limiter >= 0)
    assert.ok(source.indexOf("router.post('/login'") > limiter)
    const bridge = await fs.readFile(path.join(process.cwd(), 'src/routes/humanVerification.ts'), 'utf8')
    assert.doesNotMatch(bridge, /authLimiter/)
    for (const operation of ['challenge', 'verify', 'unlock'])
      assert.ok(bridge.includes("router.post('/" + operation + "', attempts,"))
  })

  it('uses generic validation responses on public auth entry points', async () => {
    const routePath = path.join(process.cwd(), 'src', 'routes', 'auth.ts');
    const source = await fs.readFile(routePath, 'utf-8');

    assert.match(
      source,
      /const publicRegistrationValidation:[\s\S]*?exposeDetails:\s*false,[\s\S]*?ERR_REGISTRATION_REQUEST_INVALID/,
    );
    assert.match(
      source,
      /const publicAuthValidation:[\s\S]*?exposeDetails:\s*false,[\s\S]*?ERR_AUTH_REQUEST_INVALID/,
    );
    assert.match(source, /validate\(registerSchema,\s*publicRegistrationValidation\)/);
    assert.match(source, /validate\(loginSchema,\s*publicAuthValidation\)/);
    assert.match(source, /validate\(forgotPasswordSchema,\s*publicAuthValidation\)/);
    assert.match(source, /validate\(resetPasswordSchema,\s*publicAuthValidation\)/);
    assert.match(source, /validate\(verifyEmailSchema,\s*publicAuthValidation\)/);
  });
});
