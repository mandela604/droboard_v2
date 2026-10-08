'use strict';
const ctrl = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// frontend store-service contract: GET /api/store
router.get('/', requireAuth, generalLimiter, ctrl.storeData);

module.exports = router;
