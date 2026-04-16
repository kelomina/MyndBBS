export interface IIdentityIntegrationPort {
  getUserProfile(userId: string): Promise<{ id: string; username: string; level: number } | null>;
  getUserByUsername(username: string): Promise<{ id: string; username: string } | null>;
}
