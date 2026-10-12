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

module.exports = {
  res, dashboard, activity, signContract, sendMessage, reviewDecide, contractSend,
  approveChapterEdit, rejectChapterEdit, approveBookEdit, rejectBookEdit,
  verificationRequests: (req, res) => verificationList(req, res, 'requests'),
  verificationRecent: (req, res) => verificationList(req, res, 'recent'),
  verificationHistory: (req, res) => verificationList(req, res, 'history'),
  verificationApprove: (req, res) => verificationDecide(req, res, 'approved'),
  verificationReject: (req, res) => verificationDecide(req, res, 'rejected'),
};
