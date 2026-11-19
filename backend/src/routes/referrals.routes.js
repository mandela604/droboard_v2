'use strict';
// routes/referrals.routes.js — frontend refer.html contracts + invite stats.
//   GET /api/referrals/code   -> { code, link }
//   GET /api/referrals/stats  -> { invited, joined, earned }
//   GET /api/referrals        -> { items: [...] }
const { z } = require('zod');
const base = require('../controllers/base.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, generalLimiter } = require('../middleware/http');
const referrals = require('../services/referrals.service');
const env = require('../config/env');
const { User } = require('../models/user.model');
const { userRefFilter } = require('../services/user-ref');

function Router() { return require('express').Router(); }
const router = Router();

function inviteLink(code, req) {
  // A relative link is useless once it is copied into WhatsApp/DMs — the
  // recipient's browser resolves it against whatever page they are on, so the
  // ?ref code is silently lost at signup. Always return an absolute URL.
  const envRaw = (env.appUrl || env.backendUrl || '').replace(/\/$/, '');
  // A proxy/dev APP_URL must never be handed out as a shareable invite link.
  const fromEnv = /^https?:\/\/(127\.|localhost|0\.0\.0\.0)/i.test(envRaw) ? '' : envRaw;
  const host = req && req.get ? String(req.get('x-forwarded-host') || req.get('host') || '') : '';
  const proto = req && req.get ? String(req.get('x-forwarded-proto') || '') : '';
  const localHost = /^(127\.|localhost|0\.0\.0\.0)/i.test(host);
  const fromReq = (!localHost && host) ? (proto || (req && req.protocol) || 'https') + '://' + host : '';
  // Last resort: the production host. A relative link here would silently
  // drop ?ref when pasted into WhatsApp/DMs — that is how invites got lost.
  const baseUrl = fromEnv || fromReq || 'https://droboard-v2.onrender.com';
  return baseUrl + '/Pages/signup.html?ref=' + encodeURIComponent(code);
}

router.get('/code', requireAuth, generalLimiter, async (req, res) => {
  return base.wrap(res, async () => {
    const code = await referrals.ensureCode(req.user.id);
    return { code, link: inviteLink(code, req) };
  });
});

router.get('/stats', requireAuth, generalLimiter, async (req, res) => {
  return base.wrap(res, async () => referrals.getStats(req.user.id));
});

/* Admin repair: before the share link was made absolute, a shared relative
   link lost its ?ref code and a real signup went unattributed. Admin-only,
   idempotent — re-running never double-credits. */
router.post('/backfill', requireAuth, generalLimiter,
  validate(z.object({ body: z.object({
    userIds: z.array(z.string().min(1).max(80)).min(1).max(20),
  }).strict() })),
  async (req, res) => base.wrap(res, async () => {
    if (!(req.user.roles || []).includes('admin')) {
      const e = new Error('forbidden'); e.status = 403; throw e;
    }
    const code = await referrals.ensureCode(req.user.id);
    const results = [];
    for (const uid of req.valid.body.userIds) {
      const u = await User.findOne(userRefFilter([uid])).select('_id id username').lean();
      if (!u) { results.push({ id: uid, error: 'no_user' }); continue; }
      const out = await referrals.applyReferral(
        { _id: u._id, id: u.id, username: u.username }, code
      );
      results.push({ id: uid, inviterId: out.inviterId || null, credited: !!(out.stage1 && out.stage1.credited) || !!out.stage1 });
    }
    return { results };
  }));

router.get('/', requireAuth, generalLimiter,
  validate(z.object({ query: z.object({ limit: z.string().max(6).optional() }).strict() })),
  async (req, res) => {
    return base.wrap(res, async () => ({
      items: await referrals.listReferred(req.user.id, { limit: parseInt((req.valid.query && req.valid.query.limit) || '50', 10) }),
    }));
  });

module.exports = router;
