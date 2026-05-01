/**
 * 模块：EnvStoreAdapter
 *
 * 函数作用：
 *   环境变量存储适配器——读写 .env 文件，提供数据库/域名/SMTP 等配置的持久化与更新。
 * Purpose:
 *   Environment variable store adapter — reads and writes .env files, provides persistence
 *   and updates for database, domain, and SMTP configuration.
 *
 * 中文关键词：
 *   环境变量，.env，配置适配器，安装，SMTP，域名
 * English keywords:
 *   environment variable, .env, config adapter, setup, SMTP, domain
 */
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { IEnvStore, EnvironmentConfigInput, DomainConfigInput, SmtpConfigInput } from '../../../domain/provisioning/IEnvStore';

/**
 * 函数名称：getBackendEnvPath
 *
 * 函数作用：
 *   从调用目录向上查找 backend 包的 package.json，定位 .env 文件路径。
 * Purpose:
 *   Walks up from the calling directory to locate the .env file by finding the backend package.json.
 */
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

/**
 * 函数名称：upsertKey
 *
 * 函数作用：
 *   在 .env 内容中插入或更新单行键值对。
 * Purpose:
 *   Inserts or updates a single key-value pair in .env content.
 */
export function upsertKey(envContent: string, key: string, rawValue: string): string {
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(envContent)) {
    return envContent.replace(re, `${key}=${rawValue}`);
  }
  const suffix = envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n';
  return `${envContent}${suffix}${key}=${rawValue}\n`;
}

/** 将 origin 合并到 FRONTEND_URL 环境变量中（去重）/ Merges an origin into FRONTEND_URL env var (deduplicated) */
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

/** 校验主机名格式（禁止协议、路径、IP、特殊字符）/ Validates hostname format (no protocol, path, IP, special chars) */
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

/** 校验 WebAuthn RP ID 格式（同主机名校验）/ Validates WebAuthn RP ID format (same as hostname) */
export function validateRpId(rpId: string): boolean {
  return validateHostname(rpId);
}

/** 构建 origin URL / Builds an origin URL from protocol and hostname */
export function buildOrigin(protocol: string, hostname: string): string {
  return `${protocol}://${hostname}`;
}

/**
 * 函数名称：applyDomainConfigToEnv
 *
 * 函数作用：
 *   将域名配置应用到 .env 内容字符串中。
 * Purpose:
 *   Applies domain configuration to an .env content string.
 */
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

/**
 * 类名称：EnvStoreAdapter
 *
 * 函数作用：
 *   .env 文件读写适配器——提供数据库/域名/SMTP 配置的持久化。
 * Purpose:
 *   .env file read/write adapter — provides persistence for database, domain, and SMTP configuration.
 */
export class EnvStoreAdapter implements IEnvStore {
  private envPath: string;

  constructor() {
    this.envPath = getBackendEnvPath(__dirname);
  }

  /** 读取 .env 文件内容 / Reads .env file content */
  async read(): Promise<string> {
    return fs.readFile(this.envPath, 'utf8').catch(() => '');
  }

  /** 写入 .env 文件 / Writes .env file content */
  async write(content: string): Promise<void> {
    await fs.writeFile(this.envPath, content);
  }

  /**
   * 函数名称：updateDatabaseUrl
   *
   * 函数作用：
   *   更新 .env 中的 DATABASE_URL，并同步到当前进程环境变量。
   * Purpose:
   *   Updates DATABASE_URL in .env and syncs to the current process env.
   */
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

  /**
   * 函数名称：setupEnvironment
   *
   * 函数作用：
   *   安装流程中初始化 .env 文件，写入全部必需配置并同步到进程环境。
   * Purpose:
   *   Initializes .env during installation, writes all required config and syncs to process env.
   */
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

  /**
   * 函数名称：updateDomainConfig
   *
   * 函数作用：
   *   更新 .env 中的域名配置并同步到进程环境。
   * Purpose:
   *   Updates domain config in .env and syncs to process env.
   */
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

  /**
   * 函数名称：updateSmtpConfig
   *
   * 函数作用：
   *   更新 .env 中的 SMTP 配置并同步到进程环境。
   * Purpose:
   *   Updates SMTP config in .env and syncs to process env.
   */
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
