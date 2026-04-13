import { Request, Response } from 'express';
import { prisma } from '../db';
import { UserStatus } from '@prisma/client';
import { redis } from '../lib/redis';
import jwt from 'jsonwebtoken';
import { finalizeAuth } from './auth';
import { isValidPassword } from '@myndbbs/shared';
import { AuthApplicationService } from '../application/identity/AuthApplicationService';
import { PrismaCaptchaChallengeRepository } from '../infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from '../infrastructure/repositories/PrismaPasskeyRepository';

const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository()
);

/**
 * Callers: []
 * Callees: [AuthApplicationService.registerUser, isValidPassword, test, json, status, sign, cookie, error]
 * Description: Orchestrates the user registration process via the domain service, enforcing strong password requirements and consuming verified captchas.
 * Keywords: register, user, identity, auth, service
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, captchaId } = req.body;

    if (!email || !username || !password || !captchaId) {
      res.status(400).json({ error: 'ERR_MISSING_REQUIRED_FIELDS' });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'ERR_PASSWORD_MUST_BE_BETWEEN_8_AND_128_CHARACTERS' });
      return;
    }
    
    // Add comprehensive strength check (uppercase, lowercase, number, special char)
    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'ERR_PASSWORD_MUST_CONTAIN_UPPERCASE_LOWERCASE_NUMBER_AND_SPECIAL_CHARACTER' });
      return;
    }
    // Restrict to ASCII characters to prevent Unicode bypass
    if (!/^[ -~]+$/.test(password)) {
      res.status(400).json({ error: 'ERR_PASSWORD_CONTAINS_INVALID_CHARACTERS' });
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

    // Generate Temp Token for 2FA Registration
    const tempToken = jwt.sign({ userId: user.id, type: 'registration' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    res.cookie('tempToken', tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.status(201).json({ message: 'User registered. Please complete 2FA.', user: { id: user.id, username: user.username, role: user.role?.name } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findFirst, verify, push, sign, cookie, finalizeAuth, error]
 * Description: Handles the login user logic for the application.
 * Keywords: loginuser, login, user, auto-annotated
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'ERR_EMAIL_USERNAME_AND_PASSWORD_REQUIRED' });
      return;
    }

    const user = await prisma.user.findFirst({ 
      where: { OR: [{ email }, { username: email }] },
      include: { passkeys: true, role: true }
    });
    if (!user || !user.password) {
      res.status(401).json({ error: 'ERR_INVALID_CREDENTIALS' });
      return;
    }

    if (user.status === UserStatus.BANNED) {
      res.status(403).json({ error: 'ERR_ACCOUNT_IS_BANNED' });
      return;
    }

    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      res.status(401).json({ error: 'ERR_INVALID_CREDENTIALS' });
      return;
    }

    const methods: string[] = [];
    if (user.isTotpEnabled) methods.push('totp');
    if (user.passkeys && user.passkeys.length > 0) methods.push('passkey');

    if (methods.length > 0) {
      const tempToken = jwt.sign({ userId: user.id, type: 'login' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
      res.cookie('tempToken', tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000 // 1 hour
      });
      res.json({ requires2FA: true, methods });
      return;
    }

    await finalizeAuth(user, req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [verify, deleteMany, del, clearCookie, json, error, status]
 * Description: Handles the logout user logic for the application.
 * Keywords: logoutuser, logout, user, auto-annotated
 */
export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accessToken, refreshToken: tokenFromCookie } = req.cookies;

    let sessionId = null;
    
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string, { ignoreExpiration: true }) as any;
        if (decoded.sessionId) sessionId = decoded.sessionId;
      } catch (e) {
        // ignore invalid token errors
      }
    }
    
    if (!sessionId && tokenFromCookie) {
      try {
        const decoded = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET as string, { ignoreExpiration: true }) as any;
        if (decoded.sessionId) sessionId = decoded.sessionId;
      } catch (e) {
        // ignore
      }
    }

    if (sessionId) {
      await prisma.session.deleteMany({
        where: { id: sessionId }
      });
      await redis.del(`session:${sessionId}`);
      await redis.del(`session:${sessionId}:requires_refresh`);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('tempToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR_DURING_LOGOUT' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, verify, findUnique, clearCookie, sign, cookie, error]
 * Description: Handles the refresh token logic for the application.
 * Keywords: refreshtoken, refresh, token, auto-annotated
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      res.status(401).json({ error: 'ERR_REFRESH_TOKEN_REQUIRED' });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;

    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
      if (!session) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'ERR_SESSION_REVOKED_OR_INVALID' });
        return;
      }
    }

    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      include: { role: true }
    });
    if (!user) {
      res.status(401).json({ error: 'ERR_INVALID_REFRESH_TOKEN' });
      return;
    }

    if (user.status === UserStatus.BANNED) {
      res.status(403).json({ error: 'ERR_ACCOUNT_IS_BANNED' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role?.name, sessionId: decoded.sessionId }, 
      process.env.JWT_SECRET as string, 
      { expiresIn: '15m' }
    );

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error(error);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(401).json({ error: 'ERR_INVALID_OR_EXPIRED_REFRESH_TOKEN' });
  }
};
