'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-contracts.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const guard = [requireAuth, requireRole('chief_editor', 'admin')];
const id = z.string().min(1).max(120);
const pageQuery = z.object({
  page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();

// ---- Contract templates ----
const templateBody = z.object({
  name: z.string().min(1).max(120), desc: z.string().max(1000).optional(),
  type: z.enum(['Publishing', 'Financial', 'Legal', 'Rights', 'Non-Exclusive', 'Exclusive', 'Renewal', 'Amendment', 'Work-for-Hire']).optional(),
  status: z.enum(['active', 'draft', 'paused', 'archived']).optional(),
  clauses: z.number().int().min(0).optional(), body: z.string().max(50000).optional(),
  clauseText: z.string().max(20000).optional(),
  royaltyRate: z.number().min(0).max(100).nullable().optional(),
  termLength: z.string().max(60).optional(),
  signupBonusMin: z.number().min(0).optional(), signupBonusMax: z.number().min(0).optional(),
  completionTarget: z.number().min(0).optional(), completionWindowMonths: z.number().min(0).optional(),
  profitShareThreshold: z.number().min(0).optional(), profitShareBonus: z.number().min(0).optional(),
  autoRenew: z.boolean().optional(), usageCount: z.number().min(0).optional(),
  defaultChapterPrice: z.number().min(0).optional(),
  cfHidden: z.array(z.string().max(60)).max(50).optional(),
  cfLabels: z.record(z.string().max(120)).optional(),
  preview: z.object({ title: z.string().max(200).optional(), body: z.string().max(5000).optional() }).optional(),
}).strict();

router.get('/contract-templates', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.consoleTemplates);

router.post('/contract-templates', ...guard, audit('chief.templates.create'),
  validate(z.object({ body: templateBody })), ctrl.createTemplate);

router.get('/contract-templates/:id', ...guard,
  validate(z.object({ params: z.object({ id }) })), ctrl.getTemplate);

router.patch('/contract-templates/:id', ...guard, audit('chief.templates.update'),
  validate(z.object({ params: z.object({ id }), body: templateBody.partial() })), ctrl.updateTemplate);

router.delete('/contract-templates/:id', ...guard, audit('chief.templates.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteTemplate);

router.post('/contract-templates/:id/pause', ...guard, audit('chief.templates.pause'),
  validate(z.object({ params: z.object({ id }) })), ctrl.pauseTemplate);

router.post('/contract-templates/:id/activate', ...guard, audit('chief.templates.activate'),
  validate(z.object({ params: z.object({ id }) })), ctrl.activateTemplate);

// ---- Author contracts (static paths before :id) ----
router.get('/author-contracts', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.listContracts);

router.get('/author-contracts/templates', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.listTemplates);

router.get('/author-contracts/active', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.activeContracts);

router.get('/author-contracts/pending-offers', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.pendingOffers);

router.post('/author-contracts/offers', ...guard, audit('chief.contracts.offer'),
  validate(z.object({ body: z.object({
    authorId: z.string().min(1).max(120), templateId: z.string().min(1).max(120),
    value: z.number().min(0).optional(),
    type: z.enum(['Exclusive_Publishing', 'Revenue_Share', 'License_Agreement', 'Non_Exclusive']).optional(),
    bookId: z.string().max(120).optional(),
  }).strict() })), ctrl.createOffer);

router.post('/author-contracts/:id/sign', ...guard, audit('chief.contracts.sign'),
  validate(z.object({ params: z.object({ id }) })), ctrl.signContract);

router.post('/author-contracts/:id/approve', ...guard, audit('chief.contracts.approve'),
  validate(z.object({ params: z.object({ id }) })), ctrl.approveContract);

router.post('/author-contracts/:id/reject', ...guard, audit('chief.contracts.reject'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ reason: z.string().max(500).optional() }).strict().optional(),
  })), ctrl.rejectContract);

module.exports = router;
