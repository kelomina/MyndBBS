import { Request, Response } from 'express';
import { prisma } from '../db';
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
        role: true,
        isTotpEnabled: true,
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
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

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, username, password } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
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
      updateData.password = await argon2.hash(password);
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, username: true, role: true } // Don't return password or sensitive data
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
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

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret }
    });

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
    if (!user || !user.totpSecret) {
      res.status(401).json({ error: 'Unauthorized or setup not initiated' });
      return;
    }

    const result = authenticator.verifySync({ secret: user.totpSecret, token: code });
    if (!result || !result.valid) {
      res.status(400).json({ error: 'Invalid TOTP code' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isTotpEnabled: true }
    });

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

    await prisma.authChallenge.upsert({
      where: { id: userId },
      update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { id: userId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
    });

    res.json(options);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyPasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { response } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: userId } });
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

      await prisma.authChallenge.delete({ where: { id: userId } });
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

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
