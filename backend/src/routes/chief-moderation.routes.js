'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-moderation.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const paging = z.object({
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();
const noteBody = z.object({ note: z.string().max(1000).optional() }).strict();
const resolutionBody = z.object({ resolution: z.string().max(1000).optional() }).strict();
const appealQuery = paging.extend({ status: z.enum(['open', 'in_review', 'upheld', 'rejected']).optional() });

router.get('/disputes-appeals', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.disputesAppeals);

router.get('/appeals', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: appealQuery })), ctrl.listAppeals);
router.post('/appeals/:id/uphold', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.appeals.uphold'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.uphold);
router.post('/appeals/:id/overturn', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.appeals.overturn'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.overturn);
router.post('/appeals/:id/investigate', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.appeals.investigate'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.investigate);

router.get('/copyright-disputes', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.copyrightDisputes);
router.post('/copyright-disputes/:id/resolve', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.copyright.resolve'),
  validate(z.object({ params: z.object({ id }), body: resolutionBody })), ctrl.resolveCopyright);

router.get('/plagiarism-cases', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.plagiarismCases);
router.post('/plagiarism-cases/:id/confirm', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.plagiarism.confirm'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.confirmPlagiarism);
router.post('/plagiarism-cases/:id/clear', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.plagiarism.clear'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.clearPlagiarism);

router.get('/escalated-reports', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.escalatedReports);
router.post('/escalated-reports/:id/resolve', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.escalated.resolve'),
  validate(z.object({ params: z.object({ id }), body: resolutionBody })), ctrl.resolveEscalated);
router.post('/escalated-reports/:id/escalate-legal', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.escalated.escalateLegal'),
  validate(z.object({ params: z.object({ id }), body: noteBody })), ctrl.escalateLegal);

router.get('/resolution-history', requireAuth, requireRole('chief_editor', 'admin'), ctrl.resolutionHistory);

module.exports = router;
