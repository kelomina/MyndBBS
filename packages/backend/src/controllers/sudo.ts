import { Response } from 'express';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { redis } from '../lib/redis';
import * as argon2 from 'argon2';
import { AuthRequest } from '../middleware/auth';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { AuthApplicationService } from '../application/identity/AuthApplicationService';
import { PrismaCaptchaChallengeRepository } from '../infrastructure/repositories/PrismaCaptchaChallengeRepository';
import { PrismaPasskeyRepository } from '../infrastructure/repositories/PrismaPasskeyRepository';
import { PrismaSessionRepository } from '../infrastructure/repositories/PrismaSessionRepository';
import { PrismaAuthChallengeRepository } from '../infrastructure/repositories/PrismaAuthChallengeRepository';
import { PrismaUserRepository } from '../infrastructure/repositories/PrismaUserRepository';
import { PrismaRoleRepository } from '../infrastructure/repositories/PrismaRoleRepository';

const authApplicationService = new AuthApplicationService(
  new PrismaCaptchaChallengeRepository(),
  new PrismaPasskeyRepository(),
  new PrismaSessionRepository(),
  new PrismaAuthChallengeRepository(),
  new PrismaUserRepository(),
  new PrismaRoleRepository()
);

const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

/**
 * Callers: []
 * Callees: [findMany, json, status, generateAuthenticationOptions, map, randomUUID, create, now]
 * Description: Handles the get sudo passkey options logic for the application.
 * Keywords: getsudopasskeyoptions, get, sudo, passkey, options, auto-annotated
 */
export const getSudoPasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const userPasskeys = await identityQueryService.listUserPasskeyIds(userId);
  
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

  const authChallenge = await authApplicationService.generateAuthChallenge(options.challenge);
  const challengeId = authChallenge.id;

  res.json({ ...options, challengeId });
};

/**
 * Callers: []
 * Callees: [findUnique, json, status, verify, verifySync, verifyAuthenticationResponse, Number, update, BigInt, delete, set, error]
 * Description: Handles the verify sudo logic for the application.
 * Keywords: verifysudo, verify, sudo, auto-annotated
 */
export const verifySudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, password, totpCode, passkeyResponse, response, challengeId } = req.body;
  const actualPasskeyResponse = passkeyResponse || response;
  const actualType = type || (actualPasskeyResponse ? 'passkey' : undefined);
  const userId = req.user!.userId;
  const sessionId = req.user!.sessionId;

  const user = await identityQueryService.getUserWithRoleById(userId);
  if (!user) {
    res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
    return;
  }

  let isValid = false;

  try {
    if (actualType === 'password') {
      if (!password || !user.password) {
        res.status(400).json({ error: 'ERR_INVALID_CREDENTIALS' });
        return;
      }
      isValid = await argon2.verify(user.password, password);
    } else if (actualType === 'totp') {
      if (!totpCode || !user.totpSecret) {
        res.status(400).json({ error: 'ERR_INVALID_TOTP' });
        return;
      }
      const { OTP } = await import('otplib');
      const authenticator = new OTP({ strategy: 'totp' });
      const result = authenticator.verifySync({ token: totpCode, secret: user.totpSecret });
      isValid = result && result.valid;
    } else if (actualType === 'passkey') {
      if (!actualPasskeyResponse || !challengeId) {
        res.status(400).json({ error: 'ERR_CHALLENGE_ID_IS_REQUIRED' });
        return;
      }

      let expectedChallenge;
      try {
        expectedChallenge = await authApplicationService.consumeAuthChallenge(challengeId);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
        return;
      }

      const passkey = await identityQueryService.getPasskeyById(actualPasskeyResponse.id);
      if (!passkey || passkey.userId !== userId) {
        res.status(400).json({ error: 'ERR_INVALID_PASSKEY' });
        return;
      }

      const verification = await verifyAuthenticationResponse({
        response: actualPasskeyResponse,
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
        await authApplicationService.updatePasskeyCounter(passkey.id, BigInt(verification.authenticationInfo.newCounter));
      }
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

/**
 * Callers: []
 * Callees: [get, json]
 * Description: Handles the check sudo logic for the application.
 * Keywords: checksudo, check, sudo, auto-annotated
 */
export const checkSudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const isSudo = await redis.get(`sudo:${req.user!.sessionId}`);
  res.json({ isSudo: isSudo === 'true' });
};
