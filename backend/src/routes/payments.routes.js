'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/payments.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, moneyLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const verifyBody = z.object({
  coins: z.number().int().min(1).max(100000),
  amount: z.number().min(0),
  currency: z.string().max(8).optional(),
  reference: z.string().max(200).optional(),
  purchaseToken: z.string().max(1000).optional(),
  transactionId: z.string().max(200).optional(),
}).strict();

router.post('/paystack/verify', requireAuth, moneyLimiter, validate(z.object({ body: verifyBody })), ctrl.paystack);
router.post('/play/verify', requireAuth, moneyLimiter, validate(z.object({ body: verifyBody })), ctrl.play);
router.post('/appstore/verify', requireAuth, moneyLimiter, validate(z.object({ body: verifyBody })), ctrl.appstore);

module.exports = router;
