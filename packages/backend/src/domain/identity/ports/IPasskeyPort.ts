/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: Port interface for WebAuthn Passkey operations.
 * Keywords: passkey, port, domain, identity, webauthn
 */
export interface IPasskeyPort {
  generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any>;
  verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string): Promise<any>;
  generateAuthenticationOptions(allowCredentials: any[]): Promise<any>;
  verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string, credential: any): Promise<any>;
}
