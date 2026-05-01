/**
 * 接口名称：IPasskeyPort
 *
 * 函数作用：
 *   WebAuthn Passkey 操作的端口接口——定义注册和认证选项生成与响应验证的契约。
 * Purpose:
 *   Port interface for WebAuthn Passkey operations — defines the contract for
 *   registration/authentication option generation and response verification.
 *
 * 调用方 / Called by:
 *   - AuthApplicationService
 *
 * 实现方 / Implemented by:
 *   - PasskeyAdapter
 *
 * 中文关键词：
 *   Passkey，WebAuthn，端口接口，注册，认证
 * English keywords:
 *   passkey, WebAuthn, port interface, registration, authentication
 */
export interface IPasskeyPort {
  generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any>;
  verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string): Promise<any>;
  generateAuthenticationOptions(allowCredentials: any[]): Promise<any>;
  verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string, expectedRPID: string, credential: any): Promise<any>;
}
