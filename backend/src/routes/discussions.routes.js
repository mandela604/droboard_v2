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
// Genre-hub composer sends TitleCase tags ('Discussion','Theory'…) — the
// service lowercases; enum values are the source of truth.
const tag = z.enum(['discussion', 'recommendation', 'theory', 'question', 'controversial']);
const tagIn = z.string().max(30).transform(v => String(v || '').toLowerCase().trim());
// optional linked story from the hub composer's story picker
const storyIn = z.object({
  id: z.string().max(40).optional(), title: z.string().max(160).optional(),
  writer: z.string().max(80).optional(), author: z.string().max(80).optional(),
  cover: z.string().max(500).optional(), cat: z.string().max(40).optional(),
  genre: z.string().max(40).optional(),
}).passthrough().optional();

router.get('/', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({
    genre: slug, tag: tagIn.optional(),
    sort: z.enum(['new', 'top', 'hot']).optional(),
    page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('discussions.create'),
  validate(z.object({ body: z.object({
    genre: slug, title: z.string().min(1).max(200),
    body: z.string().max(8000).optional(), tag: tagIn.optional(),
    media: z.string().max(2800000).optional(),
    trope: z.string().max(60).optional(),
    story: storyIn,
  }).passthrough() })), ctrl.create);

router.get('/:id', generalLimiter, optionalAuth,
  validate(z.object({ params: z.object({ id }) })), ctrl.get);

router.patch('/:id', requireAuth, writeLimiter, audit('discussions.update'),
  validate(z.object({ params: z.object({ id }), body: z.object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().max(8000).optional(), tag: tagIn.optional(),
    media: z.string().max(2800000).optional(),
    trope: z.string().max(60).optional(),
    story: storyIn,
  }).passthrough() })), ctrl.update);

router.delete('/:id', requireAuth, writeLimiter, audit('discussions.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

router.post('/:id/like', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.like);

module.exports = router;
