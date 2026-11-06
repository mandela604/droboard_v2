'use strict';
/*
 * services/admin-boards.service.js — the admin console's Boards page.
 *
 * A board IS the category the CE creates. Genres are sections inside it and
 * carry no crew, so each board has exactly one admin team + one moderator team
 * and this console is the only place they get assigned.
 *
 * Every number on the page is derived from real rows:
 *   members / newWeek   CategoryMembership.createdAt
 *   growth              this week's joins vs the previous week's
 *   threads / postsWeek Discussion rows of the board's child genres
 *   repliesPerPost      Comment rows (scope=discussion) over those threads
 *   reportsOpen         pending Report rows filed against those threads
 *   visits / returningP InsightHit (surface=hub) rows for the board's keys
 *   lastActiveMin       newest thread, else the board's own creation
 *
 * The hub tracker records whatever the reader had in the URL — board id, board
 * slug or a child genre slug/id — so a board's visit roll-up matches all of
 * those keys, not just one.
 */
const { Category, Genre, CategoryMembership } = require('../models/content.model');
const { Discussion, Comment, InsightHit } = require('../models/social.model');
const { Report } = require('../models/editorial.model');
const { User } = require('../models/user.model');

const DAY = 864e5, WEEK = 7 * DAY;

function err(msg, status) { const e = new Error(msg); e.status = status || 400; throw e; }
function pageOf(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
function rx(q) { return new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
const today = () => new Date().toISOString().slice(0, 10);

// The chip the console colours: growth ≥5% is growing, no growth or a board
// nobody has posted in for 6h is quiet. CE's own active/inactive switch wins.
function chip(c, growth, lastActiveMin) {
  if (c.status !== 'active') return 'inactive';
  if (growth >= 5) return 'growing';
  if (growth < 0 || lastActiveMin > 6 * 60) return 'quiet';
  return 'active';
}

function round1(n) { return Math.round((Number(n) || 0) * 10) / 10; }

function emptyStats() {
  return {
    members: 0, newWeek: 0, prevWeek: 0, threads: 0, postsWeek: 0, replies: 0,
    reportsOpen: 0, lastAt: null, visits: { d: 0, w: 0, m: 0 },
    recent: new Set(), returning: new Set(),
  };
}

// ---- one roll-up for every board on the page ----
async function statsFor(cats) {
  const catIds = cats.map(c => String(c.id));
  const weekAgo = new Date(Date.now() - WEEK);
  const twoWeeksAgo = new Date(Date.now() - 2 * WEEK);
  const monthAgo = new Date(Date.now() - 30 * DAY);

  const genres = await Genre.find({ categoryId: { $in: catIds } }).select('id slug name categoryId').lean();
  const boardOfGenre = {};
  const hubKeysByBoard = {};
  cats.forEach(c => { hubKeysByBoard[String(c.id)] = [String(c.id), String(c.slug)]; });
  genres.forEach(g => {
    boardOfGenre[String(g.id)] = String(g.categoryId);
    (hubKeysByBoard[String(g.categoryId)] = hubKeysByBoard[String(g.categoryId)] || []).push(String(g.id), String(g.slug));
  });
  const genreIds = genres.map(g => String(g.id));
  const keyToBoard = {};
  Object.keys(hubKeysByBoard).forEach(cid => hubKeysByBoard[cid].forEach(k => { keyToBoard[k] = cid; }));

  const [members, threads, hits] = await Promise.all([
    CategoryMembership.aggregate([
      { $match: { categoryId: { $in: catIds } } },
      {
        $group: {
          _id: '$categoryId',
          members: { $sum: 1 },
          newWeek: { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, 1, 0] } },
          prevWeek: { $sum: { $cond: [{ $and: [{ $gte: ['$createdAt', twoWeeksAgo] }, { $lt: ['$createdAt', weekAgo] }] }, 1, 0] } },
        },
      },
    ]),
    genreIds.length
      ? Discussion.find({ genreId: { $in: genreIds } }).select('id genreId createdAt').lean()
      : Promise.resolve([]),
    InsightHit.aggregate([
      { $match: { surface: 'hub', targetId: { $in: Object.values(hubKeysByBoard).flat() } } },
      {
        $group: {
          _id: { board: '$targetId', user: '$userId' },
          d: { $sum: { $cond: [{ $eq: ['$day', today()] }, '$count', 0] } },
          w: { $sum: { $cond: [{ $gte: ['$createdAt', weekAgo] }, '$count', 0] } },
          m: { $sum: { $cond: [{ $gte: ['$createdAt', monthAgo] }, '$count', 0] } },
          older: { $sum: { $cond: [{ $lt: ['$createdAt', weekAgo] }, '$count', 0] } },
        },
      },
    ]),
  ]);

  const byBoard = {};
  const slot = id => (byBoard[id] = byBoard[id] || emptyStats());

  members.forEach(m => Object.assign(slot(String(m._id)), { members: m.members, newWeek: m.newWeek, prevWeek: m.prevWeek }));
  hits.forEach(h => {
    const owner = keyToBoard[String((h._id && h._id.board) || '')];
    if (!owner) return;
    const s = slot(owner);
    s.visits.d += h.d; s.visits.w += h.w; s.visits.m += h.m;
    const user = h._id && h._id.user;
    if (user && h.w > 0) { s.recent.add(String(user)); if (h.older > 0) s.returning.add(String(user)); }
  });

  // Replies and open reports are keyed on the thread, so both queries take the
  // thread ids this page's boards actually own.
  const threadIds = threads.map(t => String(t.id));
  threads.forEach(t => {
    const bid = boardOfGenre[String(t.genreId)];
    if (!bid) return;
    const s = slot(bid);
    s.threads += 1;
    if (t.createdAt >= weekAgo) s.postsWeek += 1;
    if (!s.lastAt || new Date(t.createdAt) > new Date(s.lastAt)) s.lastAt = t.createdAt;
  });

  if (threadIds.length) {
    const [replies, reports] = await Promise.all([
      Comment.aggregate([
        { $match: { scope: 'discussion', discussionId: { $in: threadIds } } },
        { $group: { _id: '$discussionId', n: { $sum: 1 } } },
      ]),
      Report.find({ status: 'pending', discussionId: { $in: threadIds } }).select('discussionId').lean(),
    ]);
    const boardOfThread = {};
    threads.forEach(t => { boardOfThread[String(t.id)] = boardOfGenre[String(t.genreId)]; });
    replies.forEach(r => { const b = boardOfThread[String(r._id)]; if (b) slot(b).replies += r.n; });
    reports.forEach(p => { const b = boardOfThread[String(p.discussionId)]; if (b) slot(b).reportsOpen += 1; });
  }

  return byBoard;
}

function shape(c, s, crew) {
  const newWeek = s.newWeek, prevWeek = s.prevWeek;
  const growth = prevWeek > 0
    ? round1(((newWeek - prevWeek) / prevWeek) * 100)
    : (newWeek > 0 ? 100 : 0);
  const lastAt = s.lastAt || c.createdAt;
  const lastActiveMin = lastAt ? Math.max(0, Math.floor((Date.now() - new Date(lastAt).getTime()) / 60000)) : null;
  const recent = s.recent.size;
  return {
    id: c.id, name: c.name, slug: c.slug, icon: c.icon || '', color: c.color || '',
    status: chip(c, growth, lastActiveMin),
    members: s.members, newWeek, postsWeek: s.postsWeek,
    repliesPerPost: s.threads ? round1(s.replies / s.threads) : 0,
    returningPct: recent ? Math.round((s.returning.size / recent) * 100) : 0,
    visits: s.visits, threads: s.threads, reportsOpen: s.reportsOpen, growth,
    lastActiveMin,
    mods: crew.mods,
    // The page prints the flag banner straight from these.
    flagReason: c.flagReason || '', flagNote: c.flagNote || '',
    flaggedBy: c.flaggedBy || null, flaggedAt: c.flaggedAt || null,
  };
}

const SORTS = {
  members: (a, b) => b.members - a.members,
  posts: (a, b) => b.postsWeek - a.postsWeek,
  replies: (a, b) => b.repliesPerPost - a.repliesPerPost,
  returning: (a, b) => b.returningPct - a.returningPct,
  daily: (a, b) => b.visits.d - a.visits.d,
  growth: (a, b) => b.growth - a.growth,
  reports: (a, b) => b.reportsOpen - a.reportsOpen,
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
};

async function listBoards(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = {};
  // The console's search box also matches a crew member's name; that filter
  // runs over the loaded page client-side, so only the board name is matched.
  if (q.q) filter.name = rx(q.q);
  const sort = SORTS[q.sort] ? q.sort : 'members';
  // Every column the console sorts and chips on is derived, so the whole
  // catalogue is rolled up and paginated here — boards number in the dozens.
  const cats = await Category.find(filter).sort({ name: 1 }).lean();

  const stats = await statsFor(cats);
  const crewIds = [...new Set(cats.flatMap(c => [...(c.adminIds || []), ...(c.moderatorIds || [])]).map(String))];
  const users = crewIds.length
    ? await User.find({ id: { $in: crewIds } }).select('id username fullName avatar').lean()
    : [];
  const userById = {};
  users.forEach(u => { userById[String(u.id)] = u; });

  let rows = cats.map(c => {
    const s = stats[String(c.id)] || emptyStats();
    const mods = [
      ...(c.adminIds || []).map(id => ({ user: userById[String(id)], role: 'Admin' })),
      ...(c.moderatorIds || []).map(id => ({ user: userById[String(id)], role: 'Mod' })),
    ].filter(m => m.user).map(m => ({
      id: m.user.id,
      name: m.user.username || m.user.fullName || '',
      avatar: m.user.avatar || '',
      role: m.role,
    }));
    return shape(c, s, { mods });
  });

  if (q.status === 'flagged') rows = rows.filter(r => r.flagReason);
  else if (q.status) rows = rows.filter(r => r.status === q.status);
  rows.sort(SORTS[sort]);

  const items = rows.slice(skip, skip + limit);
  return { items, total: rows.length, page, limit, pages: Math.max(1, Math.ceil(rows.length / limit)) };
}

// ---- crew assignment: the whole team in one write ----
async function setCrew(id, data) {
  const c = await Category.findOne({ $or: [{ id: String(id) }, { slug: String(id) }] });
  if (!c) err('not_found', 404);
  const admins = [...new Set((data.admins || []).map(String))];
  const moderators = [...new Set((data.moderators || []).map(String).filter(m => !admins.includes(m)))];
  const ids = [...admins, ...moderators];
  if (ids.length) {
    const found = await User.countDocuments({ id: { $in: ids } });
    if (found !== ids.length) err('bad_user', 400);
  }
  c.adminIds = admins;
  c.moderatorIds = moderators;
  await c.save();
  return {
    id: c.id, name: c.name,
    admins: c.adminIds, moderators: c.moderatorIds,
  };
}

// ---- flag / unflag — same flow the senior editor's book flag uses ----
function reportTypeFor(reason) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('hate') || r.includes('harass') || r.includes('abuse')) return 'abuse';
  if (r.includes('spam') || r.includes('scam')) return 'spam';
  if (r.includes('adult') || r.includes('nsfw') || r.includes('off-topic') || r.includes('misleading')) return 'content';
  return 'other';
}

async function flagBoard(id, { reason, note }, actor) {
  const clean = String(reason || '').trim().slice(0, 200);
  if (!clean) err('reason_required', 400);
  const c = await Category.findOne({ $or: [{ id: String(id) }, { slug: String(id) }] });
  if (!c) err('not_found', 404);
  if (c.flagReason) err('already_flagged', 409);
  c.flagReason = clean;
  c.flagNote = String(note || '').slice(0, 2000);
  c.flaggedBy = String(actor.id);
  c.flaggedAt = new Date();
  await c.save();

  const report = await Report.create({
    categoryId: c.id,
    title: c.name,
    desc: c.flagNote ? c.flagReason + ' — ' + c.flagNote : c.flagReason,
    type: reportTypeFor(clean),
    severity: 'medium',
    reporterId: String(actor.id),
    reporterLabel: 'Board flag',
    status: 'pending',
  });
  return { id: c.id, flagReason: c.flagReason, flaggedAt: c.flaggedAt, reportId: report.id };
}

async function unflagBoard(id, actor) {
  const c = await Category.findOne({ $or: [{ id: String(id) }, { slug: String(id) }] });
  if (!c) err('not_found', 404);
  if (!c.flagReason) err('not_flagged', 409);
  c.flagReason = '';
  c.flagNote = '';
  c.flaggedBy = null;
  c.flaggedAt = null;
  await c.save();
  await Report.updateMany(
    { categoryId: c.id, status: 'pending' },
    { $set: { status: 'resolved', resolutionNote: 'Board unflagged by admin', resolvedBy: String(actor.id) } }
  );
  return { id: c.id, flagReason: '' };
}

module.exports = { listBoards, setCrew, flagBoard, unflagBoard };
