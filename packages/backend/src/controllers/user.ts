import { Request, Response } from 'express';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import * as argon2 from 'argon2';
import { AuthRequest } from '../middleware/auth';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { OTP } from 'otplib';
import QRCode from 'qrcode';

const rpName = 'MyndBBS';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

const authenticator = new OTP({ strategy: 'totp' });

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: { select: { name: true } },
        isTotpEnabled: true,
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: { ...user, role: user.role?.name || null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBookmarkedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const postBookmarks = await prisma.bookmark.findMany({
      where: { 
        userId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            author: { select: { id: true, username: true } },
            category: { select: { id: true, name: true, description: true } }
          }
        }
      }
    });

    const commentBookmarks = await prisma.commentBookmark.findMany({
      where: {
        userId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        comment: {
          include: {
            author: { select: { id: true, username: true } },
            post: { select: { id: true, title: true, status: true } }
          }
        }
      }
    });

    const unifiedBookmarks = [
      ...postBookmarks.map(b => ({ ...b.post, type: 'post', bookmarkedAt: b.createdAt })),
      ...commentBookmarks.map(b => ({ ...b.comment, type: 'comment', bookmarkedAt: b.createdAt }))
    ].sort((a, b) => b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime());

    res.json(unifiedBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPasskeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId },
      select: { id: true, deviceType: true, backedUp: true, createdAt: true }
    });

    res.json({ passkeys });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const passkeyId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await prisma.passkey.deleteMany({
      where: { id: passkeyId, userId }
    });

    res.json({ message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const disableTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, totpCode } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!currentPassword && !totpCode) {
      res.status(401).json({ error: 'Current password or TOTP code required to disable 2FA' });
      return;
    }
    if (currentPassword && user.password) {
      const isValid = await argon2.verify(user.password, currentPassword);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid current password' });
        return;
      }
    }
    if (totpCode && user.totpSecret) {
      const result = authenticator.verifySync({ secret: user.totpSecret, token: totpCode });
      if (!result || !result.valid) {
        res.status(400).json({ error: 'Invalid TOTP code' });
        return;
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isTotpEnabled: false, totpSecret: null }
    });

    res.json({ message: 'TOTP disabled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

import { accessibleBy } from '@casl/prisma';

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, username, password, currentPassword, totpCode } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (email || password) {
      if (!currentPassword && !totpCode) {
        res.status(401).json({ error: 'Current password or TOTP code required for sensitive changes' });
        return;
      }
      if (currentPassword && user.password) {
        const isValid = await argon2.verify(user.password, currentPassword);
        if (!isValid) {
          res.status(401).json({ error: 'Invalid current password' });
          return;
        }
      }
      if (totpCode && user.totpSecret) {
        const result = authenticator.verifySync({ secret: user.totpSecret, token: totpCode });
        if (!result || !result.valid) {
          res.status(400).json({ error: 'Invalid TOTP code' });
          return;
        }
      }
    }

    const updateData: any = {};

    if (email && email !== user.email) {
      // check if email is taken
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        res.status(400).json({ error: 'Email already in use' });
        return;
      }
      updateData.email = email;
    }

    if (username && username !== user.username) {
      // check if username is taken
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername) {
        res.status(400).json({ error: 'Username already in use' });
        return;
      }
      updateData.username = username;
    }

    if (password) {
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
        return;
      }
      
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}/.test(password)) {
        res.status(400).json({ error: 'Password must contain uppercase, lowercase, number, and special character' });
        return;
      }
      // Restrict to ASCII characters to prevent Unicode bypass
      if (!/^[ -~]+$/.test(password)) {
        res.status(400).json({ error: 'Password contains invalid characters' });
        return;
      }
      updateData.password = await argon2.hash(password);
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, username: true, role: { select: { name: true } } } // Don't return password or sensitive data
    });

    res.json({ message: 'Profile updated successfully', user: { ...updatedUser, role: updatedUser.role?.name || null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generateTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.generateURI({ issuer: rpName, label: user.email, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    await redis.set(`totp_setup:${userId}`, secret, 'EX', 300); // 5 minutes

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pendingSecret = await redis.get(`totp_setup:${userId}`);
    if (!pendingSecret) {
      res.status(401).json({ error: 'Unauthorized or setup not initiated/expired' });
      return;
    }

    const result = authenticator.verifySync({ secret: pendingSecret, token: code });
    if (!result || !result.valid) {
      res.status(400).json({ error: 'Invalid TOTP code' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isTotpEnabled: true, totpSecret: pendingSecret }
    });

    await redis.del(`totp_setup:${userId}`);

    res.json({ message: 'TOTP setup successful' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const generatePasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const userPasskeys = await prisma.passkey.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(userId)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    const challengeId = crypto.randomUUID();
    await prisma.authChallenge.upsert({
      where: { id: challengeId },
      update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { id: challengeId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
    });

    res.json({ ...options, challengeId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyPasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { response, challengeId } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!challengeId) {
      res.status(400).json({ error: 'Challenge ID is required' });
      return;
    }

    const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } });
    if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
      res.status(400).json({ error: 'Challenge expired or not found' });
      return;
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: expectedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      await prisma.passkey.create({
        data: {
          id: credentialID,
          publicKey: Buffer.from(credentialPublicKey),
          userId,
          webAuthnUserID: userId,
          counter: BigInt(counter),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        }
      });

      await prisma.authChallenge.delete({ where: { id: challengeId } });
      res.json({ message: 'Passkey registered successfully' });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true
      }
    });

    res.json({ sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.params.sessionId as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    // Verify the session belongs to the user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    await prisma.session.delete({
      where: { id: sessionId }
    });

    await redis.del(`session:${sessionId}`);
    await redis.del(`session:${sessionId}:requires_refresh`);

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        role: { select: { name: true } },
        createdAt: true,
        posts: {
          where: accessibleBy(req.ability!).Post,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            category: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { posts: { where: accessibleBy(req.ability!).Post } } }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: { ...user, role: user.role?.name || null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
