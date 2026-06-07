export interface ISudoStore {
  grant(sessionId: string, ttlSeconds: number): Promise<void>;
  check(sessionId: string): Promise<boolean>;
}
