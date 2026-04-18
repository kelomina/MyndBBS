import { Request, Response } from 'express';
import { authApplicationService } from '../registry';

const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || `http://${rpID}:3000`;

// Helper to get user from tempToken
const getUserFromTempToken = async (req: Request, expectedType: 'registration' | 'login' = 'registration') => {
  return await authApplicationService.getUserFromTempToken(req.cookies?.tempToken, expectedType);
};


export const finalizeAuth = async (user: any, req: Request, res: Response) => {
  const { accessToken, refreshToken } = await authApplicationService.finalizeAuth(
    user,
    req.ip || null,
    req.headers['user-agent'] || null
  );

  const roleName = user.role?.name || user.role || null;

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

export const generateTotp = async (req: Request, res: Response): Promise<void> => {
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED_OR_TOKEN_EXPIRED' });
    return;
  }

  try {
    const { secret, qrCodeUrl } = await authApplicationService.generateTotp(user.id, user.email);
    res.json({ secret, qrCodeUrl });
  } catch (error: any) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const verifyTotpRegistration = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req);
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    await authApplicationService.verifyTotpRegistration(user.id, code);
    await finalizeAuth(user, req, res);
  } catch (error: any) {
    if (error.message === 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED') {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

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
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_INTERNAL_SERVER_ERROR' ? 500 : 400).json({ error: errorCode });
  }
};

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
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_INTERNAL_SERVER_ERROR';
    res.status(errorCode === 'ERR_INTERNAL_SERVER_ERROR' ? 500 : 400).json({ error: errorCode });
  }
};

export const getAbility = async (req: any, res: Response): Promise<void> => {
  res.json({ rules: req.ability?.rules || [] });
};

export const verifyTotpLogin = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body;
  const user = await getUserFromTempToken(req, 'login');
  
  if (!user) {
    res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
    return;
  }

  try {
    const verifiedUser = await authApplicationService.verifyTotpLogin(user.id, code);
    await finalizeAuth(verifiedUser, req, res);
  } catch (error: any) {
    if (error.message === 'ERR_UNAUTHORIZED_OR_TOTP_NOT_ENABLED') {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const generatePasskeyAuthenticationOptions = async (req: Request, res: Response): Promise<void> => {
  const { tempToken } = req.cookies;
  
  try {
    const options = await authApplicationService.processGeneratePasskeyAuthenticationOptions(tempToken);
    res.json(options);
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message === 'ERR_UNAUTHORIZED' ? 401 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

export const verifyPasskeyAuthenticationResponse = async (req: Request, res: Response): Promise<void> => {
  const { response, challengeId } = req.body;
  const { tempToken } = req.cookies;
  
  try {
    const verification = await authApplicationService.processPasskeyAuthentication(
      response,
      challengeId,
      tempToken
    );

    if (verification.verified && verification.user) {
      await finalizeAuth(verification.user, req, res);
    } else {
      res.status(400).json({ error: 'ERR_VERIFICATION_FAILED' });
    }
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message === 'ERR_UNAUTHORIZED' ? 401 : 400;
      res.status(statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};
