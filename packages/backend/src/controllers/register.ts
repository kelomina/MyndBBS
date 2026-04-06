import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { isValidPassword } from '@myndbbs/shared';
import { hashPassword } from '../utils/crypto';
import { verifyCaptcha } from '../utils/captcha';

const prisma = new PrismaClient();
const MAX_ACCOUNTS_PER_IP = 3;

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, username, password, captchaToken, supportsWebAuthn } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';

  if (!email || !username || !captchaToken || supportsWebAuthn === undefined) {
    res.status(400).json({ code: 400, message: 'Missing required fields' });
    return;
  }

  // Verify Captcha
  const isCaptchaValid = await verifyCaptcha(captchaToken, ip);
  if (!isCaptchaValid) {
    res.status(403).json({ code: 403, message: 'Invalid captcha token' });
    return;
  }

  // Password is required for all new registrations (Cross-device fallback)
  if (!password) {
    res.status(400).json({ code: 400, message: 'Password is required' });
    return;
  }
  
  if (!isValidPassword(password)) {
    res.status(400).json({ code: 400, message: 'Password does not meet strict requirements' });
    return;
  }

  try {
    // Check IP limits
    const ipAccountCount = await prisma.user.count({
      where: { registeredIp: ip }
    });

    if (ipAccountCount >= MAX_ACCOUNTS_PER_IP) {
      res.status(403).json({ code: 403, message: 'Maximum accounts reached for this IP' });
      return;
    }

    // Check if email/username exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existingUser) {
      res.status(409).json({ code: 409, message: 'Email or username already exists' });
      return;
    }

    const { hash: passwordHash, salt: passwordSalt } = hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash, // Saved even if Passkey is supported
        passwordSalt,
        registeredIp: ip,
        isPasskeyMandatory: supportsWebAuthn // Flag to prompt Passkey on compatible devices
      }
    });

    if (supportsWebAuthn) {
      // Logic to trigger Passkey registration challenge will go here
      res.status(201).json({ 
        code: 0, 
        message: 'User registered, proceed to Passkey and 2FA setup', 
        data: { userId: newUser.id, requirePasskeySetup: true } 
      });
      return;
    }

    res.status(201).json({ code: 0, message: 'User registered, proceed to 2FA setup', data: { userId: newUser.id } });
  } catch (error) {
    res.status(500).json({ code: 500, message: 'Internal server error' });
  }
};
