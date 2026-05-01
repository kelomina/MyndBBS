/**
 * 接口名称：ITokenPort
 *
 * 函数作用：
 *   JWT Token 操作的端口接口——定义签名和验证的契约。
 * Purpose:
 *   Port interface for JWT token operations — defines the contract for signing and verification.
 *
 * 调用方 / Called by:
 *   - AuthApplicationService
 *
 * 实现方 / Implemented by:
 *   - TokenAdapter
 *
 * 中文关键词：
 *   Token，JWT，端口接口，签名，验证
 * English keywords:
 *   token, JWT, port interface, sign, verify
 */
export interface ITokenPort {
  /** 签发 JWT token / Signs a JWT token */
  sign(payload: any, secret: string, expiresIn: string): string;
  /** 验证 JWT token / Verifies a JWT token */
  verify(token: string, secret: string, options?: any): any;
}
