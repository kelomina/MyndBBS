export interface IIdentityBootstrapPort {
  bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string>;
}
