import { Request, Response } from 'express';
import { prisma } from '../db';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { finalizeAuth } from './auth';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, captchaId } = req.body;

    if (!email || !username || !password || !captchaId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
      return;
    }
    
    // Add comprehensive strength check (uppercase, lowercase, number, special char)
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}/.test(password)) {
      res.status(400).json({ error: 'Password must contain uppercase, lowercase, number, and special character' });
      return;
    }

    // Verify Captcha
    const challenge = await prisma.captchaChallenge.findUnique({
      where: { id: captchaId }
    });

    try {
      // Immediately delete the captcha to prevent replay attacks and race conditions, and to cleanup expired records
      if (challenge) {
        await prisma.captchaChallenge.delete({ where: { id: captchaId } });
      }
    } catch (e) {
      res.status(400).json({ error: 'Captcha already used or invalid' });
      return;
    }

    if (!challenge || !challenge.verified || challenge.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid, expired, or unverified captcha' });
      return;
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email or username already in use' });
      return;
    }

    // Hash password with Argon2id
    const hashedPassword = await argon2.hash(password);

    // Get USER role
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        ...(userRole && { roleId: userRole.id })
      },
      include: { role: true }
    });

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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email/Username and password required' });
      return;
    }

    const user = await prisma.user.findFirst({ 
      where: { OR: [{ email }, { username: email }] },
      include: { passkeys: true, role: true }
    });
    if (!user || !user.password) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Account is banned' });
      return;
    }

    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

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
        const decoded = jwt.verify(tokenFromCookie, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string, { ignoreExpiration: true }) as any;
        if (decoded.sessionId) sessionId = decoded.sessionId;
      } catch (e) {
        // ignore
      }
    }

    if (sessionId) {
      await prisma.session.deleteMany({
        where: { id: sessionId }
      });
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('tempToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error during logout' });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string) as any;

    if (decoded.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });
      if (!session) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.status(401).json({ error: 'Session revoked or invalid' });
        return;
      }
    }

    const user = await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      include: { role: true }
    });
    if (!user) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    if (user.status === 'BANNED') {
      res.status(403).json({ error: 'Account is banned' });
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
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};
