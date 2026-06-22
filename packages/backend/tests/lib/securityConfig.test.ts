import {
  getAuthCookieOptions,
  getTempTokenSecret,
  shouldUseSecureCookies,
  validateRuntimeSecurityConfig,
} from '../../src/lib/securityConfig';

describe('securityConfig', () => {
  const strongA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const strongC = '89abcdef012345678989abcdef012345678989abcdef012345678989abcdef01';

  it('rejects production startup when TEMP_TOKEN_SECRET is missing', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: 'production',
        INSTALL_LOCKED: 'true',
        JWT_SECRET: strongA,
      }),
    ).toThrow('ERR_TEMP_TOKEN_SECRET_REQUIRED');
  });

  it('rejects weak production secrets before allowing install mode', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: 'production',
        INSTALL_LOCKED: 'false',
        ALLOW_INSTALL_MODE: 'true',
        JWT_SECRET: 'change-me',
        TEMP_TOKEN_SECRET: strongC,
      }),
    ).toThrow('ERR_WEAK_JWT_SECRET');
  });

  it('rejects production install mode unless it is explicitly enabled', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: 'production',
        INSTALL_LOCKED: 'false',
        JWT_SECRET: strongA,
        TEMP_TOKEN_SECRET: strongC,
      }),
    ).toThrow('ERR_INSTALL_MODE_EXPLICIT_ENABLE_REQUIRED');
  });

  it('allows production install mode only with explicit mode and strong distinct secrets', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: 'production',
        INSTALL_LOCKED: 'false',
        ALLOW_INSTALL_MODE: 'true',
        JWT_SECRET: strongA,
        TEMP_TOKEN_SECRET: strongC,
      }),
    ).not.toThrow();
  });

  it('does not require JWT_REFRESH_SECRET for installed BFF session runtime', () => {
    expect(() =>
      validateRuntimeSecurityConfig({
        NODE_ENV: 'production',
        INSTALL_LOCKED: 'true',
        JWT_SECRET: strongA,
        TEMP_TOKEN_SECRET: strongC,
      }),
    ).not.toThrow();
  });

  it('does not fall back to JWT_SECRET for development temp tokens', () => {
    expect(
      getTempTokenSecret({
        NODE_ENV: 'development',
        JWT_SECRET: strongA,
      }),
    ).not.toBe(strongA);
  });

  it('uses secure cookies when COOKIE_SECURE is explicitly enabled outside production', () => {
    expect(shouldUseSecureCookies({ NODE_ENV: 'development', COOKIE_SECURE: 'true' })).toBe(true);
    expect(getAuthCookieOptions(1000, 'lax', { NODE_ENV: 'development', COOKIE_SECURE: 'true' }))
      .toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', maxAge: 1000 });
  });

  it('uses secure cookies when the configured public origin is HTTPS', () => {
    expect(shouldUseSecureCookies({
      NODE_ENV: 'development',
      FRONTEND_URL: 'https://forum.example.com',
    })).toBe(true);
    expect(shouldUseSecureCookies({
      NODE_ENV: 'development',
      ORIGIN: 'https://forum.example.com',
    })).toBe(true);
  });
});
