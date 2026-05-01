/**
 * 接口名称：ITotpPort
 *
 * 函数作用：
 *   TOTP 生成和验证的端口接口。
 * Purpose:
 *   Port interface for TOTP generation and verification.
 *
 * 中文关键词：
 *   TOTP，双因素认证，端口接口
 * English keywords:
 *   TOTP, two-factor auth, port interface
 */
export interface ITotpPort {
  generateSecret(): string;
  generateURI(issuer: string, accountName: string, secret: string): string;
  verify(secret: string, token: string): boolean;
}
