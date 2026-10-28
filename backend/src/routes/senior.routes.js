'use strict';
// Senior-editor namespace — mirrors ONLY what the 13 sidebar menu pages call.
// Menu: dashboard, review-queue, book-management, reports-flags,
// contract-review, completion-application, chapter-edit-review,
// book-story-review, authors, invite-authors, author-verification,
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
const reportNote = z.object({ note: z.string().max(1000).optional() }).strict();

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
/* ── CSV exports — real files streamed to the browser ───────────────── */
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function sendCsv(res, filename, rows, fields) {
  if (!fields && rows.length) {
    fields = [];
    rows.forEach(r => Object.keys(r).forEach(k => { if (fields.indexOf(k) === -1) fields.push(k); }));
  }
  const lines = [(fields || []).join(',')];
  rows.forEach(r => lines.push((fields || []).map(f => csvCell(r[f])).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
  res.send('\uFEFF' + lines.join('\r\n')); // BOM so Excel opens UTF-8 correctly
}
function csvFail(res, e) {
  return res.status(e.status || 500).json({ error: e.message || 'error' });
}
// paged() caps limit at 50 — walk pages up to maxRows for the export.
async function collectPaged(fetchPage, maxRows) {
  const out = [];
  let page = 1, total = Infinity;
  while (out.length < maxRows && out.length < total && page <= 20) {
    const d = await fetchPage({ page: String(page), limit: '50' });
    const batch = (d && (d.items || d.payments)) || [];
    total = d && typeof d.total === 'number' ? d.total : batch.length;
    if (!batch.length) break;
    out.push.apply(out, batch);
    page += 1;
  }
  return out.slice(0, maxRows);
}

router.post('/activity-logs/export', writeLimiter, audit('senior.activity.export'),
  async (req, res) => {
    try {
      const sidebar = require('../services/senior-sidebar.service');
      const rows = await collectPaged(q => sidebar.activity(req.user, q), 1000);
      const data = rows.map(a => ({
        timestamp: a.at, user: a.user, action: a.action, type: a.type, detail: a.detail, ip: a.ip,
      }));
      return sendCsv(res, 'activity-logs.csv', data, ['timestamp', 'user', 'action', 'type', 'detail', 'ip']);
    } catch (e) { return csvFail(res, e); }
  });

// review queue (decorated with book + author + KYC data)
router.get('/review-queue', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.reviewQueue);
router.put('/review-queue/:id', writeLimiter, audit('senior.reviews.decide'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      action: z.enum(['approved', 'rejected']),
      feedback: z.string().max(2000).optional(),
      // Present when the editor chose "Accept for Contract": the acceptance
      // wizard's deal type + monetization terms become a real offer.
      contract: z.object({
        type: z.enum(['Exclusive_Publishing', 'Non_Exclusive', 'Revenue_Share', 'License_Agreement']).optional(),
        termMonths: z.number().int().min(1).max(60).optional(),
        revenueSplit: z.number().int().min(0).max(100).optional(),
        advance: z.number().min(0).optional(),
        note: z.string().max(1000).optional(),
        pricing: z.object({
          freeChapters: z.number().int().min(0).optional(),
          adsPerChapter: z.number().int().min(0).optional(),
          allowAdUnlock: z.boolean().optional(),
          rows: z.array(z.object({}).passthrough()).max(500).optional(),
        }).strict().optional(),
      }).strict().optional(),
    }).strict(),
  })), ctrl.reviewDecide);

// book management (full CRUD + rate/flag/unflag used by book-management-service.js)
router.get('/books', generalLimiter, validate(z.object({ query: z.object({
  tab: z.string().max(20).optional(), status: z.string().max(30).optional(),
  q: q.q, page: q.page, limit: q.limit,
}).strict() })), ctrl.booksList);
router.get('/books/:id', generalLimiter, validate(z.object({ params: z.object({ id }) })), ctrl.res('stories').get);
router.put('/books/:id', writeLimiter, audit('senior.books.update'),
  validate(z.object({ params: z.object({ id }), body: anyBody })), ctrl.res('stories').update);
router.delete('/books/:id', writeLimiter, audit('senior.books.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.res('stories').remove);
router.put('/books/:id/rating', writeLimiter, audit('senior.books.rate'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ rating: z.number().min(0).max(5) }).strict(),
  })), ctrl.rateBook);
router.post('/books/:id/flag', writeLimiter, audit('senior.books.flag'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      reason: z.string().min(1).max(200),
      note: z.string().max(2000).optional(),
      password: z.string().min(1).max(200),
    }).strict(),
  })), ctrl.flagBook);
router.post('/books/:id/unflag', writeLimiter, audit('senior.books.unflag'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ password: z.string().min(1).max(200) }).strict(),
  })), ctrl.unflagBook);

// reports + settings
router.get('/reports', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('reports').list);
router.post('/reports/:id/resolve', writeLimiter, audit('senior.reports.resolve'),
  validate(z.object({ params: z.object({ id }), body: reportNote })), ctrl.reportResolve);
router.post('/reports/:id/dismiss', writeLimiter, audit('senior.reports.reject'),
  validate(z.object({ params: z.object({ id }), body: reportNote })), ctrl.reportDismiss);
router.get('/reports/settings', generalLimiter, async (req, res) => {
  const base = require('../controllers/base.controller');
  const { PlatformSetting } = require('../models/platform.model');
  return base.wrap(res, async () => PlatformSetting.findOne({ key: 'reports' }).lean());
});

/* ── Surface endpoints the dashboard pages name but the core review/contract
      models don't cover. Response shapes match each senior-editor service. */
const base = require('../controllers/base.controller');
const S = require('../services/senior-surfaces.service');

const read = (fn) => (req, res) => base.wrap(res, () => fn(req));
const listQuery = validate(z.object({ query: z.object(q).strict() }));

// author-content surfaces (scoped to this editor's assigned authors)
router.get('/stories', generalLimiter, listQuery, read(r => S.stories(r.user, r.valid.query)));
router.get('/story-analytics', generalLimiter, listQuery,
  read(r => S.storyAnalytics(r.user, r.valid.query)));

// merchandising (SE reads what CE places)
router.get('/featured-stories', generalLimiter, read(() => S.featuredStories()));
router.get('/editors-picks', generalLimiter, read(() => S.editorsPicks()));

// announcements
router.get('/announcements', generalLimiter, listQuery, read(() => S.announcements()));
router.post('/announcements', writeLimiter, audit('senior.announcements.create'),
  validate(z.object({ body: anyBody })), read(r => S.createAnnouncement(r.valid.body)));

// book reviews
router.get('/book-reviews', generalLimiter, validate(z.object({ query: z.object({
  q: q.q, page: q.page, limit: q.limit,
  tab: z.string().max(20).optional(), search: z.string().max(80).optional(),
}).strict() })), read(r => S.bookReviews(r.user, r.valid.query)));
router.get('/book-reviews/date-filter', generalLimiter, read(() => S.bookReviewsDateFilter()));

// contract templates + the one-shot overview the contracts page reads.
// NOTE: /contracts/overview is registered BEFORE crud('/contracts') below so
// it is never swallowed by GET /contracts/:id.
router.get('/contracts/overview', generalLimiter, read(() => S.contractsOverview()));
router.get('/contract-templates', generalLimiter, listQuery,
  read(r => S.contractTemplates(r.valid.query)));
router.get('/contract-templates/usage', generalLimiter, read(() => S.contractTemplatesUsage()));

// featured banners
router.get('/featured-banners', generalLimiter, read(() => S.featuredBanners()));
router.post('/featured-banners', writeLimiter, audit('senior.banners.create'),
  validate(z.object({ body: anyBody })), read(r => S.createFeaturedBanner(r.valid.body)));
router.get('/featured-banners/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), read(r => S.featuredBanner(r.valid.params.id)));
router.post('/featured-banners/:id/pause', writeLimiter, audit('senior.banners.pause'),
  validate(z.object({ params: z.object({ id }) })),
  read(r => S.pauseFeaturedBanner(r.valid.params.id)));
router.get('/featured-banners/:id/analytics', generalLimiter,
  validate(z.object({ params: z.object({ id }) })),
  read(r => S.featuredBannerAnalytics(r.valid.params.id)));

// earnings / payments / transactions / withdrawals
router.get('/earnings-overview', generalLimiter, read(() => S.earningsOverview()));
router.get('/earnings/analytics', generalLimiter, read(() => S.earningsOverview()));
router.get('/earnings/leaderboard', generalLimiter, read(() => S.earningsOverview()));
router.post('/earnings/export', writeLimiter, audit('senior.earnings.export'),
  async (req, res) => {
    try {
      const ov = await S.earningsOverview();
      // Summary export: byBook is currently empty in earningsOverview().
      const data = [
        { metric: 'Lifetime earnings', value: ov.lifetime },
        { metric: 'Pending withdrawals', value: ov.pending },
      ];
      return sendCsv(res, 'earnings-overview.csv', data, ['metric', 'value']);
    } catch (e) { return csvFail(res, e); }
  });
router.get('/payments', generalLimiter, listQuery, read(r => S.payments(r.valid.query)));
router.get('/payments/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), read(r => S.payment(r.valid.params.id)));
router.post('/payments/export', writeLimiter, audit('senior.payments.export'),
  async (req, res) => {
    try {
      const rows = await collectPaged(q => S.payments(q), 500);
      return sendCsv(res, 'payments.csv', rows,
        ['id', 'recipient', 'amount', 'method', 'status', 'date']);
    } catch (e) { return csvFail(res, e); }
  });
router.get('/transactions', generalLimiter, listQuery, read(r => S.transactions(r.valid.query)));
router.post('/transactions/export', writeLimiter, audit('senior.transactions.export'),
  async (req, res) => {
    try {
      const rows = await collectPaged(q => S.transactions(q), 500);
      const data = rows.map(t => ({
        id: t.id, description: t.desc, type: t.type, amount: t.amount,
        author: t.usr, direction: t.cls === 'debit' ? 'debit' : 'credit', date: t.date,
      }));
      return sendCsv(res, 'transactions.csv', data,
        ['id', 'description', 'type', 'amount', 'author', 'direction', 'date']);
    } catch (e) { return csvFail(res, e); }
  });
router.get('/withdrawal-requests', generalLimiter, listQuery,
  read(r => S.withdrawalRequests(r.valid.query)));
router.get('/withdrawal-settings', generalLimiter, read(() => S.withdrawalSettings()));
router.get('/signed-contracts', generalLimiter, listQuery,
  read(r => S.signedContracts(r.valid.query)));

// system pages
router.get('/system-pages', generalLimiter, read(() => S.systemPages()));
router.post('/system-pages', writeLimiter, audit('senior.systemPages.create'),
  validate(z.object({ body: anyBody })),
  (req, res) => base.wrap(res, async () => S.createSystemPage(req.valid.body, req.user)));
router.get('/system-pages/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), read(r => S.systemPage(r.valid.params.id)));
router.get('/system-pages/:id/preview', generalLimiter,
  validate(z.object({ params: z.object({ id }) })),
  read(r => S.systemPagePreview(r.valid.params.id)));

// notifications (this editor only) — read-all MUST return {items}
router.get('/notifications', generalLimiter, listQuery,
  read(r => S.notifications(r.user, r.valid.query)));
router.post('/notifications', writeLimiter, audit('senior.notifications.create'),
  validate(z.object({ body: anyBody })),
  (req, res) => base.wrap(res, async () => S.createNotification(req.valid.body, req.user)));
router.post('/notifications/read-all', writeLimiter, audit('senior.notifications.readAll'),
  read(r => S.notificationsReadAll(r.user, {})));

router.get('/platform-settings', generalLimiter, read(() => S.platformSettings()));
router.get('/editor-bill-review', generalLimiter, listQuery,
  read(r => S.editorBillReview(r.user, r.valid.query)));

// author messages (decorated inbox + persisted thread history)
router.get('/author-messages', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.messagesList);
router.get('/author-messages/:id/messages', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.messageThread);
router.put('/author-messages/:id', writeLimiter, audit('senior.authorMessages.update'),
  validate(z.object({ params: z.object({ id }), body: anyBody })),
  ctrl.messageUpdate);
router.post('/author-messages/:id/messages', writeLimiter, audit('senior.authorMessages.send'),
  validate(z.object({ params: z.object({ id }), body: anyBody })),
  ctrl.messageSend);
router.post('/author-messages/read-all', writeLimiter, audit('senior.authorMessages.readAll'),
  ctrl.messagesReadAll);

// contract review
crud('/contracts', 'contracts');

// Author applications → the editor's offer. Approve assigns the deal type and
// sends a Contract; the author then signs it from Author Center.
router.get('/contract-applications', generalLimiter, ctrl.contractApplications);
router.post('/contract-applications/:id/approve', writeLimiter, audit('senior.contracts.offer'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      type: z.enum(['Exclusive_Publishing', 'Non_Exclusive', 'Revenue_Share', 'License_Agreement']),
      termMonths: z.number().int().min(1).max(60).default(12),
      revenueSplit: z.number().int().min(0).max(100).default(70),
      advance: z.number().min(0).optional(),
      note: z.string().max(1000).optional(),
    }).strict(),
  })), ctrl.contractApprove);
router.post('/contract-applications/:id/reject', writeLimiter, audit('senior.contracts.rejectApplication'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ reason: z.string().min(5).max(500) }).strict(),
  })), ctrl.contractAppReject);

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

// completion applications (decorated; approve closes the book)
router.get('/completion-applications', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.completionList);
router.post('/completion-applications/:id/approve', writeLimiter, audit('senior.completions.approve'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.completionApprove);
router.post('/completion-applications/:id/reject', writeLimiter, audit('senior.completions.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.completionReject);

// chapter edits (proposals apply content ONLY on approve)
router.get('/chapter-edits', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.chapterEditList);
router.post('/chapter-edits/:id/approve', writeLimiter, audit('senior.chapterEdits.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveChapterEdit);
router.post('/chapter-edits/:id/reject', writeLimiter, audit('senior.chapterEdits.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.rejectChapterEdit);

// book edits (description/cover/... — same approve-to-apply rule)
router.get('/book-edits', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.bookEditList);
router.post('/book-edits/:id/approve', writeLimiter, audit('senior.bookEdits.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveBookEdit);
router.post('/book-edits/:id/reject', writeLimiter, audit('senior.bookEdits.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ note: z.string().max(2000).optional() }).strict(),
  })), ctrl.rejectBookEdit);

// contract type catalog for the review-queue acceptance wizard
router.get('/contract-types', generalLimiter, ctrl.contractTypes);

// VIP registration reviews (vip-registration-review-service.js reads {items})
router.get('/vip-registrations', generalLimiter, listQuery,
  read(r => S.vipRegistrations(r.valid.query)));

// authors + invites (decorated: story counts, earnings, invite provenance)
router.get('/authors', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.authorsList);
// This editor's own authors (scoped by EditorAssignment) + invite provenance.
router.get('/my-authors', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.myAuthors);
// Editor-invite code: signup with it ⇒ writer role + auto-assignment.
router.get('/referral-code', generalLimiter, ctrl.referralCode);
router.post('/referral-code/regenerate', writeLimiter, audit('senior.referral.rotate'), ctrl.rotateReferralCode);
router.get('/invites', generalLimiter, ctrl.res('invites').list);
router.post('/invites', writeLimiter, audit('senior.invites.create'),
  validate(z.object({ body: anyBody })), ctrl.res('invites').create);

// author verification — decide by record id (atomic, safe with many editors)
router.get('/author-verification/requests', generalLimiter, ctrl.verificationRequests);
router.get('/author-verification/recent-reviews', generalLimiter, ctrl.verificationRecent);
router.get('/author-verification/history', generalLimiter, ctrl.verificationHistory);
router.post('/author-verification/requests/:id/approve', writeLimiter, audit('senior.verifications.approve'),
  validate(z.object({
    params: z.object({ id: z.string().min(1).max(120) }),
    body: z.object({ reason: z.string().max(500).optional() }).strict(),
  })), ctrl.verificationApprove);
router.post('/author-verification/requests/:id/reject', writeLimiter, audit('senior.verifications.reject'),
  validate(z.object({
    params: z.object({ id: z.string().min(1).max(120) }),
    body: z.object({ reason: z.string().min(5).max(500) }).strict(),
  })), ctrl.verificationReject);

// author messages — create a conversation
router.post('/author-messages', writeLimiter, audit('senior.messages.send'),
  validate(z.object({ body: z.object({
    toUserId: z.string().min(1).max(40).optional(), conversationId: z.string().max(40).optional(),
    text: z.string().min(1).max(2000),
  }).strict() })), ctrl.sendMessage);
router.get('/messages', generalLimiter, validate(z.object({ query: z.object(q).strict() })), ctrl.res('messages').list);

module.exports = router;
