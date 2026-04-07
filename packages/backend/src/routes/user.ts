import { Router, Router as ExpressRouter } from 'express';
import { updateProfile, getSessions, revokeSession, getProfile, getPasskeys, deletePasskey, disableTotp, generatePasskeyOptions, verifyPasskey, generateTotp, verifyTotp, getPublicProfile } from '../controllers/user';
import { requireAuth } from '../middleware/auth';

const router: ExpressRouter = Router();

// Public routes
router.get('/public/:username', getPublicProfile);

// All other user routes require authentication
router.use(requireAuth);

// Profile Management
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Security Settings
router.get('/passkeys', getPasskeys);
router.delete('/passkeys/:id', deletePasskey);
router.get('/passkey/generate-registration-options', generatePasskeyOptions);
router.post('/passkey/verify-registration', verifyPasskey);

router.post('/totp/disable', disableTotp);
router.post('/totp/generate', generateTotp);
router.post('/totp/verify', verifyTotp);

// Session Management
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);

export default router;
