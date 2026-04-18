/**
 * Callers: [AuthApplicationService]
 * Callees: []
 * Description: Port interface for generating JWT tokens.
 * Keywords: token, port, domain, identity, jwt
 */
export interface ITokenPort {
  sign(payload: any, secret: string, expiresIn: string): string;
  verify(token: string, secret: string, options?: any): any;
}
