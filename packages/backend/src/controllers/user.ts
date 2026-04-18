import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { identityQueryService } from '../queries/identity/IdentityQueryService';
import { authApplicationService, userApplicationService } from '../registry';

/**
 * Callers: [Router]
 * Callees: [identityQueryService]
 * Description: Retrieves the profile of the authenticated user.
 * Keywords: user, profile
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
 * Callers: [Router]
 * Callees: [identityQueryService]
 * Description: Retrieves bookmarked posts for the authenticated user.
 * Keywords: user, bookmarks
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
 * Callers: [Router]
 * Callees: [identityQueryService]
 * Description: Retrieves the list of passkeys registered by the authenticated user.
 * Keywords: user, passkeys, webauthn
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Deletes a specific passkey for the authenticated user.
 * Keywords: user, passkey, delete
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
      const errorCode = typeof e?.message === 'string' && e.message.startsWith('ERR_')
        ? e.message
        : 'ERR_BAD_REQUEST';
      res.status(400).json({ error: errorCode });
      return;
    }

    res.json({ message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: [Router]
 * Callees: [userApplicationService]
 * Description: Disables TOTP 2FA for the authenticated user with verification.
 * Keywords: user, totp, disable, 2fa
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


/**
 * Callers: [Router]
 * Callees: [authApplicationService, identityQueryService]
 * Description: Updates the authenticated user's profile information (password, email, username).
 * Keywords: user, profile, update
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

    try {
      const updatedUser = await authApplicationService.changePasswordWithVerification(
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
 * Callers: [Router]
 * Callees: [identityQueryService, authApplicationService]
 * Description: Generates a TOTP secret and QR code for setting up 2FA.
 * Keywords: user, totp, generate, 2fa
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

    const { secret, qrCodeUrl } = await authApplicationService.generateTotp(userId, user.email);

    res.json({ secret, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Verifies a TOTP code during registration to finalize 2FA setup.
 * Keywords: user, totp, verify, 2fa
 */
export const verifyTotp = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    try {
      await authApplicationService.verifyTotpRegistration(userId, code);
      res.json({ message: 'TOTP setup successful' });
    } catch (error: any) {
      if (error.message === 'ERR_UNAUTHORIZED_OR_SETUP_NOT_INITIATED_EXPIRED') {
        res.status(400).json({ error: 'ERR_TOTP_SETUP_NOT_INITIATED_OR_EXPIRED' });
        return;
      }
      if (error.message === 'ERR_USER_NOT_FOUND') {
        res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
        return;
      }
      if (error.message.startsWith('ERR_')) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Generates options for WebAuthn passkey registration.
 * Keywords: user, passkey, register, webauthn
 */
export const generatePasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    const options = await authApplicationService.generatePasskeyRegistrationOptions(userId);
    res.json(options);
  } catch (error: any) {
    if (error.message.startsWith('ERR_')) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Verifies the passkey registration response to finalize WebAuthn setup.
 * Keywords: user, passkey, verify, webauthn
 */
export const verifyPasskey = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { response, challengeId } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'ERR_UNAUTHORIZED' });
      return;
    }

    try {
      const verificationResult = await authApplicationService.verifyPasskeyRegistration(userId, response, challengeId);
      if (verificationResult.verified) {
        res.json({ message: 'Passkey registered successfully' });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
      return;
    }
  } catch (error) {
    res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
  }
};

/**
 * Callers: [Router]
 * Callees: [identityQueryService]
 * Description: Retrieves active sessions for the authenticated user.
 * Keywords: user, sessions, list
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
 * Callers: [Router]
 * Callees: [authApplicationService]
 * Description: Revokes a specific session for the authenticated user.
 * Keywords: user, session, revoke
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

    try {
      await authApplicationService.revokeSession(sessionId, userId);
      res.json({ message: 'Session revoked successfully' });
    } catch (error: any) {
      if (error.message === 'ERR_SESSION_NOT_FOUND_OR_UNAUTHORIZED') {
        res.status(404).json({ error: error.message });
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
 * Callers: [Router]
 * Callees: [identityQueryService]
 * Description: Retrieves the public profile of a user by username.
 * Keywords: user, profile, public
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
