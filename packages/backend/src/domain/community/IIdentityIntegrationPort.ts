/**
 * 接口名称：IIdentityIntegrationPort（Community）
 *
 * 函数作用：
 *   社区域的身份集成端口接口——提供版主判断。
 * Purpose:
 *   Identity integration port interface for the Community domain — provides moderator checks.
 *
 * 中文关键词：
 *   身份集成，社区域，版主
 * English keywords:
 *   identity integration, community domain, moderator
 */
export interface IIdentityIntegrationPort {
  isModerator(userId: string): Promise<boolean>;
}
