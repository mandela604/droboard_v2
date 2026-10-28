'use strict';
const senior = require('../services/senior.service');
const sidebar = require('../services/senior-sidebar.service');
const base = require('./base.controller');

function res(name) {
  // Every access is scoped to the caller: senior editors only see their own
  // assigned authors' work (see senior.service.scopedResources).
  const scoped = async (req) => (await senior.scopedResources(req.user))[name]();
  return {
    list: async (req, res) => base.wrap(res, async () => (await scoped(req)).list(req.valid.query)),
    get: async (req, res) => base.wrap(res, async () => (await scoped(req)).get(req.valid.params.id)),
    create: async (req, res) => base.wrap(res, async () => {
      const out = await (await scoped(req)).create(req.valid.body);
      res.status(201);
      return out;
    }),
    update: async (req, res) => base.wrap(res, async () =>
      (await scoped(req)).update(req.valid.params.id, req.valid.body)),
    remove: async (req, res) => base.wrap(res, async () =>
      (await scoped(req)).remove(req.valid.params.id)),
    approve: async (req, res) => base.wrap(res, async () =>
      (await scoped(req)).setStatus(req.valid.params.id, 'approved')),
    reject: async (req, res) => base.wrap(res, async () =>
      (await scoped(req)).setStatus(req.valid.params.id, 'rejected')),
  };
}

async function dashboard(req, res) {
  return base.wrap(res, async () => sidebar.dashboard(req.user));
}

async function activity(req, res) {
  return base.wrap(res, async () => sidebar.activity(req.user, req.valid.query));
}

/* ── Sidebar read surfaces (decorated) ───────────────────────────────── */

async function reviewQueue(req, res) {
  return base.wrap(res, async () => sidebar.reviews(req.user, req.valid.query));
}

async function booksList(req, res) {
  return base.wrap(res, async () => sidebar.books(req.user, req.valid.query));
}

async function completionList(req, res) {
  return base.wrap(res, async () => sidebar.completions(req.user, req.valid.query));
}

async function completionApprove(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () =>
    sidebar.decideCompletion(req.user, req.valid.params.id, 'approved', note));
}

async function completionReject(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () =>
    sidebar.decideCompletion(req.user, req.valid.params.id, 'rejected', note));
}

async function chapterEditList(req, res) {
  return base.wrap(res, async () => sidebar.chapterEdits(req.user, req.valid.query));
}

async function bookEditList(req, res) {
  return base.wrap(res, async () => sidebar.bookEdits(req.user, req.valid.query));
}

async function authorsList(req, res) {
  return base.wrap(res, async () => sidebar.authors(req.user, req.valid.query));
}

async function messagesList(req, res) {
  return base.wrap(res, async () => sidebar.messages(req.user, req.valid.query));
}

async function messageThread(req, res) {
  return base.wrap(res, async () => sidebar.thread(req.user, req.valid.params.id));
}

async function messageUpdate(req, res) {
  return base.wrap(res, async () =>
    sidebar.messageUpdate(req.user, req.valid.params.id, req.valid.body));
}

async function messageSend(req, res) {
  return base.wrap(res, async () =>
    sidebar.messageSend(req.user, req.valid.params.id, req.valid.body));
}

async function messagesReadAll(req, res) {
  return base.wrap(res, async () => sidebar.messagesReadAll(req.user));
}

async function contractTypes(req, res) {
  return base.wrap(res, async () => sidebar.contractTypes());
}

// Report decisions write resolved/dismissed (never approved/rejected).
async function reportResolve(req, res) {
  return base.wrap(res, async () => senior.decideReport(req.user, req.valid.params.id, 'resolved',
    req.valid.body && req.valid.body.note));
}
async function reportDismiss(req, res) {
  return base.wrap(res, async () => senior.decideReport(req.user, req.valid.params.id, 'dismissed',
    req.valid.body && req.valid.body.note));
}

// Edit proposals: approve APPLIES content to the live book/chapter (the only
// time an author edit takes effect). Reject leaves live untouched + note.
// req.user rides along so the service can enforce author ownership.
async function approveChapterEdit(req, res) {
  return base.wrap(res, async () => senior.approveChapterEdit(req.valid.params.id, req.user.id, req.user));
}

async function rejectChapterEdit(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () => senior.rejectChapterEdit(req.valid.params.id, req.user.id, note, req.user));
}

async function approveBookEdit(req, res) {
  return base.wrap(res, async () => senior.approveBookEdit(req.valid.params.id, req.user.id, req.user));
}

async function rejectBookEdit(req, res) {
  const note = req.valid.body && req.valid.body.note;
  return base.wrap(res, async () => senior.rejectBookEdit(req.valid.params.id, req.user.id, note, req.user));
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

// Review queue decide. Accepts either a ReviewSubmission id (legacy/manual
// entries) or a Book id (the normal path: author moved draft → under_review).
async function reviewDecide(req, res) {
  return base.wrap(res, async () => {
    const { ReviewSubmission, BookEdit } = require('../models/application.model');
    const { Book } = require('../models/content.model');
    const action = req.valid.body.action;
    const feedback = req.valid.body.feedback;

    const submission = await ReviewSubmission.findOne({ id: req.valid.params.id });
    if (submission) {
      await senior.assertOwned(req.user, submission.authorId);
      submission.status = action;
      if (feedback !== undefined) submission.feedback = feedback;
      // Records who decided + (re)routes to the acting editor if it was unassigned.
      submission.assignedSeId = req.user.id;
      await submission.save();
      if (action === 'approved') {
        const offer = req.valid.body.contract
          ? await sidebar.offerContract(req.user, {
            bookId: submission.bookId,
            authorId: submission.authorId,
            terms: req.valid.body.contract,
          })
          : null;
        await publishBookForSubmission(submission.bookId);
        await grantWriterRole(submission.authorId);
        return Object.assign({}, submission.toJSON(), offer ? { contract: offer } : {});
      }
      return submission.toJSON();
    }

    const book = await Book.findOne({ id: req.valid.params.id });
    if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, book.authorId);
    if (book.status !== 'under_review') { const e = new Error('not_pending'); e.status = 409; throw e; }

    if (action === 'approved') {
      // Publish first: if the manuscript can't go live, no offer should exist.
      // An open publish proposal carries the target status + any content edits
      // the author sent with it — approving the manuscript approves both.
      const proposal = await BookEdit.findOne({ bookId: book.id, status: 'pending' });
      const booksService = require('../services/books.service');
      let out;
      if (proposal) {
        out = await booksService.applyBookProposal({ proposal, reviewerId: req.user.id });
      } else {
        if ((book.wordCount || 0) < booksService.BOOK_LIVE_MIN_WORDS) {
          const e = new Error('below_min_words_5k'); e.status = 400; throw e;
        }
        book.status = 'published';
        await book.save();
        out = book.toJSON();
      }

      // The book is live even if the offer cannot be sent (books publish with
      // no contract) — the KYC gate only blocks the contract, and the editor
      // can send the offer from Contract Review once verification passes.
      let offer = null;
      if (req.valid.body.contract) {
        offer = await sidebar.offerContract(req.user, {
          bookId: book.id,
          authorId: book.authorId,
          terms: req.valid.body.contract,
        });
      }
      await grantWriterRole(book.authorId);
      return offer ? Object.assign({}, out, { contract: offer }) : out;
    }

    // Product rule: a rejection always carries a written reason for the author.
    if (!feedback || !String(feedback).trim()) {
      const e = new Error('feedback_required'); e.status = 400; throw e;
    }

    // Rejected: the manuscript returns to the author's drafts; any pending
    // publish proposal is closed with the same reason so it leaves the queue.
    book.status = 'draft';
    await book.save();
    await BookEdit.updateMany(
      { bookId: book.id, status: 'pending' },
      { $set: { status: 'rejected', reviewerId: req.user.id, reviewNote: feedback || '', decidedAt: new Date() } }
    );
    return book.toJSON();
  });
}

// A reader becomes a WRITER only when a submission of theirs is approved.
// Editor-code signups already hold the role, so this is a no-op for them.
async function grantWriterRole(authorId) {
  try {
    const { User } = require('../models/user.model');
    await User.updateOne(
      { id: String(authorId), roles: { $ne: 'writer' } },
      { $addToSet: { roles: 'writer' }, $set: { primaryRole: 'writer' } }
    );
  } catch (e) { /* role grant is best-effort */ }
}

// Legacy ReviewSubmission approval: push its book live if it was still pending.
async function publishBookForSubmission(bookId) {
  if (!bookId) return;
  try {
    const { Book } = require('../models/content.model');
    await Book.updateOne(
      { id: String(bookId), status: { $in: ['under_review'] } },
      { $set: { status: 'published' } }
    );
  } catch (e) { /* book publish is best-effort for legacy rows */ }
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
function docLabel(kyc) {
  if (!kyc) return 'No documents';
  if (kyc.type === 'guardian') return 'Guardian ID';
  if (kyc.type === 'pending') return (kyc.altId && kyc.altId.type) || 'Alternate ID';
  return 'National ID (NIN)';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// The console keys rows by person, so each record carries the author's display
// fields and the owning editor. A writer with no owner stays unassigned rather
// than inheriting a demo reviewer.
async function decorateVerifications(list) {
  const { User } = require('../models/user.model');
  const { EditorAssignment } = require('../models/chief.model');
  const userIds = list.map((r) => r.userId).filter(Boolean);
  if (!userIds.length) return list;
  const [users, assigns] = await Promise.all([
    User.find({ id: { $in: userIds } }).select('id fullName username email avatar').lean(),
    EditorAssignment.find({ authorIds: { $in: userIds } }).select('editorId authorIds').lean(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const ownerOf = new Map();
  for (const a of assigns) for (const uid of a.authorIds) if (!ownerOf.has(uid)) ownerOf.set(uid, a.editorId);
  const editorIds = [...new Set(ownerOf.values())];
  const editors = editorIds.length
    ? await User.find({ id: { $in: editorIds } }).select('id fullName avatar').lean()
    : [];
  const edById = new Map(editors.map((u) => [u.id, u]));
  return list.map((r) => {
    const u = byId.get(r.userId) || {};
    const ed = edById.get(ownerOf.get(r.userId));
    const submitted = fmtDate(r.submittedAt || r.createdAt);
    return {
      ...r,
      name: u.fullName || u.username || 'Unknown author',
      email: u.email || '',
      avatar: u.avatar || '',
      doc: docLabel(r.kyc),
      docIcon: 'fa-id-card',
      submitted,
      meta: (r.status === 'approved' ? 'Approved · ' : r.status === 'rejected' ? 'Rejected · ' : 'Pending · ') + submitted,
      reviewer: ed ? { name: ed.fullName, avatar: ed.avatar || '', via: 'assigned' } : null,
    };
  });
}

// Every writer belongs to exactly one senior editor (invite or assignment), so
// the queue is strictly that editor's writers; chief/admin see the platform.
async function scopeVerifications(req, list) {
  const ids = await senior.scopeAuthorIds(req.user);
  if (ids === null) return list;
  const mine = new Set(ids.map(String));
  return list.filter((r) => mine.has(String(r.userId)));
}

async function verificationList(req, res, which) {
  return base.wrap(res, async () => {
    const { AuthorVerification } = require('../models/application.model');
    if (which === 'recent') {
      const list = await AuthorVerification.find({ status: { $ne: 'pending' } })
        .sort({ updatedAt: -1 }).limit(10).lean();
      return decorateVerifications(await scopeVerifications(req, list));
    }
    if (which === 'history') {
      const list = await AuthorVerification.find({ status: { $ne: 'pending' } })
        .sort({ updatedAt: -1 }).limit(50).lean();
      return decorateVerifications(await scopeVerifications(req, list));
    }
    const list = await AuthorVerification.find({ status: 'pending' }).sort({ createdAt: 1 }).lean();
    return decorateVerifications(await scopeVerifications(req, list));
  });
}

async function verificationDecide(req, res, decision) {
  return base.wrap(res, async () => {
    const { AuthorVerification } = require('../models/application.model');
    const target = await AuthorVerification.findOne({ id: req.valid.params.id, status: 'pending' }).lean();
    if (!target) { const e = new Error('not_found_or_decided'); e.status = 409; throw e; }

    // 404 for another editor's writer — a senior editor can't probe the queue.
    await senior.assertOwned(req.user, target.userId);

    // Rejection is never silent — the author needs to know what to fix.
    const reason = (req.valid.body && req.valid.body.reason) || '';
    if (decision === 'rejected' && reason.trim().length < 5) {
      const e = new Error('rejection_reason_required');
      e.status = 400;
      throw e;
    }

    // Atomic claim on the row itself: deciding by queue index let two editors
    // shift the list under each other and approve the wrong writer.
    const updated = await AuthorVerification.findOneAndUpdate(
      { id: target.id, status: 'pending' },
      { $set: { status: decision, reviewerId: req.user.id, reviewNote: reason.trim() } },
      { new: true }
    );
    if (!updated) { const e = new Error('not_found_or_decided'); e.status = 409; throw e; }
    return { ok: true, id: updated.id, status: decision, reviewerId: req.user.id };
  });
}

// ── Contract applications (the author's apply → the editor's offer) ─────────
// Console type keys, kept in sync with public/senior-editor/contract-review-service.js.
const CONSOLE_TYPE = {
  Exclusive_Publishing: 'exclusive',
  Non_Exclusive: 'non-exclusive',
  Revenue_Share: 'revenue-share',
  License_Agreement: 'licensing',
};

function consoleContractStatus(app, contract) {
  if (contract) {
    if (contract.status === 'signed' || contract.status === 'active') return 'signed';
    if (contract.status === 'approved') return 'approved'; // author signed, platform signature next
    if (contract.status === 'sent') return 'pending';
    if (['rejected', 'terminated', 'expired'].includes(contract.status)) return 'rejected';
  }
  return app.status === 'rejected' ? 'rejected' : 'pending';
}

async function contractApplications(req, res) {
  return base.wrap(res, async () => {
    const { ContractApplication, AuthorVerification } = require('../models/application.model');
    const { Contract } = require('../models/contract.model');
    const { Book } = require('../models/content.model');
    const { User } = require('../models/user.model');

    const ids = await senior.scopeAuthorIds(req.user);
    const apps = await ContractApplication.find({
      status: { $in: ['applied', 'review', 'contracted', 'rejected'] },
      ...(ids === null ? {} : { authorId: { $in: ids } }),
    }).sort({ submittedAt: -1 }).limit(200).lean();
    if (!apps.length) return [];

    const bookIds = [...new Set(apps.map((a) => a.bookId))];
    const authorIds = [...new Set(apps.map((a) => a.authorId))];
    const contractIds = [...new Set(apps.map((a) => a.contractId).filter(Boolean))];

    const [books, users, verifications, contracts] = await Promise.all([
      Book.find({ id: { $in: bookIds } }).select('id title genre chapterCount cover').lean(),
      User.find({ id: { $in: authorIds } }).select('id fullName username avatar email').lean(),
      AuthorVerification.find({ userId: { $in: authorIds } }).select('userId status kyc').lean(),
      contractIds.length
        ? Contract.find({ id: { $in: contractIds } }).select('id bookId type status duration revenueSplit authorNote').lean()
        : [],
    ]);
    const bookOf = new Map(books.map((b) => [b.id, b]));
    const userOf = new Map(users.map((u) => [u.id, u]));
    const verifOf = new Map(verifications.map((v) => [v.userId, v]));
    const contractOf = new Map(contracts.map((c) => [c.id, c]));

    return apps.map((a) => {
      const b = bookOf.get(a.bookId) || {};
      const u = userOf.get(a.authorId) || {};
      const v = verifOf.get(a.authorId);
      const c = a.contractId ? contractOf.get(a.contractId) : null;
      return {
        id: a.id,
        contractId: c ? c.id : '',
        bookId: a.bookId,
        author: u.fullName || u.username || 'Unknown author',
        email: u.email || '',
        avatar: u.avatar || '',
        bookTitle: b.title || '',
        bookGenre: b.genre || '',
        chapters: b.chapterCount || 0,
        cover: b.cover || '',
        ct: c ? CONSOLE_TYPE[c.type] || '' : '',
        type: c ? c.type : a.type || '',
        term: c ? c.duration : '',
        rev: c ? `${c.revenueSplit}/${100 - c.revenueSplit}` : '',
        submitted: fmtDate(a.submittedAt || a.createdAt),
        status: consoleContractStatus(a, c),
        sent: !!c,
        notes: (c && c.authorNote) || '',
        kyc: v ? v.kyc : null,
        verificationStatus: v ? v.status : 'none',
      };
    });
  });
}

// Approve = assign the deal type and send the offer. The book goes to 'review'
// (live, offer pending); the author's signature is the only thing that makes it
// 'contracted'.
async function contractApprove(req, res) {
  return base.wrap(res, async () => {
    const { ContractApplication, AuthorVerification } = require('../models/application.model');
    const { Contract } = require('../models/contract.model');
    const { Book } = require('../models/content.model');

    const app = await ContractApplication.findOne({ id: req.valid.params.id });
    if (!app) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, app.authorId);

    // Signing is a verified-identity action — no offer goes out otherwise.
    const v = await AuthorVerification.findOne({ userId: app.authorId }).select('status').lean();
    if (!v || v.status !== 'approved') { const e = new Error('identity_not_verified'); e.status = 409; throw e; }

    const body = req.valid.body;
    const claimed = await ContractApplication.findOneAndUpdate(
      { id: app.id, status: 'applied' },
      { $set: { status: 'review', type: body.type, reviewerId: req.user.id, decidedAt: new Date() } },
      { new: true }
    );
    if (!claimed) { const e = new Error('not_decidable'); e.status = 409; throw e; }

    let contract;
    try {
      contract = await Contract.create({
        bookId: app.bookId,
        authorId: app.authorId,
        type: body.type,
        status: 'sent',
        sentAt: new Date(),
        editorId: req.user.id,
        duration: body.termMonths + ' months',
        termMonths: body.termMonths,
        revenueSplit: body.revenueSplit,
        advance: body.advance || 0,
        authorNote: body.note || '',
      });
    } catch (e) {
      // Never leave the application claimed without an offer behind it.
      await ContractApplication.updateOne({ id: app.id }, { $set: { status: 'applied', contractId: '' } });
      throw e;
    }
    await ContractApplication.updateOne({ id: app.id }, { $set: { contractId: contract.id } });
    await Book.updateOne({ id: app.bookId }, { contractStatus: 'review' });

    try {
      const { notify } = require('../services/notifications.service');
      await notify({
        recipientId: app.authorId, type: 'contract',
        title: 'Contract offer ready',
        desc: 'Your editor sent a contract — review and sign it in Author Center.',
      });
    } catch (e) {}

    return { ok: true, appId: app.id, contractId: contract.id, status: 'sent' };
  });
}

async function contractAppReject(req, res) {
  return base.wrap(res, async () => {
    const { ContractApplication } = require('../models/application.model');
    const { Contract } = require('../models/contract.model');
    const { Book } = require('../models/content.model');

    const app = await ContractApplication.findOne({ id: req.valid.params.id });
    if (!app) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, app.authorId);

    const reason = req.valid.body.reason.trim();
    const now = new Date();
    // 'applied' = turn the application down; 'review' = withdraw the open offer.
    const updated = await ContractApplication.findOneAndUpdate(
      { id: app.id, status: { $in: ['applied', 'review'] } },
      { $set: { status: 'rejected', reviewerId: req.user.id, reviewNote: reason, decidedAt: now } },
      { new: true }
    );
    if (!updated) { const e = new Error('not_decidable'); e.status = 409; throw e; }

    if (app.contractId) {
      await Contract.findOneAndUpdate(
        { id: app.contractId, status: 'sent' },
        {
          $set: { status: 'rejected' },
          $push: { replies: { from: 'editor', message: reason, at: now } },
        }
      );
    }
    await Book.updateOne({ id: app.bookId }, { contractStatus: 'none' });

    try {
      const { notify } = require('../services/notifications.service');
      await notify({
        recipientId: app.authorId, type: 'contract',
        title: 'Contract application not accepted',
        desc: reason,
      });
    } catch (e) {}

    return { ok: true, id: app.id, status: 'rejected' };
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

// Staff book update/delete go through books.service so the same validation,
// slug refresh and genre counts apply as everywhere else.
async function bookUpdate(req, res) {
  return base.wrap(res, async () => {
    const books = require('../services/books.service');
    const book = await books.loadBookById(req.valid.params.id);
    await senior.assertOwned(req.user, book.authorId);
    return books.updateBook({ book, data: req.valid.body });
  });
}

async function bookRemove(req, res) {
  return base.wrap(res, async () => {
    const books = require('../services/books.service');
    const book = await books.loadBookById(req.valid.params.id);
    await senior.assertOwned(req.user, book.authorId);
    return books.deleteBook({ book });
  });
}

async function rateBook(req, res) {
  return base.wrap(res, async () => {
    const { Book } = require('../models/content.model');
    const b = await Book.findOne({ id: req.valid.params.id });
    if (!b) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, b.authorId);
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
    await senior.assertOwned(req.user, b.authorId);
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
    await senior.assertOwned(req.user, b.authorId);
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

// Invite-authors page: this editor's authors + their shared code provenance.
async function myAuthors(req, res) {
  return base.wrap(res, async () => senior.myAuthors(req.user, req.valid.query));
}

// The editor's own invite code (lazily minted) + rotation.
// Signup with this code ⇒ writer role + auto-assigned to this editor.
async function referralCode(req, res) {
  return base.wrap(res, async () => {
    const referrals = require('../services/referrals.service');
    return { code: await referrals.ensureEditorCode(req.user.id) };
  });
}

async function rotateReferralCode(req, res) {
  return base.wrap(res, async () => {
    const referrals = require('../services/referrals.service');
    return { code: await referrals.rotateEditorCode(req.user.id) };
  });
}

module.exports = {
  res, dashboard, activity, signContract, sendMessage, reviewDecide, contractSend,
  approveChapterEdit, rejectChapterEdit, approveBookEdit, rejectBookEdit,
  rateBook, flagBook, unflagBook, bookUpdate, bookRemove, myAuthors, referralCode, rotateReferralCode,
  reviewQueue, booksList, completionList, completionApprove, completionReject,
  chapterEditList, bookEditList, authorsList,
  messagesList, messageThread, messageUpdate, messageSend, messagesReadAll,
  contractTypes,
  reportResolve, reportDismiss,
  verificationRequests: (req, res) => verificationList(req, res, 'requests'),
  verificationRecent: (req, res) => verificationList(req, res, 'recent'),
  verificationHistory: (req, res) => verificationList(req, res, 'history'),
  verificationApprove: (req, res) => verificationDecide(req, res, 'approved'),
  verificationReject: (req, res) => verificationDecide(req, res, 'rejected'),
  contractApplications, contractApprove, contractAppReject,
};
