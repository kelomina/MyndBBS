import { Request, Response } from 'express';
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
    return await prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch (err) {
    return null;
  }
};

// Helper to issue tokens and session
const finalizeAuth = async (user: any, req: Request, res: Response) => {
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_REFRESH_SECRET as string || process.env.JWT_SECRET as string, { expiresIn: '7d' });

  // Create Session
  await prisma.session.create({
    data: {
      userId: user.id,
      ...(req.ip && { ipAddress: req.ip }),
      ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] }),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  });

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
};

export const generateTotp = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized or token expired' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.generateURI({ issuer: rpName, label: user.email, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret }
  });

  res.json({ secret, qrCodeUrl });
};

export const verifyTotpRegistration = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req);
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
    where: { id: user.id },
    data: { isTotpEnabled: true }
  });

  await finalizeAuth(user, req, res);

  res.json({ message: 'TOTP setup successful', user: { id: user.id, username: user.username, role: user.role } });
};

export const generatePasskeyRegistrationOptions = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
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

  // Store challenge
  await prisma.authChallenge.upsert({
    where: { id: user.id },
    update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: { id: user.id, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
  });

  res.json(options);
};

export const verifyPasskeyRegistrationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: user.id } });
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
        userId: user.id,
        webAuthnUserID: user.id,
        counter: BigInt(counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      }
    });

    await prisma.authChallenge.delete({ where: { id: user.id } });

    await finalizeAuth(user, req, res);

    res.json({ message: 'Passkey registered successfully', user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(400).json({ error: 'Verification failed' });
  }
};

export const verifyTotpLogin = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req, 'login');
  
  if (!user || !user.isTotpEnabled || !user.totpSecret) {
    res.status(401).json({ error: 'Unauthorized or TOTP not enabled' });
    return;
  }

  const result = authenticator.verifySync({ secret: user.totpSecret, token: code });
  if (!result || !result.valid) {
    res.status(400).json({ error: 'Invalid TOTP code' });
    return;
  }

  await finalizeAuth(user, req, res);

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } });
};

export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req, 'login');
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: userPasskeys.map(passkey => ({
      id: passkey.id,
      transports: ['internal'],
    })),
    userVerification: 'preferred',
  });

  // Store challenge
  await prisma.authChallenge.upsert({
    where: { id: user.id },
    update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    create: { id: user.id, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }
  });

  res.json(options);
};

export const verifyPasskeyAuthenticationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response } = req.body;
  const user = await getUserFromTempToken(req, 'login');
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const expectedChallenge = await prisma.authChallenge.findUnique({ where: { id: user.id } });
  if (!expectedChallenge || expectedChallenge.expiresAt < new Date()) {
    res.status(400).json({ error: 'Challenge expired or not found' });
    return;
  }

  const passkey = await prisma.passkey.findUnique({ where: { id: response.id } });
  if (!passkey || passkey.userId !== user.id) {
    res.status(400).json({ error: 'Passkey not found or does not belong to user' });
    return;
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

    await prisma.authChallenge.delete({ where: { id: user.id } });

    await finalizeAuth(user, req, res);

    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(400).json({ error: 'Verification failed' });
  }
};
