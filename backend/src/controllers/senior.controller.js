'use strict';
const senior = require('../services/senior.service');
const base = require('./base.controller');

function res(name) {
  return {
    list: async (req, res) => base.wrap(res, async () => senior.R[name]().list(req.valid.query)),
    get: async (req, res) => base.wrap(res, async () => senior.R[name]().get(req.valid.params.id)),
    create: async (req, res) => base.wrap(res, async () => {
      const out = await senior.R[name]().create(req.valid.body);
      res.status(201);
      return out;
    }),
    update: async (req, res) => base.wrap(res, async () =>
      senior.R[name]().update(req.valid.params.id, req.valid.body)),
    remove: async (req, res) => base.wrap(res, async () =>
      senior.R[name]().remove(req.valid.params.id)),
    approve: async (req, res) => base.wrap(res, async () =>
      senior.R[name]().setStatus(req.valid.params.id, 'approved')),
    reject: async (req, res) => base.wrap(res, async () =>
      senior.R[name]().setStatus(req.valid.params.id, 'rejected')),
  };
}

async function dashboard(req, res) {
  return base.wrap(res, async () => senior.dashboard());
}

async function activity(req, res) {
  return base.wrap(res, async () => senior.activity(req.valid.query));
}

// Edit proposals: approve APPLIES content to the live book/chapter (the only
// time an author edit takes effect). Reject leaves live untouched + note.
async function approveChapterEdit(req, res) {
  return base.wrap(res, async () => senior.approveChapterEdit(req.valid.params.id, req.user.id));
}

async function rejectChapterEdit(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () => senior.rejectChapterEdit(req.valid.params.id, req.user.id, note));
}

async function approveBookEdit(req, res) {
  return base.wrap(res, async () => senior.approveBookEdit(req.valid.params.id, req.user.id));
}

async function rejectBookEdit(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () => senior.rejectBookEdit(req.valid.params.id, req.user.id, note));
}

// Contract sign: capture monetization pricing + lock terms.
async function signContract(req, res) {
  return base.wrap(res, async () => {
    const { Contract } = require('../models/contract.model');
    const { ContractPricing } = require('../models/revenue.model');
    const c = await Contract.findOne({ id: req.valid.params.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    const t = req.valid.body.pricing || {};
    await ContractPricing.findOneAndUpdate(
      { contractId: c.id },
      {
        contractId: c.id, bookId: c.bookId,
        freeChapters: t.freeChapters || 0, adsPerChapter: t.adsPerChapter || 0,
        allowAdUnlock: t.allowAdUnlock !== false,
        rows: t.rows || [], paidCount: (t.rows || []).filter(r => !r.free).length,
        status: 'signed',
      },
      { upsert: true, new: true }
    );
    c.status = 'signed';
    c.signedAt = new Date();
    await c.save();
    try {
      const { notify } = require('../services/notifications.service');
      await notify({ recipientId: c.authorId, type: 'contract', title: 'Contract signed', desc: 'Your contract is now active.' });
    } catch (e) {}
    return c.toJSON();
  });
}

// Review queue decide (shared senior-editor-data.js contract).
async function reviewDecide(req, res) {
  return base.wrap(res, async () => {
    const { ReviewSubmission } = require('../models/application.model');
    const s = await ReviewSubmission.findOne({ id: req.valid.params.id });
    if (!s) { const e = new Error('not_found'); e.status = 404; throw e; }
    if (!['approved', 'rejected'].includes(req.valid.body.action)) {
      const e = new Error('bad_action'); e.status = 400; throw e;
    }
    s.status = req.valid.body.action;
    if (req.valid.body.feedback !== undefined) s.feedback = req.valid.body.feedback;
    await s.save();
    return s.toJSON();
  });
}

// Contract send (select type + send to author).
async function contractSend(req, res) {
  return base.wrap(res, async () => {
    const { Contract } = require('../models/contract.model');
    const c = await Contract.findOne({ id: req.valid.params.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    if (req.valid.body.ct) c.type = req.valid.body.ct;
    c.status = 'sent';
    c.sentAt = new Date();
    await c.save();
    return c.toJSON();
  });
}

// Author verification (root service contract: index-based decide).
async function verificationList(req, res, which) {
  return base.wrap(res, async () => {
    const { AuthorVerification } = require('../models/application.model');
    if (which === 'recent') {
      const list = await AuthorVerification.find({ status: { $ne: 'pending' } })
        .sort({ updatedAt: -1 }).limit(10).lean();
      return list;
    }
    if (which === 'history') {
      const list = await AuthorVerification.find({ status: { $ne: 'pending' } })
        .sort({ updatedAt: -1 }).limit(50).lean();
      return list;
    }
    const list = await AuthorVerification.find({ status: 'pending' }).sort({ createdAt: 1 }).lean();
    return list;
  });
}

async function verificationDecide(req, res, decision) {
  return base.wrap(res, async () => {
    const { AuthorVerification } = require('../models/application.model');
    const pending = await AuthorVerification.find({ status: 'pending' }).sort({ createdAt: 1 }).lean();
    const idx = parseInt(req.valid.params.idx, 10);
    const target = pending[idx];
    if (!target) { const e = new Error('not_found'); e.status = 404; throw e; }
    // Verification = verified badge on profile only. No role grants here.
    await AuthorVerification.updateOne({ id: target.id }, { status: decision });
    return { ok: true, id: target.id, status: decision };
  });
}

// Author messages: send (find-or-create conversation + socket emit).
async function sendMessage(req, res) {
  return base.wrap(res, async () => {
    const { Conversation, Message } = require('../models/social.model');
    const { toUserId, conversationId, text } = req.valid.body;
    let conv = conversationId ? await Conversation.findOne({ id: conversationId }) : null;
    if (!conv) {
      conv = await Conversation.create({ participants: [req.user.id, toUserId], preview: String(text).slice(0, 80) });
    }
    const msg = await Message.create({
      conversationId: conv.id, senderId: req.user.id, fromRole: 'editor', text,
    });
    conv.preview = String(text).slice(0, 80);
    conv.updatedAt = new Date();
    await conv.save();
    try {
      const { getIo } = require('../socket');
      const io = getIo();
      if (io) conv.participants.forEach(pid => io.to('user:' + pid).emit('message', msg.toJSON()));
    } catch (e) {}
    res.status(201);
    return msg.toJSON();
  });
}

// Book management: rate / flag / unflag (password-gated actions).
async function verifyActorPassword(req, password) {
  const argon2 = require('argon2');
  const { User } = require('../models/user.model');
  const u = await User.findOne({ id: req.user.id }).select('+passwordHash');
  if (!u || !u.passwordHash) { const e = new Error('oauth_only'); e.status = 400; throw e; }
  const ok = await argon2.verify(u.passwordHash, String(password || '')).catch(() => false);
  if (!ok) { const e = new Error('invalid_password'); e.status = 401; throw e; }
  return u;
}

async function rateBook(req, res) {
  return base.wrap(res, async () => {
    const { Book } = require('../models/content.model');
    const b = await Book.findOne({ id: req.valid.params.id });
    if (!b) { const e = new Error('not_found'); e.status = 404; throw e; }
    const r = Number(req.valid.body.rating);
    if (!(r >= 0 && r <= 5)) { const e = new Error('bad_rating'); e.status = 400; throw e; }
    b.rating = r;
    await b.save();
    return { id: b.id, rating: b.rating };
  });
}

async function flagBook(req, res) {
  return base.wrap(res, async () => {
    const { Book } = require('../models/content.model');
    const { reason, note, password } = req.valid.body;
    if (!reason) { const e = new Error('reason_required'); e.status = 400; throw e; }
    const actor = await verifyActorPassword(req, password);
    const b = await Book.findOne({ id: req.valid.params.id });
    if (!b) { const e = new Error('not_found'); e.status = 404; throw e; }
    b.flagPrevStatus = b.status;
    b.status = 'flagged';
    b.flagReason = String(reason).slice(0, 200);
    b.flagNote = String(note || '').slice(0, 2000);
    b.flaggedBy = actor.id;
    b.flaggedAt = new Date();
    await b.save();
    try {
      const { notify } = require('../services/notifications.service');
      await notify({ recipientId: b.authorId, type: 'moderation', title: 'Book flagged', desc: 'Your book "' + b.title + '" was flagged for review.' });
    } catch (e) {}
    return { id: b.id, status: b.status, flagReason: b.flagReason };
  });
}

async function unflagBook(req, res) {
  return base.wrap(res, async () => {
    const { Book } = require('../models/content.model');
    await verifyActorPassword(req, req.valid.body && req.valid.body.password);
    const b = await Book.findOne({ id: req.valid.params.id });
    if (!b) { const e = new Error('not_found'); e.status = 404; throw e; }
    b.status = b.flagPrevStatus && b.flagPrevStatus !== 'flagged' ? b.flagPrevStatus : 'published';
    b.flagReason = '';
    b.flagNote = '';
    b.flaggedBy = null;
    b.flaggedAt = null;
    b.flagPrevStatus = null;
    await b.save();
    return { id: b.id, status: b.status };
  });
}

module.exports = {
  res, dashboard, activity, signContract, sendMessage, reviewDecide, contractSend,
  approveChapterEdit, rejectChapterEdit, approveBookEdit, rejectBookEdit,
  rateBook, flagBook, unflagBook,
  verificationRequests: (req, res) => verificationList(req, res, 'requests'),
  verificationRecent: (req, res) => verificationList(req, res, 'recent'),
  verificationHistory: (req, res) => verificationList(req, res, 'history'),
  verificationApprove: (req, res) => verificationDecide(req, res, 'approved'),
  verificationReject: (req, res) => verificationDecide(req, res, 'rejected'),
};
