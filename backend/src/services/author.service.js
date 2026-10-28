'use strict';
// Author namespace backing author/*.html pages.
// Contracts mirror services/author/*-service.js USE_API declarations:
//   GET /dashboard, /books, /books/:id/overview, /books/:id/characters (CRUD),
//   /books/:id/plot, /books/:bookId/chapters/:num, /contracts, /completion,
//   /vip, /launch-kit, /chapter-reviews
const { Book, Chapter, Character, Plot } = require('../models/content.model');
const {
  ContractApplication, CompletionApplication, VipApplication,
  ChapterReviewRequest, AuthorVerification,
} = require('../models/application.model');
const { User } = require('../models/user.model');
const { LaunchCampaign } = require('../models/editorial.model');
const { Contract } = require('../models/contract.model');

async function dashboard({ userId }) {
  const [books, contracts] = await Promise.all([
    Book.countDocuments({ authorId: userId }),
    Contract.countDocuments({ authorId: userId }),
  ]);
  const reads = await Book.aggregate([
    { $match: { authorId: userId } },
    { $group: { _id: null, t: { $sum: '$reads' } } },
  ]);
  return {
    stats: {
      books, contracts,
      reads: reads[0] ? reads[0].t : 0,
      pendingReviews: 0,
    },
  };
}

async function books({ userId }) {
  return Book.find({ authorId: userId }).sort({ updatedAt: -1 }).lean();
}

/* single own book + own chapter list/save (book-workspace, edit-chapter) */
async function getBook({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId }).lean();
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
  return chapters.updateChapter({ ch, data: payload });
}

/* book change request: persists a pending BookEdit proposal for editors */
async function requestBookChange({ userId, bookId, changes, details, order }) {
  const book = await ownBook({ userId, bookId });
  const list = Array.isArray(changes) ? changes.map(String).slice(0, 12) : [];
  if (!list.length && !(order && order.length)) { const e = new Error('empty_request'); e.status = 400; throw e; }
  const { BookEdit } = require('../models/application.model');
  const proposed = { changes: list };
  if (details) proposed.details = String(details).slice(0, 2000);
  if (order) proposed.order = order.map(String).slice(0, 500);
  const doc = await BookEdit.create({ bookId: book.id, authorId: userId, proposed, status: 'pending' });
  return { applied: false, proposal: doc.toJSON() };
}

async function overview({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId }).lean();
  if (!book) { const e = new Error('not_found'); e.status = 404; throw e; }
  const chapters = await Chapter.countDocuments({ bookId: book.id });
  return {
    stats: { reads: book.reads || 0, likes: book.likes || 0, chapters },
    activity: [],
    quickActions: ['New Chapter', 'Plotting', 'Characters'],
  };
}

async function ownBook({ userId, bookId }) {
  const book = await Book.findOne({ id: bookId, authorId: userId });
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
  const [books, apps, verification, contracts] = await Promise.all([
    Book.find({ authorId: userId }).sort({ updatedAt: -1 })
      .select('id title genre cover chapterCount contractStatus').lean(),
    ContractApplication.find({ authorId: userId })
      .sort({ createdAt: -1 }).select('bookId submittedAt verificationId').lean(),
    AuthorVerification.findOne({ userId }).select('status kyc.type').lean(),
    Contract.find({ authorId: userId, status: { $in: ['sent', 'approved', 'signed', 'active'] } })
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
  const contract = await Contract.findOne({ id: contractId, authorId: userId });
  if (!contract) { const e = new Error('not_found'); e.status = 404; throw e; }

  const verification = await AuthorVerification.findOne({ userId }).select('status').lean();
  if (!verification || verification.status !== 'approved') {
    const e = new Error('identity_not_verified'); e.status = 409; throw e;
  }

  const now = new Date();
  const signed = await Contract.findOneAndUpdate(
    { id: contractId, authorId: userId, status: 'sent' },
    {
      $set: { status: 'approved', signedAt: now },
      $push: { signatures: { by: userId, role: 'author', at: now, hash: '' } },
    },
    { new: true }
  );
  // Already signed or the editor withdrew the offer — never double-sign.
  if (!signed) { const e = new Error('contract_not_open'); e.status = 409; throw e; }

  await ContractApplication.updateOne(
    { authorId: userId, contractId, status: 'review' },
    { $set: { status: 'contracted', decidedAt: now } }
  );
  await Book.updateOne({ id: signed.bookId, authorId: userId }, { contractStatus: 'contracted' });

  try {
    if (signed.editorId) {
      const { notify } = require('./notifications.service');
      await notify({
        recipientId: signed.editorId, type: 'contract',
        title: 'Contract signed by author',
        desc: 'The author signed — the platform signature is the last step.',
      });
    }
  } catch (e) {}

  return Object.assign(signed.toJSON(), { contractStatus: 'contracted' });
}

async function declineContract({ userId, contractId, reason }) {
  const now = new Date();
  const declined = await Contract.findOneAndUpdate(
    { id: contractId, authorId: userId, status: 'sent' },
    {
      $set: { status: 'rejected' },
      $push: { replies: { from: 'author', message: (reason || 'Offer declined by the author.').trim(), at: now } },
    },
    { new: true }
  );
  if (!declined) { const e = new Error('contract_not_open'); e.status = 409; throw e; }

  await ContractApplication.updateOne(
    { authorId: userId, contractId, status: 'review' },
    { $set: { status: 'rejected', reviewNote: (reason || '').trim(), decidedAt: now } }
  );
  await Book.updateOne({ id: declined.bookId, authorId: userId }, { contractStatus: 'none' });

  try {
    if (declined.editorId) {
      const { notify } = require('./notifications.service');
      await notify({
        recipientId: declined.editorId, type: 'contract',
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

  const u = await User.findOne({ id: userId }).select('fullName email avatar').lean();
  const profile = {
    name: (u && u.fullName) || '',
    email: (u && u.email) || '',
    avatar: (u && u.avatar) || '',
  };
  return AuthorVerification.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...profile,
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
  const v = await AuthorVerification.findOne({ userId }).lean();
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
  const existing = await AuthorVerification.findOne({ userId });
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

  let verification = await AuthorVerification.findOne({ userId });
  if (!verification || verification.status !== 'approved') {
    if (!kyc) { const e = new Error('kyc_required'); e.status = 400; throw e; }
    verification = await saveIdentity({ userId, kyc, idFiles });
  }

  // Resubmitting replaces the open application instead of stacking duplicates.
  const open = await ContractApplication.findOne({
    bookId: book.id, authorId: userId, status: { $in: ['applied', 'review'] },
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
  await Book.updateOne({ id: book.id, authorId: userId }, { contractStatus: 'applied' });
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
  return ChapterEdit.find({ bookId, authorId: userId }).sort({ createdAt: -1 }).lean();
}

async function listBookEdits({ userId, bookId }) {
  await ownBook({ userId, bookId });
  const { BookEdit } = require('../models/application.model');
  return BookEdit.find({ bookId, authorId: userId }).sort({ createdAt: -1 }).lean();
}

async function launchKit({ userId }) {
  const list = await LaunchCampaign.find({ writerId: userId }).sort({ createdAt: -1 }).lean();
  return list;
}

async function saveLaunchKit({ userId, data, id }) {
  if (id) {
    const c = await LaunchCampaign.findOne({ id, writerId: userId });
    if (!c) { const e = new Error('not_found'); e.status = 404; throw e; }
    Object.assign(c, data);
    await c.save();
    return c.toJSON();
  }
  const c = await LaunchCampaign.create(Object.assign({}, data, { writerId: userId }));
  return c.toJSON();
}

module.exports = {
  dashboard, books, overview, ownBook, getBook, listChapters, saveBookChapter, requestBookChange,
  listCharacters, saveCharacter, deleteCharacter,
  getPlot, savePlot,
  listContracts, applyContract, signContract, declineContract, applyCompletion, applyVip,
  getVerification, submitVerification,
  submitChapterReview,
  listChapterEdits, listBookEdits,
  launchKit, saveLaunchKit,
};
