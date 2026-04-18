import { Request, Response } from 'express';
import { finalizeAuth } from './auth';
import { authApplicationService } from '../registry';

/**
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Registers a new user and returns a temporary token for 2FA completion.
 * Keywords: auth, register, 2fa
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, captchaId } = req.body;

    if (!email || !username || !password || !captchaId) {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    let user;
    try {
      user = await authApplicationService.registerUser(email, username, password, captchaId);
    } catch (error: any) {
      if (error.message.startsWith('ERR_')) {
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
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    // @ts-ignore - t is injected by i18next middleware
    const message = req.t ? req.t('USER_REGISTERED_COMPLETE_2FA', 'User registered. Please complete 2FA.') : 'User registered. Please complete 2FA.';
    res.status(201).json({ message, user: { id: user.id, username: user.username, role: user.role?.name } });
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
