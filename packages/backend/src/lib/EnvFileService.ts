import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';

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

export type DomainConfigInput = {
  protocol: 'http' | 'https';
  hostname: string;
  rpId: string;
  reverseProxyMode: boolean;
};

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

export class EnvFileService {
  constructor(private envPath: string) {}

  async read(): Promise<string> {
    return fs.readFile(this.envPath, 'utf8').catch(() => '');
  }

  async write(content: string): Promise<void> {
    await fs.writeFile(this.envPath, content);
  }
}
