import { Request, Response } from 'express';
import crypto from 'crypto';
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { redis } from '../lib/redis';

const rpName = 'MyndBBS';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

const authenticator = new OTP({ strategy: 'totp' });

// Helper to get user from tempToken
const getUserFromTempToken = async (req: Request, expectedType: 'registration' | 'login' = 'registration') => {
  const { tempToken } = req.cookies;
  if (!tempToken) return null;
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET as string) as any;
    if (decoded.type !== expectedType) return null;
    return await prisma.user.findUnique({ 
      where: { id: decoded.userId },
      include: { role: true }
    });
  } catch (err) {
    return null;
  }
};

export const finalizeAuth = async (user: any, req: Request, res: Response) => {
  // Create Session first
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

  const roleName = user.role?.name || user.role || null;

  const accessToken = jwt.sign({ userId: user.id, role: roleName, sessionId: session.id }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, role: roleName, sessionId: session.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });

  res.clearCookie('tempToken');

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: roleName } });
};

export const generateTotp = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.generateURI({ issuer: rpName, label: user.email, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  await redis.set(`totp_setup:${user.id}`, secret, 'EX', 300); // 5 minutes

  res.json({ secret, qrCodeUrl });
};

export const verifyTotpRegistration = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const pendingSecret = await redis.get(`totp_setup:${user.id}`);
  if (!pendingSecret) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED' });
    return;
  }

  const result = authenticator.verifySync({ secret: pendingSecret, token: code });
  if (!result || !result.valid) {
    res.status(400).json({ error: 'ERR_INVALID_TOTP_CODE' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isTotpEnabled: true, totpSecret: pendingSecret }
  });

  await redis.del(`totp_setup:${user.id}`);

  await finalizeAuth(user, req, res);
};

export const generatePasskeyRegistrationOptions = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
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
  // Store challenge
  await prisma.authChallenge.upsert({
    where: { id: challengeId },
    update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: { id: challengeId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
  });

  res.json({ ...options, challengeId });
};

export const verifyPasskeyRegistrationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  if (!challengeId) {
    res.status(400).json({ error: 'ERR_CHALLENGE_ID_IS_REQUIRED' });
    return;
  }

  const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } });
  if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
    res.status(400).json({ error: 'ERR_CHALLENGE_EXPIRED_OR_NOT_FOUND' });
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
        userId: user.id,
        webAuthnUserID: user.id,
        counter: BigInt(counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      }
    });

    await prisma.authChallenge.delete({ where: { id: challengeId } });

    await finalizeAuth(user, req, res);
  } else {
    res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
  }
};

export const getAbility = async (req: any, res: Response): Promise<void> => {
  res.json({ rules: req.ability?.rules || [] });
};

export const verifyTotpLogin = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req, 'login');
  
  if (!user || !user.isTotpEnabled || !user.totpSecret) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED' });
    return;
  }

  const result = authenticator.verifySync({ secret: user.totpSecret, token: code });
  if (!result || !result.valid) {
    res.status(400).json({ error: 'ERR_INVALID_TOTP_CODE' });
    return;
  }

  await finalizeAuth(user, req, res);
};

export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const { tempToken } = req.cookies;
  
  let options;
  let challengeId;

  if (tempToken) {
      // 2FA flow
      const user = await getUserFromTempToken(req, 'login');
      if (!user) {
        res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
        return;
      }
      const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });
      options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userPasskeys.map(passkey => ({
          id: passkey.id,
          transports: ['internal'],
        })),
        userVerification: 'preferred',
      });
      challengeId = crypto.randomUUID();
    } else {
    // Passwordless flow
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // Prompt for all discoverable credentials
      userVerification: 'preferred',
    });
    challengeId = crypto.randomUUID();
  }

  // Store challenge
  await prisma.authChallenge.upsert({
    where: { id: challengeId },
    update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: { id: challengeId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
  });

  res.json({ ...options, challengeId });
};

export const verifyPasskeyAuthenticationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId: bodyChallengeId } = req.body;
  const { tempToken } = req.cookies;
  
  let user;
  let challengeId;

  if (tempToken) {
    // 2FA flow
    user = await getUserFromTempToken(req, 'login');
    if (!user) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    if (!bodyChallengeId) {
      res.status(400).json({ error: 'ERR_CHALLENGE_ID_IS_REQUIRED' });
      return;
    }
    challengeId = bodyChallengeId;
  } else {
    // Passwordless flow
    if (!bodyChallengeId) {
      res.status(400).json({ error: 'ERR_CHALLENGE_ID_IS_REQUIRED_FOR_PASSWORDLESS_LOGIN' });
      return;
    }
    challengeId = bodyChallengeId;
  }

  const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: challengeId } });
  if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
    res.status(400).json({ error: 'ERR_CHALLENGE_EXPIRED_OR_NOT_FOUND' });
    return;
  }

  const passkey = await prisma.passkey.findUnique({ where: { id: response.id } });
  if (!passkey) {
    res.status(400).json({ error: 'ERR_PASSKEY_NOT_FOUND' });
    return;
  }

  if (tempToken && passkey.userId !== user?.id) {
    res.status(400).json({ error: 'ERR_PASSKEY_DOES_NOT_BELONG_TO_USER' });
    return;
  }

  // In passwordless flow, we find the user from the passkey
  if (!tempToken) {
    user = await prisma.user.findUnique({ 
      where: { id: passkey.userId },
      include: { role: true }
    });
    if (!user) {
      res.status(400).json({ error: 'ERR_USER_NOT_FOUND_FOR_THIS_PASSKEY' });
      return;
    }
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: expectedChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
      },
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }

  if (verification.verified && verification.authenticationInfo) {
    const { newCounter } = verification.authenticationInfo;
    
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(newCounter) }
    });

    await prisma.authChallenge.delete({ where: { id: challengeId } });

    if (!user) {
      res.status(400).json({ error: 'ERR_USER_NOT_FOUND' });
      return;
    }

    await finalizeAuth(user, req, res);
  } else {
    res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
  }
};
