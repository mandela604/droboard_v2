'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-editors.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit, authLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const guard = [requireAuth, requireRole('chief_editor', 'admin')];
const pageQuery = z.object({
  q: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  sort: z.string().max(40).optional(),
  genre: z.string().max(60).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();
const idParam = z.object({ params: z.object({ id: z.string().max(60) }).strict() }).strict();

router.get('/senior-editors', ...guard,
  validate(z.object({ query: pageQuery }).strict()), ctrl.list);

router.get('/senior-editors/quotas', ...guard, ctrl.quotas);

router.get('/senior-editors/:id', ...guard, validate(idParam), ctrl.get);

router.patch('/senior-editors/:id', ...guard, audit('chief.editors.patch'),
  validate(z.object({
    params: z.object({ id: z.string().max(60) }).strict(),
    body: z.object({
      target: z.number().min(0).optional(),
      invited: z.number().min(0).optional(),
      status: z.string().max(40).optional(),
      paymentType: z.string().max(40).optional(),
      monthlyPay: z.union([z.number(), z.string()]).optional(),
      revenueShare: z.union([z.number(), z.string()]).optional(),
      deadline: z.string().max(40).optional(),
      note: z.string().max(500).optional(),
    }).strict(),
  }).strict()), ctrl.patch);

const inviteBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  target: z.number().min(0).optional(),
  paymentType: z.string().max(40).optional(),
  monthlyPay: z.union([z.number(), z.string()]).optional(),
  revenueShare: z.union([z.number(), z.string()]).optional(),
  deadline: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
}).strict();

router.post('/senior-editors/invites', ...guard, audit('chief.editors.invite'),
  validate(z.object({ body: inviteBody }).strict()), ctrl.createInvite);

router.get('/senior-editors/invites', ...guard,
  validate(z.object({
    query: z.object({
      status: z.string().max(40).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }).strict(),
  }).strict()), ctrl.listInvites);

router.patch('/senior-editors/invites/:id', ...guard, audit('chief.editors.invite.patch'),
  validate(z.object({
    params: z.object({ id: z.string().max(60) }).strict(),
    body: inviteBody.partial(),
  }).strict()), ctrl.patchInvite);

router.post('/senior-editors/:id/resend-invite', ...guard, audit('chief.editors.invite.resend'),
  validate(idParam), ctrl.resendInvite);

router.delete('/senior-editors/invites/:id', ...guard, audit('chief.editors.invite.cancel'),
  validate(idParam), ctrl.cancelInvite);

// Pre-login invite flow (same shape as /api/auth — public + auth limiter).
router.get('/invites/by-token/:token', authLimiter,
  validate(z.object({ params: z.object({ token: z.string().min(10).max(128) }).strict() }).strict()),
  ctrl.inviteByToken);

router.post('/invites/accept', authLimiter,
  validate(z.object({
    body: z.object({
      token: z.string().min(10).max(128),
      password: z.string().min(8).max(128),
      username: z.string().min(3).max(24).optional(),
      fullName: z.string().min(2).max(80).optional(),
    }).strict(),
  }).strict()), ctrl.acceptInvite);

router.get('/authors', ...guard,
  validate(z.object({ query: pageQuery }).strict()), ctrl.authors);

// Invite wizard step 1 — live search of registered accounts (role can only be
// granted to someone who already has a platform account).
router.get('/users/search', ...guard,
  validate(z.object({
    query: z.object({
      q: z.string().min(2).max(120).optional(),
      limit: z.coerce.number().int().min(1).max(20).optional(),
    }).strict(),
  }).strict()), ctrl.searchUsers);

// "Needs an editor" queue — writers in no EditorAssignment (option B).
// ?waiting=1 → only those with a submission actually parked awaiting review.
router.get('/unassigned-authors', ...guard,
  validate(z.object({
    query: pageQuery.extend({ waiting: z.string().max(4).optional() }),
  }).strict()), ctrl.unassigned);

router.get('/assignments', ...guard, ctrl.assignments);

router.put('/senior-editors/:id/assignments', ...guard, audit('chief.editors.assignments'),
  validate(z.object({
    params: z.object({ id: z.string().max(60) }).strict(),
    body: z.object({ authorIds: z.array(z.string().max(60)).max(100) }).strict(),
  }).strict()), ctrl.saveAssignments);

module.exports = router;
