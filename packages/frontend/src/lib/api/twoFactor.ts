import { fetcher } from './fetcher';

/**
 * Callers: [TwoFactorSetup]
 * Callees: [fetcher]
 * Description: Generates a TOTP secret and QR code URL for setup.
 * Keywords: totp, generate, setup, 2fa, domain
 */
export async function generateTotp(endpoint: string): Promise<{ secret: string; qrCodeUrl: string }> {
  return fetcher(endpoint, {
    method: 'POST',
  });
}

/**
 * Callers: [TwoFactorSetup]
 * Callees: [fetcher]
 * Description: Verifies a TOTP code against the server to complete setup.
 * Keywords: totp, verify, 2fa, domain
 */
export async function verifyTotp(endpoint: string, code: string): Promise<void> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Callers: [SecuritySettings]
 * Callees: [fetcher]
 * Description: Disables TOTP 2FA for the user.
 * Keywords: totp, disable, 2fa, domain
 */
export async function disableTotp(endpoint: string): Promise<void> {
  return fetcher(endpoint, {
    method: 'POST',
  });
}

/**
 * Callers: [TwoFactorLogin]
 * Callees: [fetcher]
 * Description: Verifies a TOTP code during the login flow.
 * Keywords: totp, verify, login, 2fa, domain
 */
export async function verifyTotpLogin(endpoint: string, code: string): Promise<void> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * Callers: [TwoFactorSetup]
 * Callees: [fetcher]
 * Description: Generates Passkey registration options from the server.
 * Keywords: passkey, generate, options, registration, 2fa, domain
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generatePasskeyOptions(endpoint: string): Promise<any> {
  return fetcher(endpoint);
}

/**
 * Callers: [TwoFactorSetup]
 * Callees: [fetcher]
 * Description: Verifies a Passkey registration response against the server.
 * Keywords: passkey, verify, registration, 2fa, domain
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyPasskeyRegistration(endpoint: string, response: any, challengeId: string): Promise<void> {
  return fetcher(endpoint, {
    method: 'POST',
    body: JSON.stringify({ response, challengeId }),
  });
}
