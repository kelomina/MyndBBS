import { IPasskeyPort } from '../../../domain/identity/ports/IPasskeyPort';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { APP_NAME } from '@myndbbs/shared';

/**
 * Callers: [Registry]
 * Callees: [@simplewebauthn/server]
 * Description: Infrastructure adapter for Passkey operations using simplewebauthn.
 * Keywords: passkey, adapter, infrastructure, identity, webauthn
 */
export class PasskeyAdapter implements IPasskeyPort {
  public async generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any> {
    return generateRegistrationOptions({
      rpName: APP_NAME,
      rpID: process.env.RP_ID || 'localhost',
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });
  }

  public async verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string): Promise<any> {
    return verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
    });
  }

  public async generateAuthenticationOptions(allowCredentials: any[]): Promise<any> {
    return generateAuthenticationOptions({
      rpID: process.env.RP_ID || 'localhost',
      allowCredentials,
      userVerification: 'preferred',
    });
  }

  public async verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string, credential: any): Promise<any> {
    return verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential,
    });
  }
}
