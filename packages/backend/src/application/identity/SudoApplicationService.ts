/**
 * 模块：Sudo Application Service
 *
 * 函数作用：
 *   Sudo 模式应用服务——管理二次认证（密码/TOTP/Passkey）和 sudo 状态。
 * Purpose:
 *   Sudo mode application service — manages re-authentication (password/TOTP/Passkey) and sudo state.
 *
 * 中文关键词：
 *   Sudo，二次认证，密码，TOTP，Passkey
 * English keywords:
 *   sudo, re-authentication, password, TOTP, passkey
 */
import * as argon2 from 'argon2';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { AuthApplicationService } from './AuthApplicationService';
import { ISudoStore } from './ports/ISudoStore';
import { IUserSecurityReadModel } from './ports/IUserSecurityReadModel';
import { ITotpPort } from '../../domain/identity/ports/ITotpPort';

/**
 * 类型名称：VerifyInput
 *
 * 函数作用：
 *   Sudo 模式验证输入——支持密码、TOTP 验证码或 Passkey 响应三种方式。
 * Purpose:
 *   Sudo mode verification input — supports password, TOTP code, or passkey response.
 *
 * 中文关键词：
 *   验证输入，密码，TOTP，Passkey
 * English keywords:
 *   verify input, password, TOTP, passkey
 */
export type VerifyInput =
  | { type: 'password'; password: string }
  | { type: 'totp'; totpCode: string }
  | { type: 'passkey'; passkeyResponse: any; challengeId: string };

/**
 * 类名称：SudoApplicationService
 *
 * 函数作用：
 *   提供 sudo 模式的 Passkey 选项生成、身份验证和状态检查功能。
 * Purpose:
 *   Provides sudo mode passkey option generation, identity verification, and state checking.
 *
 * 调用方 / Called by:
 *   - sudoController
 *   - middleware/auth.ts（requireSudo）
 *
 * 中文关键词：
 *   Sudo，应用服务，二次认证
 * English keywords:
 *   sudo, application service, re-authentication
 */
export class SudoApplicationService {
  constructor(
    private userSecurityReadModel: IUserSecurityReadModel,
    private authApplicationService: AuthApplicationService,
    private sudoStore: ISudoStore,
    private rpID: string,
    private origin: string,
    private totpPort: ITotpPort
  ) {}

  /**
   * 函数名称：getPasskeyOptions
   *
   * 函数作用：
   *   为 sudo 模式生成 WebAuthn Passkey 认证选项。
   * Purpose:
   *   Generates WebAuthn Passkey authentication options for sudo mode.
   *
   * 调用方 / Called by:
   *   sudoController.getSudoPasskeyOptions
   *
   * 参数说明 / Parameters:
   *   - userId: string, 当前用户 ID
   *
   * 返回值说明 / Returns:
   *   WebAuthn 认证选项对象（含 challengeId）
   *
   * 错误处理 / Error handling:
   *   - ERR_NO_PASSKEYS_REGISTERED（用户未注册 Passkey）
   *
   * 副作用 / Side effects:
   *   写数据库——创建 AuthChallenge 记录
   *
   * 中文关键词：
   *   Sudo，Passkey，认证选项
   * English keywords:
   *   sudo, passkey, authentication options
   */
  public async getPasskeyOptions(userId: string): Promise<any> {
    const userPasskeys = await this.userSecurityReadModel.listUserPasskeyIds(userId);
    if (userPasskeys.length === 0) throw new Error('ERR_NO_PASSKEYS_REGISTERED');

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    });

    const authChallenge = await this.authApplicationService.generateAuthChallenge(options.challenge);
    return { ...options, challengeId: authChallenge.id };
  }

  /**
   * 函数名称：verify
   *
   * 函数作用：
   *   验证用户身份以激活 sudo 模式。支持密码、TOTP 或 Passkey 三种方式。
   *   验证通过后在 Redis 中记录 sudo 状态（15 分钟有效）。
   * Purpose:
   *   Verifies user identity to activate sudo mode. Supports password, TOTP, or Passkey.
   *   Records sudo state in Redis on success (15-minute TTL).
   *
   * 调用方 / Called by:
   *   sudoController.verifySudo
   *
   * 被调用方 / Calls:
   *   - argon2.verify（密码验证）
   *   - totpPort.verify（TOTP 验证）
   *   - authApplicationService.consumeAuthChallenge / updatePasskeyCounter（Passkey 验证）
   *   - sudoStore.grant
   *
   * 参数说明 / Parameters:
   *   - userId: string, 用户 ID
   *   - sessionId: string, 当前会话 ID
   *   - input: VerifyInput, 验证输入（密码/TOTP/Passkey）
   *
   * 返回值说明 / Returns:
   *   Promise<void>
   *
   * 错误处理 / Error handling:
   *   - ERR_USER_NOT_FOUND（用户不存在）
   *   - ERR_INVALID_CREDENTIALS（密码错误）
   *   - ERR_INVALID_TOTP（TOTP 无效）
   *   - ERR_INVALID_PASSKEY（Passkey 无效）
   *   - ERR_VERIFICATION_FAILED（验证失败）
   *
   * 副作用 / Side effects:
   *   - 写 Redis——授权 sudo 状态（15 分钟 TTL）
   *   - Passkey 验证通过后更新计数器
   *
   * 中文关键词：
   *   Sudo，验证，密码，TOTP，Passkey
   * English keywords:
   *   sudo, verify, password, TOTP, passkey
   */
  public async verify(userId: string, sessionId: string, input: VerifyInput): Promise<void> {
    const user = await this.userSecurityReadModel.getUserWithRoleById(userId);
    if (!user) throw new Error('ERR_USER_NOT_FOUND');

    let isValid = false;

    if (input.type === 'password') {
      if (!user.password) throw new Error('ERR_INVALID_CREDENTIALS');
      isValid = await argon2.verify(user.password, input.password);
    }

    if (input.type === 'totp') {
      if (!user.totpSecret) throw new Error('ERR_INVALID_TOTP');
      const isValidTotp = this.totpPort.verify(user.totpSecret, input.totpCode);
      isValid = isValidTotp;
    }

    if (input.type === 'passkey') {
      const expectedChallenge = await this.authApplicationService.consumeAuthChallenge(input.challengeId);
      const passkey = await this.userSecurityReadModel.getPasskeyById(input.passkeyResponse.id);
      if (!passkey || passkey.userId !== userId) throw new Error('ERR_INVALID_PASSKEY');

      const verification = await verifyAuthenticationResponse({
        response: input.passkeyResponse,
        expectedChallenge: expectedChallenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
        },
      });

      isValid = verification.verified;
      if (isValid && verification.authenticationInfo) {
        await this.authApplicationService.updatePasskeyCounter(passkey.id, BigInt(verification.authenticationInfo.newCounter));
      }
    }

    if (!isValid) throw new Error('ERR_VERIFICATION_FAILED');
    await this.sudoStore.grant(sessionId, 15 * 60);
  }

  /**
   * 函数名称：check
   *
   * 函数作用：
   *   检查当前会话是否处于 sudo 模式。
   * Purpose:
   *   Checks if the current session is in sudo mode.
   *
   * 调用方 / Called by:
   *   - sudoController.checkSudo
   *   - middleware/auth.ts requireSudo
   *
   * 参数说明 / Parameters:
   *   - sessionId: string, 会话 ID
   *
   * 返回值说明 / Returns:
   *   boolean，true 表示已激活 sudo 模式
   *
   * 副作用 / Side effects:
   *   无——只读查询 Redis
   *
   * 中文关键词：
   *   Sudo，检查，状态
   * English keywords:
   *   sudo, check, status
   */
  public async check(sessionId: string): Promise<boolean> {
    return this.sudoStore.check(sessionId);
  }
}
