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

export interface IEnvStore {
  read(): Promise<string>;
  write(content: string): Promise<void>;
  updateDatabaseUrl(newDbUrl: string): Promise<void>;
  setupEnvironment(config: EnvironmentConfigInput, jwtSecret: string, jwtRefreshSecret: string): Promise<void>;
  updateDomainConfig(config: DomainConfigInput): Promise<void>;
}
