/**
 * Callers: [AuthApplicationService, UserApplicationService]
 * Callees: []
 * Description: Port interface for TOTP generation and verification.
 * Keywords: totp, port, domain, identity
 */
export interface ITotpPort {
  generateSecret(): string;
  generateURI(issuer: string, accountName: string, secret: string): string;
  generateQRCode(otpauth: string): Promise<string>;
  verify(secret: string, token: string): boolean;
}
