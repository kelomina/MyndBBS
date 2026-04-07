import { Request, Response } from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '../db';

const rpName = 'MyndBBS';
const rpID = 'localhost'; // Should be domain in prod
const origin = `http://${rpID}:3000`;

export const generateRegisterChallenge = async (req: Request, res: Response) => {
  const { email, username } = req.body;
  
  if (!email || !username) {
    return res.status(400).json({ code: 400, message: 'Email and username required' });
  }

  // Mock user ID generation for challenge
  const mockUserId = 'user-' + Date.now();

  // Periodically cleanup expired challenges to prevent database exhaustion (10% probability)
  if (Math.random() < 0.1) {
    prisma.authChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    }).catch(console.error);
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(mockUserId)),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Store in database instead of userChallenges dictionary
  await prisma.authChallenge.create({
    data: {
      id: mockUserId,
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
    }
  });

  res.json({ 
    code: 0, 
    message: 'Challenge generated', 
    data: { options, mockUserId } 
  });
};

export const verifyRegisterChallenge = async (req: Request, res: Response) => {
  const { mockUserId, response } = req.body;

  if (!mockUserId || !response) {
    return res.status(400).json({ code: 400, message: 'Missing required fields' });
  }

  const challengeRecord = await prisma.authChallenge.findUnique({
    where: { id: mockUserId }
  });

  try {
    if (challengeRecord) {
      await prisma.authChallenge.delete({ where: { id: mockUserId } });
    }
  } catch (error) {
    return res.status(400).json({ code: 400, message: 'Challenge already used or invalid' });
  }

  if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
    return res.status(400).json({ code: 400, message: 'Challenge expired or invalid' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    return res.status(400).json({ code: 400, message: (error as Error).message || 'Challenge already used or invalid' });
  }

  const { verified } = verification;
  
  if (verified) {
    return res.json({ code: 0, message: 'Registration verified successfully', data: { verified } });
  }

  return res.status(400).json({ code: 400, message: 'Registration verification failed' });
};

