import { expect, test } from '@playwright/test';

const acceptedCookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
};

test('register page can resend a verification email after the original link expires', async ({ page }) => {
  await page.addInitScript((preferences) => {
    window.localStorage.setItem('myndbbs_cookie_consent', JSON.stringify(preferences));
  }, acceptedCookiePreferences);

  await page.route('**/api/v1/user/profile', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ERR_UNAUTHORIZED' }),
    });
  });

  await page.route('**/api/v1/auth/captcha', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        captchaId: 'e2e-captcha-id',
        image: null,
        puzzle: { targetX: 120, targetY: 0 },
      }),
    });
  });

  await page.route('**/api/v1/auth/register/verify-email', async (route) => {
    await route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ERR_EMAIL_REGISTRATION_EXPIRED' }),
    });
  });

  await page.route('**/api/v1/auth/register/resend-email', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'accepted',
        email: 'recover@example.com',
        expiresAt: '2030-01-01T00:00:00.000Z',
      }),
    });
  });

  await page.goto('/register?verificationToken=expired-token&email=recover@example.com');

  await expect(page.getByTestId('register-verification-expired')).toContainText('recover@example.com');
  await page.getByTestId('register-resend-verification-button').click();
  await expect(page.getByTestId('register-pending-verification')).toBeVisible();
  await expect(page.getByTestId('register-status-message')).toBeVisible();
});

test('reset-password page switches into the expired branch when the reset token is stale', async ({ page }) => {
  await page.addInitScript((preferences) => {
    window.localStorage.setItem('myndbbs_cookie_consent', JSON.stringify(preferences));
  }, acceptedCookiePreferences);

  await page.route('**/api/v1/user/profile', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ERR_UNAUTHORIZED' }),
    });
  });

  await page.route('**/api/v1/auth/password/reset', async (route) => {
    await route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ERR_PASSWORD_RESET_EXPIRED' }),
    });
  });

  await page.goto('/reset-password?token=expired-token&email=recover@example.com');

  await page.getByTestId('reset-password-new-password').fill('NewPassword!123');
  await page.getByTestId('reset-password-confirm-password').fill('NewPassword!123');
  await page.getByTestId('reset-password-submit').click();

  await expect(page.getByTestId('reset-password-expired')).toContainText('recover@example.com');
  await expect(page.getByTestId('reset-password-request-new-link')).toBeVisible();
});
