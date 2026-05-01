/**
 * 类名称：IdentityIntegrationPort
 *
 * 函数作用：
 *   身份集成适配器——为社区域和私信域提供用户身份查询（角色、用户资料）的统一接口。
 * Purpose:
 *   Identity integration adapter — provides a unified interface for community and messaging domains
 *   to query user identity (roles, profiles).
 *
 * 中文关键词：
 *   身份集成，适配器，用户查询，角色
 * English keywords:
 *   identity integration, adapter, user query, role
 */
import { IIdentityIntegrationPort as ICommunityIdentityPort } from '../../domain/community/IIdentityIntegrationPort';
import { IIdentityIntegrationPort as IMessagingIdentityPort } from '../../domain/messaging/IIdentityIntegrationPort';
import { IdentityQueryService } from '../../queries/identity/IdentityQueryService';

export class IdentityIntegrationPort implements ICommunityIdentityPort, IMessagingIdentityPort {
  constructor(private identityQueryService: IdentityQueryService) {}

  /**
   * 函数名称：isModerator
   *
   * 函数作用：
   *   判断用户是否为版主（MODERATOR 角色）。
   * Purpose:
   *   Checks if a user has the MODERATOR role.
   */
  public async isModerator(userId: string): Promise<boolean> {
    const user = await this.identityQueryService.getUserWithRoleById(userId);
    return user?.role?.name === 'MODERATOR';
  }

  /**
   * 函数名称：getUserProfile
   *
   * 函数作用：
   *   获取用户的个人资料（ID、用户名、等级）。
   * Purpose:
   *   Gets a user's profile (ID, username, level).
   */
  public async getUserProfile(userId: string): Promise<{ id: string; username: string; level: number } | null> {
    const profile = await this.identityQueryService.getProfile(userId);
    if (!profile) return null;
    return {
      id: profile.id,
      username: profile.username,
      level: profile.level
    };
  }

  public async getUserByUsername(username: string): Promise<{ id: string; username: string } | null> {
    const user = await this.identityQueryService.getUserByUsername(username);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username
    };
  }
}
