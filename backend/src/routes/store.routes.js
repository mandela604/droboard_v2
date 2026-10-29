'use strict';
const ctrl = require('../controllers/wallet.controller');
const { optionalAuth } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// frontend store-service contract: GET /api/store
// Catalog is public product info (a logged-out reader still has to see prices);
// the balance is attached only when an identity is present.
router.get('/', optionalAuth, generalLimiter, ctrl.storeData);

module.exports = router;
