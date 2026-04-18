import { AuthApplicationService } from './AuthApplicationService';
import { ISudoStore } from './ports/ISudoStore';
import { IUserSecurityReadModel } from './ports/IUserSecurityReadModel';
import { IPasswordHasher } from '../../domain/identity/IPasswordHasher';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';
import { IPasskeyPort } from '../../domain/identity/ports/IPasskeyPort';

export type VerifyInput =
  | { type: 'password'; password: string }
  | { type: 'totp'; totpCode: string }
  | { type: 'passkey'; passkeyResponse: any; challengeId: string };

/**
 * Callers: [SudoController]
 * Callees: [IUserSecurityReadModel, AuthApplicationService, ISudoStore, IPasswordHasher, ITotpPort, IPasskeyPort]
 * Description: The Application Service for handling Sudo (elevated privilege) mode.
 * Keywords: sudo, identity, application, service, elevated
 */
export class SudoApplicationService {
  constructor(
    private userSecurityReadModel: IUserSecurityReadModel,
    private authApplicationService: AuthApplicationService,
    private sudoStore: ISudoStore,
    private passwordHasher: IPasswordHasher,
    private totpPort: ITotpPort,
    private passkeyPort: IPasskeyPort,
    private rpID: string,
    private origin: string
  ) {}

  public async getPasskeyOptions(userId: string): Promise<any> {
    const userPasskeys = await this.userSecurityReadModel.listUserPasskeyIds(userId);
    if (userPasskeys.length === 0) throw new Error('ERR_NO_PASSKEYS_REGISTERED');

    const allowCredentials = userPasskeys.map((passkey) => ({
      id: passkey.id,
      transports: ['internal'] as any,
    }));

    const options = await this.passkeyPort.generateAuthenticationOptions(allowCredentials);

    const authChallenge = await this.authApplicationService.generateAuthChallenge(options.challenge);
    return { ...options, challengeId: authChallenge.id };
  }

  public async verify(userId: string, sessionId: string, input: VerifyInput): Promise<void> {
    const user = await this.userSecurityReadModel.getUserWithRoleById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    let isValid = false;

    if (input.type === 'password') {
      if (!user.password) throw new Error('ERR_INVALID_CREDENTIALS');
      isValid = await this.passwordHasher.verify(user.password, input.password);
    }

    if (input.type === 'totp') {
      if (!user.totpSecret) throw new Error('ERR_INVALID_TOTP');
      isValid = this.totpPort.verify(user.totpSecret, input.totpCode);
    }

    if (input.type === 'passkey') {
      const expectedChallenge = await this.authApplicationService.consumeAuthChallenge(input.challengeId);
      const passkey = await this.userSecurityReadModel.getPasskeyById(input.passkeyResponse.id);
      if (!passkey || passkey.userId !== userId) throw new Error('ERR_INVALID_PASSKEY');

      const credential = {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      };

      const verification = await this.passkeyPort.verifyAuthenticationResponse(
        input.passkeyResponse,
        expectedChallenge.challenge,
        this.origin,
        this.rpID,
        credential
      );

      isValid = verification.verified;
      if (isValid && verification.authenticationInfo) {
        await this.authApplicationService.updatePasskeyCounter(passkey.id, BigInt(verification.authenticationInfo.newCounter));
      }
    }

    if (!isValid) throw new Error('ERR_VERIFICATION_FAILED');
    await this.sudoStore.grant(sessionId, 15 * 60);
  }

  public async check(sessionId: string): Promise<boolean> {
    return this.sudoStore.check(sessionId);
  }
}
