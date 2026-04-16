import { IIdentityBootstrapPort } from '../../../domain/provisioning/IIdentityBootstrapPort';
import { IdentityBootstrapApplicationService } from '../../../application/identity/IdentityBootstrapApplicationService';

export class IdentityBootstrapServiceAdapter implements IIdentityBootstrapPort {
  constructor(private identityBootstrapService: IdentityBootstrapApplicationService) {}

  public async bootstrapSuperAdmin(username: string, email: string, password: string): Promise<string> {
    return this.identityBootstrapService.bootstrapSuperAdmin(username, email, password);
  }
}
