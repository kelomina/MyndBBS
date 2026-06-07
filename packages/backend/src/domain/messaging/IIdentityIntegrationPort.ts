/**
 * 接口名称：IIdentityIntegrationPort（Messaging）
 *
 * 函数作用：
 *   私信域的身份集成端口接口——提供用户资料查询。
 * Purpose:
 *   Identity integration port interface for the Messaging domain — provides user profile queries.
 *
 * 中文关键词：
 *   身份集成，私信域，端口接口
 * English keywords:
 *   identity integration, messaging domain, port interface
 */
export interface IIdentityIntegrationPort {
  getUserProfile(userId: string): Promise<{ id: string; username: string; level: number } | null>;
  getUserByUsername(username: string): Promise<{ id: string; username: string } | null>;
}
