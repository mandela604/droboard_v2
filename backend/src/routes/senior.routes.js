'use strict';
// Senior-editor namespace — mirrors ONLY what the 13 sidebar menu pages call.
// Menu: dashboard, review-queue, book-management, reports-flags,
// contract-review, completion-application, chapter-edit-review,
// book-series-review, authors, invite-authors, author-verification,
// author-messages, activity-logs. Nothing else gets an endpoint here.
const { z } = require('zod');
const ctrl = require('../controllers/senior.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.use(requireAuth, requireRole('senior_editor', 'chief_editor', 'admin'));

const id = z.string().min(1).max(120);
const q = { q: z.string().max(80).optional(), status: z.string().max(30).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional() };
const anyBody = z.object({}).catchall(z.unknown());

function crud(path, name, opts) {
  opts = opts || {};
  router.get(path, generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res(name).list);
  if (opts.create !== false) {
    router.post(path, writeLimiter, audit('senior.' + name + '.create'),
      validate(z.object({ body: anyBody })), ctrl.res(name).create);
  }
  router.get(path + '/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.res(name).get);
  if (opts.decide) {
    router.post(path + '/:id/approve', writeLimiter, audit('senior.' + name + '.approve'),
      validate(z.object({ params: z.object({ id }) })), ctrl.res(name).approve);
    router.post(path + '/:id/reject', writeLimiter, audit('senior.' + name + '.reject'),
      validate(z.object({ params: z.object({ id }) })), ctrl.res(name).reject);
  }
}

router.get('/dashboard', generalLimiter, ctrl.dashboard);
router.get('/activity-logs', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.activity);
router.post('/activity-logs/export', writeLimiter, audit('senior.activity.export'),
  async (req, res) => {
    const base = require('../controllers/base.controller');
    return base.wrap(res, async () => ({ ok: true, export: 'csv' }));
  });

// review queue (shared senior-editor-data.js contract)
router.get('/review-queue', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('reviews').list);
router.put('/review-queue/:id', writeLimiter, audit('senior.reviews.decide'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ action: z.enum(['approved', 'rejected']), feedback: z.string().max(2000).optional() }).strict(),
  })), ctrl.reviewDecide);

// book management
router.get('/books', generalLimiter, validate(z.object({ query: z.object({
  tab: z.string().max(20).optional(), q: q.q, page: q.page, limit: q.limit,
}).strict() })), ctrl.res('stories').list);

// reports + settings
router.get('/reports', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('reports').list);
router.post('/reports/:id/resolve', writeLimiter, audit('senior.reports.resolve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('reports').approve);
router.post('/reports/:id/dismiss', writeLimiter, audit('senior.reports.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('reports').reject);
router.get('/reports/settings', generalLimiter, async (req, res) => {
  const base = require('../controllers/base.controller');
  const { PlatformSetting } = require('../models/platform.model');
  return base.wrap(res, async () => PlatformSetting.findOne({ key: 'reports' }).lean());
});

// contract review (page is local-demo today; backend ready)
crud('/contracts', 'contracts');
router.post('/contracts/:id/send', writeLimiter, audit('senior.contracts.send'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ ct: z.string().max(40).optional() }).strict(),
  })), ctrl.contractSend);
router.post('/contracts/:id/sign', writeLimiter, audit('senior.contracts.sign'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ pricing: z.object({}).catchall(z.unknown()).optional() }).strict(),
  })), ctrl.signContract);
router.post('/contracts/:id/reject', writeLimiter, audit('senior.contracts.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('contracts').reject);
router.put('/contracts/:id/pricing', writeLimiter, audit('senior.contracts.pricing'),
  validate(z.object({ params: z.object({ id }), body: anyBody })), async (req, res) => {
    const base = require('../controllers/base.controller');
    const { ContractPricing } = require('../models/revenue.model');
    return base.wrap(res, async () => {
      const doc = await ContractPricing.findOneAndUpdate(
        { contractId: req.valid.params.id },
        Object.assign({ contractId: req.valid.params.id }, req.valid.body),
        { upsert: true, new: true }
      ).lean();
      return doc;
    });
  });

// completion applications
crud('/completion-applications', 'completions', { create: false });
router.post('/completion-applications/:id/approve', writeLimiter, audit('senior.completions.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('completions').approve);
router.post('/completion-applications/:id/reject', writeLimiter, audit('senior.completions.reject'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('completions').reject);

// chapter edits (proposals apply content ONLY on approve)
crud('/chapter-edits', 'chapterEdits', { create: false });
router.post('/chapter-edits/:id/approve', writeLimiter, audit('senior.chapterEdits.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveChapterEdit);
router.post('/chapter-edits/:id/reject', writeLimiter, audit('senior.chapterEdits.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.rejectChapterEdit);

// book edits (description/cover/... — same approve-to-apply rule)
crud('/book-edits', 'bookEdits', { create: false });
router.post('/book-edits/:id/approve', writeLimiter, audit('senior.bookEdits.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveBookEdit);
router.post('/book-edits/:id/reject', writeLimiter, audit('senior.bookEdits.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.rejectBookEdit);

// authors + invites
router.get('/authors', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('authors').list);
router.get('/invites', generalLimiter, ctrl.res('invites').list);
router.post('/invites', writeLimiter, audit('senior.invites.create'),
  validate(z.object({ body: anyBody })), ctrl.res('invites').create);

// author verification (root service contract: index-based decide)
router.get('/author-verification/requests', generalLimiter, ctrl.verificationRequests);
router.get('/author-verification/recent-reviews', generalLimiter, ctrl.verificationRecent);
router.get('/author-verification/history', generalLimiter, ctrl.verificationHistory);
router.post('/author-verification/requests/:idx/approve', writeLimiter, audit('senior.verifications.approve'),
  validate(z.object({ params: z.object({ idx: z.string().min(1).max(10) }) })), ctrl.verificationApprove);
router.post('/author-verification/requests/:idx/reject', writeLimiter, audit('senior.verifications.reject'),
  validate(z.object({ params: z.object({ idx: z.string().min(1).max(10) }) })), ctrl.verificationReject);

// author messages
router.get('/author-messages', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('messages').list);
router.post('/author-messages', writeLimiter, audit('senior.messages.send'),
  validate(z.object({ body: z.object({
    toUserId: z.string().min(1).max(40).optional(), conversationId: z.string().max(40).optional(),
    text: z.string().min(1).max(2000),
  }).strict() })), ctrl.sendMessage);
router.get('/messages', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('messages').list);

module.exports = router;
