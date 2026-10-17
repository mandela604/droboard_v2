'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/comments.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const commentBody = z.object({
  scope: z.enum(['story', 'chapter', 'post', 'discussion']),
  storyId: z.string().max(40).optional(),
  chapterId: z.string().max(40).optional(),
  postId: z.string().max(40).optional(),
  discussionId: z.string().max(40).optional(),
  parentId: z.string().max(40).optional(),
  team: z.string().max(40).optional(),
  text: z.string().min(1).max(2000),
}).strict();

router.get('/', generalLimiter, validate(z.object({ query: z.object({
  scope: z.enum(['story', 'chapter', 'post', 'discussion']).optional(),
  storyId: z.string().max(40).optional(), chapterId: z.string().max(40).optional(),
  postId: z.string().max(40).optional(), discussionId: z.string().max(40).optional(),
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), ctrl.list);

router.post('/', requireAuth, writeLimiter, audit('comments.create'),
  validate(z.object({ body: commentBody })), ctrl.create);

router.get('/:id/replies', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.replies);
router.post('/:id/like', requireAuth, writeLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.like);
router.patch('/:id', requireAuth, writeLimiter, audit('comments.update'),
  validate(z.object({ params: z.object({ id }), body: z.object({ text: z.string().min(1).max(2000) }).strict() })), ctrl.update);
router.post('/:id/react', requireAuth, writeLimiter, audit('comments.react'),
  validate(z.object({ params: z.object({ id }), body: z.object({ rid: z.string().min(1).max(40) }).strict() })), ctrl.react);
router.delete('/:id/react', requireAuth, writeLimiter, audit('comments.unreact'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unreact);
router.delete('/:id', requireAuth, writeLimiter, audit('comments.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

module.exports = router;
