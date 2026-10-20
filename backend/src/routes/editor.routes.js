'use strict';
// Editor namespace — mirrors editor/shared/api.js DroboardAPI contracts.
const { z } = require('zod');
const ctrl = require('../controllers/editor.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.use(requireAuth, requireRole('senior_editor', 'chief_editor', 'admin'));

const id = z.string().min(1).max(120);
const q = { q: z.string().max(80).optional(), status: z.string().max(30).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional() };
const anyBody = z.object({}).catchall(z.unknown());

router.get('/stats', generalLimiter, ctrl.stats);
router.get('/activity', generalLimiter, ctrl.activity);
router.get('/logs', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.logs);

function crud(path, name) {
  router.get(path, generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res(name).list);
  router.post(path, writeLimiter, audit('editor.' + name + '.create'),
    validate(z.object({ body: anyBody })), ctrl.res(name).create);
  router.get(path + '/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.res(name).get);
  router.patch(path + '/:id', writeLimiter, audit('editor.' + name + '.update'),
    validate(z.object({ params: z.object({ id }), body: anyBody })), ctrl.res(name).update);
  router.delete(path + '/:id', writeLimiter, audit('editor.' + name + '.delete'),
    validate(z.object({ params: z.object({ id }) })), ctrl.res(name).remove);
}

crud('/announcements', 'announcements');
crud('/messages', 'messages');
crud('/verifications', 'verifications');
crud('/authors', 'authors');
crud('/books', 'books');
crud('/categories', 'categories');
crud('/genres', 'genres');
crud('/templates', 'templates');
crud('/contracts', 'contracts');
crud('/banners', 'banners');
crud('/payments', 'payments');
crud('/settings', 'settings');
crud('/promotions', 'promotions');
crud('/reports', 'reports');
crud('/withdrawals', 'withdrawals');

// reviews + approve/reject (book-review-center contract)
crud('/reviews', 'reviews');
crud('/book-reviews', 'reviews');
router.post('/reviews/:id/approve', writeLimiter, audit('editor.reviews.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('reviews').approve);
router.post('/reviews/:id/reject', writeLimiter, audit('editor.reviews.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('reviews').reject);
router.post('/verifications/:id/approve', writeLimiter, audit('editor.verifications.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('verifications').approve);
router.post('/verifications/:id/reject', writeLimiter, audit('editor.verifications.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('verifications').reject);
router.post('/withdrawals/:id/approve', requireRole('finance', 'admin'), audit('editor.withdrawals.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('withdrawals').approve);
router.post('/withdrawals/:id/reject', requireRole('finance', 'admin'), audit('editor.withdrawals.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('withdrawals').reject);

// notifications (editor scope — only the requesting editor's own rows)
router.get('/notifications', generalLimiter, async (req, res) => {
  const base = require('../controllers/base.controller');
  const { Notification } = require('../models/social.model');
  return base.wrap(res, async () => Notification.find({ recipientId: String(req.user.id) }).sort({ createdAt: -1 }).limit(50).lean());
});
router.post('/notifications/mark-read', writeLimiter, ctrl.markNotificationsRead);

// system pages (content blobs under platform settings)
router.get('/system-pages/:key', generalLimiter,
  validate(z.object({ params: z.object({ key: z.string().min(1).max(60) }) })),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    const { PlatformSetting } = require('../models/platform.model');
    return base.wrap(res, async () => PlatformSetting.findOne({ key: 'system-pages:' + req.valid.params.key }).lean());
  });

module.exports = router;
