import { ITokenPort } from '../../../domain/identity/ports/ITokenPort';
import jwt from 'jsonwebtoken';

/**
 * Callers: [Registry]
 * Callees: [jwt]
 * Description: Infrastructure adapter for Token operations using jsonwebtoken.
 * Keywords: token, adapter, infrastructure, identity, jwt
 */
export class TokenAdapter implements ITokenPort {
  public sign(payload: any, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, { expiresIn });
  }

  public verify(token: string, secret: string): any {
    return jwt.verify(token, secret);
  }
}
