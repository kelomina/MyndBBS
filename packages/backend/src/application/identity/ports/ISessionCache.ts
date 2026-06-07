export interface ISessionCache {
  revokeSession(sessionId: string): Promise<void>;
  markSessionRequiresRefresh(sessionId: string, ttlSeconds: number): Promise<void>;
  getSessionValidity(sessionId: string): Promise<'valid' | 'invalid' | null>;
  setSessionValidity(sessionId: string, validity: 'valid' | 'invalid', ttlSeconds: number): Promise<void>;
  checkRequiresRefresh(sessionId: string): Promise<boolean>;
  extendRefreshGracePeriod(sessionId: string, ttlSeconds: number): Promise<void>;
  
  storeTotpSecret(userId: string, secret: string, ttlSeconds: number): Promise<void>;
  getTotpSecret(userId: string): Promise<string | null>;
  removeTotpSecret(userId: string): Promise<void>;
}
