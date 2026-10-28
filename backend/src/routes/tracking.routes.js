'use strict';
// Reader activity tracking: content impressions + personal search/impression
// trails. Searches are ALSO logged server-side inside search.routes (no
// client call needed) — this router only handles impression pings + reads.
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const base = require('../controllers/base.controller');
const track = require('../services/tracking.service');
const { validate, writeLimiter, generalLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

function optionalAuth(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : (req.cookies && req.cookies.dro_access) || null;
    if (!token) return next();
    const env = require('../config/env');
    const p = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: p.sub, roles: p.roles || [] };
  } catch (e) { /* anonymous */ }
  return next();
}

function requireAuthLite(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    return next();
  });
}

const pg = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

router.post('/impression', requireAuthLite, writeLimiter,
  validate(z.object({ body: z.object({
    targetType: z.enum(['post', 'discussion', 'story']),
    targetId: z.string().min(1).max(120),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => track.impression({
    userId: req.user.id, targetType: req.valid.body.targetType, targetId: req.valid.body.targetId,
  })));

router.get('/me', requireAuthLite, generalLimiter,
  async (req, res) => base.wrap(res, async () => track.myActivity({ userId: req.user.id })));

router.get('/me/impressions', requireAuthLite, generalLimiter,
  validate(z.object({ query: z.object({ targetType: z.enum(['post', 'discussion', 'story']).optional(), ...pg }).strict() })),
  async (req, res) => base.wrap(res, async () => track.impressionsFor({
    userId: req.user.id, targetType: req.valid.query.targetType,
    page: req.valid.query.page, limit: req.valid.query.limit,
  })));

router.get('/me/searches', requireAuthLite, generalLimiter,
  validate(z.object({ query: z.object({ ...pg }).strict() })),
  async (req, res) => base.wrap(res, async () => track.searchesFor({
    userId: req.user.id, page: req.valid.query.page, limit: req.valid.query.limit,
  })));

// Page insights — shared/insights-tracker.js hit + insights-service.js read.
router.post('/insight', optionalAuth, writeLimiter,
  validate(z.object({ body: z.object({
    surface: z.enum(['hub', 'droboard', 'profile', 'collection']),
    targetId: z.string().max(120).optional(),
    country: z.string().max(40).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => track.insightHit({
    userId: req.user && req.user.id,
    surface: req.valid.body.surface,
    targetId: req.valid.body.targetId,
    country: req.valid.body.country,
  })));

router.get('/insight', generalLimiter,
  validate(z.object({ query: z.object({
    surface: z.enum(['hub', 'droboard', 'profile', 'collection']),
    targetId: z.string().max(120).optional(),
    period: z.enum(['today', '7d', 'month', 'all']).optional(),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => track.insightStats({
    surface: req.valid.query.surface,
    targetId: req.valid.query.targetId,
    period: req.valid.query.period || 'all',
  })));

module.exports = router;
