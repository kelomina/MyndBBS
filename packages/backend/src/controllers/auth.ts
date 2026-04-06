import { Request, Response } from 'express';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const rpName = 'MyndBBS';
const rpID = 'localhost'; // Should be domain in prod
const origin = `http://${rpID}:3000`;

// Mock in-memory store for challenges
const userChallenges: { [userId: string]: string } = {};

export const generateRegisterChallenge = async (req: Request, res: Response) => {
  const { email, username } = req.body;
  
  if (!email || !username) {
    return res.status(400).json({ code: 400, message: 'Email and username required' });
  }

  // Mock user ID generation for challenge
  const mockUserId = 'user-' + Date.now();

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

  userChallenges[mockUserId] = options.challenge;

  res.json({ 
    code: 0, 
    message: 'Challenge generated', 
    data: { options, mockUserId } 
  });
};
