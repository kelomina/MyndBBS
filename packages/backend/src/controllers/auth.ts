import { Request, Response } from 'express';
import { authApplicationService } from '../registry';

const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

/**
 * 函数名称：getUserFromTempToken
 *
 * 函数作用：
 *   从请求 Cookie 中解析临时令牌并获取对应用户信息。
 * Purpose:
 *   Parses the temporary token from request cookies and retrieves the corresponding user info.
 *
 * 调用方 / Called by:
 *   - generateTotp（本文件）
 *   - verifyTotpRegistration（本文件）
 *   - 其他 auth 控制器函数
 *
 * 被调用方 / Calls:
 *   - authApplicationService.getUserFromTempToken
 *
 * 参数说明 / Parameters:
 *   - req: Request, Express 请求对象，从 cookies 读取 tempToken
 *   - expectedType: 'registration' | 'login', 预期令牌类型（默认 registration）
 *
 * 返回值说明 / Returns:
 *   user | null，有效令牌时返回用户对象，否则返回 null
 *
 * 错误处理 / Error handling:
 *   令牌无效或过期时静默返回 null
 *
 * 副作用 / Side effects:
 *   无——只读操作
 *
 * 中文关键词：
 *   认证，临时令牌，用户获取，Cookie
 * English keywords:
 *   auth, temp token, user retrieval, Cookie
 */
const getUserFromTempToken = async (req: Request, expectedType: 'registration' | 'login' = 'registration') => {
  return await authApplicationService.getUserFromTempToken(req.cookies?.tempToken, expectedType);
};

/**
 * 函数名称：finalizeAuth
 *
 * 函数作用：
 *   完成认证流程——创建会话、签发 access/refresh token，设置 Cookie 并返回用户信息。
 * Purpose:
 *   Completes the authentication flow — creates a session, issues access/refresh tokens, sets cookies, and returns user info.
 *
 * 调用方 / Called by:
 *   - verifyTotpRegistration（本文件）
 *   - verifyPasskeyRegistrationResponse（本文件）
 *   - register.ts 中的 loginUser
 *
 * 被调用方 / Calls:
 *   - authApplicationService.finalizeAuth
 *
 * 参数说明 / Parameters:
 *   - user: any, 认证成功的用户对象
 *   - req: Request, Express 请求对象
 *   - res: Response, Express 响应对象
 *
 * 返回值说明 / Returns:
 *   无显式返回——向客户端写入 Cookie 并返回 JSON 响应
 *
 * 错误处理 / Error handling:
 *   无显式异常处理——依赖于 authApplicationService 的错误传播
 *
 * 副作用 / Side effects:
 *   - 创建数据库会话记录
 *   - 设置 accessToken / refreshToken Cookie（httpOnly）
 *   - 清除 tempToken Cookie
 *
 * 事务边界 / Transaction:
 *   由 authApplicationService.finalizeAuth 内部管理
 *
 * 中文关键词：
 *   认证完成，会话创建，Token 签发，Cookie 设置
 * English keywords:
 *   finalize auth, session creation, token issuance, cookie setting
 */
export const finalizeAuth = async (user: any, req: Request, res: Response) => {
  const { accessToken, refreshToken } = await authApplicationService.finalizeAuth(
    user,
    req.ip || null,
    req.headers['user-agent'] || null
  );

  const roleName = user.role?.name || user.role || null;

  res.clearCookie('tempToken');

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: roleName } });
};

/**
 * 函数名称：generateTotp
 *
 * 函数作用：
 *   为注册流程生成 TOTP 密钥和二维码。
 * Purpose:
 *   Generates a TOTP secret and QR code for the registration flow.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/totp/generate
 *
 * 被调用方 / Calls:
 *   - authApplicationService.generateTotp
 *
 * 参数说明 / Parameters:
 *   无请求体参数——从 cookies 中的 tempToken 获取用户
 *
 * 返回值说明 / Returns:
 *   { secret: string, qrCodeUrl: string } 或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED（令牌无效）
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写缓存——临时存储 TOTP secret（5 分钟 TTL）
 *
 * 中文关键词：
 *   双因素认证，TOTP，密钥生成，二维码
 * English keywords:
 *   two-factor auth, TOTP, secret generation, QR code
 */
export const generateTotp = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED' });
    return;
  }

  try {
    const { secret, qrCodeUrl } = await authApplicationService.generateTotp(user.id, user.email);
    res.json({ secret, qrCodeUrl });
  } catch (error: any) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：verifyTotpRegistration
 *
 * 函数作用：
 *   验证 TOTP 验证码并完成双因素认证设置，然后完成登录/注册流程。
 * Purpose:
 *   Verifies the TOTP code, finalizes 2FA setup, then completes the login/registration flow.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/totp/verify
 *
 * 被调用方 / Calls:
 *   - authApplicationService.verifyTotpRegistration
 *   - finalizeAuth（本文件）
 *
 * 参数说明 / Parameters:
 *   - req.body.code: string, 用户输入的 TOTP 验证码
 *
 * 返回值说明 / Returns:
 *   成功时调用 finalizeAuth 返回用户信息，失败返回 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED
 *   - 400: 其他 ERR_ 前缀错误码
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 写数据库——在用户上启用 TOTP
 *   - 设置 auth Cookie
 *   - 清除 tempToken Cookie
 *
 * 事务边界 / Transaction:
 *   由 authApplicationService.verifyTotpRegistration 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   双因素认证，TOTP 验证，注册完成，认证流程
 * English keywords:
 *   two-factor auth, TOTP verification, registration complete, auth flow
 */
export const verifyTotpRegistration = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    await authApplicationService.verifyTotpRegistration(user.id, code);
    await finalizeAuth(user, req, res);
  } catch (error: any) {
    if (error.message === 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED') {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：generatePasskeyRegistrationOptions
 *
 * 函数作用：
 *   为注册流程生成 WebAuthn Passkey 注册选项。
 * Purpose:
 *   Generates WebAuthn Passkey registration options for the signup flow.
 *
 * 调用方 / Called by:
 *   GET /api/v1/auth/passkey/generate-registration-options
 *
 * 被调用方 / Calls:
 *   - authApplicationService.generatePasskeyRegistrationOptions
 *
 * 参数说明 / Parameters:
 *   无请求体参数——从 cookies 中的 tempToken 获取用户
 *
 * 返回值说明 / Returns:
 *   WebAuthn 注册选项对象，包含 challenge 和 challengeId，或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（令牌无效）
 *   - 400: 其他 ERR_ 错误码
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——创建 AuthChallenge 记录
 *
 * 中文关键词：
 *   Passkey，WebAuthn，注册选项，认证挑战
 * English keywords:
 *   Passkey, WebAuthn, registration options, auth challenge
 */
export const generatePasskeyRegistrationOptions = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const options = await authApplicationService.generatePasskeyRegistrationOptions(user.id);
    res.json(options);
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_INTERNAL_SERVER_ERROR' ? 500 : 400).json({ error: errorCode });
  }
};

/**
 * Callers: [Router]
 * Callees: [authApplicationService, finalizeAuth]
 * Description: Verifies a passkey registration response.
 * Keywords: auth, passkey, register, verify
 */
export const verifyPasskeyRegistrationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const verificationResult = await authApplicationService.verifyPasskeyRegistration(user.id, response, challengeId);
    
    if (verificationResult.verified) {
      if (verificationResult.requiresTotpSetup) {
        // @ts-ignore - t is injected by i18next middleware
        res.json({ message: req.t ? req.t('PASSKEY_REGISTERED_SETUP_TOTP', verificationResult.message) : verificationResult.message });
        return;
      }
      // If user was updated with new level/role, use the returned user, otherwise use current user
      const updatedUser = verificationResult.user || user;
      await finalizeAuth(updatedUser, req, res);
    }
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_INTERNAL_SERVER_ERROR' ? 500 : 400).json({ error: errorCode });
  }
};

/**
 * 函数名称：getAbility
 *
 * 函数作用：
 *   返回当前用户的 CASL 权限规则。
 * Purpose:
 *   Returns the current user's CASL ability rules.
 *
 * 调用方 / Called by:
 *   GET /api/v1/auth/ability
 *
 * 被调用方 / Calls:
 *   无——从 req.ability 直接读取
 *
 * 参数说明 / Parameters:
 *   无请求体参数
 *
 * 返回值说明 / Returns:
 *   { rules: array } CASL 权限规则列表
 *
 * 副作用 / Side effects:
 *   无——只读操作
 *
 * 中文关键词：
 *   权限，CASL，能力规则，前端
 * English keywords:
 *   permission, CASL, ability rules, frontend
 */
export const getAbility = async (req: any, res: Response): Promise<void> => {
  res.json({ rules: req.ability?.rules || [] });
};

/**
 * 函数名称：verifyTotpLogin
 *
 * 函数作用：
 *   在登录流程中验证 TOTP 验证码，并在成功后完成认证。
 * Purpose:
 *   Verifies the TOTP code during login and completes authentication on success.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/totp/login-verify
 *
 * 被调用方 / Calls:
 *   - authApplicationService.verifyTotpLogin
 *   - finalizeAuth（本文件）
 *
 * 参数说明 / Parameters:
 *   - req.body.code: string, TOTP 验证码
 *
 * 返回值说明 / Returns:
 *   成功时调用 finalizeAuth 返回用户信息，失败返回 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED（令牌无效）
 *   - 400: 其他 ERR_ 错误码
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   设置 auth Cookie——登录成功后签发会话
 *
 * 中文关键词：
 *   登录，TOTP 验证，双因素认证
 * English keywords:
 *   login, TOTP verification, two-factor authentication
 */
export const verifyTotpLogin = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req, 'login');
  
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const verifiedUser = await authApplicationService.verifyTotpLogin(user.id, code);
    await finalizeAuth(verifiedUser, req, res);
  } catch (error: any) {
    if (error.message === 'ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED') {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：generatePasskeyAuthenticationOptions
 *
 * 函数作用：
 *   为登录流程生成 WebAuthn Passkey 认证选项。
 * Purpose:
 *   Generates WebAuthn Passkey authentication options for the login flow.
 *
 * 调用方 / Called by:
 *   GET /api/v1/auth/passkey/generate-authentication-options
 *
 * 被调用方 / Calls:
 *   - authApplicationService.processGeneratePasskeyAuthenticationOptions
 *
 * 参数说明 / Parameters:
 *   无请求体参数——从 cookies 中的 tempToken 获取用户上下文
 *
 * 返回值说明 / Returns:
 *   WebAuthn 认证选项对象，包含 challenge 和 challengeId，或 { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_UNAUTHORIZED
 *   - 400: 其他 ERR_ 错误码
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   写数据库——创建 AuthChallenge 记录
 *
 * 中文关键词：
 *   Passkey，WebAuthn，登录选项，认证挑战
 * English keywords:
 *   Passkey, WebAuthn, authentication options, auth challenge
 */
export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const { tempToken } = req.cookies;
  
  try {
    const options = await authApplicationService.processGeneratePasskeyAuthenticationOptions(tempToken);
    res.json(options);
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message === 'ERR_UNAUTHORIZED' ? 401 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const verifyPasskeyAuthenticationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId } = req.body;
  const { tempToken } = req.cookies;
  
  try {
    const verification = await authApplicationService.processPasskeyAuthentication(
      response,
      challengeId,
      tempToken
    );

    if (verification.verified && verification.user) {
      await finalizeAuth(verification.user, req, res);
    } else {
      res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
    }
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message === 'ERR_UNAUTHORIZED' ? 401 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};
