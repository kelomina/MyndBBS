import { Request, Response } from 'express';
import { redis } from '../lib/redis';
import * as argon2 from 'argon2';
import { AuthRequest } from '../middleware/auth';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { authApplicationService, userApplicationService } from '../registry';

const rpName = 'MyndBBS';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

const authenticator = new OTP({ strategy: 'totp' });

/**
 * Callers: []
 * Callees: [json, status, findUnique, error]
 * Description: Handles the get profile logic for the application.
 * Keywords: getprofile, get, profile, auto-annotated
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const user = await identityQueryService.getProfile(userId);

    if (!user) {
      res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
      return;
    }

    res.json({ user: { ...user, role: user.role?.name || null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findMany, sort, map, getTime, error]
 * Description: Handles the get bookmarked posts logic for the application.
 * Keywords: getbookmarkedposts, get, bookmarked, posts, auto-annotated
 */
export const getBookmarkedPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const unifiedBookmarks = await identityQueryService.listBookmarks(userId);

    res.json(unifiedBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findMany, error]
 * Description: Handles the get passkeys logic for the application.
 * Keywords: getpasskeys, get, passkeys, auto-annotated
 */
export const getPasskeys = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const passkeys = await identityQueryService.listPasskeys(userId);

    res.json({ passkeys });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [AuthApplicationService.deletePasskey, count, update, json, status, error]
 * Description: Orchestrates the deletion of a passkey via the domain service. Also handles automatic security level downgrades if no passkeys remain.
 * Keywords: delete, passkey, webauthn, service, identity
 */
export const deletePasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const passkeyId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    try {
      await authApplicationService.deletePasskey(passkeyId, userId);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    // Check remaining passkeys. If 0, force level to 1 (Pragmatic CQRS read inside controller for flow control)
    const remaining = await identityQueryService.countPasskeys(userId);
    if (remaining === 0) {
      await userApplicationService.changeLevel(userId, 1);
    }

    res.json({ message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, verify, verifySync, update, error]
 * Description: Handles the disable totp logic for the application.
 * Keywords: disabletotp, disable, totp, auto-annotated
 */
export const disableTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const { currentPassword, totpCode } = req.body;

    try {
      await userApplicationService.disableTotpWithVerification(userId, currentPassword, totpCode);
    } catch (error: any) {
      if (error.message.startsWith('ERR_')) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }

    res.json({ message: 'TOTP disabled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

import { accessibleBy } from '@casl/prisma';

/**
 * Callers: []
 * Callees: [json, status, findUnique, verify, verifySync, test, hash, keys, update, error]
 * Description: Handles the update profile logic for the application.
 * Keywords: updateprofile, update, profile, auto-annotated
 */
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const { email, username, password, currentPassword, totpCode } = req.body;
    
    if (!email && !username && !password) {
      res.status(400).json({ error: 'ERR_NO_FIELDS_TO_UPDATE' });
      return;
    }

    if (password) {
      try {
        authApplicationService.validatePasswordPolicy(password);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    try {
      const updatedUser = await userApplicationService.changePasswordWithVerification(
        userId,
        currentPassword,
        totpCode,
        password,
        email,
        username
      );
      
      // We need to return role name, let's fetch it via Prisma CQRS read
      const userRole = await identityQueryService.getUserWithRoleById(userId);

      res.json({ message: 'Profile updated successfully', user: { ...updatedUser, role: userRole?.role?.name || null } });
    } catch (error: any) {
      if (error.message.startsWith('ERR_')) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, generateSecret, generateURI, toDataURL, set]
 * Description: Handles the generate totp logic for the application.
 * Keywords: generatetotp, generate, totp, auto-annotated
 */
export const generateTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const user = await identityQueryService.getUserWithRoleById(userId);
    if (!user) return;

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.generateURI({ issuer: rpName, label: user.email, secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    await redis.set(`totp_setup:${userId}`, secret, 'EX', 300); // 5 minutes

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, get, verifySync, update, del]
 * Description: Handles the verify totp logic for the application.
 * Keywords: verifytotp, verify, totp, auto-annotated
 */
export const verifyTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const user = await identityQueryService.getUserWithRoleById(userId);
    if (!user) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const pendingSecret = await redis.get(`totp_setup:${userId}`);
    if (!pendingSecret) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED' });
      return;
    }

    const result = authenticator.verifySync({ secret: pendingSecret, token: code });
    if (!result || !result.valid) {
      res.status(400).json({ error: 'ERR_INVALID_TOTP_CODE' });
      return;
    }

    await userApplicationService.enableTotp(userId, pendingSecret);

    await redis.del(`totp_setup:${userId}`);

    res.json({ message: 'TOTP setup successful' });
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, findMany, generateRegistrationOptions, from, map, randomUUID, upsert, now]
 * Description: Handles the generate passkey options logic for the application.
 * Keywords: generatepasskeyoptions, generate, passkey, options, auto-annotated
 */
export const generatePasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const user = await identityQueryService.getUserWithRoleById(userId);
    if (!user) return;

    const userPasskeys = await identityQueryService.listPasskeys(userId);

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

    const authChallenge = await authApplicationService.generateAuthChallenge(options.challenge);
    const challengeId = authChallenge.id;

    res.json({ ...options, challengeId });
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findUnique, verifyRegistrationResponse, create, from, BigInt, delete, update]
 * Description: Handles the verify passkey logic for the application.
 * Keywords: verifypasskey, verify, passkey, auto-annotated
 */
export const verifyPasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { response, challengeId } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    if (!challengeId) {
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

    await authApplicationService.addPasskey(
      userId,
      credentialID,
      Buffer.from(credentialPublicKey),
      userId,
      BigInt(counter),
      credentialDeviceType,
      credentialBackedUp
    );

      const dbUser = await identityQueryService.getUserWithRoleById(userId);
      if (dbUser && dbUser.level === 1) {
        await userApplicationService.changeLevel(userId, 2);
      }

      res.json({ message: 'Passkey registered successfully' });
    } else {
      res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
    }
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findMany, error]
 * Description: Handles the get sessions logic for the application.
 * Keywords: getsessions, get, sessions, auto-annotated
 */
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const sessions = await identityQueryService.listSessions(userId);

    res.json({ sessions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [json, status, findFirst, delete, del, error]
 * Description: Handles the revoke session logic for the application.
 * Keywords: revokesession, revoke, session, auto-annotated
 */
export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.params.sessionId as string;

    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: 'ERR_SESSION_ID_IS_REQUIRED' });
      return;
    }

    // Verify the session belongs to the user
    const session = await identityQueryService.getSessionById(sessionId);

    if (!session || session.userId !== userId) {
      res.status(404).json({ error: 'ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED' });
      return;
    }

    await authApplicationService.revokeSession(sessionId);

    await redis.del(`session:${sessionId}`);
    await redis.del(`session:${sessionId}:requires_refresh`);

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: []
 * Callees: [findUnique, accessibleBy, json, status, error]
 * Description: Handles the get public profile logic for the application.
 * Keywords: getpublicprofile, get, public, profile, auto-annotated
 */
export const getPublicProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = req.params.username as string;
    const user = await identityQueryService.getPublicProfile(username, req.ability!);

    if (!user) {
      res.status(404).json({ error: 'ERR_USER_NOT_FOUND' });
      return;
    }

    res.json({ user: { ...user, role: user.role?.name || null } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};
