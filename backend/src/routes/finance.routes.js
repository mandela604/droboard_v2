'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/finance.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const id = z.string().min(1).max(120);

router.get('/earnings', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.earnings);
router.get('/transactions', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.transactions);

router.get('/payment-methods', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.methods);
router.post('/payment-methods', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({
    type: z.enum(['bank', 'paypal', 'mobile']), accountName: z.string().min(1).max(120),
    bankName: z.string().max(120).optional(), accountNumber: z.string().max(40).optional(),
    email: z.string().max(160).optional(), provider: z.string().max(60).optional(),
    phoneNumber: z.string().max(30).optional(),
  }).strict(),
})), ctrl.addMethod);
router.delete('/payment-methods/:id', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  params: z.object({ id }),
})), ctrl.deleteMethod);

router.get('/withdrawals', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.withdrawals);
router.post('/withdrawals', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ amount: z.number().min(100), methodId: z.string().min(1).max(40) }).strict(),
})), ctrl.requestWithdrawal);

router.get('/disputes', requireAuth, generalLimiter, validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.disputes);
router.post('/disputes', requireAuth, writeLimiter, validate(z.object({
  query: z.object({ authorId: z.string().max(40).optional() }).strict(),
  body: z.object({ transactionId: z.string().max(40).optional(), amount: z.number().min(0), reason: z.string().min(1).max(1000) }).strict(),
})), ctrl.fileDispute);

module.exports = router;
