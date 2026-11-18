'use strict';
// Author namespace backing author/*.html pages.
// Contracts mirror services/author/*-service.js USE_API declarations:
//   GET /dashboard, /books, /books/:id/overview, /books/:id/characters (CRUD),
//   /books/:id/plot, /books/:bookId/chapters/:num, /contracts, /completion,
//   /vip, /launch-kit, /chapter-reviews
const { Book, Category, Chapter, Character, Plot, BookDailyStat } = require('../models/content.model');
const {
  ContractApplication, CompletionApplication, VipApplication,
  ChapterReviewRequest, AuthorVerification,
} = require('../models/application.model');
const { User } = require('../models/user.model');
const { LaunchCampaign } = require('../models/editorial.model');
const { Contract } = require('../models/contract.model');
const { Wallet, LedgerEntry } = require('../models/money.model');
const { Follow } = require('../models/social.model');

// Percentage change of a metric over its prior 30-day base. null when there is
// no base to divide by — the frontend hides the delta instead of showing a
// made-up 0% or 100%. Never fabricates.
function pctChange(cur, prev) {
  if (!(prev > 0)) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// Ownership scope for author-owned rows. A user row exposes our uuidv7 `id`,
// but rows written before that convention stored the legacy 24-hex `_id` in
// foreign keys such as Book.authorId. Matching only the new id made an author
// with a real book see "No books found" and a 0-book dashboard. Resolve BOTH
// identities of the same account — never anyone else's.
const HEX24 = /^[0-9a-fA-F]{24}$/;
async function authorIds(userId) {
  const key = String(userId || '');
  const q = HEX24.test(key) ? { $or: [{ id: key }, { _id: key }] } : { id: key };
  const u = await User.findOne(q).select('id _id').lean();
  const ids = new Set([key]);
  if (u) {
    if (u.id) ids.add(String(u.id));
    if (u._id) ids.add(String(u._id));
  }
  return Array.from(ids).filter(Boolean);
}
async function authorScope(userId) {
  return { authorId: { $in: await authorIds(userId) } };
}

async function dashboard({ userId }) {
  const DAY = 864e5;
  const now = Date.now();
  const since = (days) => new Date(now - days * DAY);
  // BookDailyStat.day is a YYYY-MM-DD string, so window filtering is lexical.
  const sinceDay = (days) => since(days).toISOString().slice(0, 10);

  const ids = await authorIds(userId);
  const scope = { authorId: { $in: ids } };
  const [bookRows, contracts, user, wallet] = await Promise.all([
    Book.find(scope).select('id status reads').lean(),
    Contract.countDocuments(scope),
    User.findOne(require('./user-ref').userRefFilter(ids)).select('followerCount').lean(),
    Wallet.findOne({ userId: { $in: ids }, kind: 'author' }).select('lifetimeEarned').lean(),
  ]);

  const bookIds = bookRows.map(b => String(b.id));
  const reads = bookRows.reduce((s, b) => s + (b.reads || 0), 0);
  const published = bookRows.filter(b => b.status === 'published' || b.status === 'completed').length;
  const completionRate = bookIds.length ? Math.round((published / bookIds.length) * 100) : 0;

  const [reads30, reads60, newFollow30, earn30, earnPrev, pendingReviews] = await Promise.all([
    // Reads momentum comes from the per-book daily snapshot. Book.reads itself
    // has no timestamps, so summing reads by book.createdAt would misattribute
    // every read to the publish date. reads60 covers days 0-60; the 30-60
    // window is the difference between the two.
    bookIds.length ? BookDailyStat.aggregate([
      { $match: { bookId: { $in: bookIds }, day: { $gte: sinceDay(30) } } },
      { $group: { _id: null, t: { $sum: '$reads' } } },
    ]) : Promise.resolve([]),
    bookIds.length ? BookDailyStat.aggregate([
      { $match: { bookId: { $in: bookIds }, day: { $gte: sinceDay(60) } } },
      { $group: { _id: null, t: { $sum: '$reads' } } },
    ]) : Promise.resolve([]),
    Follow.countDocuments({ followingId: { $in: ids }, createdAt: { $gte: since(30) } }),
    LedgerEntry.aggregate([
      { $match: { creditAcct: { $in: ids.map(id => 'wallet:author:' + id) }, createdAt: { $gte: since(30) } } },
      { $group: { _id: null, t: { $sum: '$amount' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { creditAcct: { $in: ids.map(id => 'wallet:author:' + id) }, createdAt: { $gte: since(60), $lt: since(30) } } },
      { $group: { _id: null, t: { $sum: '$amount' } } },
    ]),
    // ChapterReviewRequest has no authorId column — a review belongs to the
    // author through its book, so scope by this author's book ids.
    ChapterReviewRequest.countDocuments({ bookId: { $in: bookIds }, status: 'pending' }),
  ]);

  const readsLast30 = reads30[0] ? reads30[0].t : 0;
  const readsPrev30 = Math.max(0, (reads60[0] ? reads60[0].t : 0) - readsLast30);
  const earnLast30 = earn30[0] ? earn30[0].t : 0;
  const earnPrev30 = earnPrev[0] ? earnPrev[0].t : 0;
  const followerCount = user ? (user.followerCount || 0) : 0;
  // Net follower-base growth over the window. Follow rows are deleted on
  // unfollow, so the base 30d ago is reconstructed as current less the follows
  // created within it — the only signal the timestamps actually carry.
  const followerBase = Math.max(0, followerCount - newFollow30);

  return {
    stats: {
      books: bookIds.length,
      contracts,
      reads,
      followers: followerCount,
      earnings: wallet ? (wallet.lifetimeEarned || 0) : 0, // fiat credited as writer, base currency
      completionRate,
      pendingReviews,
    },
    growth: {
      reads: pctChange(readsLast30, readsPrev30),
      followers: pctChange(followerCount, followerBase),
      earnings: pctChange(earnLast30, earnPrev30),
      completionRate: null, // no historical ratio snapshot to diff — never fabricated
    },
  };
}

// The create-wizard's "continue this book" list and book-workspace both read
// this: every Book field plus lastChapter (highest chapter n) and the category
// label, so the frontend never has to join books -> chapters -> categories.
async function books({ userId }) {
  const rows = await Book.find(await authorScope(userId)).sort({ updatedAt: -1 }).lean();
  if (!rows.length) return [];
  const bookIds = rows.map(b => String(b.id));
  const [lastOf, cats] = await Promise.all([
    Chapter.aggregate([
      { $match: { bookId: { $in: bookIds } } },
      { $group: { _id: '$bookId', last: { $max: '$n' } } },
    ]),
    Category.find({ id: { $in: [...new Set(rows.map(b => String(b.categoryId || '')).filter(Boolean))] } })
      .select('id name').lean(),
  ]);
  const last = {};
  lastOf.forEach(r => { last[String(r._id)] = r.last || 0; });
  const catName = {};
  cats.forEach(c => { catName[String(c.id)] = c.name; });
  return rows.map(b => Object.assign({}, b, {
    lastChapter: last[String(b.id)] || 0,
    category: catName[String(b.categoryId || '')] || b.genre || '',
  }));
}

/* single own book + own chapter list/save (book-workspace, edit-chapter) */
async function getBook({ userId, bookId }) {
  const book = await Book.findOne(Object.assign({ id: bookId }, await authorScope(userId))).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

async function listChapters({ userId, bookId, page, limit }) {
  const book = await ownBook({ userId, bookId });
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const [items, total] = await Promise.all([
    Chapter.find({ bookId: book.id }).sort({ n: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Chapter.countDocuments({ bookId: book.id }),
  ]);
  return { items, total, page: pg, limit: lim };
}

async function saveBookChapter({ userId, bookId, num, data }) {
  const book = await ownBook({ userId, bookId });
  const n = parseInt(num, 10);
  if (!Number.isInteger(n) || n < 1) { const e = new Error('bad_num'); e.status = 400; throw e; }
  const ch = await Chapter.findOne({ bookId: book.id, n });
  if (!ch) { const e = new Error('not_found'); e.status = 404; throw e; }
  // Pricing never changes through the author namespace (admin/editor module only).
  const payload = Object.assign({}, data);
  delete payload.price;
  const chapters = require('./chapters.service');
  const wantsContent = chapters.CHAPTER_CONTENT_FIELDS.some(k => payload[k] !== undefined);
  const wantsPublish = payload.status !== undefined && chapters.PUBLISH_CHAPTER_STATUS.includes(payload.status);
  // Accepted books are live: later content edits go back to the owning editor
  // as a proposal (same rule as PATCH /api/books/:id/chapters/:key).
  if (wantsPublish || (wantsContent && chapters.chapterNeedsProposal(ch))) {
    return chapters.proposeChapterEdit({ book, ch, authorId: userId, data: payload });
  }
  return chapters.updateChapter({ ch, data: payload });
}

/* draft → under_review. Only the book is reviewed; its chapters ride along.
   Routed to the editor this author is assigned to — a reader has no editor
   yet, so it lands unassigned for the chief to allocate. */
async function submitBook({ userId, bookId }) {
  const book = await ownBook({ userId, bookId });
  if (book.status !== 'draft') { const e = new Error('not_draft'); e.status = 409; throw e; }
  const written = await Chapter.countDocuments({ bookId: book.id, words: { $gt: 0 } });
  if (!written) { const e = new Error('no_chapters'); e.status = 400; throw e; }
  const { EditorAssignment } = require('../models/chief.model');
  const asg = await EditorAssignment.findOne({ authorIds: String(userId) }).select('editorId').lean();
  book.status = 'under_review';
  book.assignedSeId = asg ? String(asg.editorId) : null;
  book.submittedAt = new Date();
  book.reviewFeedback = '';
  await book.save();
  return book.toJSON();
}

/* book change request: persists a pending BookEdit proposal for editors */
const BOOK_EDIT_FIELDS = ['title', 'synopsis', 'genre', 'categoryId', 'cover', 'tags', 'tropes'];
async function requestBookChange({ userId, bookId, changes, details, order, proposed: values }) {
  const book = await ownBook({ userId, bookId });
  const list = Array.isArray(changes) ? changes.map(String).slice(0, 12) : [];
  const proposed = {};
  if (values && typeof values === 'object') {
    BOOK_EDIT_FIELDS.forEach(k => {
      if (values[k] === undefined || values[k] === null || values[k] === '') return;
      proposed[k] = values[k];
    });
  }
  if (!list.length && !(order && order.length) && !Object.keys(proposed).length) {
    const e = new Error('empty_request'); e.status = 400; throw e;
  }
  // The proposal is applied verbatim on approve, so reject a non-uploaded cover
  // now instead of failing later in the editor's queue.
  if (proposed.cover !== undefined) {
    const { validateMediaUrl } = require('./media.service');
    proposed.cover = validateMediaUrl(proposed.cover, 'cover');
  }
  // The editor UI reads the author's own words from proposed.authorNote.
  const note = [];
  if (list.length) note.push('Requested: ' + list.join(', ') + '.');
  if (order && order.length) note.push('Requested chapter order: ' + order.join(' → ') + '.');
  if (details) note.push(String(details));
  if (note.length) proposed.authorNote = note.join(' ').slice(0, 2000);
  const { BookEdit } = require('../models/application.model');
  const doc = await BookEdit.create({ bookId: book.id, authorId: userId, proposed, status: 'pending' });
  return { applied: false, proposal: doc.toJSON() };
}

async function overview({ userId, bookId }) {
  const book = await Book.findOne(Object.assign({ id: bookId }, await authorScope(userId))).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  const chapters = await Chapter.countDocuments({ bookId: book.id });
  return {
    stats: { reads: book.reads || 0, likes: book.likes || 0, chapters },
    activity: [],
    quickActions: ['New Chapter', 'Plotting', 'Characters'],
  };
}

async function ownBook({ userId, bookId }) {
  const book = await Book.findOne(Object.assign({ id: bookId }, await authorScope(userId)));
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  return book;
}

async function listCharacters({ book }) {
  return Character.find({ bookId: book.id }).lean();
}

async function saveCharacter({ book, data, id }) {
  const { validateMediaUrl } = require('./media.service');
  if (data.avatar !== undefined) data.avatar = validateMediaUrl(data.avatar, 'avatar');
  if (id) {
    const c = await Character.findOne({ id, bookId: book.id });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    ['name', 'role', 'avatar', 'meta', 'bio', 'arc', 'traits'].forEach(k => {
      if (data[k] !== undefined) c[k] = data[k];
    });
    await c.save();
    return c.toJSON();
  }
  const c = await Character.create(Object.assign({}, data, { bookId: book.id }));
  return c.toJSON();
}

async function deleteCharacter({ book, id }) {
  await Character.deleteOne({ id, bookId: book.id });
  return { ok: true };
}

async function getPlot({ book }) {
  let plot = await Plot.findOne({ bookId: book.id }).lean();
  if (!plot) plot = { bookId: book.id, acts: [], roadmap: [] };
  return plot;
}

async function savePlot({ book, data }) {
  const plot = await Plot.findOneAndUpdate(
    { bookId: book.id },
    { acts: data.acts || [], roadmap: data.roadmap || [] },
    { upsert: true, new: true }
  ).lean();
  return plot;
}

// Book rows carry the contract state — the author page lists every book,
// not just the ones that already applied.
async function listContracts({ userId }) {
  const ids = await authorIds(userId);
  const scope = { authorId: { $in: ids } };
  const [books, apps, verification, contracts] = await Promise.all([
    Book.find(scope).sort({ updatedAt: -1 })
      .select('id title genre cover chapterCount contractStatus').lean(),
    ContractApplication.find(scope)
      .sort({ createdAt: -1 }).select('bookId submittedAt verificationId').lean(),
    AuthorVerification.findOne({ userId: { $in: ids } }).select('status kyc.type').lean(),
    Contract.find(Object.assign({ status: { $in: ['sent', 'approved', 'signed', 'active'] } }, scope))
      .sort({ createdAt: -1 }).select('id bookId type status sentAt termMonths revenueSplit').lean(),
  ]);
  const latest = new Map();
  for (const a of apps) if (!latest.has(a.bookId)) latest.set(a.bookId, a);
  const openOffer = new Map();
  for (const c of contracts) if (!openOffer.has(c.bookId)) openOffer.set(c.bookId, c);
  return books.map((b) => {
    const a = latest.get(b.id);
    const c = openOffer.get(b.id);
    return {
      id: b.id,
      title: b.title,
      genre: b.genre,
      cover: b.cover,
      chapters: b.chapterCount || 0,
      status: b.contractStatus || 'none',
      appliedAt: a ? a.submittedAt || null : null,
      contractId: c ? c.id : '',
      offerType: c ? c.type : '',
      offerSentAt: c ? c.sentAt || null : null,
      termMonths: c ? c.termMonths : null,
      revenueSplit: c ? c.revenueSplit : null,
      kycType: verification && verification.kyc ? verification.kyc.type : null,
      verificationStatus: verification ? verification.status : 'none',
    };
  });
}

// Signing is gated: an offer exists (Contract 'sent') AND the writer's identity
// is approved. Books stay live without a contract, so this is the only step
// that turns an offer into a binding deal.
async function signContract({ userId, contractId }) {
  const ids = await authorIds(userId);
  const contract = await Contract.findOne({ id: contractId, authorId: { $in: ids } });
  if (!contract) { const e = new Error('not_found'); e.status = 404; throw e; }

  const verification = await AuthorVerification.findOne({ userId: { $in: ids } }).select('status').lean();
  if (!verification || verification.status !== 'approved') {
    const e = new Error('identity_not_verified'); e.status = 409; throw e;
  }

  const now = new Date();
  const signed = await Contract.findOneAndUpdate(
    { id: contractId, authorId: { $in: ids }, status: 'sent' },
    {
      $set: { status: 'approved', signedAt: now },
      $push: { signatures: { by: userId, role: 'author', at: now, hash: '' } },
    },
    { new: true }
  );
  // Already signed or the editor withdrew the offer — never double-sign.
  if (!signed) { const e = new Error('contract_not_open'); e.status = 409; throw e; }

  await ContractApplication.updateOne(
    { authorId: { $in: ids }, contractId, status: 'review' },
    { $set: { status: 'contracted', decidedAt: now } }
  );
  await Book.updateOne(Object.assign({ id: signed.bookId }, await authorScope(userId)), { contractStatus: 'contracted' });

  try {
    if (signed.editorId) {
      const { emit } = require('./notification-emitter');
      await emit({
        recipientId: signed.editorId, type: 'contract_update',
        title: 'Contract signed by author',
        desc: 'The author signed — the platform signature is the last step.',
      });
    }
  } catch (e) {}

  return Object.assign(signed.toJSON(), { contractStatus: 'contracted' });
}

async function declineContract({ userId, contractId, reason }) {
  const now = new Date();
  const ids = await authorIds(userId);
  const declined = await Contract.findOneAndUpdate(
    { id: contractId, authorId: { $in: ids }, status: 'sent' },
    {
      $set: { status: 'rejected' },
      $push: { replies: { from: 'author', message: (reason || 'Offer declined by the author.').trim(), at: now } },
    },
    { new: true }
  );
  if (!declined) { const e = new Error('contract_not_open'); e.status = 409; throw e; }

  await ContractApplication.updateOne(
    { authorId: { $in: ids }, contractId, status: 'review' },
    { $set: { status: 'rejected', reviewNote: (reason || '').trim(), decidedAt: now } }
  );
  await Book.updateOne(Object.assign({ id: declined.bookId }, await authorScope(userId)), { contractStatus: 'none' });

  try {
    if (declined.editorId) {
      const { emit } = require('./notification-emitter');
      await emit({
        recipientId: declined.editorId, type: 'contract_update',
        title: 'Contract offer declined',
        desc: (reason || '').trim() || 'The author declined the offer.',
      });
    }
  } catch (e) {}

  return Object.assign(declined.toJSON(), { contractStatus: 'none' });
}

function ageFromDob(dob) {
  const d = new Date(String(dob) + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

// One identity record per writer. Age is recomputed here — the client's
// number is never trusted. Photos are mandatory: an application without
// them cannot be reviewed.
async function saveIdentity({ userId, kyc, idFiles }) {
  const front = idFiles && idFiles.front && idFiles.front[0];
  const back = idFiles && idFiles.back && idFiles.back[0];
  if (!front || !back) { const e = new Error('id_photos_required'); e.status = 400; throw e; }

  const age = ageFromDob(kyc.dob);
  if (age === null || age < 10 || age > 110) { const e = new Error('bad_dob'); e.status = 400; throw e; }

  const media = require('./media.service');
  const [frontUrl, backUrl] = await Promise.all([
    media.uploadImageBuffer(front.buffer, front.mimetype, 'kyc-front-' + userId),
    media.uploadImageBuffer(back.buffer, back.mimetype, 'kyc-back-' + userId),
  ]);

  const identity = {
    type: kyc.type,
    dob: kyc.dob,
    age,
    nin: kyc.type === 'self' ? kyc.nin || '' : '',
    altId: kyc.type === 'pending'
      ? { type: kyc.altId.type, no: kyc.altId.no }
      : { type: '', no: '' },
    guardian: kyc.type === 'guardian'
      ? { name: kyc.guardian.name, relationship: kyc.guardian.relationship, idNo: kyc.guardian.idNo }
      : { name: '', relationship: '', idNo: '' },
    idPhotos: { front: frontUrl, back: backUrl },
  };

  const u = await User.findOne(require('./user-ref').userRefFilter([userId])).select('id fullName email avatar').lean();
  const profile = {
    name: (u && u.fullName) || '',
    email: (u && u.email) || '',
    avatar: (u && u.avatar) || '',
  };
  const ids = await authorIds(userId);
  // Repair legacy orphan rows (userId null) that match this writer by email or
  // name. They were created before the userId fix and are the reason approving
  // a verification in the SE console did not unblock the author's contract.
  const orphans = await AuthorVerification.find({
    userId: { $in: [null, '', undefined] },
    $or: [
      ...(u && u.email ? [{ email: String(u.email).toLowerCase() }] : []),
      ...(u && u.fullName ? [{ name: u.fullName }] : []),
    ],
  }).lean().catch(() => []);
  for (const o of orphans) {
    await AuthorVerification.updateOne({ id: o.id }, { $set: { userId: String(userId) } });
  }
  return AuthorVerification.findOneAndUpdate(
    { userId: { $in: ids } },
    {
      $set: {
        ...profile,
        // Upsert filters with `$in` cannot populate the new document — set the
        // owner explicitly or the request is born orphaned (userId null),
        // invisible to both the author's contract page and the editor's queue.
        userId: String(userId),
        kyc: identity,
        status: 'pending',
        reviewerId: null,
        reviewNote: '',
        submittedAt: new Date(),
      },
      // Upserts bypass pre('validate'), so the custom public id is set here.
      $setOnInsert: { id: require('../models/ids').uuidv7() },
    },
    { upsert: true, new: true }
  );
}

async function getVerification({ userId }) {
  const v = await AuthorVerification.findOne({ userId: { $in: await authorIds(userId) } }).lean();
  if (!v) return { status: 'none', kycType: null, submittedAt: null, hasPhotos: false };
  const photos = v.kyc && v.kyc.idPhotos;
  return {
    status: v.status,
    kycType: v.kyc ? v.kyc.type : null,
    submittedAt: v.submittedAt || null,
    hasPhotos: !!(photos && photos.front && photos.back),
  };
}

// Profile badge path: a writer can verify before ever applying for a contract.
async function submitVerification({ userId, kyc, idFiles }) {
  const existing = await AuthorVerification.findOne({ userId: { $in: await authorIds(userId) } });
  if (existing && existing.status === 'approved') {
    return { status: 'approved', kycType: existing.kyc ? existing.kyc.type : null };
  }
  const v = await saveIdentity({ userId, kyc, idFiles });
  return { status: v.status, kycType: v.kyc ? v.kyc.type : null, submittedAt: v.submittedAt };
}

// A verified writer applies without re-uploading; everyone else supplies KYC
// here and the same record backs their badge.
async function applyContract({ userId, bookId, kyc, idFiles }) {
  const book = await ownBook({ userId, bookId });

  const ids = await authorIds(userId);
  let verification = await AuthorVerification.findOne({ userId: { $in: ids } });
  if (!verification || verification.status !== 'approved') {
    if (!kyc) { const e = new Error('kyc_required'); e.status = 400; throw e; }
    verification = await saveIdentity({ userId, kyc, idFiles });
  }

  // Resubmitting replaces the open application instead of stacking duplicates.
  const open = await ContractApplication.findOne({
    bookId: book.id, authorId: { $in: ids }, status: { $in: ['applied', 'review'] },
  });
  let c;
  if (open) {
    open.verificationId = verification.id;
    open.status = 'applied';
    open.submittedAt = new Date();
    await open.save();
    c = open;
  } else {
    c = await ContractApplication.create({
      bookId: book.id, authorId: userId, verificationId: verification.id, status: 'applied',
    });
  }
  await Book.updateOne(Object.assign({ id: book.id }, await authorScope(userId)), { contractStatus: 'applied' });
  return Object.assign(c.toJSON(), { verificationStatus: verification.status });
}

async function applyCompletion({ userId, bookId, data }) {
  const c = await CompletionApplication.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

async function applyVip({ userId, bookId, data }) {
  const c = await VipApplication.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

async function submitChapterReview({ userId, bookId, data }) {
  const c = await ChapterReviewRequest.create(Object.assign({}, data, { bookId, authorId: userId, status: 'pending' }));
  return c.toJSON();
}

// Author's own edit proposals (pending/approved/rejected) per book.
async function listChapterEdits({ userId, bookId }) {
  await ownBook({ userId, bookId });
  const { ChapterEdit } = require('../models/application.model');
  return ChapterEdit.find({ bookId, authorId: { $in: await authorIds(userId) } }).sort({ createdAt: -1 }).lean();
}

async function listBookEdits({ userId, bookId }) {
  await ownBook({ userId, bookId });
  const { BookEdit } = require('../models/application.model');
  return BookEdit.find({ bookId, authorId: { $in: await authorIds(userId) } }).sort({ createdAt: -1 }).lean();
}

async function launchKit({ userId }) {
  const list = await LaunchCampaign.find({ writerId: { $in: await authorIds(userId) } }).sort({ createdAt: -1 }).lean();
  return list;
}

async function saveLaunchKit({ userId, data, id }) {
  if (id) {
    const c = await LaunchCampaign.findOne({ id, writerId: { $in: await authorIds(userId) } });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    Object.assign(c, data);
    await c.save();
    return c.toJSON();
  }
  const c = await LaunchCampaign.create(Object.assign({}, data, { writerId: userId }));
  return c.toJSON();
}

module.exports = {
  dashboard, books, overview, ownBook, getBook, listChapters, saveBookChapter, submitBook, requestBookChange,
  listCharacters, saveCharacter, deleteCharacter,
  getPlot, savePlot,
  listContracts, applyContract, signContract, declineContract, applyCompletion, applyVip,
  getVerification, submitVerification,
  submitChapterReview,
  listChapterEdits, listBookEdits,
  launchKit, saveLaunchKit,
};
