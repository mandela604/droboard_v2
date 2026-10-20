'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-reports.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const paging = z.object({
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();
const listQuery = paging.extend({
  q: z.string().max(80).optional(),
  type: z.enum(['content', 'spam', 'plagiarism', 'abuse', 'other']).optional(),
  status: z.enum(['pending', 'resolved', 'dismissed']).optional(),
  // accepted-but-ignored: Report schema has no severity field (see service header).
  severity: z.string().max(20).optional(),
  // best-effort team scope: matched against reporterId OR reporterLabel
  // (Report has no seId field; full support needs a schema migration).
  seId: z.string().max(120).optional(),
});
const statsQuery = z.object({ seId: z.string().max(120).optional() }).strict();
const noteBody = z.object({ note: z.string().max(1000).optional() }).strict();

router.get('/reports/story', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: listQuery })), ctrl.list);

// NOTE: /stats before /:id so 'stats' is never captured as an id.
router.get('/reports/story/stats', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: statsQuery })), ctrl.stats);

router.get('/reports/story/:id', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ params: z.object({ id }) })), ctrl.get);

router.post('/reports/story/:id/resolve', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.reports.resolve'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.resolve);
router.post('/reports/story/:id/dismiss', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.reports.dismiss'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.dismiss);
router.post('/reports/story/:id/reopen', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.reports.reopen'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.reopen);

module.exports = router;
