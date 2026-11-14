import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuthenticatedUser } from '../middleware/authenticate.js';
import { ensureCsrfToken, requireCsrf, requireSameOrigin } from '../middleware/security.js';
import {
  currentUser, getApplicationConfig, googleSignIn, logout, privateProfile,
} from '../auth/auth.controller.js';

const router = Router();
const googleLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' },
});

router.get('/config', getApplicationConfig);
router.get('/auth/csrf', ensureCsrfToken);
router.post('/auth/google', requireSameOrigin, requireCsrf, googleLoginLimiter, googleSignIn);
router.get('/auth/me', currentUser);
router.post('/auth/logout', requireSameOrigin, requireCsrf, logout);
router.get('/private/profile', requireAuthenticatedUser, privateProfile);

export { router as authRouter };
