import { IPasskeyPort } from '../../../domain/identity/ports/IPasskeyPort';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { APP_NAME } from '@myndbbs/shared';

/**
 * 适配器名称：PasskeyAdapter
 *
 * 函数作用：
 *   WebAuthn Passkey 操作的基础设施适配器。将 simplewebauthn 库包装为 IPasskeyPort 接口，
 *   生成注册/认证选项并验证响应。
 *
 * Adapter: PasskeyAdapter
 *
 * Purpose:
 *   Infrastructure adapter for WebAuthn Passkey operations. Wraps the simplewebauthn library
 *   as an IPasskeyPort implementation, generating registration/authentication options and
 *   verifying responses.
 *
 * 调用方 / Called by:
 *   - Registry（依赖注入注册）
 *   - AuthApplicationService（通过 IPasskeyPort 接口间接调用）
 *
 * 被调用方 / Calls:
 *   - @simplewebauthn/server（generateRegistrationOptions, verifyRegistrationResponse,
 *     generateAuthenticationOptions, verifyAuthenticationResponse）
 *
 * 接入方式 / Integration:
 *   - 由 Registry 实例化并注入到 AuthApplicationService
 *   - 每次调用均为无状态方法，不持有可变状态
 *
 * 中文关键词：
 *   Passkey，WebAuthn，适配器，simplewebauthn，基础设施，身份，安全，注册，认证，FIDO2
 * English keywords:
 *   passkey, WebAuthn, adapter, simplewebauthn, infrastructure, identity, security, registration, authentication, FIDO2
 */
export class PasskeyAdapter implements IPasskeyPort {
  /**
   * 函数名称：generateRegistrationOptions
   *
   * 函数作用：
   *   生成 WebAuthn 通行密钥注册选项。设置 residentKey=required 以确保创建可发现凭据（passkey），
   *   保持 userVerification=preferred 以尽量要求设备级用户验证。
   *   不限制 authenticatorAttachment，同时支持平台认证器（Touch ID, Windows Hello）和跨平台认证器（USB 密钥, NFC）。
   *
   * Purpose:
   *   Generates WebAuthn passkey registration options. Sets residentKey=required to ensure
   *   discoverable credentials (passkeys), keeps userVerification=preferred to request device-level
   *   user verification when available. Does not restrict authenticatorAttachment, supporting both
   *   platform authenticators (Touch ID, Windows Hello) and cross-platform authenticators (USB keys, NFC).
   *
   * 调用方 / Called by:
   *   - AuthApplicationService.generatePasskeyRegistrationOptions
   *
   * 被调用方 / Calls:
   *   - simplewebauthn generateRegistrationOptions
   *
   * 参数说明 / Parameters:
   *   - user: any, 用户对象（需含 id 和 email）/ user object (needs id and email)
   *   - excludeCredentials: any[], 已注册凭据列表用于排除 / existing credentials to exclude
   *
   * 返回值说明 / Returns:
   *   - Promise<any>, WebAuthn 注册选项对象 / WebAuthn registration options object
   *
   * 副作用 / Side effects:
   *   无——纯选项生成，不读写数据库
   *
   * 中文关键词：
   *   通行密钥，WebAuthn，注册选项，创建凭据，residentKey，验证，认证器，跨平台，可发现凭据，FIDO2
   * English keywords:
   *   passkey, WebAuthn, registration options, credential creation, residentKey, verification, authenticator, cross-platform, discoverable credential, FIDO2
   */
  public async generateRegistrationOptions(user: any, excludeCredentials: any[]): Promise<any> {
    return generateRegistrationOptions({
      rpName: APP_NAME,
      rpID: process.env.RP_ID || 'localhost',
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });
  }

  public async verifyRegistrationResponse(response: any, expectedChallenge: string, expectedOrigin: string | string[], expectedRPID: string): Promise<any> {
    return verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: false,
    });
  }

  public async generateAuthenticationOptions(allowCredentials: any[]): Promise<any> {
    return generateAuthenticationOptions({
      allowCredentials,
      rpID: process.env.RP_ID || 'localhost',
      timeout: 60000,
      userVerification: 'preferred',
    });
  }

  public async verifyAuthenticationResponse(response: any, expectedChallenge: string, expectedOrigin: string | string[], expectedRPID: string, credential: any): Promise<any> {
    return verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential,
    });
  }
}
