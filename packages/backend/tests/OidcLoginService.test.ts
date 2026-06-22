import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('OIDC login service and route static assertions', () => {
  let serviceSource: string;
  let routeSource: string;
  let controllerSource: string;
  let indexSource: string;

  beforeAll(async () => {
    const root = process.cwd();
    [serviceSource, routeSource, controllerSource, indexSource] = await Promise.all([
      fs.readFile(path.join(root, 'src', 'application', 'identity', 'OidcLoginService.ts'), 'utf8'),
      fs.readFile(path.join(root, 'src', 'routes', 'oidcAuth.ts'), 'utf8'),
      fs.readFile(path.join(root, 'src', 'controllers', 'oidcAuth.ts'), 'utf8'),
      fs.readFile(path.join(root, 'src', 'index.ts'), 'utf8'),
    ]);
  });

  it('uses PKCE S256 code_challenge', () => {
    assert.match(serviceSource, /code_challenge_method.*S256/);
    assert.match(serviceSource, /createHash\('sha256'\)/);
  });

  it('uses random state for CSRF protection', () => {
    assert.match(serviceSource, /createOpaqueBase64Url/);
    assert.match(serviceSource, /authorizationUrl\.searchParams\.set\('state', state\)/);
  });

  it('stores code_verifier in a signed HttpOnly cookie', () => {
    assert.match(controllerSource, /OIDC_STATE_COOKIE_NAME/);
    assert.match(controllerSource, /httpOnly: true/);
    assert.match(controllerSource, /jwt\.sign/);
    assert.match(controllerSource, /codeVerifier/);
  });

  it('does not store verifier or state in frontend-accessible storage', () => {
    assert.doesNotMatch(controllerSource, /localStorage|sessionStorage/);
  });

  it('uses exact redirect_uri https://kolobbs.kolostudio.fun/api/auth/oidc/callback by default', () => {
    assert.match(serviceSource, /MYNDBBS_OIDC_CALLBACK_PATH.*'\/api\/auth\/oidc\/callback'/);
    assert.match(controllerSource, /res\.clearCookie\(OIDC_STATE_COOKIE_NAME/);
  });

  it('does not use client_secret (no client_secret in request)', () => {
    assert.doesNotMatch(serviceSource, /client_secret/);
    assert.doesNotMatch(serviceSource, /clientSecret/);
  });

  it('rejects non-backoffice users (MODERATOR/ADMIN/SUPER_ADMIN only)', () => {
    assert.match(serviceSource, /MYNDBBS_OIDC_ALLOWED_ROLE_NAMES/);
    assert.match(serviceSource, /ERR_OIDC_ROLE_NOT_ALLOWED/);
  });

  it('does NOT auto-create MyndBBS users from SSO', () => {
    assert.match(serviceSource, /findByEmail/);
    assert.doesNotMatch(serviceSource, /createUser|userRepository\.save/);
  });

  it('validates ID Token signature using RS256 with JWKS', () => {
    assert.match(serviceSource, /alg.*RS256/);
    assert.match(serviceSource, /jwksUri/);
    assert.match(serviceSource, /createPublicKey/);
  });

  it('validates ID token issuer and audience', () => {
    assert.match(serviceSource, /issuer/);
    assert.match(serviceSource, /audience/);
  });

  it('requires email_verified from ID token', () => {
    assert.match(serviceSource, /email_verified/);
    assert.match(serviceSource, /ERR_OIDC_EMAIL_NOT_VERIFIED/);
  });

  it('clears OIDC state cookie after callback and rejects mismatched state', () => {
    assert.match(controllerSource, /res\.clearCookie\(OIDC_STATE_COOKIE_NAME/);
    assert.match(controllerSource, /state.*!==.*stateCookie\.state/);
  });

  it('routes are mounted under /api/v1/auth/oidc and /api/auth/oidc', () => {
    assert.match(indexSource, /\/api\/v1\/auth\/oidc.*oidcAuthRoutes/);
    assert.match(indexSource, /\/api\/auth\/oidc.*oidcAuthRoutes/);
  });

  it('has rate limiter on OIDC endpoints', () => {
    assert.match(routeSource, /oidcLoginLimiter/);
  });

  it('marks sessions created by OIDC as trusted external auth sessions', () => {
    assert.match(controllerSource, /trustedExternalAuth:\s*true/);
  });
});
