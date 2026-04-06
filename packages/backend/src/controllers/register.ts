import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, password, captchaId } = req.body;

    if (!email || !username || !password || !captchaId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify Captcha
    const challenge = await prisma.captchaChallenge.findUnique({
      where: { id: captchaId }
    });

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

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });

    // Cleanup captcha
    await prisma.captchaChallenge.delete({ where: { id: captchaId } });

    // Generate JWT
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'User registered successfully', token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
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

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
