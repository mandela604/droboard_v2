'use strict';
const svc = require('../services/debate-args.service');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();
const { z } = require('zod');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

const id = z.string().min(1).max(120);

// GET  /api/posts/:postId/debate/args?side=for|against|all&sort=top|new
router.get('/posts/:postId/debate/args', generalLimiter, optionalAuth,
  validate(z.object({
    params: z.object({ postId: id }),
    query: z.object({
      side: z.enum(['for', 'against', 'all']).optional(),
      sort: z.enum(['top', 'new']).optional(),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => svc.listArgs({
    postId: req.valid.params.postId,
    side: req.valid.query.side,
    sort: req.valid.query.sort,
    viewerId: req.user && req.user.id,
  })));

// POST /api/posts/:postId/debate/args {text, side, parentId?}
router.post('/posts/:postId/debate/args', requireAuth, writeLimiter, audit('debate.args.create'),
  validate(z.object({
    params: z.object({ postId: id }),
    body: z.object({
      text: z.string().min(1).max(2000),
      side: z.enum(['for', 'against']).optional(),
      parentId: z.string().max(120).optional(),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => {
    const card = await svc.createArg({
      postId: req.valid.params.postId,
      userId: req.user.id,
      text: req.valid.body.text,
      side: req.valid.body.side,
      parentId: req.valid.body.parentId,
    });
    res.status(201);
    return card;
  }));

// POST /api/debate/args/:id/vote {vote: 1|-1|'up'|'down'|null}
router.post('/debate/args/:id/vote', requireAuth, writeLimiter, audit('debate.args.vote'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      vote: z.union([z.literal(1), z.literal(-1), z.literal(0), z.literal('up'), z.literal('down'), z.literal('clear'), z.null()]),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => svc.voteArg({
    id: req.valid.params.id, userId: req.user.id, vote: req.valid.body.vote,
  })));

// PATCH /api/debate/args/:id {text, side?}
router.patch('/debate/args/:id', requireAuth, writeLimiter, audit('debate.args.edit'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      text: z.string().min(1).max(2000),
      side: z.enum(['for', 'against']).optional(),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => svc.editArg({
    id: req.valid.params.id, userId: req.user.id,
    text: req.valid.body.text, side: req.valid.body.side,
  })));

// DELETE /api/debate/args/:id
router.delete('/debate/args/:id', requireAuth, writeLimiter, audit('debate.args.delete'),
  validate(z.object({ params: z.object({ id }) })),
  async (req, res) => base.wrap(res, async () => svc.deleteArg({
    id: req.valid.params.id, user: req.user,
  })));

module.exports = router;
