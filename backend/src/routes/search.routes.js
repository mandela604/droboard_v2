'use strict';
const { z } = require('zod');
const base = require('../controllers/base.controller');
const search = require('../services/search.service');
const { generalLimiter } = require('../middleware/http');
const { validate } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

// search-service contract: GET /api/search/index
router.get('/index', generalLimiter,
  validate(z.object({ query: z.object({
    q: z.string().max(80).optional(), type: z.string().max(20).optional(), limit: z.string().max(6).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => search.index(req.valid.query)));

module.exports = router;
