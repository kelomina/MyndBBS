import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('auth route rate-limit ordering', () => {
  it('keeps captcha routes outside the global auth limiter', async () => {
    const routePath = path.join(process.cwd(), 'src', 'routes', 'auth.ts');
    const raw = await fs.readFile(routePath, 'utf-8');
    // Prettier 可能折行；去空白后断言排序（B2 unlock 亦须在 authLimiter 之前，避免叠加）
    const source = raw.replace(/\s+/g, '');

    const captchaGenerateIndex = source.indexOf("router.get('/captcha'".replace(/\s+/g, ''));
    const captchaVerifyIndex = source.indexOf("router.post('/captcha/verify'".replace(/\s+/g, ''));
    const captchaUnlockIndex = source.indexOf("router.post('/captcha/unlock'".replace(/\s+/g, ''));
    const authLimiterIndex = source.indexOf('router.use(authLimiter)'.replace(/\s+/g, ''));
    const loginIndex = source.indexOf("router.post('/login'".replace(/\s+/g, ''));

    assert.ok(captchaGenerateIndex >= 0, 'captcha generation route should exist');
    assert.ok(captchaVerifyIndex >= 0, 'captcha verification route should exist');
    assert.ok(captchaUnlockIndex >= 0, 'captcha unlock route should exist');
    assert.ok(authLimiterIndex >= 0, 'global auth limiter should still protect sensitive auth routes');
    assert.ok(loginIndex >= 0, 'login route should exist');
    assert.ok(captchaGenerateIndex < authLimiterIndex);
    assert.ok(captchaVerifyIndex < authLimiterIndex);
    assert.ok(captchaUnlockIndex < authLimiterIndex);
    assert.ok(loginIndex > authLimiterIndex);
  });

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
