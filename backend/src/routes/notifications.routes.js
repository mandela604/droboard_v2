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
    body: z.object({ read: z.boolean().optional() }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => notifications.patchOne({
    userId: req.user.id, id: req.valid.params.id, read: req.valid.body.read,
  })));

router.get('/settings', requireAuth, generalLimiter,
  async (req, res) => base.wrap(res, async () => notifications.getSettings(req.user.id)));

router.put('/settings', requireAuth, writeLimiter,
  validate(z.object({ body: z.record(z.any()) })),
  async (req, res) => base.wrap(res, async () => notifications.saveSettings({ userId: req.user.id, body: req.valid.body })));

module.exports = router;
