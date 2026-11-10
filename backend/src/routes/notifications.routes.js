'use strict';
const { z } = require('zod');
const base = require('../controllers/base.controller');
const notifications = require('../services/notifications.service');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// notification-service + notification-page-service contracts
router.get('/', requireAuth, generalLimiter,
  validate(z.object({ query: z.object({
    unread: z.string().max(5).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => notifications.list(Object.assign({ userId: req.user.id }, req.valid.query))));

// The signed-in user raises a notification about their own account (a poll
// that closed, a 24h status report). The recipient is always the caller and
// only the self-observable types are accepted.
const selfNotificationBody = z.object({
  type: z.string().max(60),
  title: z.string().max(300).optional(),
  desc: z.string().max(600).optional(),
  link: z.string().max(400).optional(),
  key: z.string().max(160).optional(),
  audience: z.enum(['reader', 'author', 'both']).optional(),
  metrics: z.array(z.object({
    label: z.string().max(60), value: z.string().max(60), delta: z.string().max(60).optional(),
  }).strict()).max(8).optional(),
  chips: z.array(z.string().max(120)).max(8).optional(),
  badge: z.string().max(30).optional(),
  medal: z.string().max(30).optional(),
  cover: z.string().max(2800).optional(),
  avatar: z.string().max(2800).optional(),
  thumb: z.string().max(2800).optional(),
  rank: z.number().optional(),
  rankNote: z.string().max(120).optional(),
  iconName: z.string().max(60).optional(),
  tier: z.string().max(60).optional(),
  tierClass: z.string().max(60).optional(),
  color: z.string().max(40).optional(),
  count: z.number().optional(),
  linkLabel: z.string().max(120).optional(),
  // The avatar tint travels with the row. Colours are constrained to hex /
  // rgb so a client can never inject arbitrary CSS into the inline style.
  icon: z.object({
    name: z.string().regex(/^[a-z0-9 -]{1,40}$/i).optional(),
    bg: z.string().regex(/^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s,.%]{1,40}\)$/).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s,.%]{1,40}\)$/).optional(),
  }).strict().optional(),
}).strict();

router.post('/', requireAuth, writeLimiter,
  validate(z.object({ body: selfNotificationBody })),
  async (req, res) => base.wrap(res, async () => notifications.createSelf({
    userId: req.user.id, body: req.valid.body,
  })));

router.get('/unread-count', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => notifications.unreadCount(req.user.id)));

router.post('/read', requireAuth, writeLimiter,
  validate(z.object({ body: z.object({ id: z.string().max(40).optional() }).strict() })),
  async (req, res) => base.wrap(res, async () => notifications.markRead({ userId: req.user.id, id: req.valid.body.id })));

// notification-store.js contracts (USE_API wiring)
router.post('/read-all', requireAuth, writeLimiter,
  async (req, res) => base.wrap(res, async () => notifications.markRead({ userId: req.user.id })));

router.patch('/:id', requireAuth, writeLimiter,
  validate(z.object({
    params: z.object({ id: z.string().max(40) }),
    body: z.object({ read: z.boolean().optional(), deleted: z.boolean().optional() }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => notifications.patchOne({
    userId: req.user.id, id: req.valid.params.id, read: req.valid.body.read, deleted: req.valid.body.deleted,
  })));

router.get('/settings', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => notifications.getSettings(req.user.id)));

router.put('/settings', requireAuth, writeLimiter,
  validate(z.object({ body: z.record(z.any()) })),
  async (req, res) => base.wrap(res, async () => notifications.saveSettings({ userId: req.user.id, body: req.valid.body })));

module.exports = router;
