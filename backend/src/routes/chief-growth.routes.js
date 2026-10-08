'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-growth.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
const paging = z.object({
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();
const statusQuery = paging.extend({ status: z.string().max(40).optional() });
const policyBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(20000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
}).strict();
const policyPatch = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
}).strict();

router.get('/partnerships', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: statusQuery })), ctrl.partnerships);
router.get('/partnerships/publishing', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.publishing);
router.get('/partnerships/translations', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.translations);
router.get('/partnerships/contests', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.contests);
router.get('/partnerships/ip-media', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging })), ctrl.ipMedia);
router.get('/partnerships/requests', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: statusQuery })), ctrl.partnershipRequests);
router.post('/partnerships/requests/:id/approve', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.partnerships.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveRequest);
router.post('/partnerships/requests/:id/decline', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.partnerships.decline'),
  validate(z.object({ params: z.object({ id }) })), ctrl.declineRequest);

router.get('/editorial-strategy', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategy);
router.get('/editorial-strategy/notes', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategyNotes);
router.get('/editorial-strategy/genre-priorities', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategyGenres);
router.get('/editorial-strategy/quarterly-goals', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategyGoals);
router.get('/editorial-strategy/campaigns', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategyCampaigns);
router.get('/editorial-strategy/acquisition-targets', requireAuth, requireRole('chief_editor', 'admin'), ctrl.strategyTargets);

router.get('/policies/history', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: paging.extend({ policyId: z.string().max(120).optional() }) })), ctrl.policyHistory);
router.get('/policies', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ query: statusQuery })), ctrl.listPolicies);
router.post('/policies', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.create'),
  validate(z.object({ body: policyBody })), ctrl.createPolicy);
router.get('/policies/:id', requireAuth, requireRole('chief_editor', 'admin'),
  validate(z.object({ params: z.object({ id }) })), ctrl.getPolicy);
router.patch('/policies/:id', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.update'),
  validate(z.object({ params: z.object({ id }), body: policyPatch })), ctrl.updatePolicy);
router.post('/policies/:id/archive', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.archive'),
  validate(z.object({ params: z.object({ id }) })), ctrl.archivePolicy);
router.post('/policies/:id/publish', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.publish'),
  validate(z.object({ params: z.object({ id }) })), ctrl.publishPolicy);
router.post('/policies/:id/approve', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approvePolicy);
router.post('/policies/:id/send-back', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.policies.sendBack'),
  validate(z.object({ params: z.object({ id }) })), ctrl.sendBackPolicy);

router.get('/profile', requireAuth, requireRole('chief_editor', 'admin'), ctrl.profile);
router.get('/sessions', requireAuth, requireRole('chief_editor', 'admin'), ctrl.sessions);
router.post('/sessions/revoke-others', requireAuth, requireRole('chief_editor', 'admin'), audit('chief.sessions.revokeOthers'),
  validate(z.object({
    body: z.object({
      currentFamilyId: z.string().max(120).optional(),
      refreshToken: z.string().max(500).optional(),
    }).strict(),
  })), ctrl.revokeOthers);

module.exports = router;
