'use strict';
const { z } = require('zod');
const engagement = require('../services/engagement.service');
const base = require('../controllers/base.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, writeLimiter } = require('../middleware/http');

// One share endpoint for every content family. The client always sends WHAT it
// shared (contentId + contentType); the server resolves that document by id and
// bumps its own persisted counter — no client-supplied counts, no demo paths.
const router = require('express').Router();

const shareBody = z.object({
  contentId: z.string().min(1).max(120),
  contentType: z.enum(engagement.SHARE_TYPES),
  // Copy is a share too: the reader sent the link somewhere. status/profile are
  // the in-app destinations the same sheet posts to.
  channel: z.enum(engagement.SHARE_CHANNELS).default('copy'),
}).strict();

router.post('/', requireAuth, writeLimiter, audit('share.create'),
  validate(z.object({ body: shareBody })),
  (req, res) => base.wrap(res, () => engagement.shareContent({
    contentType: req.valid.body.contentType,
    contentId: req.valid.body.contentId,
    channel: req.valid.body.channel,
    userId: req.user.id,
  })));

module.exports = router;
