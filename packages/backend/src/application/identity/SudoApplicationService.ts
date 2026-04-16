import * as argon2 from 'argon2';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { IdentityQueryService } from '../../queries/identity/IdentityQueryService';
import { AuthApplicationService } from './AuthApplicationService';
import { ISudoStore } from './ports/ISudoStore';

export type VerifyInput =
  | { type: 'password'; password: string }
  | { type: 'totp'; totpCode: string }
  | { type: 'passkey'; passkeyResponse: any; challengeId: string };

export class SudoApplicationService {
  constructor(
    private identityQueryService: IdentityQueryService,
    private authApplicationService: AuthApplicationService,
    private sudoStore: ISudoStore,
    private rpID: string,
    private origin: string
  ) {}

  public async getPasskeyOptions(userId: string): Promise<any> {
    const userPasskeys = await this.identityQueryService.listUserPasskeyIds(userId);
    if (userPasskeys.length === 0) throw new Error('ERR_NO_PASSKEYS_REGISTERED');

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    });

    const authChallenge = await this.authApplicationService.generateAuthChallenge(options.challenge);
    return { ...options, challengeId: authChallenge.id };
  }

  public async verify(userId: string, sessionId: string, input: VerifyInput): Promise<void> {
    const user = await this.identityQueryService.getUserWithRoleById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    let isValid = false;

    if (input.type === 'password') {
      if (!user.password) throw new Error('ERR_INVALID_CREDENTIALS');
      isValid = await argon2.verify(user.password, input.password);
    }

    if (input.type === 'totp') {
      if (!user.totpSecret) throw new Error('ERR_INVALID_TOTP');
      const { OTP } = await import('otplib');
      const authenticator = new OTP({ strategy: 'totp' });
      const result = authenticator.verifySync({ token: input.totpCode, secret: user.totpSecret });
      isValid = result && result.valid;
    }

    if (input.type === 'passkey') {
      const expectedChallenge = await this.authApplicationService.consumeAuthChallenge(input.challengeId);
      const passkey = await this.identityQueryService.getPasskeyById(input.passkeyResponse.id);
      if (!passkey || passkey.userId !== userId) throw new Error('ERR_INVALID_PASSKEY');

      const verification = await verifyAuthenticationResponse({
        response: input.passkeyResponse,
        expectedChallenge: expectedChallenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
        },
      });

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
