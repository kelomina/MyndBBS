export interface IIdentityIntegrationPort {
  isModerator(userId: string): Promise<boolean>;
}
