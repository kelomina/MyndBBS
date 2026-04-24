import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const registerClientPath = new URL('../src/app/(auth)/register/RegisterClient.tsx', import.meta.url);
const loginClientPath = new URL('../src/app/(auth)/login/LoginClient.tsx', import.meta.url);
const forgotPasswordClientPath = new URL('../src/app/(auth)/forgot-password/ForgotPasswordClient.tsx', import.meta.url);
const resetPasswordClientPath = new URL('../src/app/(auth)/reset-password/ResetPasswordClient.tsx', import.meta.url);

test('register page exposes pending and expired verification recovery branches', async () => {
  const source = await fs.readFile(registerClientPath, 'utf8');

  assert.match(source, /verificationExpired/);
  assert.match(source, /resendEmailRegistration/);
  assert.match(source, /register\/resend-email/);
});

test('login page links forgot-password users into the recovery flow', async () => {
  const source = await fs.readFile(loginClientPath, 'utf8');

  assert.match(source, /href="\/forgot-password"|href='\/forgot-password'|href=\/forgot-password/);
});

test('forgot-password client requests reset mail through the public auth endpoint', async () => {
  const source = await fs.readFile(forgotPasswordClientPath, 'utf8');

  assert.match(source, /requestPasswordReset/);
  assert.match(source, /\/api\/v1\/auth\/password\/forgot/);
});

test('reset-password client consumes token links and exposes an expired-link branch', async () => {
  const source = await fs.readFile(resetPasswordClientPath, 'utf8');

  assert.match(source, /passwordResetLinkExpiredTitle/);
  assert.match(source, /\/api\/v1\/auth\/password\/reset/);
  assert.match(source, /requestNewResetLink/);
});

test('new auth recovery pages do not keep inline English fallback copy', async () => {
  const [registerSource, forgotPasswordSource, resetPasswordSource] = await Promise.all([
    fs.readFile(registerClientPath, 'utf8'),
    fs.readFile(forgotPasswordClientPath, 'utf8'),
    fs.readFile(resetPasswordClientPath, 'utf8'),
  ]);

  assert.doesNotMatch(registerSource, /\|\|\s*['"]/);
  assert.doesNotMatch(forgotPasswordSource, /\|\|\s*['"]/);
  assert.doesNotMatch(resetPasswordSource, /\|\|\s*['"]/);
});
