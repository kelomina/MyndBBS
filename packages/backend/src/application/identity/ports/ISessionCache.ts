export interface ISessionCache {
  revokeSession(sessionId: string): Promise<void>;
  markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void>;
  getSessionValidity(sessionId: string): Promise<'valid' | 'invalid' | null>;
  setSessionValidity(sessionId: string, validity: 'valid' | 'invalid', ttlSeconds: number): Promise<void>;
  checkRequiresRefresh(sessionId: string): Promise<boolean>;
  extendRefreshGracePeriod(sessionId: string, ttlSeconds: number): Promise<void>;
}
