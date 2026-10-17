'use strict';
// Genre-hub discussion threads: list per hub (genre or category slug),
// create/read/update/delete, toggle like. Replies are plain comments with
// scope=discussion (see comments.routes) — commentsCount syncs from there.
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const ctrl = require('../controllers/discussions.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

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

const id = z.string().min(1).max(120);
const slug = z.string().min(1).max(120);
const tag = z.enum(['discussion', 'recommendation', 'theory', 'question', 'controversial']);

router.get('/', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({
    genre: slug, tag: tag.optional(),
    sort: z.enum(['new', 'top', 'hot']).optional(),
    page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('discussions.create'),
  validate(z.object({ body: z.object({
    genre: slug, title: z.string().min(1).max(200),
    body: z.string().max(8000).optional(), tag: tag.optional(),
    media: z.string().max(2800000).optional(),
  }).strict() })), ctrl.create);

router.get('/:id', generalLimiter, optionalAuth,
  validate(z.object({ params: z.object({ id }) })), ctrl.get);

router.patch('/:id', requireAuth, writeLimiter, audit('discussions.update'),
  validate(z.object({ params: z.object({ id }), body: z.object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().max(8000).optional(), tag: tag.optional(),
    media: z.string().max(2800000).optional(),
  }).strict() })), ctrl.update);

router.delete('/:id', requireAuth, writeLimiter, audit('discussions.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

router.post('/:id/like', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.like);

module.exports = router;
