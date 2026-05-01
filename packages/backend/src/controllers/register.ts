import { Request, Response } from 'express';
import { finalizeAuth } from './auth';
import { authApplicationService } from '../registry';

const EMAIL_SERVICE_ERROR_CODES = new Set([
  'ERR_EMAIL_DELIVERY_NOT_CONFIGURED',
  'ERR_EMAIL_DELIVERY_FAILED',
]);

/**
 * Callers: [registerUser, resendEmailRegistration, requestPasswordReset]
 * Callees: [Set.has]
 * Description: Maps identity email-flow error codes to HTTP status codes so transient mail infrastructure failures are reported as service-side failures instead of client validation mistakes.
 * 描述：将身份域邮件流程错误码映射为 HTTP 状态码，让临时邮件基础设施故障返回服务端失败，而不是被误判为客户端校验错误。
 * Variables: `errorCode` is the application error emitted by the identity service; `EMAIL_SERVICE_ERROR_CODES` lists failures caused by mail infrastructure.
 * 变量：`errorCode` 是身份应用服务抛出的错误码；`EMAIL_SERVICE_ERROR_CODES` 列出由邮件基础设施导致的失败。
 * Integration: Use this helper in public auth controllers that create or resend mailbox links.
 * 接入方式：在创建或补发邮箱链接的公开认证控制器中调用本函数。
 * Error Handling: Unknown identity error codes remain `400`, preserving existing validation behavior.
 * 错误处理：未知身份域错误码仍返回 `400`，保持现有校验错误语义。
 * Keywords: email status, delivery failure, smtp unavailable, auth controller, http mapping, 邮件状态码, 投递失败, SMTP不可用, 认证控制器, HTTP映射
 */
function getEmailFlowErrorStatusCode(errorCode: string): number {
  return EMAIL_SERVICE_ERROR_CODES.has(errorCode) ? 503 : 400;
}

/**
 * 函数名称：registerUser
 *
 * 函数作用：
 *   发起邮箱注册流程——校验输入、消费验证码、创建待注册票据、发送验证邮件。
 * Purpose:
 *   Initiates the email registration flow — validates input, consumes captcha,
 *   creates a pending registration ticket, and sends a verification email.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/register
 *
 * 被调用方 / Calls:
 *   - authApplicationService.registerUser
 *
 * 参数说明 / Parameters:
 *   - req.body.email: string, 用户邮箱
 *   - req.body.username: string, 用户名
 *   - req.body.password: string, 密码
 *   - req.body.captchaId: string, 验证码 ID
 *
 * 返回值说明 / Returns:
 *   202 Accepted: { message, email, expiresAt }
 *   400/503: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 校验错误（缺少字段、邮箱已存在、密码不合法等）
 *   - 503: 邮件服务不可用
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 写数据库（Redis）——创建待注册票据
 *   - 发送注册验证邮件
 *
 * 中文关键词：
 *   注册，邮箱验证，验证码，票据，邮件
 * English keywords:
 *   register, email verification, captcha, ticket, email
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, captchaId } = req.body;

    if (!email || !username || !password || !captchaId) {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    let registrationRequest;
    try {
      registrationRequest = await authApplicationService.registerUser(email, username, password, captchaId);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('ERR_')) {
        const statusCode = getEmailFlowErrorStatusCode(error.message);
        res.status(statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('EMAIL_REGISTRATION_VERIFICATION_SENT', 'Verification email sent. Please check your inbox.') : 'Verification email sent. Please check your inbox.';
    res.status(202).json({ message, email: registrationRequest.email, expiresAt: registrationRequest.expiresAt.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：verifyEmailRegistration
 *
 * 函数作用：
 *   消费邮箱验证令牌，创建用户账户，设置临时注册 Cookie 以继续 2FA 引导流程。
 * Purpose:
 *   Consumes the email verification token, creates the user account,
 *   and sets a temporary registration cookie to continue the 2FA onboarding flow.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/register/verify-email
 *
 * 被调用方 / Calls:
 *   - authApplicationService.verifyEmailRegistration
 *   - authApplicationService.generateTempToken
 *
 * 参数说明 / Parameters:
 *   - req.body.token: string, 邮箱验证令牌
 *
 * 返回值说明 / Returns:
 *   200: { message, user }
 *   400: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 令牌无效、过期或身份已被占用
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 创建新用户（数据库）
 *   - 设置 tempToken Cookie
 *
 * 事务边界 / Transaction:
 *   由 authApplicationService.verifyEmailRegistration 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   邮箱验证，用户创建，令牌消费，2FA 引导
 * English keywords:
 *   email verification, user creation, token consumption, 2FA onboarding
 */
export const verifyEmailRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    let user;
    try {
      user = await authApplicationService.verifyEmailRegistration(token);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('ERR_')) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    const tempToken = authApplicationService.generateTempToken(user.id, 'registration');

    res.cookie('tempToken', tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('USER_REGISTERED_COMPLETE_2FA', 'User registered. Please complete 2FA.') : 'User registered. Please complete 2FA.';
    res.status(200).json({ message, user: { id: user.id, username: user.username, role: user.role.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：resendEmailRegistration
 *
 * 函数作用：
 *   为已有的待验证注册补发新的验证邮件（替换旧票据）。
 * Purpose:
 *   Resends a fresh verification email for an existing pending registration (replaces old ticket).
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/register/resend-email
 *
 * 被调用方 / Calls:
 *   - authApplicationService.resendEmailRegistration
 *
 * 参数说明 / Parameters:
 *   - req.body.email: string, 需要补发验证邮件的邮箱
 *
 * 返回值说明 / Returns:
 *   202 Accepted: { message, email, expiresAt }
 *
 * 错误处理 / Error handling:
 *   - 400: 输入校验错误
 *   - 503: 邮件服务不可用
 *   - 防枚举：即使找不到注册记录也返回 202
 *
 * 副作用 / Side effects:
 *   - 写数据库（Redis）——创建新票据
 *   - 发送补发验证邮件
 *
 * 中文关键词：
 *   补发邮件，注册验证，票据替换
 * English keywords:
 *   resend email, registration verification, ticket replacement
 */
export const resendEmailRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    let registrationRequest;
    try {
      registrationRequest = await authApplicationService.resendEmailRegistration(email);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('ERR_')) {
        if (error.message === 'ERR_EMAIL_REGISTRATION_NOT_FOUND') {
          // Return generic accepted response to prevent user enumeration
          const message = req.t ? req.t('EMAIL_REGISTRATION_VERIFICATION_RESENT', 'Verification email resent. Please check your inbox.') : 'Verification email resent. Please check your inbox.';
          res.status(202).json({ message, email });
          return;
        }
        const statusCode = getEmailFlowErrorStatusCode(error.message);
        res.status(statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('EMAIL_REGISTRATION_VERIFICATION_RESENT', 'Verification email resent. Please check your inbox.') : 'Verification email resent. Please check your inbox.';
    res.status(202).json({ message, email: registrationRequest.email, expiresAt: registrationRequest.expiresAt.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：requestPasswordReset
 *
 * 函数作用：
 *   发起忘记密码流程——发送密码重置邮件。无论邮箱是否存在都返回 202 以防枚举。
 * Purpose:
 *   Initiates the forgot-password flow — sends a password reset email.
 *   Always returns 202 regardless of whether the email exists to prevent enumeration.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/password/forgot
 *
 * 被调用方 / Calls:
 *   - authApplicationService.requestPasswordReset
 *
 * 参数说明 / Parameters:
 *   - req.body.email: string, 需要重置密码的邮箱
 *
 * 返回值说明 / Returns:
 *   202 Accepted: { message, email, expiresAt }
 *   400: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 邮箱格式不合法
 *   - 503: 邮件服务不可用
 *   - 防账户枚举：不存在的邮箱也返回 202
 *
 * 副作用 / Side effects:
 *   - 写数据库（Redis）——创建密码重置票据
 *   - 发送重置密码邮件
 *
 * 中文关键词：
 *   忘记密码，重置邮件，防枚举，票据
 * English keywords:
 *   forgot password, reset email, anti-enumeration, ticket
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    let passwordResetRequest;
    try {
      passwordResetRequest = await authApplicationService.requestPasswordReset(email);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('ERR_')) {
        const statusCode = getEmailFlowErrorStatusCode(error.message);
        res.status(statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('PASSWORD_RESET_EMAIL_SENT', 'If the mailbox exists, a password reset email has been sent.') : 'If the mailbox exists, a password reset email has been sent.';
    res.status(202).json({ message, email: passwordResetRequest.email, expiresAt: passwordResetRequest.expiresAt.toISOString() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：resetPasswordWithToken
 *
 * 函数作用：
 *   消费密码重置令牌，将用户密码替换为新密码。
 * Purpose:
 *   Consumes a password-reset token and replaces the user's password with the new one.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/password/reset
 *
 * 被调用方 / Calls:
 *   - authApplicationService.resetPasswordWithToken
 *
 * 参数说明 / Parameters:
 *   - req.body.token: string, 密码重置令牌
 *   - req.body.password: string, 新密码
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   400: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 400: 令牌无效、过期、密码不合法或用户不存在
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 写数据库——更新密码哈希
 *   - 撤销所有现有会话
 *   - 删除重置票据
 *
 * 事务边界 / Transaction:
 *   由 authApplicationService.resetPasswordWithToken 内部通过 UnitOfWork 管理
 *
 * 中文关键词：
 *   重置密码，令牌消费，密码替换，会话撤销
 * English keywords:
 *   reset password, token consumption, password replacement, session revocation
 */
export const resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    try {
      await authApplicationService.resetPasswordWithToken(token, password);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('ERR_')) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('PASSWORD_RESET_COMPLETED', 'Password reset completed. Please sign in with your new password.') : 'Password reset completed. Please sign in with your new password.';
    res.status(200).json({ message });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：loginUser
 *
 * 函数作用：
 *   用户登录——校验凭证；如果需要双因素认证则设置 tempToken 并返回可用方法列表；否则直接完成认证。
 * Purpose:
 *   User login — validates credentials; if 2FA is required, sets tempToken and
 *   returns available methods; otherwise completes authentication directly.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/login
 *
 * 被调用方 / Calls:
 *   - authApplicationService.loginUser
 *   - finalizeAuth（需不需要双因素认证时）
 *
 * 参数说明 / Parameters:
 *   - req.body.email: string, 邮箱或用户名
 *   - req.body.password: string, 密码
 *
 * 返回值说明 / Returns:
 *   需要 2FA: { requires2FA: true, methods: string[] } + 设置 tempToken Cookie
 *   不需要 2FA: 调用 finalizeAuth 设置 accessToken/refreshToken Cookie
 *   401: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_INVALID_CREDENTIALS（凭证无效）
 *   - 403: ERR_ACCOUNT_IS_BANNED（账户被封禁）
 *   - 500: ERR_INTERNAL_SERVER_ERROR
 *
 * 副作用 / Side effects:
 *   - 可选：设置 tempToken Cookie（2FA 场景）
 *   - 或：创建会话 + 设置 accessToken/refreshToken Cookie
 *
 * 中文关键词：
 *   登录，认证，双因素，凭证校验
 * English keywords:
 *   login, authentication, two-factor, credential verification
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'ERR_EMAIL_USERNAME_AND_PASSWORD_REQUIRED' });
      return;
    }

    let authResult;
    try {
      authResult = await authApplicationService.loginUser(email, password);
    } catch (error: any) {
      if (error.message.startsWith('ERR_')) {
        const statusCode = error.message === 'ERR_ACCOUNT_IS_BANNED' ? 403 : 401;
        res.status(statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }

    if (authResult.requires2FA && authResult.tempToken) {
      res.cookie('tempToken', authResult.tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000 // 1 hour
      });
      res.json({ requires2FA: true, methods: authResult.methods });
      return;
    }

    await finalizeAuth(authResult.user, req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * 函数名称：logoutUser
 *
 * 函数作用：
 *   用户注销——撤销会话令牌并清除所有认证 Cookie。
 * Purpose:
 *   User logout — revokes session tokens and clears all auth cookies.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/logout
 *
 * 被调用方 / Calls:
 *   - authApplicationService.logout
 *
 * 参数说明 / Parameters:
 *   - req.cookies.accessToken: string | undefined, access token（从 Cookie 读取）
 *   - req.cookies.refreshToken: string | undefined, refresh token（从 Cookie 读取）
 *
 * 返回值说明 / Returns:
 *   200: { message }
 *   500: { error: errorCode }
 *
 * 错误处理 / Error handling:
 *   500: ERR_INTERNAL_SERVER_ERROR_DURING_LOGOUT
 *
 * 副作用 / Side effects:
 *   - 撤销数据库会话记录
 *   - 清除 accessToken/refreshToken/tempToken Cookie
 *
 * 中文关键词：
 *   注销，会话撤销，Cookie 清除
 * English keywords:
 *   logout, session revocation, cookie clearing
 */
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accessToken, refreshToken: tokenFromCookie } = req.cookies;

    await authApplicationService.logout(accessToken, tokenFromCookie);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('tempToken');
    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('LOGGED_OUT_SUCCESSFULLY', 'Logged out successfully') : 'Logged out successfully';
    res.json({ message });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR_DURING_LOGOUT' });
  }
};

/**
 * 函数名称：refreshToken
 *
 * 函数作用：
 *   使用有效的 refresh token 刷新 access token。
 * Purpose:
 *   Refreshes the access token using a valid refresh token.
 *
 * 调用方 / Called by:
 *   POST /api/v1/auth/refresh
 *
 * 被调用方 / Calls:
 *   - authApplicationService.refreshAccessToken
 *
 * 参数说明 / Parameters:
 *   - req.cookies.refreshToken: string, refresh token（从 Cookie 读取）
 *
 * 返回值说明 / Returns:
 *   200: { message } + 设置新的 accessToken Cookie
 *   401: { error: errorCode }
 *   403: { error: ERR_ACCOUNT_IS_BANNED }
 *
 * 错误处理 / Error handling:
 *   - 401: ERR_REFRESH_TOKEN_REQUIRED / ERR_INVALID_OR_EXPIRED_REFRESH_TOKEN / ERR_SESSION_REVOKED_OR_INVALID
 *   - 403: ERR_ACCOUNT_IS_BANNED（账户被封禁）
 *   - 失败时清除 accessToken/refreshToken Cookie
 *
 * 副作用 / Side effects:
 *   设置新的 accessToken Cookie；refresh token 无效时清除 Cookie
 *
 * 中文关键词：
 *   令牌刷新，Access Token，Refresh Token，会话续期
 * English keywords:
 *   token refresh, access token, refresh token, session renewal
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      res.status(401).json({ error: 'ERR_REFRESH_TOKEN_REQUIRED' });
      return;
    }

    try {
      const { accessToken } = await authApplicationService.refreshAccessToken(refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      // @ts-ignore - t is injected by i18next middleware
      const message = req.t ? req.t('TOKEN_REFRESHED_SUCCESSFULLY', 'Token refreshed successfully') : 'Token refreshed successfully';
      res.json({ message });
    } catch (error: any) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      
      if (error.message === 'ERR_ACCOUNT_IS_BANNED') {
        res.status(403).json({ error: 'ERR_ACCOUNT_IS_BANNED' });
        return;
      }
      
      res.status(401).json({ error: error.message || 'ERR_INVALID_OR_EXPIRED_REFRESH_TOKEN' });
    }
  } catch (error) {
    console.error(error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'ERR_INVALID_OR_EXPIRED_REFRESH_TOKEN' });
  }
};
