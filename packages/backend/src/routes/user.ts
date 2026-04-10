import { Router, Router as ExpressRouter } from 'express';
import { updateProfile, getSessions, revokeSession, getProfile, getPasskeys, deletePasskey, disableTotp, generatePasskeyOptions, verifyPasskey, generateTotp, verifyTotp, getPublicProfile, getBookmarkedPosts } from '../controllers/user';
import { getSudoPasskeyOptions, verifySudo, checkSudo } from '../controllers/sudo';
import { requireSudo } from '../middleware/auth';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router: ExpressRouter = Router();

// Public routes
router.get('/public/:username', optionalAuth, getPublicProfile);

// All other user routes require authentication
router.use(requireAuth);

// Sudo routes
router.get('/sudo/check', checkSudo);
router.get('/sudo/passkey-options', getSudoPasskeyOptions);
router.post('/sudo/verify', verifySudo);


// Profile Management
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Bookmarks
router.get('/bookmarks', getBookmarkedPosts);

// Security Settings
router.get('/passkeys', getPasskeys);
router.delete('/passkeys/:id', requireSudo, deletePasskey);
router.get('/passkey/generate-registration-options', requireSudo, generatePasskeyOptions);
router.post('/passkey/verify-registration', requireSudo, verifyPasskey);

router.post('/totp/disable', requireSudo, disableTotp);
router.post('/totp/generate', requireSudo, generateTotp);
router.post('/totp/verify', requireSudo, verifyTotp);

// Session Management
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);

export default router;
