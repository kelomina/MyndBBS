export interface IAbilityCache {
  invalidateUserRules(userId: string): Promise<void>;
  invalidateUsersRules(userIds: string[]): Promise<void>;
}
