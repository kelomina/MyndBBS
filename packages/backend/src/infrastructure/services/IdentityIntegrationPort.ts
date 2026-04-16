import { IIdentityIntegrationPort } from '../../domain/community/IIdentityIntegrationPort';
import { IdentityQueryService } from '../../queries/identity/IdentityQueryService';

export class IdentityIntegrationPort implements IIdentityIntegrationPort {
  constructor(private identityQueryService: IdentityQueryService) {}

  public async isModerator(userId: string): Promise<boolean> {
    const user = await this.identityQueryService.getUserWithRoleById(userId);
    return user?.role?.name === 'MODERATOR';
  }
}
