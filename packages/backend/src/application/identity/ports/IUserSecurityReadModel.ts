export interface IUserSecurityReadModel {
  listUserPasskeyIds(userId: string): Promise<any[]>;
  getUserWithRoleById(userId: string): Promise<any | null>;
  getPasskeyById(passkeyId: string): Promise<any | null>;
}
