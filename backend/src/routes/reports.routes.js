'use strict';
/* Public filing desk: logged-in users file reports (collections, discussions,
   posts today; stories/chapters later). Moderation stays in
   senior/chief/super-admin — filed reports surface automatically in the
   chief reports console, senior reports and editor reports (all read Report). */
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, writeLimiter } = require('../middleware/http');
const { Report } = require('../models/editorial.model');
const { Collection } = require('../models/social.model');
const { User } = require('../models/user.model');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

// Predefined report types (mirrored by the dots-menu report sheet).
const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'copyright', 'other'];
const REASON_TO_TYPE = {
  spam: 'spam', harassment: 'abuse', hate: 'abuse', sexual: 'abuse',
  violence: 'abuse', misinformation: 'content', copyright: 'plagiarism', other: 'other',
};

router.get('/reasons', async (req, res) => base.wrap(res, async () => ({ items: REPORT_REASONS })));

router.post('/', requireAuth, writeLimiter, audit('reports.file'),
  validate(z.object({
    body: z.object({
      target: z.enum(['collection', 'discussion', 'post', 'comment']),
      targetId: z.string().min(1).max(120),
      reason: z.enum(['spam', 'harassment', 'hate', 'sexual', 'violence', 'misinformation', 'copyright', 'other']),
      details: z.string().max(1000).optional(),
      title: z.string().max(160).optional(),
    }).strict(),
  })), async (req, res) => base.wrap(res, async () => {
    const { target, targetId, reason, details, title } = req.valid.body;
    const me = await User.findOne({ id: req.user.id }).select('username fullName').lean();
    const reporterLabel = (me && (me.username || me.fullName)) || '';
    const filed = (fields) => Report.create(Object.assign({
      title: String(title || 'Report').slice(0, 160) || 'Report',
      desc: '[' + reason + '] ' + String(details || '').slice(0, 1000),
      type: REASON_TO_TYPE[reason] || 'other',
      reporterId: req.user.id, reporterLabel,
    }, fields));
    let doc;
    if (target === 'collection') {
      const col = await Collection.findOne({ id: String(targetId) }).select('id title').lean();
      if (!col) { const e = new Error('not_found'); e.status = 404; throw e; }
      doc = await filed({ collectionId: String(col.id), title: col.title || 'Collection' });
    } else if (target === 'discussion') {
      // Real threads resolve title; legacy demo ids (gh_…) keep the supplied label.
      let label = String(title || 'Discussion').slice(0, 160) || 'Discussion';
      try {
        const { Discussion } = require('../models/social.model');
        const disc = await Discussion.findOne({ id: String(targetId) }).select('id title').lean();
        if (disc && disc.title) label = disc.title;
      } catch (e) { /* demo id — keep supplied label */ }
      doc = await filed({ discussionId: String(targetId), title: label });
    } else if (target === 'comment') {
      // Demo comments carry client-side ids — accept anyway; use real text when found.
      let label = String(title || 'Comment').slice(0, 160) || 'Comment';
      try {
        const { Comment } = require('../models/social.model');
        const cm = await Comment.findOne({ id: String(targetId) }).select('text').lean();
        if (cm && cm.text) label = 'Comment: ' + String(cm.text).slice(0, 140);
      } catch (e) { /* demo id — keep supplied label */ }
      doc = await filed({ commentId: String(targetId), title: label });
    } else {
      doc = await filed({ postId: String(targetId), title: String(title || 'Post').slice(0, 160) || 'Post' });
    }
    const plain = doc.toJSON ? doc.toJSON() : doc;
    res.status(201);
    return { ok: true, id: plain.id };
  }));

module.exports = router;
