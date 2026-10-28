'use strict';
// Senior-editor sidebar surfaces (12 menu pages only).
// Every function returns the exact shape its page renders. Ownership scoping is
// inherited from senior.scopeAuthorIds: chief_editor/admin see everything, a
// senior_editor sees only their assigned authors' rows.

const { Book, Chapter } = require('../models/content.model');
const { User, AuditLog } = require('../models/user.model');
const {
  ReviewSubmission, CompletionApplication, ChapterEdit, BookEdit,
  AuthorVerification, ContractApplication,
} = require('../models/application.model');
const { Contract } = require('../models/contract.model');
const { ContractPricing } = require('../models/revenue.model');
const { Conversation, Message } = require('../models/social.model');
const { Report } = require('../models/editorial.model');
const { AuthorTransaction } = require('../models/money.model');
const senior = require('./senior.service');

function notFound() { const e = new Error('not_found'); e.status = 404; return e; }
function iso(d) { return d ? new Date(d).toISOString() : null; }

function pageOf(query, maxLimit) {
  query = query || {};
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit || 50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function rx(value) {
  return {
    $regex: String(value).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    $options: 'i',
  };
}

function timeAgo(d) {
  if (!d) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  if (s < 2592000) return Math.floor(s / 604800) + 'w ago';
  return Math.floor(s / 2592000) + 'mo ago';
}

function dateLabel(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function label(v) {
  return String(v == null ? '' : v).replace(/_/g, ' ').trim();
}

async function usersById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id fullName username email avatar roles status authorGenre genres createdAt referredByUserId editorInviteCode')
    .lean();
  const out = {};
  for (const u of rows) {
    out[String(u.id)] = {
      id: u.id,
      name: u.fullName || u.username || 'Unknown',
      username: u.username || '',
      email: u.email || '',
      avatar: u.avatar || '',
      roles: u.roles || [],
      status: u.status || 'active',
      authorGenre: u.authorGenre || '',
      genres: u.genres || [],
      createdAt: u.createdAt,
      referredByUserId: u.referredByUserId ? String(u.referredByUserId) : '',
      editorInviteCode: u.editorInviteCode || '',
    };
  }
  return out;
}

async function booksById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await Book.find({ id: { $in: uniq } })
    .select('id title authorId cover genre synopsis kind status wordCount chapterCount reads rating')
    .lean();
  const out = {};
  for (const b of rows) out[String(b.id)] = b;
  return out;
}

async function latestKyc(userIds) {
  const uniq = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await AuthorVerification.find({ userId: { $in: uniq } })
    .sort({ submittedAt: -1 })
    .select('userId status kyc docType docUrl reviewNote')
    .lean();
  const out = {};
  for (const v of rows) if (!out[String(v.userId)]) out[String(v.userId)] = v;
  return out;
}

function kycOf(v) {
  if (!v) return null;
  return {
    status: v.status || 'pending',
    type: (v.kyc && v.kyc.type) || '',
    docType: v.docType || '',
    docUrl: v.docUrl || '',
    idPhotos: (v.kyc && v.kyc.idPhotos) || { front: '', back: '' },
  };
}

/* ── Activity / audit ─────────────────────────────────────────────────── */

const VERBS = {
  create: 'Created', update: 'Updated', delete: 'Deleted', approve: 'Approved',
  reject: 'Rejected', sign: 'Signed', send: 'Sent', rate: 'Rated', flag: 'Flagged',
  unflag: 'Unflagged', pricing: 'Updated pricing', decide: 'Reviewed',
  resolve: 'Resolved', dismiss: 'Dismissed', offer: 'Sent contract offer',
  export: 'Exported', rotate: 'Rotated invite code', readall: 'Marked messages read',
  rejectapplication: 'Rejected contract application',
};

function auditMeta(action) {
  const tail = String(action || '').split('.').pop().toLowerCase();
  return { verb: VERBS[tail] || 'Performed', type: /create/.test(tail) ? 'create'
    : /delete/.test(tail) ? 'delete'
    : /login/.test(tail) ? 'login' : 'update' };
}

function auditRow(a, people) {
  const who = people[String(a.actorId)] || {};
  const meta = auditMeta(a.action);
  const entity = String(a.entity || '').replace(/^\/api\/senior-editor/, '') || '';
  return {
    id: a.id,
    av: who.avatar || '',
    user: who.name || a.actorRole || 'Staff',
    action: meta.verb,
    type: meta.type,
    detail: (entity + (a.entityId ? ' · ' + a.entityId : '')).trim(),
    ip: a.ip || '',
    time: timeAgo(a.at),
    at: iso(a.at),
  };
}

async function auditRows(rows) {
  const people = await usersById(rows.map(r => r.actorId));
  return rows.map(r => auditRow(r, people));
}

/* ── Dashboard ────────────────────────────────────────────────────────── */

async function recentSubmissions(own) {
  const [reviews, booksInReview, completions, chapterEdits, bookEdits, contracts] = await Promise.all([
    ReviewSubmission.find(own).sort({ createdAt: -1 }).limit(5).lean(),
    Book.find({ ...own, status: 'under_review' }).sort({ createdAt: -1 }).limit(5).lean(),
    CompletionApplication.find(own).sort({ createdAt: -1 }).limit(5).lean(),
    ChapterEdit.find(own).sort({ createdAt: -1 }).limit(5).lean(),
    BookEdit.find(own).sort({ createdAt: -1 }).limit(5).lean(),
    Contract.find(own).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const bookIds = [];
  const authorIds = [];
  for (const r of reviews) { bookIds.push(r.bookId); authorIds.push(r.authorId); }
  for (const b of booksInReview) { bookIds.push(b.id); authorIds.push(b.authorId); }
  for (const r of completions) { bookIds.push(r.bookId); authorIds.push(r.authorId); }
  for (const r of chapterEdits) { bookIds.push(r.bookId); authorIds.push(r.authorId); }
  for (const r of bookEdits) { bookIds.push(r.bookId); authorIds.push(r.authorId); }
  for (const r of contracts) { bookIds.push(r.bookId); authorIds.push(r.authorId); }

  const [books, people] = await Promise.all([booksById(bookIds), usersById(authorIds)]);
  const bookOf = id => books[String(id)] || {};
  const authorOf = id => people[String(id)] || {};
  const at = d => (d ? new Date(d).getTime() : 0);

  const rows = [];
  const coveredBySubmission = new Set(reviews.map(r => String(r.bookId)));
  for (const r of reviews) {
    const b = bookOf(r.bookId);
    rows.push({
      at: r.createdAt,
      row: {
        id: r.id, kind: 'review', status: r.status,
        title: 'Review — ' + (b.title || 'Untitled'),
        author: authorOf(r.authorId).name || 'Unknown',
        meta: label(b.genre || r.category || 'Fiction') + ' · Manuscript',
        time: timeAgo(r.createdAt),
      },
    });
  }
  for (const b of booksInReview) {
    if (coveredBySubmission.has(String(b.id))) continue;
    rows.push({
      at: b.createdAt,
      row: {
        id: b.id, kind: 'review', status: 'pending',
        title: 'Review — ' + (b.title || 'Untitled'),
        author: authorOf(b.authorId).name || 'Unknown',
        meta: label(b.genre || 'Fiction') + ' · Manuscript',
        time: timeAgo(b.createdAt),
      },
    });
  }
  for (const r of completions) {
    const b = bookOf(r.bookId);
    rows.push({
      at: r.createdAt,
      row: {
        id: r.id, kind: 'completion', status: r.status,
        title: 'Completion — ' + (b.title || 'Untitled'),
        author: authorOf(r.authorId).name || 'Unknown',
        meta: r.chapters + ' chapters · ' + (r.wordCount || 0).toLocaleString() + ' words',
        time: timeAgo(r.createdAt),
      },
    });
  }
  for (const r of chapterEdits) {
    const b = bookOf(r.bookId);
    const p = r.proposed || {};
    rows.push({
      at: r.createdAt,
      row: {
        id: r.id, kind: 'chapterEdit', status: r.status,
        title: 'Chapter Edit — ' + (b.title || 'Untitled') + ' Ch.' + (r.chapterN || p.n || ''),
        author: authorOf(r.authorId).name || 'Unknown',
        meta: label(p.editType || 'Edit') + ' · ' + (p.words || 0) + ' words',
        time: timeAgo(r.createdAt),
      },
    });
  }
  for (const r of bookEdits) {
    const b = bookOf(r.bookId);
    const keys = Object.keys(r.proposed || {}).filter(k => !['updatedAt', 'id'].includes(k));
    rows.push({
      at: r.createdAt,
      row: {
        id: r.id, kind: 'bookEdit', status: r.status,
        title: 'Book Edit — ' + (b.title || 'Untitled'),
        author: authorOf(r.authorId).name || 'Unknown',
        meta: label(keys[0] || 'Metadata'),
        time: timeAgo(r.createdAt),
      },
    });
  }
  for (const r of contracts) {
    const b = bookOf(r.bookId);
    rows.push({
      at: r.createdAt,
      row: {
        id: r.id, kind: 'contract', status: r.status,
        title: 'Contract — ' + (b.title || 'Untitled'),
        author: authorOf(r.authorId).name || 'Unknown',
        meta: label(r.type) + ' · ' + r.status,
        time: timeAgo(r.createdAt),
      },
    });
  }

  rows.sort((a, b) => at(b.at) - at(a.at));
  return rows.slice(0, 6).map(r => r.row);
}

async function dashboard(user) {
  const ids = await senior.scopeAuthorIds(user);
  const own = ids === null ? {} : { authorId: { $in: ids } };
  const verifOwn = ids === null ? {} : { userId: { $in: ids } };
  const contractOwn = ids === null
    ? { status: { $in: ['pending', 'sent', 'approved'] } }
    : { status: { $in: ['pending', 'sent', 'approved'] }, authorId: { $in: ids } };

  const [
    pendingSubs, pendingContracts, pendingCompletions, pendingChapterEdits,
    pendingBookEdits, pendingVerifications, activeReports, decided, recent, auditPage,
  ] = await Promise.all([
    ReviewSubmission.find({ ...own, status: 'pending' }).select('bookId').lean(),
    Contract.countDocuments(contractOwn),
    CompletionApplication.countDocuments({ ...own, status: 'pending' }),
    ChapterEdit.countDocuments({ ...own, status: 'pending' }),
    BookEdit.countDocuments({ ...own, status: 'pending' }),
    AuthorVerification.countDocuments({ ...verifOwn, status: 'pending' }),
    Report.countDocuments({ status: 'pending' }),
    ReviewSubmission.find({ ...own, status: { $in: ['approved', 'rejected'] } })
      .select('status createdAt updatedAt').limit(500).lean(),
    recentSubmissions(own),
    AuditLog.find(ids === null ? {} : { actorId: String(user.id) })
      .sort({ at: -1 }).limit(4).lean(),
  ]);

  const subBookIds = pendingSubs.map(r => String(r.bookId));
  const pendingReviews = pendingSubs.length + await Book.countDocuments({
    ...own,
    status: 'under_review',
    ...(subBookIds.length ? { id: { $nin: subBookIds } } : {}),
  });

  const approved = decided.filter(d => d.status === 'approved').length;
  const approvalRate = decided.length ? Math.round((approved / decided.length) * 100) : 0;
  const turns = decided
    .map(d => new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime())
    .filter(ms => ms > 0);
  const avgMs = turns.length ? turns.reduce((s, n) => s + n, 0) / turns.length : 0;
  const avgLabel = avgMs > 0 ? (avgMs / 3600000).toFixed(1) + 'h' : '—';

  return {
    pendingReviews,
    pendingContracts,
    activeReports,
    queues: {
      contracts: pendingContracts,
      completions: pendingCompletions,
      chapterEdits: pendingChapterEdits,
      bookEdits: pendingBookEdits,
      reviews: pendingReviews,
      verifications: pendingVerifications,
    },
    stats: {
      totalPending: pendingContracts + pendingCompletions + pendingChapterEdits + pendingBookEdits + pendingReviews,
      urgentChapterEdits: pendingChapterEdits,
      approvalRate,
      avgTurnaround: avgLabel,
    },
    recent,
    activity: (await auditRows(auditPage)).map(a => ({
      icon: a.type === 'create' ? 'fa-plus-circle'
        : a.type === 'delete' ? 'fa-trash'
        : a.type === 'login' ? 'fa-right-to-bracket' : 'fa-check-circle',
      color: a.type === 'create' ? 'green' : a.type === 'delete' ? 'red'
        : a.type === 'login' ? 'purple' : 'blue',
      text: a.action + (a.detail ? ' · ' + a.detail : ''),
      time: a.time,
    })),
  };
}

/* ── Review queue ─────────────────────────────────────────────────────── */

// A book waiting for its first decision lives on Book.status = 'under_review'
// (authors submit by moving draft → under_review). ReviewSubmission rows are
// still honoured for legacy/manual entries; both feed the same queue, deduped
// by bookId so one manuscript never appears twice.
async function reviews(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const scoped = ids === null ? {} : { authorId: { $in: ids } };
  const subFilter = { ...scoped };
  if (query.status) subFilter.status = query.status;
  const wantBooks = !query.status || query.status === 'pending' || query.status === 'under_review';

  const [subs, underReview] = await Promise.all([
    ReviewSubmission.find(subFilter).sort({ createdAt: -1 }).lean(),
    wantBooks
      ? Book.find({ ...scoped, status: 'under_review' }).sort({ createdAt: -1 }).lean()
      : [],
  ]);
  const covered = new Set(subs.map(d => String(d.bookId)));
  const pendingBooks = underReview.filter(b => !covered.has(String(b.id)));

  const authorIds = [...subs.map(d => d.authorId), ...pendingBooks.map(b => b.authorId)];
  const [books, people, verifs] = await Promise.all([
    booksById([...subs.map(d => d.bookId), ...pendingBooks.map(b => b.id)]),
    usersById(authorIds),
    latestKyc(authorIds),
  ]);

  const rows = [];
  for (const d of subs) {
    const b = books[String(d.bookId)] || {};
    const u = people[String(d.authorId)] || {};
    rows.push({
      at: d.createdAt,
      item: {
        id: d.id,
        bookId: d.bookId,
        authorId: d.authorId,
        title: b.title || 'Untitled',
        author: u.name || 'Unknown',
        avatar: u.avatar || '',
        cover: d.cover || b.cover || '',
        genre: b.genre || d.category || '',
        synopsis: d.synopsis || b.synopsis || '',
        words: b.wordCount || 0,
        chapters: b.chapterCount || 0,
        kind: b.kind || 'long',
        status: d.status,
        feedback: d.feedback || '',
        assignedSeId: d.assignedSeId || '',
        kyc: kycOf(verifs[String(d.authorId)]),
        submitted: timeAgo(d.createdAt),
        submittedAt: iso(d.createdAt),
      },
    });
  }
  for (const b of pendingBooks) {
    const u = people[String(b.authorId)] || {};
    rows.push({
      at: b.createdAt,
      item: {
        id: b.id,
        bookId: b.id,
        authorId: b.authorId,
        title: b.title || 'Untitled',
        author: u.name || 'Unknown',
        avatar: u.avatar || '',
        cover: b.cover || '',
        genre: b.genre || '',
        synopsis: b.synopsis || '',
        words: b.wordCount || 0,
        chapters: b.chapterCount || 0,
        kind: b.kind || 'long',
        status: 'pending',
        feedback: '',
        assignedSeId: '',
        kyc: kycOf(verifs[String(b.authorId)]),
        submitted: timeAgo(b.createdAt),
        submittedAt: iso(b.createdAt),
      },
    });
  }
  rows.sort((a, b) => new Date(b.at) - new Date(a.at));
  return { items: rows.slice(skip, skip + limit).map(r => r.item), total: rows.length, page, limit };
}

/* ── Book management ──────────────────────────────────────────────────── */

const TAB_STATUS = {
  published: 'published', draft: 'draft', 'under review': 'under_review',
  under_review: 'under_review', flagged: 'flagged', completed: 'completed',
  ongoing: 'ongoing', paused: 'paused',
};

async function books(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  const statusKey = query.status || query.tab;
  if (statusKey && statusKey !== 'all' && statusKey !== 'All Status') {
    filter.status = TAB_STATUS[String(statusKey).toLowerCase()] || statusKey;
  }
  if (query.q) {
    const rxq = rx(query.q);
    const authors = await User.find({ $or: [{ fullName: rxq }, { username: rxq }] })
      .select('id').limit(200).lean();
    filter.$or = [{ title: rxq }, { authorId: { $in: authors.map(a => a.id) } }];
  }

  const [docs, total] = await Promise.all([
    Book.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Book.countDocuments(filter),
  ]);
  const people = await usersById(docs.map(b => b.authorId));

  const items = docs.map(b => {
    const u = people[String(b.authorId)] || {};
    return {
      id: b.id,
      title: b.title || 'Untitled',
      authorId: b.authorId,
      authorName: u.name || '—',
      author: u.name || '—',
      avatar: u.avatar || '',
      cover: b.cover || '',
      img: b.cover || '',
      genre: b.genre || '—',
      cat: b.genre || '',
      synopsis: b.synopsis || '',
      tropes: Array.isArray(b.tropes) ? b.tropes : [],
      kind: b.kind || 'long',
      status: b.status,
      chapterCount: b.chapterCount || 0,
      chapters: b.chapterCount || 0,
      wordCount: b.wordCount || 0,
      reads: b.reads || 0,
      rating: b.rating || 0,
      flagReason: b.flagReason || '',
      flagNote: b.flagNote || '',
      createdAt: iso(b.createdAt),
      updatedAt: iso(b.updatedAt),
    };
  });
  return { items, total, page, limit };
}

/* ── Completion applications ──────────────────────────────────────────── */

async function completions(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  if (query.status) filter.status = query.status;

  const [docs, total] = await Promise.all([
    CompletionApplication.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CompletionApplication.countDocuments(filter),
  ]);
  const [books, people] = await Promise.all([
    booksById(docs.map(d => d.bookId)),
    usersById(docs.map(d => d.authorId)),
  ]);

  const items = docs.map(d => {
    const b = books[String(d.bookId)] || {};
    const u = people[String(d.authorId)] || {};
    return {
      id: d.id,
      bookId: d.bookId,
      authorId: d.authorId,
      author: u.name || 'Unknown',
      avatar: u.avatar || '',
      book: b.title || 'Untitled',
      genre: d.genre || b.genre || '',
      chapters: d.chapters || 0,
      wordCount: d.wordCount || 0,
      submitted: timeAgo(d.createdAt),
      submittedAt: iso(d.createdAt),
      status: d.status,
      notes: d.authorNote || '',
      reviewerId: d.reviewerId || '',
      decidedAt: iso(d.decidedAt),
    };
  });
  return { items, total, page, limit };
}

async function decideCompletion(user, id, action, note) {
  if (!['approved', 'rejected'].includes(action)) {
    const e = new Error('bad_action'); e.status = 400; throw e;
  }
  const existing = await CompletionApplication.findOne({ id }).lean();
  if (!existing) throw notFound();
  await senior.assertOwned(user, existing.authorId);
  if (existing.status !== 'pending') {
    const e = new Error('not_pending'); e.status = 409; throw e;
  }

  const app = await CompletionApplication.findOneAndUpdate(
    { id, status: 'pending' },
    { $set: { status: action, reviewerId: String(user.id), decidedAt: new Date() } },
    { new: true }
  );
  if (!app) {
    const e = new Error('not_pending'); e.status = 409; throw e;
  }

  // Product rule: an approved completion closes the book.
  if (action === 'approved') {
    await Book.updateOne(
      { id: app.bookId, status: { $in: ['ongoing', 'published', 'under_review'] } },
      { $set: { status: 'completed' } }
    );
  }

  try {
    const { notify } = require('./notifications.service');
    await notify({
      recipientId: app.authorId,
      type: 'completion',
      title: action === 'approved' ? 'Book completion approved' : 'Book completion rejected',
      desc: action === 'approved'
        ? 'Your book is now marked complete.'
        : (note ? String(note).slice(0, 300) : 'Your completion request was reviewed.'),
    });
  } catch (e) { /* notifications are best-effort */ }

  const [books, people] = await Promise.all([booksById([app.bookId]), usersById([app.authorId])]);
  const b = books[String(app.bookId)] || {};
  const u = people[String(app.authorId)] || {};
  return {
    id: app.id,
    bookId: app.bookId,
    authorId: app.authorId,
    author: u.name || 'Unknown',
    avatar: u.avatar || '',
    book: b.title || 'Untitled',
    genre: app.genre || b.genre || '',
    chapters: app.chapters,
    wordCount: app.wordCount,
    submitted: timeAgo(app.createdAt),
    status: app.status,
    notes: app.authorNote || '',
    reviewerId: app.reviewerId || '',
    decidedAt: iso(app.decidedAt),
  };
}

/* ── Chapter edit proposals ───────────────────────────────────────────── */

async function chapterEdits(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  if (query.status) filter.status = query.status;

  const [docs, total] = await Promise.all([
    ChapterEdit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ChapterEdit.countDocuments(filter),
  ]);
  const chapterIds = docs.map(d => d.chapterId).filter(Boolean);
  const [books, people, chapters] = await Promise.all([
    booksById(docs.map(d => d.bookId)),
    usersById(docs.map(d => d.authorId)),
    chapterIds.length
      ? Chapter.find({ id: { $in: chapterIds } }).select('id n title words').lean()
      : [],
  ]);
  const chapterOf = new Map(chapters.map(c => [String(c.id), c]));

  const items = docs.map(d => {
    const b = books[String(d.bookId)] || {};
    const u = people[String(d.authorId)] || {};
    const p = d.proposed || {};
    const ch = chapterOf.get(String(d.chapterId)) || {};
    const proposedWords = Number(p.words) || 0;
    const liveWords = Number(ch.words) || 0;
    const changed = proposedWords && liveWords ? Math.abs(proposedWords - liveWords) : proposedWords;
    const n = d.chapterN || p.n || ch.n || '';
    return {
      id: d.id,
      bookId: d.bookId,
      authorId: d.authorId,
      chapterId: d.chapterId,
      author: u.name || 'Unknown',
      avatar: u.avatar || '',
      book: b.title || 'Untitled',
      chapter: n ? 'Ch.' + n : '—',
      chapterLabel: n ? 'Ch.' + n : '—',
      chapterTitle: p.title || ch.title || '',
      words: proposedWords || liveWords,
      wordsChanged: changed,
      editType: label(p.editType || 'Edit'),
      submitted: timeAgo(d.createdAt),
      submittedAt: iso(d.createdAt),
      status: d.status,
      authorNote: p.authorNote || '',
      reviewNote: d.reviewNote || '',
      decidedAt: iso(d.decidedAt),
    };
  });
  return { items, total, page, limit };
}

/* ── Book edit proposals ──────────────────────────────────────────────── */

const EDIT_LABEL = {
  title: 'Title Change', cover: 'Cover Update', synopsis: 'Description Edit',
  description: 'Description Edit', genre: 'Genre Change', tags: 'Tag Update',
  tropes: 'Trope Update', kind: 'Format Change', categoryId: 'Category Change',
};

function sameValue(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }
  return String(a) === String(b);
}

function diffOf(book, proposed) {
  const out = [];
  const src = proposed || {};
  for (const key of Object.keys(src)) {
    if (['id', 'updatedAt', 'createdAt', 'authorNote'].includes(key)) continue;
    const from = book[key];
    const to = src[key];
    if (sameValue(from, to)) continue;
    out.push({ field: key, from: from == null ? '' : from, to: to == null ? '' : to });
  }
  if (!out.length) {
    for (const key of Object.keys(src)) {
      if (['id', 'updatedAt', 'createdAt', 'authorNote'].includes(key)) continue;
      out.push({ field: key, from: '', to: src[key] == null ? '' : src[key] });
    }
  }
  return out;
}

async function bookEdits(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  if (query.status) filter.status = query.status;

  const [docs, total] = await Promise.all([
    BookEdit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    BookEdit.countDocuments(filter),
  ]);
  const [books, people] = await Promise.all([
    booksById(docs.map(d => d.bookId)),
    usersById(docs.map(d => d.authorId)),
  ]);

  const items = docs.map(d => {
    const b = books[String(d.bookId)] || {};
    const u = people[String(d.authorId)] || {};
    const changes = diffOf(b, d.proposed);
    const primary = Object.keys(d.proposed || {}).find(k => !['id', 'updatedAt', 'createdAt', 'authorNote'].includes(k)) || '';
    const first = changes[0] || { from: '', to: '' };
    return {
      id: d.id,
      bookId: d.bookId,
      authorId: d.authorId,
      author: u.name || 'Unknown',
      avatar: u.avatar || '',
      book: b.title || 'Untitled',
      editType: EDIT_LABEL[primary] || label(primary || 'Book Edit'),
      submitted: timeAgo(d.createdAt),
      submittedAt: iso(d.createdAt),
      status: d.status,
      changeFrom: first.from,
      changeTo: first.to,
      changes,
      notes: (d.proposed && d.proposed.authorNote) || '',
      authorNote: (d.proposed && d.proposed.authorNote) || '',
      reviewNote: d.reviewNote || '',
      decidedAt: iso(d.decidedAt),
    };
  });
  return { items, total, page, limit };
}

/* ── Authors ──────────────────────────────────────────────────────────── */

async function authors(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 200);
  const filter = { roles: 'writer' };
  if (ids !== null) filter.id = { $in: ids };
  if (query.q) {
    const rxq = rx(query.q);
    filter.$or = [{ fullName: rxq }, { username: rxq }, { email: rxq }];
  }

  const [docs, total, active, suspended, me] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
    User.countDocuments({ ...filter, status: 'active' }),
    User.countDocuments({ ...filter, status: 'suspended' }),
    ids === null ? null
      : User.findOne({ id: String(user.id) }).select('_id editorInviteCode').lean(),
  ]);

  const authorIds = docs.map(d => String(d.id));
  const [storyRows, earnRows] = await Promise.all([
    authorIds.length
      ? Book.aggregate([
        { $match: { authorId: { $in: authorIds } } },
        { $group: { _id: '$authorId', n: { $sum: 1 } } },
      ])
      : [],
    authorIds.length
      ? AuthorTransaction.aggregate([
        { $match: { authorId: { $in: authorIds }, amount: { $gt: 0 } } },
        { $group: { _id: '$authorId', total: { $sum: '$amount' } } },
      ])
      : [],
  ]);
  const stories = new Map(storyRows.map(r => [String(r._id), r.n]));
  const earnings = new Map(earnRows.map(r => [String(r._id), r.total]));

  const myOid = me ? String(me._id) : '';
  const code = (me && me.editorInviteCode) || '';

  const items = docs.map(u => {
    const invited = myOid
      ? String(u.referredByUserId || '') === myOid
      : !!u.referredByUserId;
    const earned = earnings.get(String(u.id)) || 0;
    return {
      id: u.id,
      name: u.fullName || u.username || 'Unknown',
      username: u.username || '',
      email: u.email || '',
      avatar: u.avatar || '',
      genre: (u.genres && u.genres[0]) || u.authorGenre || '—',
      stories: stories.get(String(u.id)) || 0,
      earnings: earned > 0 ? '$' + Math.round(earned).toLocaleString('en-US') : '—',
      warnings: 0,
      source: invited ? 'invited' : 'assigned',
      via: invited ? 'invite' : 'assigned',
      status: u.status || 'active',
      joined: dateLabel(u.createdAt),
      code: code || u.editorInviteCode || '',
    };
  });

  const invitedCount = myOid
    ? await User.countDocuments({ ...filter, referredByUserId: myOid })
    : await User.countDocuments({ ...filter, referredByUserId: { $nin: [null, ''] } });

  return {
    items,
    total,
    page,
    limit,
    code,
    stats: {
      total,
      invited: invitedCount,
      assigned: Math.max(0, total - invitedCount),
      active,
      suspended,
      warnings: 0,
    },
  };
}

/* ── Author messages ──────────────────────────────────────────────────── */

async function conversationFor(user, id) {
  const conv = await Conversation.findOne({ id });
  if (!conv) throw notFound();
  const ids = await senior.scopeAuthorIds(user);
  if (ids !== null && !(conv.participants || []).map(String).includes(String(user.id))) {
    throw notFound();
  }
  return conv;
}

async function messages(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 50);
  const filter = ids === null ? {} : { participants: String(user.id) };
  if (query.q) filter.preview = rx(query.q);

  const [docs, total] = await Promise.all([
    Conversation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Conversation.countDocuments(filter),
  ]);

  const self = String(user.id);
  const otherIds = docs.map(c => (c.participants || []).map(String).find(p => p !== self) || (c.participants || [])[0]);
  const [people, verifs] = await Promise.all([
    usersById(otherIds),
    latestKyc(otherIds),
  ]);

  const items = docs.map(c => {
    const other = (c.participants || []).map(String).find(p => p !== self) || (c.participants || [])[0] || '';
    const u = people[String(other)] || {};
    const v = verifs[String(other)];
    const role = (u.roles || []).includes('writer')
      ? (v && v.status === 'approved' ? 'Verified Author' : 'Author')
      : 'Reader';
    return {
      id: c.id,
      name: u.name || 'Unknown',
      avatar: u.avatar || '',
      role,
      participantId: other,
      preview: c.preview || '',
      unread: (c.unreadBy || []).map(String).includes(self) ? 1 : 0,
      flagged: !!c.flagged,
      status: c.status || 'open',
      time: timeAgo(c.updatedAt),
      updatedAt: iso(c.updatedAt),
    };
  });
  return { items, total, page, limit };
}

async function thread(user, id) {
  const conv = await conversationFor(user, id);
  const docs = await Message.find({ conversationId: id }).sort({ createdAt: 1 }).limit(300).lean();
  const self = String(user.id);

  const items = docs.map(m => {
    const fromSelf = String(m.senderId) === self;
    return {
      mid: m.id,
      from: fromSelf ? 'admin' : 'author',
      text: m.text || '',
      file: m.image ? { url: m.image, name: 'Image', isImage: true } : null,
      time: timeAgo(m.createdAt),
      createdAt: iso(m.createdAt),
    };
  });

  // Opening a thread marks it read for this editor.
  await Promise.all([
    Conversation.updateOne({ id }, { $pull: { unreadBy: self } }),
    Message.updateMany({ conversationId: id, senderId: { $ne: self }, read: false }, { $set: { read: true } }),
  ]);

  return { id: conv.id, items };
}

async function messageUpdate(user, id, patch) {
  const conv = await conversationFor(user, id);

  if (typeof patch.flagged === 'boolean') conv.flagged = patch.flagged;
  if (patch.status === 'open' || patch.status === 'closed') conv.status = patch.status;

  if (patch.editMessage && patch.editMessage.mid != null) {
    const m = await Message.findOne({ conversationId: id, id: String(patch.editMessage.mid) });
    if (m) { m.text = String(patch.editMessage.text || '').slice(0, 4000); await m.save(); }
  }
  if (patch.deleteMessage != null) {
    await Message.deleteOne({ conversationId: id, id: String(patch.deleteMessage) });
  }
  await conv.save();
  return { ok: true, id: conv.id };
}

async function messageSend(user, id, body) {
  const conv = await conversationFor(user, id);
  const text = String(body.text || '').slice(0, 4000).trim();
  const image = String(body.image || '').slice(0, 2000);
  if (!text && !image) {
    const e = new Error('empty_message'); e.status = 400; throw e;
  }
  const self = String(user.id);
  const doc = await Message.create({
    conversationId: id,
    senderId: self,
    fromRole: 'editor',
    text,
    image,
  });

  const others = (conv.participants || []).map(String).filter(p => p !== self);
  conv.preview = (text || 'Image').slice(0, 140);
  conv.updatedAt = new Date();
  conv.unreadBy = [...new Set([...(conv.unreadBy || []).map(String), ...others])];
  await conv.save();
  return { ok: true, id: doc.id };
}

async function messagesReadAll(user) {
  const self = String(user.id);
  const convs = await Conversation.find({ participants: self }).select('id').lean();
  const convIds = convs.map(c => String(c.id));
  await Promise.all([
    Conversation.updateMany({ participants: self }, { $pull: { unreadBy: self } }),
    convIds.length
      ? Message.updateMany(
        { conversationId: { $in: convIds }, senderId: { $ne: self }, read: false },
        { $set: { read: true } }
      )
      : Promise.resolve(),
  ]);
  return { ok: true };
}

/* ── Activity logs ────────────────────────────────────────────────────── */

async function activity(user, query) {
  const ids = await senior.scopeAuthorIds(user);
  const { page, limit, skip } = pageOf(query, 100);
  const filter = ids === null ? {} : { actorId: String(user.id) };
  if (query.q) {
    const rxq = rx(query.q);
    filter.$or = [{ action: rxq }, { entity: rxq }, { entityId: rxq }];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items: await auditRows(items), total, page, limit };
}

/* ── Contract type catalog (review-queue wizard) ──────────────────────── */

// Catalog shown in the review-queue acceptance wizard. `type`/`termMonths`/
// `revenueSplit` are what the backend needs to turn the choice into a real
// Contract offer, so the page never has to hard-code the mapping.
async function contractTypes() {
  return [
    { id: 'standard', label: 'Standard Royalty Contract', detail: '60/40 author-platform split · non-exclusive', type: 'Non_Exclusive', termMonths: 12, revenueSplit: 60 },
    { id: 'premium', label: 'Premium Exclusive Contract', detail: '70/30 author-platform split · exclusive, 12-month term', type: 'Exclusive_Publishing', termMonths: 12, revenueSplit: 70 },
    { id: 'flex', label: 'Flex Starter Contract', detail: '50/50 split · month-to-month, for new authors', type: 'Non_Exclusive', termMonths: 1, revenueSplit: 50 },
    { id: 'revenue', label: 'Revenue Share Agreement', detail: 'Configurable split · performance based', type: 'Revenue_Share', termMonths: 12, revenueSplit: 50 },
  ];
}

const DEAL_TYPES = ['Exclusive_Publishing', 'Non_Exclusive', 'Revenue_Share', 'License_Agreement'];

// "Accept for Contract" — the manuscript approval and the offer are one action
// for the editor. Identity is the gate: no offer without an approved KYC.
async function offerContract(user, { bookId, authorId, terms }) {
  const t = terms || {};
  const type = DEAL_TYPES.includes(t.type) ? t.type : 'Non_Exclusive';
  const termMonths = Math.min(60, Math.max(1, parseInt(t.termMonths, 10) || 12));
  const revenueSplit = Math.min(100, Math.max(0, parseInt(t.revenueSplit, 10) || 60));

  const v = await AuthorVerification.findOne({ userId: String(authorId) }).lean();
  if (!v || v.status !== 'approved') { const e = new Error('identity_not_verified'); e.status = 409; throw e; }

  const now = new Date();
  let app = await ContractApplication.findOne({ bookId, authorId, status: { $in: ['applied', 'review'] } });
  if (app) {
    app.status = 'review';
    app.type = type;
    app.reviewerId = String(user.id);
    app.decidedAt = now;
    await app.save();
  } else {
    app = await ContractApplication.create({
      bookId, authorId, type, status: 'review',
      reviewerId: String(user.id), decidedAt: now, verificationId: v.id,
    });
  }

  const contract = await Contract.create({
    bookId, authorId, type, status: 'sent', sentAt: now,
    editorId: String(user.id),
    duration: termMonths + ' months',
    termMonths,
    revenueSplit,
    advance: Number(t.advance) || 0,
    authorNote: String(t.note || '').slice(0, 1000),
  });
  await ContractApplication.updateOne({ id: app.id }, { $set: { contractId: contract.id } });
  await Book.updateOne({ id: bookId }, { $set: { contractStatus: 'review' } });

  // Monetization terms collected during acceptance; signing locks them.
  const pricing = t.pricing;
  if (pricing) {
    const rows = Array.isArray(pricing.rows) ? pricing.rows : [];
    await ContractPricing.findOneAndUpdate(
      { contractId: contract.id },
      {
        contractId: contract.id,
        bookId,
        freeChapters: Number(pricing.freeChapters) || 0,
        adsPerChapter: Number(pricing.adsPerChapter) || 0,
        allowAdUnlock: pricing.allowAdUnlock !== false,
        rows,
        paidCount: rows.filter(r => !r.free).length,
        status: 'pending',
      },
      { upsert: true }
    );
  }

  try {
    const { notify } = require('./notifications.service');
    await notify({
      recipientId: String(authorId), type: 'contract',
      title: 'Contract offer ready',
      desc: 'Your editor sent a contract — review and sign it in Author Center.',
    });
  } catch (e) { /* notifications are best-effort */ }

  return { applicationId: app.id, contractId: contract.id };
}

module.exports = {
  dashboard, reviews, books, completions, decideCompletion,
  chapterEdits, bookEdits, authors,
  messages, thread, messageUpdate, messageSend, messagesReadAll,
  activity, contractTypes, offerContract,
  // exported for tests
  _timeAgo: timeAgo, _diffOf: diffOf,
};
