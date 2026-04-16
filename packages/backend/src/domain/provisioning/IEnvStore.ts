export interface IEnvStore {
  read(): Promise<string>;
  write(content: string): Promise<void>;
  updateDatabaseUrl(newDbUrl: string): Promise<void>;
}
