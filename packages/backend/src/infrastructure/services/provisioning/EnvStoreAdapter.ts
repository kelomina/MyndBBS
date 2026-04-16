import { IEnvStore } from '../../../domain/provisioning/IEnvStore';
import { EnvFileService, getBackendEnvPath } from '../../../lib/EnvFileService';

export class EnvStoreAdapter implements IEnvStore {
  private envService: EnvFileService;

  constructor() {
    this.envService = new EnvFileService(getBackendEnvPath(__dirname));
  }

  async read(): Promise<string> {
    return this.envService.read();
  }

  async write(content: string): Promise<void> {
    return this.envService.write(content);
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
}
