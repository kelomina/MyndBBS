import { ITokenPort } from '../../../domain/identity/ports/ITokenPort';
import jwt from 'jsonwebtoken';

/**
 * 类名称：TokenAdapter
 *
 * 函数作用：
 *   基于 jsonwebtoken 的 Token 操作基础设施适配器。
 * Purpose:
 *   Infrastructure adapter for JWT token operations using jsonwebtoken.
 *
 * 中文关键词：
 *   Token，JWT，适配器
 * English keywords:
 *   token, JWT, adapter
 */
export class TokenAdapter implements ITokenPort {
  public sign(payload: any, secret: string, expiresIn: string): string {
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  public verify(token: string, secret: string, options?: any): any {
    return jwt.verify(token, secret, options);
  }
}
