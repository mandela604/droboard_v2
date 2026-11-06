'use strict';
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const base = require('../controllers/base.controller');
const svc = require('../services/genres.service');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const slug = z.string().min(1).max(120);
const pg = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

function optionalAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (!token) return next();
    const env = require('../config/env');
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [] };
  } catch (e) { /* anonymous */ }
  return next();
}

// Boards explorer: every board is the category the CE created.
// joined=me narrows to the reader's own boards; rows always carry isJoined.
router.get('/', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({
    q: z.string().max(80).optional(), page: pg.page, limit: pg.limit,
    joined: z.enum(['me']).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => svc.listCategories(Object.assign({}, req.valid.query, { viewerId: req.user && req.user.id }))));

router.get('/:slug', generalLimiter, optionalAuth,
  validate(z.object({ params: z.object({ slug }) })),
  async (req, res) => base.wrap(res, async () => svc.categoryHub(req.valid.params.slug, req.user && req.user.id)));

router.get('/:slug/stories', generalLimiter,
  validate(z.object({
    params: z.object({ slug }),
    query: z.object({ page: pg.page, limit: pg.limit, sort: z.enum(['top', 'new', 'rising', 'recent', 'reads', 'likes', 'rating']).optional() }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => svc.categoryStories(req.valid.params.slug, req.valid.query)));

// The board's Members tab is the same parent-only membership list, reachable by
// the board's own slug — no genre detour needed for a category.
router.get('/:slug/members', generalLimiter, optionalAuth,
  validate(z.object({
    params: z.object({ slug }),
    query: z.object({ page: pg.page, limit: pg.limit }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => svc.genreMembers(req.valid.params.slug, Object.assign({}, req.valid.query, { viewerId: req.user && req.user.id }))));

router.post('/:slug/join', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ slug }) })),
  async (req, res) => base.wrap(res, async () => svc.joinCategory(req.user.id, req.valid.params.slug)));

router.delete('/:slug/join', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ slug }) })),
  async (req, res) => base.wrap(res, async () => svc.leaveCategory(req.user.id, req.valid.params.slug)));

module.exports = router;
