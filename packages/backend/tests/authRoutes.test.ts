import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('auth route rate-limit ordering', () => {
  it('keeps captcha routes outside the global auth limiter', async () => {
    const routePath = path.join(process.cwd(), 'src', 'routes', 'auth.ts');
    const source = await fs.readFile(routePath, 'utf-8');

    const captchaGenerateIndex = source.indexOf("router.get('/captcha'");
    const captchaVerifyIndex = source.indexOf("router.post('/captcha/verify'");
    const authLimiterIndex = source.indexOf('router.use(authLimiter)');
    const loginIndex = source.indexOf("router.post('/login'");

    assert.ok(captchaGenerateIndex >= 0, 'captcha generation route should exist');
    assert.ok(captchaVerifyIndex >= 0, 'captcha verification route should exist');
    assert.ok(authLimiterIndex >= 0, 'global auth limiter should still protect sensitive auth routes');
    assert.ok(loginIndex >= 0, 'login route should exist');
    assert.ok(captchaGenerateIndex < authLimiterIndex);
    assert.ok(captchaVerifyIndex < authLimiterIndex);
    assert.ok(loginIndex > authLimiterIndex);
  });
});
