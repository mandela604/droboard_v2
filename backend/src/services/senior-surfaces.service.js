'use strict';
// Senior-editor surface endpoints. Each function returns EXACTLY the shape the
// matching frontend service reads, so flipping USE_API does not TypeError.
// Money/platform/notification surfaces are platform-level (an editor reviewing
// payouts). Author-content surfaces (stories, analytics, book-reviews) reuse
// the same EditorAssignment scoping as the review queues.
//
// NOTE: senior.paged(Model, filter, sort, query) and senior.pg(query) are the
// two helpers here — argument order matters.

const { Book, Chapter, BookDailyStat } = require('../models/content.model');
const { Contract, ContractTemplate, SignedContract } = require('../models/contract.model');
const {
  FeaturedPlacement, FeaturedHistory, FeaturedSection, EditorPick, Announcement,
} = require('../models/editorial.model');
const { Notification, Conversation, Message, BookRating } = require('../models/social.model');
const {
  Withdrawal, AuthorTransaction, Payout,
} = require('../models/money.model');
const { SystemPage } = require('../models/admin.model');
const { VipApplication } = require('../models/application.model');
const { ActivityLog, PlatformSetting } = require('../models/platform.model');
const { User } = require('../models/user.model');
const senior = require('./senior.service');

const paged = senior.paged;
const pg = senior.pg;

function iso(d) { return d ? new Date(d).toISOString() : null; }

function notFound() { const e = new Error('not_found'); e.status = 404; return e; }

// Batch-resolve User custom-ids → { id, name, avatar } so list endpoints can
// render author names without N+1 queries.
async function usersById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id username fullName name avatar').lean();
  const out = {};
  for (const u of rows) {
    out[String(u.id)] = {
      name: u.fullName || u.name || u.username || 'Unknown',
      avatar: u.avatar || '',
    };
  }
  return out;
}

async function booksById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await Book.find({ id: { $in: uniq } })
    .select('id title authorId cover genre rating').lean();
  const out = {};
  for (const b of rows) out[String(b.id)] = b;
  return out;
}

// null ⇒ unscoped (chief/admin); [] ⇒ senior_editor with nobody assigned.
async function authorScope(user) {
  return senior.scopeAuthorIds(user);
}

// Resolve the Book ids a scoped editor owns. null ⇒ no restriction.
async function ownedBookFilter(user) {
  const ids = await authorScope(user);
  if (ids === null) return null;
  if (!ids.length) return { $in: [] };
  const rows = await Book.find({ authorId: { $in: ids } }).select('id').lean();
  return { $in: rows.map(b => b.id) };
}

/* ── Stories ─────────────────────────────────────────────────────────── */

async function stories(user, query) {
  const ids = await authorScope(user);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  const { items } = await paged(Book, filter, { updatedAt: -1 }, query);
  const people = await usersById(items.map(b => b.authorId));
  return {
    stories: items.map(b => ({
      id: b.id,
      title: b.title,
      author: (people[String(b.authorId)] || {}).name || 'Unknown',
      genre: b.genre || '',
      kind: b.kind,
      chapters: b.chapterCount || 0,
      status: b.status,
      lastUpdated: iso(b.updatedAt),
      words: b.wordCount || 0,
      rating: b.rating || 0,
    })),
  };
}

/* ── Featured stories (CE-owned placements; SE reads them) ───────────── */

async function featuredStories() {
  const placements = await FeaturedPlacement.find({ active: true })
    .sort({ order: 1, startAt: -1 }).limit(60).lean();
  const history = await FeaturedHistory.find({}).sort({ at: -1 }).limit(40).lean();
  const books = await booksById(placements.map(p => p.bookId).concat(history.map(h => h.bookId)));
  const people = await usersById([...new Set(Object.values(books).map(b => b.authorId))]);

  const nameOf = (authorId) => (people[String(authorId)] || {}).name || 'Unknown';

  return {
    active: placements.map(p => {
      const b = books[String(p.bookId)] || {};
      const live = p.active && (!p.endAt || new Date(p.endAt) > new Date());
      return {
        id: p.id,
        title: b.title || '',
        author: nameOf(b.authorId),
        placement: p.sectionKey,
        start: iso(p.startAt),
        end: iso(p.endAt),
        status: live ? 'active' : 'paused',
      };
    }),
    history: history.map(h => {
      const b = books[String(h.bookId)] || {};
      return {
        title: b.title || '',
        author: nameOf(b.authorId),
        placement: h.section,
        featured: h.action,
        status: h.action === 'expired' ? 'expired' : 'completed',
      };
    }),
    availableStories: Object.values(books).map(b => ({
      id: b.id,
      title: b.title,
      author: nameOf(b.authorId),
      genre: b.genre || '',
      rating: b.rating || 0,
    })),
  };
}

/* ── Editor's picks ──────────────────────────────────────────────────── */

async function editorsPicks() {
  const picks = await EditorPick.find({}).sort({ pickedAt: -1 }).limit(80).lean();
  const books = await booksById(picks.map(p => p.bookId));
  const people = await usersById([...new Set(Object.values(books).map(b => b.authorId))]);
  const nameOf = (authorId) => (people[String(authorId)] || {}).name || 'Unknown';

  const shape = (p, selected) => {
    const b = books[String(p.bookId)] || {};
    return {
      id: p.id,
      title: b.title || '',
      author: nameOf(b.authorId),
      category: p.category || '',
      note: p.reason || '',
      selected,
      visibility: p.active ? 'public' : 'hidden',
    };
  };

  const current = picks.filter(p => p.active).map(p => shape(p, true));
  const previous = picks.filter(p => !p.active).map(p => {
    const s = shape(p, false);
    return { title: s.title, author: s.author, category: s.category, selected: false, note: s.note };
  });
  const categories = [...new Set(picks.map(p => p.category).filter(Boolean))].sort();

  return { current, previous, categories };
}

/* ── Announcements ───────────────────────────────────────────────────── */

async function announcements() {
  const rows = await Announcement.find({}).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map(a => ({
    id: a.id,
    title: a.title,
    audience: a.audience,
    content: a.content,
    status: a.status,
    created: iso(a.createdAt),
    scheduled: iso(a.scheduledAt),
  }));
}

async function createAnnouncement(data) {
  const doc = await Announcement.create({
    title: data.title || 'Untitled',
    audience: ['all', 'authors', 'readers'].includes(data.audience) ? data.audience : 'all',
    content: data.content || '',
    type: data.type,
    status: ['draft', 'scheduled', 'published'].includes(data.status) ? data.status : 'draft',
    scheduledAt: data.scheduled || data.scheduledAt || null,
    image: data.image,
  });
  return { ok: true, id: doc.id };
}

/* ── Story analytics ─────────────────────────────────────────────────── */

async function storyAnalytics(user, query) {
  const ids = await authorScope(user);
  const filter = ids === null ? {} : { authorId: { $in: ids } };
  const { items } = await paged(Book, filter, { reads: -1 }, query);

  const stats = items.length
    ? await BookDailyStat.find({ bookId: { $in: items.map(b => b.id) } }).lean()
    : [];
  const byBook = {};
  for (const s of stats) {
    const k = String(s.bookId);
    byBook[k] = byBook[k] || { reads: 0, finishes: 0 };
    byBook[k].reads += s.reads || 0;
    byBook[k].finishes += s.finishes || 0;
  }
  const people = await usersById(items.map(b => b.authorId));

  return {
    stories: items.map(b => {
      const s = byBook[String(b.id)] || { reads: b.reads || 0, finishes: 0 };
      const reads = s.reads || b.reads || 0;
      const finishes = s.finishes || 0;
      return {
        id: b.id,
        title: b.title,
        author: (people[String(b.authorId)] || {}).name || 'Unknown',
        reads,
        completions: finishes,
        retention: reads > 0 ? Math.round((finishes / reads) * 1000) / 10 : 0,
        chapters: b.chapterCount || 0,
        engagement: b.likes || 0,
        revenue: 0,
      };
    }),
  };
}

/* ── Book reviews (reader ratings on owned books) ────────────────────── */

async function bookReviews(user, query) {
  const bookFilter = await ownedBookFilter(user);
  const tab = (query && query.tab) || 'all';
  const search = ((query && query.search) || '').trim().toLowerCase();

  const ratings = await BookRating.find(bookFilter === null ? {} : { bookId: bookFilter })
    .sort({ createdAt: -1 }).limit(200).lean();

  const books = await booksById(ratings.map(r => r.bookId));
  const people = await usersById(ratings.map(r => r.userId));

  const statusOf = (r) => {
    const b = books[String(r.bookId)] || {};
    if (b.status === 'flagged') return 'rejected';
    if (b.status === 'published' || b.status === 'completed') return 'approved';
    if (b.status === 'under_review') return 'reviewing';
    return 'pending';
  };

  let items = ratings.map(r => {
    const b = books[String(r.bookId)] || {};
    const p = people[String(r.userId)] || {};
    return {
      id: r.id,
      title: b.title || '',
      img: b.cover || '',
      writer: p.name || 'Unknown',
      writerAv: p.avatar || '',
      cat: b.genre || '',
      rating: r.rating || 0,
      status: statusOf(r),
      likes: 0,
      submitted: iso(r.createdAt),
    };
  });

  if (search) items = items.filter(i =>
    i.title.toLowerCase().includes(search) || i.writer.toLowerCase().includes(search));
  if (tab && tab !== 'all') items = items.filter(i => i.status === tab);

  return { items };
}

async function bookReviewsDateFilter() {
  return { ok: true, ranges: ['7d', '30d', '90d', 'all'] };
}

/* ── Contract templates ──────────────────────────────────────────────── */

async function contractTemplates(query) {
  const { items, total, page, limit } =
    await paged(ContractTemplate, {}, { updatedAt: -1 }, query);
  return {
    items: items.map(t => ({
      id: t.id,
      name: t.name,
      desc: t.desc || '',
      type: t.type,
      status: t.status,
      clauses: t.clauses || 0,
      preview: t.preview || { title: '', body: '' },
      updated: iso(t.updatedAt),
      by: t.updatedBy || '',
    })),
    total, page, limit,
  };
}

async function contractTemplatesUsage() {
  const rows = await Contract.find({ status: { $in: ['signed', 'active'] } })
    .sort({ signedAt: -1 }).limit(50).lean();
  return { items: rows.map(c => ({ id: c.id, type: c.type, signedAt: iso(c.signedAt) })) };
}

/* ── Contracts overview (one aggregate the page reads in a single shot) ─ */

async function contractsOverview() {
  const [contracts, templates, signed] = await Promise.all([
    Contract.find({}).sort({ createdAt: -1 }).limit(200).lean(),
    ContractTemplate.find({}).sort({ updatedAt: -1 }).limit(100).lean(),
    SignedContract.find({}).sort({ createdAt: -1 }).limit(200).lean(),
  ]);

  const books = await booksById(contracts.map(c => c.bookId));
  const people = await usersById(
    contracts.map(c => c.authorId)
      .concat(contracts.map(c => c.editorId))
      .concat(signed.map(s => s.editorId)));

  const nameOf = (id) => (people[String(id)] || {}).name || '';
  const avatarOf = (id) => (people[String(id)] || {}).avatar || '';

  const statusMap = {
    pending: 'awaiting', sent: 'awaiting', approved: 'signed',
    signed: 'active', active: 'active', rejected: 'rejected', expired: 'expired',
  };

  return {
    contracts: contracts.map(c => {
      const b = books[String(c.bookId)] || {};
      return {
        id: c.id,
        type: c.type,
        status: statusMap[c.status] || c.status,
        author: nameOf(c.authorId),
        authorAv: avatarOf(c.authorId),
        book: b.title || '',
        bookId: c.bookId || '',
        kyc: null,
        dateSent: iso(c.sentAt || c.createdAt),
        signedDate: iso(c.signedAt),
        notes: c.authorNote || '',
        duration: c.duration || '',
        revenue: c.revenueSplit || 0,
        advance: c.advance || 0,
        settled: c.status === 'active' || c.status === 'signed',
        replies: (c.replies || []).map(r => ({
          from: r.from || nameOf(c.editorId) || 'Editor',
          message: r.message || '',
          time: iso(r.at),
        })),
      };
    }),
    templates: templates.map(t => ({
      id: t.id,
      status: t.status,
      bg: '',
      color: '',
      icon: '',
      name: t.name,
      desc: t.desc || '',
      type: t.type,
      updated: iso(t.updatedAt),
      preview: t.preview || { title: '', body: '' },
      clauses: t.clauses || 0,
      by: t.updatedBy || '',
    })),
    signed: signed.map(s => {
      const c = contracts.find(x => x.id === s.contractId) || {};
      const b = books[String(c.bookId)] || {};
      return {
        id: s.id,
        contractId: s.contractId,
        type: c.type || '',
        author: nameOf(c.authorId),
        authorAv: avatarOf(c.authorId),
        title: b.title || '',
        cover: s.cover || b.cover || '',
        duration: c.duration || '',
        signedAt: iso(s.signedAt || c.signedAt || s.createdAt),
        effective: iso(s.effectiveAt || c.effectiveAt),
        expiry: iso(s.expiryAt || c.expiryAt),
        revenue: c.revenueSplit || 0,
        advance: c.advance || 0,
        clauses: Array.isArray(s.clauses) ? s.clauses : [],
        editor: nameOf(s.editorId || c.editorId),
        editorAvatar: avatarOf(s.editorId || c.editorId),
      };
    }),
  };
}

/* ── Featured banners ────────────────────────────────────────────────── */

async function featuredBanners() {
  const rows = await FeaturedPlacement.find({ sectionKey: /banner/i })
    .sort({ order: 1, startAt: -1 }).limit(40).lean();
  const books = await booksById(rows.map(r => r.bookId));

  const banners = rows.map(p => {
    const b = books[String(p.bookId)] || {};
    const live = p.active && (!p.endAt || new Date(p.endAt) > new Date());
    return {
      id: p.id,
      emoji: '',
      grad: '',
      title: b.title || 'Featured banner',
      sub: p.sectionKey,
      position: p.sectionKey,
      dates: iso(p.startAt) + ' → ' + (iso(p.endAt) || 'ongoing'),
      views: 0,
      clicks: 0,
      ctr: 0,
      status: live ? 'active' : 'paused',
    };
  });

  return {
    banners,
    stats: [
      { num: banners.length, lbl: 'Total Banners', ico: 'fa-flag', cls: 'accent', delta: '' },
      { num: banners.filter(b => b.status === 'active').length, lbl: 'Live Now', ico: 'fa-bolt', cls: 'green', delta: '' },
      { num: 0, lbl: 'Total Views', ico: 'fa-eye', cls: 'blue', delta: '' },
      { num: 0, lbl: 'Total Clicks', ico: 'fa-arrow-pointer', cls: 'purple', delta: '' },
    ],
  };
}

async function createFeaturedBanner() {
  const sections = await FeaturedSection.find({}).lean();
  const sectionKey = (sections[0] && sections[0].key) || 'hero-banner';
  const doc = await FeaturedPlacement.create({ bookId: '', sectionKey, active: false });
  return { ok: true, id: doc.id };
}

async function featuredBanner(id) {
  const p = await FeaturedPlacement.findOne({ id }).lean();
  if (!p) throw notFound();
  return p;
}

async function featuredBannerAnalytics(id) {
  const p = await FeaturedPlacement.findOne({ id }).lean();
  if (!p) throw notFound();
  return { id: p.id, section: p.sectionKey, views: 0, clicks: 0, ctr: 0, active: p.active };
}

async function pauseFeaturedBanner(id) {
  const p = await FeaturedPlacement.findOne({ id });
  if (!p) throw notFound();
  p.active = !p.active;
  await p.save();
  return { ok: true, id: p.id, active: p.active };
}

/* ── Money surfaces (platform-level) ─────────────────────────────────── */

async function earningsOverview() {
  const [earnings, pending] = await Promise.all([
    AuthorTransaction.aggregate([
      { $match: { amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Withdrawal.aggregate([
      { $match: { status: { $in: ['requested', 'under_review', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  return {
    lifetime: (earnings[0] && earnings[0].total) || 0,
    pending: (pending[0] && pending[0].total) || 0,
    byBook: [],
  };
}

async function payments(query) {
  const { items, total, page, limit } = await paged(Payout, {}, { createdAt: -1 }, query);
  return {
    payments: items.map(p => ({
      id: p.id,
      recipient: p.recipient,
      amount: p.amount,
      method: p.method,
      status: p.status,
      date: iso(p.createdAt),
    })),
    total, page, limit,
  };
}

async function payment(id) {
  const p = await Payout.findOne({ id }).lean();
  if (!p) throw notFound();
  return p;
}

async function transactions(query) {
  const { items, total, page, limit } =
    await paged(AuthorTransaction, {}, { createdAt: -1 }, query);
  const people = await usersById(items.map(t => t.authorId));
  return {
    items: items.map(t => ({
      id: t.id,
      desc: t.desc || t.type,
      type: t.type,
      amount: t.amount,
      usr: (people[String(t.authorId)] || {}).name || 'Author',
      date: iso(t.createdAt),
      cls: (t.amount || 0) >= 0 ? 'credit' : 'debit',
    })),
    total, page, limit,
  };
}

async function withdrawalRequests(query) {
  const { items, total, page, limit } = await paged(Withdrawal, {}, { requestedAt: -1 }, query);
  const people = await usersById(items.map(w => w.authorId));
  return {
    items: items.map(w => ({
      id: w.id,
      author: (people[String(w.authorId)] || {}).name || 'Author',
      avatar: (people[String(w.authorId)] || {}).avatar || '',
      amount: w.amount,
      method: w.method,
      status: w.status === 'requested' ? 'pending'
        : w.status === 'approved' || w.status === 'under_review' ? 'processing'
        : w.status === 'paid' ? 'completed'
        : (w.status === 'declined' || w.status === 'failed') ? 'rejected' : w.status,
      requested: iso(w.requestedAt),
      processed: iso(w.processedAt),
    })),
    total, page, limit,
  };
}

async function withdrawalSettings() {
  const doc = await PlatformSetting.findOne({ key: 'withdrawals' }).lean();
  return doc || {
    key: 'withdrawals',
    minAmount: 100,
    methods: ['Bank Transfer', 'PayPal', 'Mobile Money'],
  };
}

async function signedContracts(query) {
  const { items, total, page, limit } = await paged(SignedContract, {}, { createdAt: -1 }, query);
  const contracts = await Contract.find({ id: { $in: items.map(s => s.contractId) } }).lean();
  const books = await booksById(contracts.map(c => c.bookId));
  const people = await usersById(
    contracts.map(c => c.authorId).concat(items.map(s => s.editorId)));
  const nameOf = (id) => (people[String(id)] || {}).name || '';
  const avatarOf = (id) => (people[String(id)] || {}).avatar || '';

  return {
    items: items.map(s => {
      const c = contracts.find(x => x.id === s.contractId) || {};
      const b = books[String(c.bookId)] || {};
      return {
        id: s.id,
        contractId: s.contractId,
        type: c.type || '',
        author: nameOf(c.authorId),
        authorAv: avatarOf(c.authorId),
        title: b.title || '',
        cover: s.cover || b.cover || '',
        duration: c.duration || '',
        signedAt: iso(s.signedAt || c.signedAt || s.createdAt),
        effective: iso(s.effectiveAt || c.effectiveAt),
        expiry: iso(s.expiryAt || c.expiryAt),
        revenue: c.revenueSplit || 0,
        advance: c.advance || 0,
        clauses: Array.isArray(s.clauses) ? s.clauses : [],
        editor: nameOf(s.editorId || c.editorId),
        editorAvatar: avatarOf(s.editorId || c.editorId),
      };
    }),
    total, page, limit,
  };
}

/* ── System pages ────────────────────────────────────────────────────── */

async function systemPages() {
  const rows = await SystemPage.find({}).sort({ updatedAt: -1 }).limit(100).lean();
  return {
    pages: rows.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      icon: p.icon,
      tone: p.tone,
      status: p.status,
      statusLabel: p.status === 'active' ? 'Published' : p.status === 'draft' ? 'Draft' : 'Hidden',
      updated: iso(p.updatedAt),
    })),
  };
}

async function createSystemPage(data, user) {
  const doc = await SystemPage.create({
    title: data.title || 'Untitled page',
    url: data.url || ('/p/' + Date.now()),
    icon: data.icon,
    tone: data.tone,
    status: data.status || 'draft',
    updatedBy: String(user.id),
  });
  return { ok: true, id: doc.id };
}

async function systemPage(id) {
  const p = await SystemPage.findOne({ id }).lean();
  if (!p) throw notFound();
  return p;
}

async function systemPagePreview(id) {
  const p = await SystemPage.findOne({ id }).lean();
  if (!p) throw notFound();
  return { id: p.id, title: p.title, url: p.url, status: p.status };
}

/* ── Notifications (this editor only) ────────────────────────────────── */

function notificationRows(items) {
  return items.map(n => ({
    ico: n.thumb || '',
    icon: n.type,
    title: n.title,
    desc: n.desc || '',
    time: iso(n.createdAt),
    unread: n.unread !== false,
    link: n.link || '',
  }));
}

async function notifications(user, query) {
  const { items, total, page, limit } =
    await paged(Notification, { recipientId: String(user.id) }, { createdAt: -1 }, query);
  return { items: notificationRows(items), total, page, limit };
}

async function createNotification(data, user) {
  const doc = await Notification.create({
    recipientId: String(user.id),
    actorId: String(user.id),
    type: data.type || 'system',
    title: data.title || 'Notification',
    desc: data.desc || data.content || '',
    link: data.link || '',
    thumb: data.thumb || '',
    unread: true,
  });
  return { ok: true, id: doc.id };
}

// The frontend reads r.items off this response to refresh its list in place.
async function notificationsReadAll(user, query) {
  await Notification.updateMany({ recipientId: String(user.id), unread: true }, { unread: false });
  return notifications(user, query || {});
}

/* ── Platform settings ───────────────────────────────────────────────── */

async function platformSettings() {
  return PlatformSetting.find({}).lean();
}

/* ── Editor bill review ("My Earnings") ──────────────────────────────── */

async function editorBillReview(user, query) {
  void user;
  const [txns, withdrawals] = await Promise.all([
    AuthorTransaction.find({}).sort({ createdAt: -1 }).limit(50).lean(),
    Withdrawal.find({}).sort({ requestedAt: -1 }).limit(50).lean(),
  ]);
  const people = await usersById(txns.map(t => t.authorId).concat(withdrawals.map(w => w.authorId)));
  const nameOf = (id) => (people[String(id)] || {}).name || 'Author';

  const rows = txns.map(t => ({
    id: t.id,
    type: 'earning',
    title: t.desc || t.type,
    book: t.bookId || '',
    amount: t.amount,
    num: t.amount,
    date: iso(t.createdAt),
    status: t.status,
    desc: t.desc || '',
    author: nameOf(t.authorId),
  })).concat(withdrawals.map(w => ({
    id: w.id,
    type: 'withdrawal',
    title: 'Withdrawal · ' + w.method,
    book: '',
    amount: -Math.abs(w.amount || 0),
    num: w.amount,
    date: iso(w.requestedAt),
    status: w.status === 'requested' ? 'pending'
      : (w.status === 'approved' || w.status === 'under_review') ? 'processing'
      : w.status === 'paid' ? 'completed' : 'failed',
    desc: w.note || '',
    author: nameOf(w.authorId),
  }))).sort((a, b) => new Date(b.date) - new Date(a.date));

  const { page, limit } = pg(query || {});
  const total = rows.length;
  return { items: rows.slice((page - 1) * limit, page * limit), total, page, limit };
}

/* ── Author messages (write paths the page needs) ────────────────────── */

async function authorMessagesUpdate(id, patch) {
  const conv = await Conversation.findOne({ id });
  if (!conv) throw notFound();

  if (typeof patch.flagged === 'boolean') conv.flagged = patch.flagged;
  if (typeof patch.status === 'string') conv.status = patch.status;

  if (patch.editMessage && patch.editMessage.mid != null) {
    const m = await Message.findOne({ conversationId: id, id: String(patch.editMessage.mid) });
    if (m) { m.text = patch.editMessage.text || ''; await m.save(); }
  }
  if (patch.deleteMessage != null) {
    await Message.deleteOne({ conversationId: id, id: String(patch.deleteMessage) });
  }
  await conv.save();
  return { ok: true, id: conv.id };
}

async function authorMessagesSend(id, msg) {
  const conv = await Conversation.findOne({ id });
  if (!conv) throw notFound();
  const doc = await Message.create({
    conversationId: id,
    senderId: String(msg.fromUserId || (conv.participants && conv.participants[0]) || ''),
    fromRole: msg.from === 'admin' ? 'admin' : 'editor',
    text: msg.text || '',
    image: (msg.file && msg.file.url) || '',
  });
  conv.preview = (msg.text || '').slice(0, 140);
  conv.updatedAt = new Date();
  await conv.save();
  return { ok: true, id: doc.id };
}

async function authorMessagesReadAll(user) {
  await Conversation.updateMany(
    { participants: String(user.id) }, { $pull: { unreadBy: String(user.id) } });
  return { ok: true };
}

/* VIP registration reviews (vip-registration-review-service.js reads {items}) */
async function vipRegistrations(query) {
  const filter = {};
  if (query && query.status) filter.status = query.status;
  if (query && query.q) {
    const rx = { $regex: String(query.q).slice(0, 80), $options: 'i' };
    filter.$or = [{ id: rx }];
  }
  const { items } = await paged(VipApplication, filter, { createdAt: -1 }, query || {});
  const users = await usersById(items.map(r => r.authorId));
  const books = await booksById(items.map(r => r.bookId));
  return {
    items: items.map(r => {
      const u = users[String(r.authorId)] || {};
      const b = books[String(r.bookId)] || {};
      return {
        id: r.id,
        author: u.name || r.authorId || '',
        avatar: u.avatar || '',
        book: b.title || r.bookId || '',
        action: 'lock', // VipApplication only models lock requests (book_lock | chapter_lock)
        reason: r.reason || '',
        submitted: iso(r.createdAt),
        status: r.status,
        notes: r.notes || '',
      };
    }),
  };
}

module.exports = {
  stories, featuredStories, editorsPicks, announcements, createAnnouncement,
  storyAnalytics, bookReviews, bookReviewsDateFilter,
  contractTemplates, contractTemplatesUsage, contractsOverview,
  featuredBanners, createFeaturedBanner, featuredBanner, featuredBannerAnalytics,
  pauseFeaturedBanner,
  earningsOverview, payments, payment, transactions,
  withdrawalRequests, withdrawalSettings, signedContracts,
  systemPages, createSystemPage, systemPage, systemPagePreview,
  notifications, createNotification, notificationsReadAll,
  platformSettings, editorBillReview,
  authorMessagesUpdate, authorMessagesSend, authorMessagesReadAll,
  vipRegistrations,
};
