export interface ISessionCache {
  revokeSession(sessionId: string): Promise<void>;
  markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void>;
}
