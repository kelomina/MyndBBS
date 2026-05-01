import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { IEnvStore, EnvironmentConfigInput, DomainConfigInput, SmtpConfigInput } from '../../../domain/provisioning/IEnvStore';

export function getBackendEnvPath(fromDirname: string): string {
  let dir = fromDirname;
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fsSync.existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(fsSync.readFileSync(pkgPath, 'utf8'));
        if (parsed?.name === 'backend') {
          return path.join(dir, '.env');
        }
      } catch {
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(fromDirname, '../../.env');
}

export function upsertKey(envContent: string, key: string, rawValue: string): string {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(envContent)) {
    return envContent.replace(re, `${key}=${rawValue}`);
  }
  const suffix = envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n';
  return `${envContent}${suffix}${key}=${rawValue}\n`;
}

export function upsertFrontendUrlOrigin(envContent: string, origin: string): string {
  const key = 'FRONTEND_URL';
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const match = envContent.match(re);
  if (!match) {
    return upsertKey(envContent, key, `"${origin}"`);
  }

  const raw = match[1] || '';
  const unquoted = raw.trim().replace(/^"(.*)"$/, '$1');
  const rawItems = unquoted
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const items: string[] = [];
  const seen = new Set<string>();
  for (const item of rawItems) {
    if (seen.has(item)) continue;
    seen.add(item);
    items.push(item);
  }

  if (!seen.has(origin)) items.push(origin);

  const next = `"${items.join(',')}"`;
  return envContent.replace(re, `${key}=${next}`);
}

export function validateHostname(hostname: string): boolean {
  const h = hostname.trim();
  if (!h) return false;
  if (h.includes('://')) return false;
  if (h.includes('/')) return false;
  if (h.includes(':') && !h.includes('::')) return false;
  if (/\s/.test(h)) return false;

  if (h === 'localhost') return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;

  if (h.includes(':')) {
    return /^[0-9a-fA-F:]+$/.test(h);
  }

  if (!/^[a-zA-Z0-9.-]+$/.test(h)) return false;
  if (h.startsWith('-') || h.endsWith('-')) return false;
  if (h.startsWith('.') || h.endsWith('.')) return false;
  return true;
}

export function validateRpId(rpId: string): boolean {
  return validateHostname(rpId);
}

export function buildOrigin(protocol: string, hostname: string): string {
  return `${protocol}://${hostname}`;
}

export function applyDomainConfigToEnv(envContent: string, input: DomainConfigInput): string {
  if (!validateHostname(input.hostname) || !validateRpId(input.rpId)) {
    throw new Error('ERR_INVALID_DOMAIN_CONFIG');
  }

  const origin = buildOrigin(input.protocol, input.hostname);
  let next = envContent;
  next = upsertKey(next, 'ORIGIN', `"${origin}"`);
  next = upsertKey(next, 'RP_ID', `"${input.rpId}"`);
  next = upsertKey(next, 'TRUST_PROXY', input.reverseProxyMode ? 'true' : 'false');
  next = upsertFrontendUrlOrigin(next, origin);
  return next;
}

export class EnvStoreAdapter implements IEnvStore {
  private envPath: string;

  constructor() {
    this.envPath = getBackendEnvPath(__dirname);
  }

  async read(): Promise<string> {
    return fs.readFile(this.envPath, 'utf8').catch(() => '');
  }

  async write(content: string): Promise<void> {
    await fs.writeFile(this.envPath, content);
  }

  async updateDatabaseUrl(newDbUrl: string): Promise<void> {
    let content = await this.read();
    if (content.includes('DATABASE_URL=')) {
      content = content.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${newDbUrl}"`);
    } else {
      content += `\nDATABASE_URL="${newDbUrl}"`;
    }
    await this.write(content);
    process.env.DATABASE_URL = newDbUrl;
  }

  async setupEnvironment(config: EnvironmentConfigInput, jwtSecret: string, jwtRefreshSecret: string): Promise<void> {
    if (!validateHostname(config.hostname) || !validateRpId(config.rpId)) {
      throw new Error('ERR_INVALID_DOMAIN_CONFIG');
    }

    const origin = buildOrigin(config.protocol, config.hostname);
    const frontendUrlValue = config.frontendUrl || origin;
    let envContent = `
PORT=${config.port || 3001}
FRONTEND_URL="${frontendUrlValue}"
UPLOAD_DIR="${config.uploadDir || './uploads'}"
WEB_ROOT="${config.webRoot || '/'}"
JWT_SECRET="${jwtSecret}"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"
`.trim() + '\n';

    envContent = applyDomainConfigToEnv(envContent, {
      protocol: config.protocol,
      hostname: config.hostname,
      rpId: config.rpId,
      reverseProxyMode: config.reverseProxyMode
    });

    await this.write(envContent);

    // Update process.env
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_REFRESH_SECRET = jwtRefreshSecret;
    process.env.ORIGIN = origin;
    process.env.RP_ID = config.rpId;
    process.env.TRUST_PROXY = config.reverseProxyMode ? 'true' : 'false';
    const m = envContent.match(/^FRONTEND_URL=(.*)$/m);
    if (m?.[1]) {
      process.env.FRONTEND_URL = m[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  async updateDomainConfig(config: DomainConfigInput): Promise<void> {
    if (!validateHostname(config.hostname) || !validateRpId(config.rpId)) {
      throw new Error('ERR_INVALID_DOMAIN_CONFIG');
    }
    const before = await this.read();
    const after = applyDomainConfigToEnv(before, config);
    await this.write(after);

    const origin = buildOrigin(config.protocol, config.hostname);
    process.env.ORIGIN = origin;
    process.env.RP_ID = config.rpId;
    process.env.TRUST_PROXY = config.reverseProxyMode ? 'true' : 'false';

    const m = after.match(/^FRONTEND_URL=(.*)$/m);
    if (m?.[1]) {
      process.env.FRONTEND_URL = m[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  async updateSmtpConfig(config: SmtpConfigInput): Promise<void> {
    let content = await this.read();
    content = upsertKey(content, 'SMTP_HOST', `"${config.host}"`);
    content = upsertKey(content, 'SMTP_PORT', String(config.port));
    content = upsertKey(content, 'SMTP_SECURE', config.secure ? 'true' : 'false');
    content = upsertKey(content, 'SMTP_USER', `"${config.user}"`);
    content = upsertKey(content, 'SMTP_PASS', `"${config.pass}"`);
    content = upsertKey(content, 'SMTP_FROM', `"${config.from}"`);
    await this.write(content);

    process.env.SMTP_HOST = config.host;
    process.env.SMTP_PORT = String(config.port);
    process.env.SMTP_SECURE = config.secure ? 'true' : 'false';
    process.env.SMTP_USER = config.user;
    process.env.SMTP_PASS = config.pass;
    process.env.SMTP_FROM = config.from;
  }
}
