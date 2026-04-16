import { IIdentityIntegrationPort as ICommunityIdentityPort } from '../../domain/community/IIdentityIntegrationPort';
import { IIdentityIntegrationPort as IMessagingIdentityPort } from '../../domain/messaging/IIdentityIntegrationPort';
import { IdentityQueryService } from '../../queries/identity/IdentityQueryService';

export class IdentityIntegrationPort implements ICommunityIdentityPort, IMessagingIdentityPort {
  constructor(private identityQueryService: IdentityQueryService) {}

  public async isModerator(userId: string): Promise<boolean> {
    const user = await this.identityQueryService.getUserWithRoleById(userId);
    return user?.role?.name === 'MODERATOR';
  }

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
