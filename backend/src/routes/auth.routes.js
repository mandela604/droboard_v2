'use strict';
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, generalLimiter } = require('../middleware/http');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// Caps signups per IP. 30/hour default (env SIGNUP_RATE_MAX): tight enough
// to kill bot farms, loose enough for a campus/cafe/carrier NAT where many
// real people share one exit IP. Over-limit → 429 until the window rolls;
// it never "locks" the network — logins and everything else keep working.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Math.max(5, parseInt(process.env.SIGNUP_RATE_MAX, 10) || 30),
  standardHeaders: true, legacyHeaders: false,
});

const email = z.string().email().max(160);
const password = z.string().min(8).max(128);

// Accepts both API ({fullName}) and web ({name, country}) signup payloads.
// Honeypot: real users never send `website` — bots filling hidden fields
// fail validation (length 0) before touching the service.
const registerBody = z.object({
  fullName: z.string().min(2).max(80).optional(),
  name: z.string().min(2).max(80).optional(),
  username: z.string().min(3).max(24).regex(/^[a-z0-9_.]+$/i),
  email, password,
  country: z.string().max(56).optional(),
  referralCode: z.string().max(16).optional(),
  website: z.string().length(0).optional(),
}).refine(v => v.fullName || v.name, { message: 'fullName or name required' });

router.post('/register', signupLimiter, validate(z.object({ body: registerBody })), ctrl.register);

// frontend signup-service calls /api/auth/signup
router.post('/signup', signupLimiter, validate(z.object({ body: registerBody })), ctrl.register);

router.get('/verify-email', validate(z.object({ query: z.object({ token: z.string().min(10) }) })), ctrl.verifyEmail);

router.post('/password/forgot', authLimiter, validate(z.object({ body: z.object({
  email,
}) })), ctrl.forgotPassword);

// frontend forgot-password-service contract
router.post('/forgot-password', authLimiter, validate(z.object({ body: z.object({
  email,
}) })), ctrl.forgotPassword);

router.post('/password/reset', authLimiter, validate(z.object({ body: z.object({
  token: z.string().min(10), password,
}) })), ctrl.resetPassword);

// frontend reset-password-service contracts
router.post('/reset-password', authLimiter, validate(z.object({ body: z.object({
  token: z.string().min(10), password,
}) })), ctrl.resetPassword);

router.get('/reset-password/validate', validate(z.object({ query: z.object({
  token: z.string().min(10),
}) })), async (req, res) => {
  const base = require('../controllers/base.controller');
  const { User } = require('../models/user.model');
  const crypto = require('crypto');
  return base.wrap(res, async () => {
    const h = crypto.createHash('sha256').update(String(req.valid.query.token)).digest('hex');
    const ok = await User.exists({ resetTokenHash: h, resetExpiresAt: { $gt: new Date() } });
    return { valid: !!ok };
  });
});

router.post('/login', authLimiter, validate(z.object({ body: z.object({
  emailOrUsername: z.string().min(3).max(160).optional(),
  email: z.string().min(3).max(160).optional(),
  password: z.string().min(1).max(128),
}).refine(v => v.emailOrUsername || v.email, { message: 'emailOrUsername or email required' }) })), ctrl.login);

router.post('/mfa/verify', authLimiter, validate(z.object({ body: z.object({
  ticket: z.string().min(10), code: z.string().min(4).max(12),
}) })), ctrl.mfaVerify);

router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

// Google OAuth: web code-flow + app/GIS idToken — same session pipeline as login.
router.get('/google/url', generalLimiter, validate(z.object({ query: z.object({
  mode: z.enum(['login', 'signup']).optional(),
  referralCode: z.string().max(16).optional(),
  redirectUri: z.string().max(500).optional(),
}).strict() })), ctrl.googleUrl);

router.post('/google/callback', authLimiter, validate(z.object({ body: z.object({
  code: z.string().min(5).max(2000).optional(),
  idToken: z.string().min(20).max(8000).optional(),
  redirectUri: z.string().max(500).optional(),
  codeVerifier: z.string().max(256).optional(),
  referralCode: z.string().max(16).optional(),
  mode: z.enum(['login', 'signup']).optional(),
}).refine(v => v.code || v.idToken, { message: 'code or idToken required' }) })), ctrl.googleCallback);

router.post('/mfa/enroll', requireAuth, ctrl.mfaEnroll);
router.post('/mfa/confirm', requireAuth, validate(z.object({ body: z.object({
  code: z.string().min(4).max(12),
}) })), audit('mfa.enroll'), ctrl.mfaConfirm);

// FIX 8: resend verification (authed or email body, no enumeration).
router.post('/resend-verification', authLimiter, validate(z.object({ body: z.object({
  email: z.string().email().max(160).optional(),
}).strict() })), ctrl.resendVerification);

router.post('/verify-email/resend', authLimiter, validate(z.object({ body: z.object({
  email: z.string().email().max(160).optional(),
}).strict() })), ctrl.resendVerification);

// FIX 8: MFA management.
router.get('/mfa/status', requireAuth, ctrl.mfaStatus);
router.delete('/mfa', requireAuth, validate(z.object({ body: z.object({
  password: z.string().max(128).optional(),
  code: z.string().min(4).max(12).optional(),
}).strict() })), ctrl.mfaDisable);
router.post('/mfa/backup-codes/regenerate', requireAuth, ctrl.mfaBackupRegen);

// FIX 8: sessions.
router.get('/sessions', requireAuth, ctrl.listSessions);
router.delete('/sessions/:familyId', requireAuth, validate(z.object({
  params: z.object({ familyId: z.string().min(3).max(80) }),
})), ctrl.revokeSession);
router.delete('/sessions', requireAuth, ctrl.revokeAllSessions);

module.exports = router;
