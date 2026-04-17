import { ITotpPort } from '../../../domain/identity/ports/ITotpPort';
import { OTP } from 'otplib';

/**
 * Callers: [Registry]
 * Callees: [OTP]
 * Description: Infrastructure adapter for TOTP operations using otplib.
 * Keywords: totp, adapter, infrastructure, identity
 */
export class TotpAdapter implements ITotpPort {
  private authenticator = new OTP({ strategy: 'totp' });

  public generateSecret(): string {
    return this.authenticator.generateSecret();
  }

  public generateURI(issuer: string, accountName: string, secret: string): string {
    return this.authenticator.generateURI({ issuer, label: accountName, secret });
  }

  public verify(secret: string, token: string): boolean {
    const result = this.authenticator.verifySync({ secret, token });
    return result && result.valid;
  }
}
