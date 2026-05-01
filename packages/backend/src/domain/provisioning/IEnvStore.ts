/**
 * 接口名称：DomainConfigInput
 *
 * 函数作用：
 *   域名配置输入的 DTO 类型。
 * Purpose:
 *   DTO type for domain configuration input.
 */
export interface DomainConfigInput {
  protocol: 'http' | 'https';
  hostname: string;
  rpId: string;
  reverseProxyMode: boolean;
}

export interface EnvironmentConfigInput extends DomainConfigInput {
  databaseUrl: string;
  port?: string | number;
  frontendUrl?: string;
  uploadDir?: string;
  webRoot?: string;
}

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * 接口名称：IEnvStore
 *
 * 函数作用：
 *   环境变量存储接口——定义读写 .env 文件和更新数据库/域名/SMTP 配置的契约。
 * Purpose:
 *   Environment store interface — defines the contract for reading/writing .env files and updating database, domain, and SMTP config.
 *
 * 中文关键词：
 *   环境变量，配置存储，接口
 * English keywords:
 *   environment variable, config store, interface
 */
export interface IEnvStore {
  read(): Promise<string>;
  write(content: string): Promise<void>;
  updateDatabaseUrl(newDbUrl: string): Promise<void>;
  setupEnvironment(config: EnvironmentConfigInput, jwtSecret: string, jwtRefreshSecret: string): Promise<void>;
  updateDomainConfig(config: DomainConfigInput): Promise<void>;
  updateSmtpConfig(config: SmtpConfigInput): Promise<void>;
}
