'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/posts.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const postBody = z.object({
  type: z.enum(['announcement', 'post', 'debate', 'shoutout', 'repost', 'poll', 'forum-poll', 'ama', 'review', 'recommendation', 'quote', 'chapter-drop']),
  title: z.string().max(160).optional(),
  text: z.string().max(10000).optional(),
  note: z.string().max(2000).optional(),
  image: z.string().max(1000).optional(),
  poll: z.object({
    q: z.string().min(1).max(300),
    opts: z.array(z.string().min(1).max(120)).min(2).max(4),
  }).optional(),
  debateData: z.object({ motion: z.string().min(1).max(500) }).optional(),
  shoutout: z.object({ userId: z.string().min(1).max(40), tagline: z.string().max(300).optional() }).optional(),
  storyRef: z.object({
    title: z.string().min(1).max(160), cat: z.string().max(40).optional(),
    writer: z.string().max(80).optional(), cover: z.string().max(500).optional(),
  }).optional(),
}).strict().refine(d => d.title || d.text || d.image || d.poll || d.shoutout || d.storyRef, { message: 'empty_post' });

router.get('/', generalLimiter, (req, _res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (token) {
      const jwt = require('jsonwebtoken');
      const env = require('../config/env');
      const p = jwt.verify(token, env.jwtAccessSecret);
      req.user = { id: p.sub, roles: p.roles || [] };
    }
  } catch (e) { /* anonymous */ }
  next();
}, validate(z.object({ query: z.object({
  tab: z.string().max(20).optional(), type: z.string().max(20).optional(),
  authorId: z.string().max(40).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('posts.create'),
  validate(z.object({ body: postBody })), ctrl.create);

router.get('/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.get);
router.patch('/:id', requireAuth, writeLimiter, audit('posts.update'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      title: z.string().max(160).optional(), text: z.string().max(10000).optional(),
      image: z.string().max(1000).optional(), pinned: z.boolean().optional(),
    }).strict(),
  })), ctrl.update);
router.delete('/:id', requireAuth, writeLimiter, audit('posts.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

router.post('/:id/like', requireAuth, writeLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.like);
router.post('/:id/save', requireAuth, writeLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.save);
router.post('/:id/poll/vote', requireAuth, writeLimiter, audit('posts.pollVote'),
  validate(z.object({ params: z.object({ id }), body: z.object({ option: z.number().int().min(0).max(10) }).strict() })), ctrl.pollVote);
router.post('/:id/debate/vote', requireAuth, writeLimiter, audit('posts.debateVote'),
  validate(z.object({ params: z.object({ id }), body: z.object({ side: z.enum(['for', 'against']) }).strict() })), ctrl.debateVote);

const rid = z.string().min(1).max(40);
router.get('/:id/reactions', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.reactions);
router.post('/:id/react', requireAuth, writeLimiter, audit('posts.react'),
  validate(z.object({ params: z.object({ id }), body: z.object({ rid }).strict() })), ctrl.react);
router.delete('/:id/react', requireAuth, writeLimiter, audit('posts.unreact'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unreact);
router.post('/:id/share', requireAuth, writeLimiter, audit('posts.share'),
  validate(z.object({ params: z.object({ id }), body: z.object({ channel: z.string().min(1).max(30) }).strict() })), ctrl.share);

module.exports = router;
