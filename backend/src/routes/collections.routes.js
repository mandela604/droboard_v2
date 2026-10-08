'use strict';
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const ctrl = require('../controllers/collections.controller');
const { requireAuth } = require('../middleware/auth');
const env = require('../config/env');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

/* optional auth: personalized (following/isOwner/private) when logged in,
   public view when anonymous */
function softAuth(req, _res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ')
    ? hdr.slice(7)
    : (req.cookies && req.cookies.dro_access) || null;
  if (token) {
    try {
      const p = jwt.verify(token, env.jwtAccessSecret);
      req.user = { id: p.sub, roles: p.roles || [] };
    } catch (e) { /* anonymous */ }
  }
  return next();
}

const id = z.string().min(1).max(120);
const storyRef = z.string().min(1).max(120);
const privacy = z.enum(['public', 'private', 'followers']);
const colBody = z.object({
  title: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  sub: z.string().max(200).optional(),
  about: z.string().max(2000).optional(),
  cover: z.string().max(500).optional(),
  icon: z.string().max(40).optional(),
  privacy: z.union([privacy, z.enum(['Public', 'Private', 'Followers'])]).optional(),
  genres: z.array(z.string().max(30)).max(10).optional(),
  stories: z.array(storyRef).max(200).optional(),
}).strict().refine(b => (b.title && b.title.trim()) || (b.name && b.name.trim()), { message: 'name_required' });
const colPatch = z.object({
  title: z.string().min(1).max(120).optional(),
  name: z.string().min(1).max(120).optional(),
  sub: z.string().max(200).optional(),
  about: z.string().max(2000).optional(),
  cover: z.string().max(500).optional(),
  icon: z.string().max(40).optional(),
  privacy: z.union([privacy, z.enum(['Public', 'Private', 'Followers'])]).optional(),
  genres: z.array(z.string().max(30)).max(10).optional(),
  stories: z.array(storyRef).max(200).optional(),
}).strict();

router.get('/', generalLimiter, softAuth, validate(z.object({ query: z.object({
  q: z.string().max(80).optional(), ownerId: z.string().max(120).optional(),
  owner: z.string().max(120).optional(), followed: z.string().max(5).optional(),
  privacy: z.union([privacy, z.enum(['Public', 'Private', 'Followers'])]).optional(),
  genre: z.string().max(30).optional(), sort: z.enum(['newest', 'popular', 'stories', 'oldest']).optional(),
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('collections.create'),
  validate(z.object({ body: colBody })), ctrl.create);

router.get('/eligible-stories', requireAuth, generalLimiter, ctrl.eligible);

router.get('/:id', generalLimiter, softAuth, validate(z.object({ params: z.object({ id }) })), ctrl.get);
router.patch('/:id', requireAuth, writeLimiter, audit('collections.update'),
  validate(z.object({ params: z.object({ id }), body: colPatch })), ctrl.update);
router.delete('/:id', requireAuth, writeLimiter, audit('collections.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

// frontend collection-service contract
router.get('/:id/stories', generalLimiter, softAuth, validate(z.object({ params: z.object({ id }) })), ctrl.stories);
router.post('/:id/stories', requireAuth, writeLimiter, audit('collections.addStory'),
  validate(z.object({ params: z.object({ id }), body: z.object({ storyId: z.string().min(1).max(120) }).strict() })), ctrl.addStory);
router.delete('/:id/stories/:storyId', requireAuth, writeLimiter, audit('collections.removeStory'),
  validate(z.object({ params: z.object({ id, storyId: z.string().min(1).max(120) }) })), ctrl.removeStory);

// follow / share (collection page buttons)
router.post('/:id/follow', requireAuth, writeLimiter, audit('collections.follow'),
  validate(z.object({ params: z.object({ id }) })), ctrl.follow);
router.delete('/:id/follow', requireAuth, writeLimiter, audit('collections.unfollow'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unfollow);
router.post('/:id/share', requireAuth, writeLimiter, audit('collections.share'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ channel: z.string().max(30).optional() }).strict().optional(),
  })), ctrl.share);

module.exports = router;
