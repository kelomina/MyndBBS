import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { handleOidcCallback, renderSilentCheckPage, startOidcLogin } from '../controllers/oidcAuth';
import { getClientIp } from '../lib/rateLimit';

const router: Router = Router();

const oidcLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  keyGenerator: getClientIp,
  validate: { ip: false, xForwardedForHeader: false },
  message: { error: 'ERR_TOO_MANY_OIDC_LOGIN_ATTEMPTS_FROM_THIS_IP_PLEASE_TRY_AGAIN_LATER' },
});

router.get('/start', oidcLoginLimiter, startOidcLogin);
router.get('/silent-check', oidcLoginLimiter, renderSilentCheckPage);
router.get('/callback', oidcLoginLimiter, handleOidcCallback);

export default router;
