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

// Report decisions write resolved/dismissed (never approved/rejected).
async function reportResolve(req, res) {
  return base.wrap(res, async () => senior.decideReport(req.user, req.valid.params.id, 'resolved',
    req.valid.body && req.valid.body.note));
}
async function reportDismiss(req, res) {
  return base.wrap(res, async () => senior.decideReport(req.user, req.valid.params.id, 'dismissed',
    req.valid.body && req.valid.body.note));
}
async function reportReopen(req, res) {
  return base.wrap(res, async () => senior.reopenReport(req.user, req.valid.params.id));
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

// Pricing arrives in two shapes from the same panel: a rows array (review
// queue) or prices/ads maps keyed by chapter number (contract review). Only the
// rows form is ever stored, so paidCount and the reader paywall read one
// source. free is chapter <= freeChapters, which is the panel's own rule.
function pricingPatch(t, contractId, bookId) {
  const rows = (() => {
    if (Array.isArray(t.rows) && t.rows.length) return t.rows;
    const prices = t.prices || {};
    const ads = t.ads || {};
    const free = Number(t.freeChapters) || 0;
    const nums = [...new Set(Object.keys(prices).concat(Object.keys(ads)).map(Number))]
      .filter(n => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
    return nums.map(n => ({ num: n, price: Number(prices[n]) || 0, ads: Number(ads[n]) || 0, free: n <= free }));
  })();
  return {
    contractId, bookId,
    freeChapters: t.freeChapters || 0,
    adsPerChapter: t.adsPerChapter || 0,
    allowAdUnlock: t.allowAdUnlock !== false,
    rows,
    paidCount: rows.filter(r => !r.free).length,
  };
}

// Platform signature: only for this editor's writer, and only after the author
// has signed ('approved'). Terms lock here — pricing sent with the signature
// replaces the stored block, otherwise the saved rows keep their values and are
// only marked signed.
async function signContract(req, res) {
  return base.wrap(res, async () => {
    const { Contract } = require('../models/contract.model');
    const { ContractPricing } = require('../models/revenue.model');
    const c = await Contract.findOne({ id: req.valid.params.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, c.authorId);
    if (c.status !== 'approved') { const e = new Error('contract_not_open'); e.status = 409; throw e; }

    const t = req.valid.body.pricing;
    if (t) {
      await ContractPricing.findOneAndUpdate(
        { contractId: c.id },
        Object.assign(pricingPatch(t, c.id, c.bookId), { status: 'signed' }),
        { upsert: true, new: true }
      );
    } else {
      await ContractPricing.updateOne({ contractId: c.id }, { $set: { status: 'signed' } });
    }
    const now = new Date();
    c.status = 'signed';
    c.signedAt = now;
    c.signatures.push({ by: String(req.user.id), role: 'editor', at: now });
    await c.save();
    try {
      const { emit } = require('../services/notification-emitter');
      await emit({ recipientId: c.authorId, type: 'contract_update', title: 'Contract signed', desc: 'Your contract is now active.' });
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

      // Only the book was reviewed. Its chapters now go live with it —
      // scheduled ones keep their timer. Later chapters publish on save.
      const { Chapter } = require('../models/content.model');
      await Chapter.updateMany(
        { bookId: String(book.id), status: 'draft' },
        { $set: { status: 'live' } }
      );
      // Record the deciding editor: for a reader's submission this is the
      // allocation the chief made (a writer's book already points at their SE).
      await Book.updateOne(
        { id: book.id },
        { $set: { assignedSeId: req.user.id, reviewFeedback: '' } }
      );
      book.assignedSeId = String(req.user.id);
      book.reviewFeedback = '';

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

    // Rejected: the manuscript returns to the author's drafts with the reason
    // attached (the author sees it in their workspace); any pending publish
    // proposal is closed with the same reason so it leaves the queue.
    book.status = 'draft';
    book.reviewFeedback = String(feedback).slice(0, 2000);
    book.assignedSeId = String(req.user.id);
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
    const { AuthorVerification } = require('../models/application.model');
    const c = await Contract.findOne({ id: req.valid.params.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, c.authorId);
    // Terms can only be replaced before either signature exists.
    if (!['draft', 'pending', 'sent'].includes(c.status)) {
      const e = new Error('contract_not_open'); e.status = 409; throw e;
    }
    // Same gate as every other offer path: identity verified or no offer.
    const v = await AuthorVerification.findOne({ userId: c.authorId }).select('status').lean();
    if (!v || v.status !== 'approved') { const e = new Error('identity_not_verified'); e.status = 409; throw e; }
    const offer = await sidebar.resolveTemplate(req.valid.body.templateId);
    c.type = offer.type;
    c.templateId = offer.templateId;
    c.duration = offer.duration;
    c.termMonths = offer.termMonths;
    c.revenueSplit = offer.revenueSplit;
    c.status = 'sent';
    c.sentAt = new Date();
    await c.save();
    return c.toJSON();
  });
}

// Chapter pricing is editable at any point in the contract's life (the console
// keeps the table live after signing — only the commercial terms are locked).
// What is enforced here is ownership: the contract must exist and belong to one
// of this editor's writers, so pricing can't be planted against a bare id.
async function contractPricing(req, res) {
  return base.wrap(res, async () => {
    const { Contract } = require('../models/contract.model');
    const { ContractPricing } = require('../models/revenue.model');
    const c = await Contract.findOne({ id: req.valid.params.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, c.authorId);

    const body = req.valid.body;
    const patch = Object.assign(
      pricingPatch(body, c.id, body.bookId || c.bookId),
      { status: c.status === 'signed' || c.status === 'active' ? 'signed' : 'pending' }
    );
    const doc = await ContractPricing.findOneAndUpdate(
      { contractId: c.id },
      { $set: patch },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc;
  });
}

// Direct offer: the editor picks the author and a chief-editor template (no
// application to answer). Workflow fields are set here, never by the client.
async function contractCreate(req, res) {
  return base.wrap(res, async () => {
    const { Contract } = require('../models/contract.model');
    const { Book } = require('../models/content.model');
    const { User } = require('../models/user.model');
    const { AuthorVerification } = require('../models/application.model');

    const body = req.valid.body;
    const author = await User.findOne({ id: body.authorId }).select('id').lean();
    if (!author) { const e = new Error('author_not_found'); e.status = 404; throw e; }
    await senior.assertOwned(req.user, author.id);

    const v = await AuthorVerification.findOne({ userId: author.id }).select('status').lean();
    if (!v || v.status !== 'approved') { const e = new Error('identity_not_verified'); e.status = 409; throw e; }

    if (body.bookId) {
      const book = await Book.findOne({ id: body.bookId }).select('authorId').lean();
      if (!book || String(book.authorId) !== String(author.id)) {
        const e = new Error('book_not_found'); e.status = 404; throw e;
      }
    }

    const offer = await sidebar.resolveTemplate(body.templateId);
    const contract = await Contract.create({
      bookId: body.bookId || undefined,
      authorId: author.id,
      type: offer.type,
      templateId: offer.templateId,
      status: 'sent',
      sentAt: new Date(),
      editorId: req.user.id,
      duration: offer.duration,
      termMonths: offer.termMonths,
      revenueSplit: offer.revenueSplit,
      advance: body.advance || 0,
      authorNote: body.authorNote || '',
    });
    // The book reads 'offer pending' until the author signs (sign sets contracted).
    if (body.bookId) await Book.updateOne({ id: body.bookId }, { contractStatus: 'review' });

    try {
      const { emit } = require('../services/notification-emitter');
      await emit({
        recipientId: author.id, type: 'contract_update',
        title: 'Contract offer ready',
        desc: 'Your editor sent a contract — review and sign it in Author Center.',
      });
    } catch (e) {}

    res.status(201);
    return contract.toJSON();
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
    const { ContractPricing } = require('../models/revenue.model');
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

    const [books, users, verifications, contracts, pricings] = await Promise.all([
      Book.find({ id: { $in: bookIds } }).select('id title genre chapterCount cover').lean(),
      User.find({ id: { $in: authorIds } }).select('id fullName username avatar email').lean(),
      AuthorVerification.find({ userId: { $in: authorIds } }).select('userId status kyc').lean(),
      contractIds.length
        ? Contract.find({ id: { $in: contractIds } }).select('id bookId type templateId status duration revenueSplit authorNote').lean()
        : [],
      contractIds.length
        ? ContractPricing.find({ contractId: { $in: contractIds } }).lean()
        : [],
    ]);
    const bookOf = new Map(books.map((b) => [b.id, b]));
    const userOf = new Map(users.map((u) => [u.id, u]));
    const verifOf = new Map(verifications.map((v) => [v.userId, v]));
    const contractOf = new Map(contracts.map((c) => [c.id, c]));
    const pricingOf = new Map(pricings.map((p) => [p.contractId, p]));

    return apps.map((a) => {
      const b = bookOf.get(a.bookId) || {};
      const u = userOf.get(a.authorId) || {};
      const v = verifOf.get(a.authorId);
      const c = a.contractId ? contractOf.get(a.contractId) : null;
      const p = a.contractId ? pricingOf.get(a.contractId) : null;
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
        ct: c ? c.templateId || '' : '',
        type: c ? c.type : a.type || '',
        term: c ? c.duration : '',
        rev: c ? `${c.revenueSplit}/${100 - c.revenueSplit}` : '',
        submitted: fmtDate(a.submittedAt || a.createdAt),
        status: consoleContractStatus(a, c),
        sent: !!c,
        notes: (c && c.authorNote) || '',
        // Saved monetization, so the page reopens on the real terms.
        pricing: p ? {
          freeChapters: p.freeChapters || 0,
          adsPerChapter: p.adsPerChapter || 0,
          allowAdUnlock: p.allowAdUnlock !== false,
          prices: Object.fromEntries((p.rows || []).map((r) => [r.num, r.price])),
          ads: Object.fromEntries((p.rows || []).map((r) => [r.num, r.ads])),
        } : null,
        kyc: v ? v.kyc : null,
        verificationStatus: v ? v.status : 'none',
      };
    });
  });
}

// Approve = send the offer for the chosen chief-editor template. The book goes
// to 'review' (live, offer pending); the author's signature is the only thing
// that makes it 'contracted'.
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
    const offer = await sidebar.resolveTemplate(body.templateId);
    const claimed = await ContractApplication.findOneAndUpdate(
      { id: app.id, status: 'applied' },
      { $set: { status: 'review', type: offer.type, reviewerId: req.user.id, decidedAt: new Date() } },
      { new: true }
    );
    if (!claimed) { const e = new Error('not_decidable'); e.status = 409; throw e; }

    let contract;
    try {
      contract = await Contract.create({
        bookId: app.bookId,
        authorId: app.authorId,
        type: offer.type,
        templateId: offer.templateId,
        status: 'sent',
        sentAt: new Date(),
        editorId: req.user.id,
        duration: offer.duration,
        termMonths: offer.termMonths,
        revenueSplit: offer.revenueSplit,
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
    await sidebar.saveOfferPricing(contract.id, app.bookId, body.pricing, 'pending');

    try {
      const { emit } = require('../services/notification-emitter');
      await emit({
        recipientId: app.authorId, type: 'contract_update',
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
      const { emit } = require('../services/notification-emitter');
      await emit({
        recipientId: app.authorId, type: 'contract_update',
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

// Book management: rate / flag / unflag (password-gated actions). The flag itself
// lives in services/book-flag.service.js, which only the assigned senior editor
// can reach — the chief reads the flagged queue and never acts on it.
async function verifyActorPassword(req, password) {
  const { verifyPassword } = require('../middleware/auth');
  return verifyPassword(req.user.id, password);
}

async function flagBook(req, res) {
  return base.wrap(res, async () => {
    const flag = require('../services/book-flag.service');
    const { reason, note, password } = req.valid.body;
    const actor = await verifyActorPassword(req, password);
    return flag.flagBook(req.valid.params.id, { reason, note },
      { user: req.user, actor });
  });
}

async function unflagBook(req, res) {
  return base.wrap(res, async () => {
    const flag = require('../services/book-flag.service');
    await verifyActorPassword(req, req.valid.body && req.valid.body.password);
    return flag.unflagBook(req.valid.params.id, { user: req.user });
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
  flagBook, unflagBook, myAuthors, referralCode, rotateReferralCode,
  reviewQueue, booksList, completionList, completionApprove, completionReject,
  chapterEditList, bookEditList, authorsList,
  messagesList, messageThread, messageUpdate, messageSend, messagesReadAll,
  reportResolve, reportDismiss, reportReopen,
  verificationRequests: (req, res) => verificationList(req, res, 'requests'),
  verificationRecent: (req, res) => verificationList(req, res, 'recent'),
  verificationHistory: (req, res) => verificationList(req, res, 'history'),
  verificationApprove: (req, res) => verificationDecide(req, res, 'approved'),
  verificationReject: (req, res) => verificationDecide(req, res, 'rejected'),
  contractApplications, contractApprove, contractAppReject, contractCreate,
  contractPricing,
};