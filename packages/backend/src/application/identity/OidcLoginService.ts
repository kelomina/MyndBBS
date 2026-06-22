import { createHash, createPublicKey, randomBytes } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { UserStatus } from '@myndbbs/shared';

import { IUserRepository } from '../../domain/identity/IUserRepository';
import { IRoleRepository } from '../../domain/identity/IRoleRepository';

export const MYNDBBS_OIDC_ALLOWED_ROLE_NAMES = new Set(['MODERATOR', 'ADMIN', 'SUPER_ADMIN']);
export const MYNDBBS_OIDC_DEFAULT_ISSUER = 'https://sso-auth.kolostudio.fun';
export const MYNDBBS_OIDC_DEFAULT_CLIENT_ID = 'myndbbs';
export const MYNDBBS_OIDC_DEFAULT_SCOPE = 'openid profile email';
export const MYNDBBS_OIDC_CALLBACK_PATH = '/api/auth/oidc/callback';
export const MYNDBBS_OIDC_DEFAULT_SUCCESS_REDIRECT = '/admin';

type FetchLike = typeof fetch;

interface JwkRecord {
  kid?: string;
  kty?: string;
  use?: string;
  alg?: string;
  [key: string]: unknown;
}

interface JwksCacheEntry {
  expiresAt: number;
  keys: JwkRecord[];
}

export interface OidcLoginConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  successRedirectPath: string;
}

export interface OidcLoginServiceOptions {
  userRepository: IUserRepository;
  roleRepository: IRoleRepository;
  config?: Partial<OidcLoginConfig>;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

export interface OidcAuthorizationRequest {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export interface MyndBbsOidcUser {
  id: string;
  email: string;
  username: string;
  role: { name: string };
  level: number;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function firstConfiguredOrigin(value: string | undefined, fallback: string): string {
  const first = value?.split(',').map((part) => part.trim()).find(Boolean) || fallback;
  return stripTrailingSlash(first);
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createOpaqueBase64Url(bytes = 32): string {
  return base64Url(randomBytes(bytes));
}

function normalizeSuccessRedirectPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return MYNDBBS_OIDC_DEFAULT_SUCCESS_REDIRECT;
  }
  return value;
}

export function buildOidcLoginConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<OidcLoginConfig> = {},
): OidcLoginConfig {
  const issuer = stripTrailingSlash(overrides.issuer || env.OIDC_ISSUER || MYNDBBS_OIDC_DEFAULT_ISSUER);
  const siteOrigin = firstConfiguredOrigin(
    env.OIDC_REDIRECT_ORIGIN || env.FRONTEND_URL || env.ORIGIN,
    'http://localhost:3100',
  );
  const redirectUri =
    overrides.redirectUri || env.OIDC_REDIRECT_URI || `${siteOrigin}${MYNDBBS_OIDC_CALLBACK_PATH}`;

  return {
    issuer,
    clientId: overrides.clientId || env.OIDC_CLIENT_ID || MYNDBBS_OIDC_DEFAULT_CLIENT_ID,
    redirectUri,
    scope: overrides.scope || env.OIDC_SCOPE || MYNDBBS_OIDC_DEFAULT_SCOPE,
    authorizationEndpoint:
      overrides.authorizationEndpoint || env.OIDC_AUTHORIZATION_ENDPOINT || `${issuer}/api/oidc/authorize`,
    tokenEndpoint: overrides.tokenEndpoint || env.OIDC_TOKEN_ENDPOINT || `${issuer}/api/oidc/token`,
    jwksUri: overrides.jwksUri || env.OIDC_JWKS_URI || `${issuer}/api/oidc/jwks`,
    successRedirectPath: normalizeSuccessRedirectPath(
      overrides.successRedirectPath || env.OIDC_SUCCESS_REDIRECT_PATH,
    ),
  };
}

export function createPkceCodeChallenge(codeVerifier: string): string {
  return base64Url(createHash('sha256').update(codeVerifier).digest());
}

export class OidcLoginService {
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly config: OidcLoginConfig;
  private jwksCache: JwksCacheEntry | null = null;

  constructor(private readonly opts: OidcLoginServiceOptions) {
    this.fetchImpl = opts.fetchImpl || fetch;
    this.now = opts.now || (() => new Date());
    this.config = buildOidcLoginConfig(process.env, opts.config);
  }

  public getSuccessRedirectPath(): string {
    return this.config.successRedirectPath;
  }

  public createAuthorizationRequest(): OidcAuthorizationRequest {
    const state = createOpaqueBase64Url();
    const codeVerifier = createOpaqueBase64Url();
    const authorizationUrl = new URL(this.config.authorizationEndpoint);

    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', this.config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authorizationUrl.searchParams.set('scope', this.config.scope);
    authorizationUrl.searchParams.set('code_challenge', createPkceCodeChallenge(codeVerifier));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('state', state);

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      codeVerifier,
    };
  }

  /**
   * 创建静默授权请求（prompt=none），用于检查用户是否已在 SSO 登录。
   * 如果用户已登录，SSO 会直接返回授权码；如果未登录，返回 login_required 错误。
   */
  public createSilentAuthorizationRequest(): OidcAuthorizationRequest {
    const state = createOpaqueBase64Url();
    const codeVerifier = createOpaqueBase64Url();
    const authorizationUrl = new URL(this.config.authorizationEndpoint);

    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', this.config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authorizationUrl.searchParams.set('scope', this.config.scope);
    authorizationUrl.searchParams.set('code_challenge', createPkceCodeChallenge(codeVerifier));
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('prompt', 'none');

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      codeVerifier,
    };
  }

  public async exchangeCodeForMyndBbsUser(input: {
    code: string;
    codeVerifier: string;
  }): Promise<MyndBbsOidcUser> {
    const tokens = await this.exchangeAuthorizationCode(input.code, input.codeVerifier);
    const claims = await this.verifyIdToken(tokens.id_token);
    const normalizedEmail = this.extractVerifiedEmail(claims);
    const user = await this.opts.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new Error('ERR_OIDC_MYND_BBS_USER_NOT_FOUND');
    }

    if (user.status === UserStatus.BANNED) {
      throw new Error('ERR_ACCOUNT_IS_BANNED');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('ERR_ACCOUNT_NOT_ACTIVE');
    }

    if (!user.roleId) {
      throw new Error('ERR_OIDC_ROLE_NOT_ALLOWED');
    }

    const role = await this.opts.roleRepository.findById(user.roleId);
    const roleName = role?.name || '';
    if (!MYNDBBS_OIDC_ALLOWED_ROLE_NAMES.has(roleName)) {
      throw new Error('ERR_OIDC_ROLE_NOT_ALLOWED');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: { name: roleName },
      level: user.level,
    };
  }

  private async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<{ id_token: string }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await this.fetchImpl(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)');
      console.error('[OIDC] Token exchange failed: status=' + response.status + ', body=' + errorBody);
      throw new Error('ERR_OIDC_TOKEN_EXCHANGE_FAILED');
    }

    const tokenSet = (await response.json()) as { id_token?: unknown };
    if (typeof tokenSet.id_token !== 'string' || !tokenSet.id_token) {
      throw new Error('ERR_OIDC_ID_TOKEN_MISSING');
    }

    return { id_token: tokenSet.id_token };
  }

  private async verifyIdToken(idToken: string): Promise<JwtPayload> {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('ERR_OIDC_ID_TOKEN_INVALID');
    }

    const kid = decoded.header.kid;
    if (decoded.header.alg !== 'RS256' || typeof kid !== 'string' || !kid) {
      throw new Error('ERR_OIDC_ID_TOKEN_INVALID');
    }

    const publicKey = await this.getPublicKeyForKid(kid);
    const verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: this.config.issuer,
      audience: this.config.clientId,
    });

    if (!verified || typeof verified === 'string') {
      throw new Error('ERR_OIDC_ID_TOKEN_INVALID');
    }

    return verified;
  }

  private extractVerifiedEmail(claims: JwtPayload): string {
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';

    if (!email) {
      throw new Error('ERR_OIDC_EMAIL_MISSING');
    }

    if (claims.email_verified !== true) {
      throw new Error('ERR_OIDC_EMAIL_NOT_VERIFIED');
    }

    return email;
  }

  private async getPublicKeyForKid(kid: string) {
    let keys = await this.loadJwks(false);
    let key = keys.find((candidate) => candidate.kid === kid);

    if (!key) {
      keys = await this.loadJwks(true);
      key = keys.find((candidate) => candidate.kid === kid);
    }

    if (!key) {
      throw new Error('ERR_OIDC_JWKS_KEY_NOT_FOUND');
    }

    return createPublicKey({ key: key as JsonWebKey, format: 'jwk' });
  }

  private async loadJwks(forceRefresh: boolean): Promise<JwkRecord[]> {
    const nowMs = this.now().getTime();
    if (!forceRefresh && this.jwksCache && this.jwksCache.expiresAt > nowMs) {
      return this.jwksCache.keys;
    }

    const response = await this.fetchImpl(this.config.jwksUri, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('ERR_OIDC_JWKS_UNAVAILABLE');
    }

    const jwks = (await response.json()) as { keys?: unknown };
    if (!Array.isArray(jwks.keys)) {
      throw new Error('ERR_OIDC_JWKS_INVALID');
    }

    const keys = jwks.keys.filter((key): key is JwkRecord => {
      return Boolean(key) && typeof key === 'object';
    });

    this.jwksCache = {
      keys,
      expiresAt: nowMs + 5 * 60 * 1000,
    };

    return keys;
  }
}
