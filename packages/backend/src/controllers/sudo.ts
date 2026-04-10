import { Response } from 'express';
import { prisma } from '../db';
import { redis } from '../lib/redis';
import * as argon2 from 'argon2';
import { AuthRequest } from '../middleware/auth';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import crypto from 'crypto';

const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

export const getSudoPasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const userPasskeys = await prisma.passkey.findMany({ where: { userId } });
  
  if (userPasskeys.length === 0) {
    res.status(400).json({ error: 'ERR_NO_PASSKEYS_REGISTERED' });
    return;
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: userPasskeys.map(passkey => ({
      id: passkey.id,
      transports: ['internal'],
    })),
    userVerification: 'preferred',
  });

  const challengeId = crypto.randomUUID();
  await prisma.authChallenge.create({
    data: {
      id: challengeId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  res.json({ ...options, challengeId });
};

export const verifySudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, password, totpCode, passkeyResponse, challengeId } = req.body;
  const userId = req.user!.userId;
  const sessionId = req.user!.sessionId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
    return;
  }

  let isValid = false;

  try {
    if (type === 'password') {
      if (!password || !user.password) {
        res.status(400).json({ error: 'ERR_INVALID_CREDENTIALS' });
        return;
      }
      isValid = await argon2.verify(user.password, password);
    } else if (type === 'totp') {
      if (!totpCode || !user.totpSecret) {
        res.status(400).json({ error: 'ERR_INVALID_TOTP' });
        return;
      }
      const { OTP } = await import('otplib');
      const authenticator = new OTP({ strategy: 'totp' });
      const result = authenticator.verifySync({ token: totpCode, secret: user.totpSecret });
      isValid = result && result.valid;
    } else if (type === 'passkey') {
      if (!passkeyResponse || !challengeId) {
        res.status(400).json({ error: 'ERR_CHALLENGE_ID_IS_REQUIRED' });
        return;
      }

      const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } });
      if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
        res.status(400).json({ error: 'ERR_CHALLENGE_EXPIRED_OR_NOT_FOUND' });
        return;
      }

      const passkey = await prisma.passkey.findUnique({ where: { id: passkeyResponse.id } });
      if (!passkey || passkey.userId !== userId) {
        res.status(400).json({ error: 'ERR_INVALID_PASSKEY' });
        return;
      }

      const verification = await verifyAuthenticationResponse({
        response: passkeyResponse,
        expectedChallenge: expectedChallenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
        },
      });

      isValid = verification.verified;
      if (isValid && verification.authenticationInfo) {
        await prisma.passkey.update({
          where: { id: passkey.id },
          data: { counter: BigInt(verification.authenticationInfo.newCounter) }
        });
      }
      await prisma.authChallenge.delete({ where: { id: challengeId } });
    } else {
      res.status(400).json({ error: 'ERR_INVALID_SUDO_TYPE' });
      return;
    }

    if (isValid) {
      await redis.set(`sudo:${sessionId}`, 'true', 'EX', 15 * 60); // Grant sudo for 15 minutes
      res.json({ message: 'Sudo mode activated' });
    } else {
      res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
    }
  } catch (error) {
    console.error('Sudo verification error:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const checkSudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const isSudo = await redis.get(`sudo:${req.user!.sessionId}`);
  res.json({ isSudo: isSudo === 'true' });
};
