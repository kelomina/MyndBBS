import { SystemApplicationService } from '../system/SystemApplicationService';
import { applyDomainConfigToEnv, buildOrigin, EnvFileService, getBackendEnvPath, validateHostname, validateRpId } from '../../lib/EnvFileService';
import crypto from 'crypto';
import fs from 'fs';

export interface InstallationConfig {
  DATABASE_URL: string;
  PORT?: number;
  FRONTEND_URL?: string;
  UPLOAD_DIR?: string;
  WEB_ROOT?: string;
  PROTOCOL?: string;
  HOSTNAME?: string;
  RP_ID?: string;
  REVERSE_PROXY_MODE?: boolean;
}

export class InstallationApplicationService {
  constructor(private systemApplicationService: SystemApplicationService) {}

  public async startInstallation(config: InstallationConfig): Promise<string> {
    await this.configureDatabase(config);
    await this.applySchema();
    const token = await this.systemApplicationService.createTemporaryRootUser();
    return token;
  }

  public async configureDatabase(config: InstallationConfig): Promise<void> {
    if (!config.DATABASE_URL) {
      throw new Error('缺少 DATABASE_URL');
    }

    const protocol = config.PROTOCOL === 'https' ? 'https' : 'http';
    const hostname = String(config.HOSTNAME || 'localhost').trim();
    if (!validateHostname(hostname)) {
      throw new Error('ERR_INVALID_DOMAIN_CONFIG');
    }

    const rpId = String(config.RP_ID || hostname).trim();
    if (!validateRpId(rpId)) {
      throw new Error('ERR_INVALID_DOMAIN_CONFIG');
    }

    const reverseProxyMode = !!config.REVERSE_PROXY_MODE;
    const origin = buildOrigin(protocol, hostname);

    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');

    const frontendUrlValue = config.FRONTEND_URL || origin;
    let envContent = `
DATABASE_URL="${config.DATABASE_URL}"
PORT=${config.PORT || 3001}
FRONTEND_URL="${frontendUrlValue}"
UPLOAD_DIR="${config.UPLOAD_DIR || './uploads'}"
WEB_ROOT="${config.WEB_ROOT || '/'}"
JWT_SECRET="${jwtSecret}"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"
`.trim() + '\n';

    envContent = applyDomainConfigToEnv(envContent, {
      protocol,
      hostname,
      rpId,
      reverseProxyMode,
    });

    const envPath = getBackendEnvPath(__dirname);
    await new EnvFileService(envPath).write(envContent);

    // Update process.env for Prisma in current runtime
    process.env.DATABASE_URL = config.DATABASE_URL;
    process.env.JWT_SECRET = jwtSecret;
    process.env.JWT_REFRESH_SECRET = jwtRefreshSecret;
    process.env.ORIGIN = origin;
    process.env.RP_ID = rpId;
    process.env.TRUST_PROXY = reverseProxyMode ? 'true' : 'false';
    const m = envContent.match(/^FRONTEND_URL=(.*)$/m);
    if (m?.[1]) {
      process.env.FRONTEND_URL = m[1].trim().replace(/^"(.*)"$/, '$1');
    }
  }

  public async applySchema(): Promise<void> {
    try {
      await this.systemApplicationService.initializeDatabaseSchema();
    } catch (error: any) {
      console.error('Prisma Error:', error.message);
      throw new Error('数据库初始化失败，请检查您的数据库凭据并确保 PostgreSQL 正在运行。');
    }
  }

  public async finalizeInstallation(username: string, email: string, password: string): Promise<string> {
    const userId = await this.systemApplicationService.finalizeInstallation(username, email, password);

    const envPath = getBackendEnvPath(__dirname);
    fs.appendFileSync(envPath, '\nINSTALL_LOCKED=true\n');

    return userId;
  }
}
