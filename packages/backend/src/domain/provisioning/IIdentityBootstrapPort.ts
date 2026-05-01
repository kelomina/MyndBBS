/**
 * 接口名称：IIdentityBootstrapPort
 *
 * 函数作用：
 *   身份引导端口接口——用于在安装流程中引导超级管理员。
 * Purpose:
 *   Identity bootstrap port interface — used for bootstrapping the super admin during installation.
 *
 * 中文关键词：
 *   身份引导，超级管理员，端口接口
 * English keywords:
 *   identity bootstrap, super admin, port interface
 */
export interface IIdentityBootstrapPort {
  bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string>;
}
