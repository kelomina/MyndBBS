import { Request, Response } from 'express';
import { finalizeAuth } from './auth';
import { authApplicationService } from '../registry';

/**
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Starts email-based registration and asks the user to verify their mailbox before 2FA onboarding begins.
 * Keywords: auth, register, 2fa
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
        const statusCode = error.message === 'ERR_EMAIL_DELIVERY_NOT_CONFIGURED' ? 503 : 400;
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Consumes the email-verification token, creates the user account, and resumes the existing 2FA registration flow by setting the temporary registration cookie.
 * Keywords: auth, register, verify, email, 2fa
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Resends a fresh registration verification email for an existing pending mailbox signup.
 * Keywords: auth, register, resend, email
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
        const statusCode = error.message === 'ERR_EMAIL_DELIVERY_NOT_CONFIGURED' ? 503 : 400;
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Starts the forgot-password flow and always returns an accepted response so the frontend can present a generic mailbox confirmation state.
 * Keywords: auth, password, forgot, reset
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
        const statusCode = error.message === 'ERR_EMAIL_DELIVERY_NOT_CONFIGURED' ? 503 : 400;
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Consumes a password-reset token and replaces the user's password with the submitted new password.
 * Keywords: auth, password, reset, token
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
 * Callers: [Router]
 * Callees: [authApplicationService, finalizeAuth]
 * Description: Authenticates a user and starts session or requires 2FA.
 * Keywords: auth, login, session
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
        secure: process.env.NODE_ENV === 'production' && req.secure,
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Logs out a user by revoking tokens and clearing cookies.
 * Keywords: auth, logout, session
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Refreshes an access token using a valid refresh token.
 * Keywords: auth, refresh, token
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
        secure: process.env.NODE_ENV === 'production' && req.secure,
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
