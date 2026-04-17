import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { sudoApplicationService } from '../registry';
import { VerifyInput } from '../application/identity/SudoApplicationService';

/**
 * Callers: [user router]
 * Callees: [sudoApplicationService.getPasskeyOptions]
 * Description: Retrieves passkey authentication options for sudo mode.
 * Keywords: sudo, passkey, options, controller, auth
 */
export const getSudoPasskeyOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  try {
    const options = await sudoApplicationService.getPasskeyOptions(userId);
    res.json(options);
  } catch (error: any) {
    const errorCode = typeof error?.message === 'string' && error.message.startsWith('ERR_')
      ? error.message
      : 'ERR_BAD_REQUEST';
    res.status(400).json({ error: errorCode });
  }
};

/**
 * Callers: [user router]
 * Callees: [sudoApplicationService.verify]
 * Description: Verifies credentials (password, TOTP, or passkey) to activate sudo mode.
 * Keywords: sudo, verify, credentials, controller, auth
 */
export const verifySudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, password, totpCode, passkeyResponse, response, challengeId } = req.body;
  const actualPasskeyResponse = passkeyResponse || response;
  const actualType = type || (actualPasskeyResponse ? 'passkey' : undefined);
  const userId = req.user!.userId;
  const sessionId = req.user!.sessionId;

  try {
    let input: VerifyInput;
    if (actualType === 'password') {
      input = { type: 'password', password };
    } else if (actualType === 'totp') {
      input = { type: 'totp', totpCode };
    } else if (actualType === 'passkey') {
      input = { type: 'passkey', passkeyResponse: actualPasskeyResponse, challengeId };
    } else {
      res.status(400).json({ error: 'ERR_INVALID_SUDO_TYPE' });
      return;
    }

    await sudoApplicationService.verify(userId, sessionId, input);
    res.json({ message: 'Sudo mode activated' });
  } catch (error: any) {
    console.error('Sudo verification error:', error);
    if (error.message.startsWith('ERR_')) {
      const statusCode = error.message.includes('NOT_FOUND') ? 404 : 400;
      res.status(statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR' });
    }
  }
};

/**
 * Callers: [user router]
 * Callees: [sudoApplicationService.check]
 * Description: Checks if the current session has active sudo mode.
 * Keywords: sudo, check, session, controller, auth
 */
export const checkSudo = async (req: AuthRequest, res: Response): Promise<void> => {
  const isSudo = await sudoApplicationService.check(req.user!.sessionId);
  res.json({ isSudo });
};

