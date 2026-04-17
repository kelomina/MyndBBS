import { Request, Response } from 'express';
import crypto from 'crypto';
import { 
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { APP_NAME } from '@myndbbs/shared';
import { userApplicationService, authApplicationService } from '../registry';

const rpName = APP_NAME;
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

const authenticator = new OTP({ strategy: 'totp' });

// Helper to get user from tempToken
/**
 * Callers: []
 * Callees: [verify, findUnique]
 * Description: Handles the get user from temp token logic for the application.
 * Keywords: getuserfromtemptoken, get, user, from, temp, token, auto-annotated
 */
const getUserFromTempToken = async (req: Request, expectedType: 'registration' | 'login' = 'registration') => {
  const { tempToken } = req.cookies;
  if (!tempToken) return null;
  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET as string) as any;
    if (decoded.type !== expectedType) return null;
    return await identityQueryService.getUserWithRoleById(decoded.userId);
  } catch (err) {
    return null;
  }
};

/**
 * Callers: []
 * Callees: [create, now, sign, clearCookie, cookie, json]
 * Description: Handles the finalize auth logic for the application.
 * Keywords: finalizeauth, finalize, auth, auto-annotated
 */
export const finalizeAuth = async (user: any, req: Request, res: Response) => {
  // Create Session first
  const session = await authApplicationService.createSession(
    user.id,
    req.ip || null,
    req.headers['user-agent'] || null,
    7 * 24 * 60 * 60 * 1000 // 7 days
  );

  const roleName = user.role?.name || user.role || null;

  const accessToken = jwt.sign({ userId: user.id, role: roleName, sessionId: session.id }, process.env.JWT_SECRET as string, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id, role: roleName, sessionId: session.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });

  res.clearCookie('tempToken');

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && req.secure,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && req.secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username, role: roleName } });
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, generateSecret, generateURI, toDataURL, set]
 * Description: Handles the generate totp logic for the application.
 * Keywords: generatetotp, generate, totp, auto-annotated
 */
export const generateTotp = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED' });
    return;
  }

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.generateURI({ issuer: rpName, label: user.email, secret });
  const qrCodeUrl = await QRCode.toDataURL(otpauth);

  await authApplicationService.storeTotpSecret(user.id, secret, 300); // 5 minutes

  res.json({ secret, qrCodeUrl });
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, get, verifySync, update, del, finalizeAuth]
 * Description: Handles the verify totp registration logic for the application.
 * Keywords: verifytotpregistration, verify, totp, registration, auto-annotated
 */
export const verifyTotpRegistration = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  const pendingSecret = await authApplicationService.getTotpSecret(user.id);
  if (!pendingSecret) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED' });
    return;
  }

  const result = authenticator.verifySync({ secret: pendingSecret, token: code });
  if (!result || !result.valid) {
    res.status(400).json({ error: 'ERR_INVALID_TOTP_CODE' });
    return;
  }

  await userApplicationService.enableTotp(user.id, pendingSecret);

  await authApplicationService.removeTotpSecret(user.id);

  await finalizeAuth(user, req, res);
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, findMany, generateRegistrationOptions, from, map, randomUUID, upsert, now]
 * Description: Handles the generate passkey registration options logic for the application.
 * Keywords: generatepasskeyregistrationoptions, generate, passkey, registration, options, auto-annotated
 */
export const generatePasskeyRegistrationOptions = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const options = await authApplicationService.generatePasskeyRegistrationOptions(user.id);
    res.json(options);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, findUnique, verifyRegistrationResponse, create, from, BigInt, delete, update, finalizeAuth]
 * Description: Handles the verify passkey registration response logic for the application.
 * Keywords: verifypasskeyregistrationresponse, verify, passkey, registration, response, auto-annotated
 */
export const verifyPasskeyRegistrationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const verificationResult = await authApplicationService.verifyPasskeyRegistration(user.id, response, challengeId);
    
    if (verificationResult.verified) {
      if (!user.isTotpEnabled) {
        res.json({ message: 'Passkey registered successfully. Please proceed to setup TOTP.' });
        return;
      }
      // If user was updated with new level/role, use the returned user, otherwise use current user
      const updatedUser = verificationResult.user || user;
      await finalizeAuth(updatedUser, req, res);
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Callers: []
 * Callees: [json]
 * Description: Handles the get ability logic for the application.
 * Keywords: getability, get, ability, auto-annotated
 */
export const getAbility = async (req: any, res: Response): Promise<void> => {
  res.json({ rules: req.ability?.rules || [] });
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, verifySync, finalizeAuth]
 * Description: Handles the verify totp login logic for the application.
 * Keywords: verifytotplogin, verify, totp, login, auto-annotated
 */
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

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, findMany, generateAuthenticationOptions, map, randomUUID, upsert, now]
 * Description: Handles the generate passkey authentication options logic for the application.
 * Keywords: generatepasskeyauthenticationoptions, generate, passkey, authentication, options, auto-annotated
 */
export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const { tempToken } = req.cookies;
  
  let options;

  if (tempToken) {
    // 2FA flow
    const user = await getUserFromTempToken(req, 'login');
    if (!user) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }
    const userPasskeys = await identityQueryService.listUserPasskeyIds(user.id);
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: ['internal'] as any,
      })),
      userVerification: 'preferred',
    });
  } else {
    // Passwordless flow
    options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // Prompt for all discoverable credentials
      userVerification: 'preferred',
    });
  }

  const authChallenge = await authApplicationService.generateAuthChallenge(options.challenge);
  const challengeId = authChallenge.id;

  res.json({ ...options, challengeId });
};

/**
 * Callers: []
 * Callees: [getUserFromTempToken, json, status, findUnique, verifyAuthenticationResponse, Number, update, BigInt, delete, finalizeAuth]
 * Description: Handles the verify passkey authentication response logic for the application.
 * Keywords: verifypasskeyauthenticationresponse, verify, passkey, authentication, response, auto-annotated
 */
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

  let expectedChallenge;
  try {
    expectedChallenge = await authApplicationService.consumeAuthChallenge(challengeId);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    return;
  }

  const passkey = await identityQueryService.getPasskeyById(response.id);
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
    user = await identityQueryService.getUserWithRoleById(passkey.userId);
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
    
    try {
      await authApplicationService.updatePasskeyCounter(passkey.id, BigInt(newCounter));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
      return;
    }

    if (!user) {
      res.status(400).json({ error: 'ERR_USER_NOT_FOUND' });
      return;
    }

    await finalizeAuth(user, req, res);
  } else {
    res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
  }
};
