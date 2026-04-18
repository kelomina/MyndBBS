import { ITotpPort } from '../../../domain/identity/ports/ITotpPort';
import { OTP } from 'otplib';
import * as QRCode from 'qrcode';

/**
 * Callers: [Registry]
 * Callees: [OTP, QRCode]
 * Description: Infrastructure adapter for TOTP operations using otplib and qrcode.
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

  public async generateQRCode(otpauth: string): Promise<string> {
    return await QRCode.toDataURL(otpauth);
  }

  public verify(secret: string, token: string): boolean {
    const result = this.authenticator.verifySync({ secret, token });
    return result && result.valid;
  }
}
