'use strict';
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const base = require('../controllers/base.controller');
const users = require('../services/users.service');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const handle = z.string().min(1).max(80);
const pg = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

// Optional auth for public profile (privacy + isFollowing).
function optionalAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ')
      ? hdr.slice(7)
      : (req.cookies && req.cookies.dro_access) || null;
    if (!token) return next();
    const env = require('../config/env');
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [], mfaAt: p.mfaAt || null };
    return next();
  } catch (e) { return next(); }
}

// FIX 7: paged public search — must sit before /:handle.
router.get('/', generalLimiter,
  validate(z.object({ query: z.object({ q: z.string().max(80).optional(), page: pg.page, limit: pg.limit }).strict() })),
  async (req, res) => base.wrap(res, async () => users.searchUsers(req.valid.query)));

router.get('/me', requireAuth, async (req, res) =>
  base.wrap(res, async () => users.me(req.user.id)));

// FIX 1: self-update.
router.patch('/me', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({
    fullName: z.string().min(2).max(80).optional(),
    name: z.string().min(2).max(80).optional(),
    username: z.string().min(3).max(24).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(120).optional(),
    country: z.string().max(56).optional(),
    locale: z.string().max(10).optional(),
    avatar: z.string().max(2800000).optional(),
    cover: z.string().max(2800000).optional(),
    about: z.any().optional(),
    genres: z.array(z.string().max(40)).max(6).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => users.updateMe(req.user.id, req.valid.body)));

// FIX 2a: change password.
router.post('/me/password', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({
    oldPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => users.changePassword(req.user.id, req.valid.body)));

// FIX 2b: request + confirm email change.
router.post('/me/email/request', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({
    newEmail: z.string().email().max(160),
    password: z.string().max(128).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => users.requestEmailChange(req.user.id, req.valid.body)));

router.post('/me/email/confirm', writeLimiter,
  validate(z.object({ body: z.object({ token: z.string().min(10) }).strict() })),
  async (req, res) => base.wrap(res, async () => users.confirmEmailChange(req.valid.body.token)));

// FIX 3: self deactivation.
router.delete('/me', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({ password: z.string().max(128).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => users.deleteMe(req.user.id, req.valid.body || {})));

// FIX 5: settings.
router.get('/me/settings', requireAuth, async (req, res) =>
  base.wrap(res, async () => users.getSettings(req.user.id)));

router.patch('/me/settings', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    notifications: z.boolean().optional(),
    privacy: z.enum(['public', 'private']).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => users.updateSettings(req.user.id, req.valid.body)));

// FIX 6: blocks / mutes.
router.get('/me/blocks', requireAuth, async (req, res) =>
  base.wrap(res, async () => users.listBlocks(req.user.id)));

router.get('/me/mutes', requireAuth, async (req, res) =>
  base.wrap(res, async () => users.listMutes(req.user.id)));

router.post('/:handle/block', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.blockUser({ userId: req.user.id, target: req.valid.params.handle })));

router.delete('/:handle/block', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.unblockUser({ userId: req.user.id, target: req.valid.params.handle })));

router.post('/:handle/mute', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.muteUser({ userId: req.user.id, target: req.valid.params.handle })));

router.delete('/:handle/mute', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.unmuteUser({ userId: req.user.id, target: req.valid.params.handle })));

router.get('/:handle', generalLimiter, optionalAuth,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.profile(req.valid.params.handle, req.user && req.user.id)));

// followers-service contract: GET /api/users/:handle/followers?page=&q=&filter=
router.get('/:handle/followers', generalLimiter,
  validate(z.object({ params: z.object({ handle }), query: z.object({ page: pg.page, limit: pg.limit, q: z.string().max(80).optional(), filter: z.string().max(20).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => users.followersOf(req.valid.params.handle, req.valid.query)));

router.get('/:handle/following', generalLimiter,
  validate(z.object({ params: z.object({ handle }), query: z.object({ page: pg.page, limit: pg.limit, q: z.string().max(80).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => users.followingOf(req.valid.params.handle, req.valid.query)));

router.post('/:handle/follow', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.follow({ userId: req.user.id, target: req.valid.params.handle })));

router.delete('/:handle/follow', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ handle }) })),
  async (req, res) => base.wrap(res, async () => users.unfollow({ userId: req.user.id, target: req.valid.params.handle })));

module.exports = router;
