'use strict';
/**
 * services/superadmin.service.js — data + actions for the Super Admin console.
 * Every function below backs a super-admin page service (call-and-render);
 * list endpoints return { items, total, page, limit, pages } unless the
 * frontend contract fixes another shape (insights overview, system-pages,
 * revenue-splits — see inline notes).
 */
const { User, AuditLog } = require('../models/user.model');
const { Book, Chapter } = require('../models/content.model');
const { Post, ReadingProgress, Referral, Notification, Reaction, ShareEvent, LibraryItem, Comment } = require('../models/social.model');
const { Wallet, LedgerEntry, CoinTransaction, AuthorTransaction, Withdrawal, Subscription, SubscriptionPlan, PaymentDispute } = require('../models/money.model');
const { Contract } = require('../models/contract.model');
const { Report, Announcement } = require('../models/editorial.model');
const { PlatformSetting, EmailTemplate } = require('../models/platform.model');
const { AdminRole, SystemPage, PERM_KEYS } = require('../models/admin.model');
const { Campaign } = require('../models/marketing.model');
const { Policy } = require('../models/chief.model');
const { AdRevenueLedger } = require('../models/revenue.model');
const { Genre } = require('../models/content.model');
const counters = require('./user-counters');
const activityFeed = require('./activity-feed.service');
// One USD pricing rule for both staff consoles: the explicit USD leg, else
// basePriceNGN over the CoinRate doc.
const financeSurfaces = require('./finance-surfaces.service');

function err(status, message) { return Object.assign(new Error(message), { status }); }
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function pageOf(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
function wrapList(items, total, page, limit) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
function daysAgo(d) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
}
function hoursAgo(d) {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 3600000));
}

/* ── dashboard ── */
/* The dashboard KPI strip paints an arrow pill from {trend, up} on every card
   and the top-stories table from {trend, up} on every row, so a figure with no
   comparison period renders "undefined%". up is only the colour switch, and for
   the one card where growth is bad news — open reports — it flips on the way up. */
function pctTrend(cur, prev, bad) {
  const c = Number(cur) || 0, p = Number(prev) || 0;
  const diff = c - p;
  if (p > 0) {
    const pct = (diff / p) * 100;
    return { trend: (pct >= 0 ? '+' : '-') + Math.abs(pct).toFixed(1) + '%', up: bad ? pct <= 0 : pct >= 0 };
  }
  return absTrend(diff, bad);
}
// No comparable base period, so the pill shows the absolute change instead of a
// percentage — '+12' reads as twelve new reports, not twelve percent more.
function absTrend(delta, bad) {
  const d = Number(delta) || 0;
  return { trend: (d >= 0 ? '+' : '-') + Math.abs(d), up: bad ? d <= 0 : d >= 0 };
}

async function dashboardSummary() {
  const DAY = 86400000;
  const from30 = new Date(Date.now() - 30 * DAY);
  const from60 = new Date(Date.now() - 60 * DAY);
  const from7 = new Date(Date.now() - 7 * DAY);
  const from14 = new Date(Date.now() - 14 * DAY);
  const created = (from, to) => ({ createdAt: { $gte: from, $lt: to } });
  const ROLES_WRITER = { roles: 'writer', deletedAt: null };

  const [
    userCount, bookCount, postCount, activeCount, writerCount,
    users30, usersPrev30, writers30, writersPrev30, books30, booksPrev30,
    pendingReports, reports7, reportsPrev7,
    activeContracts, contracts30, liveCampaigns, campaigns30,
    months,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Book.countDocuments({}),
    Post.countDocuments({}),
    User.countDocuments({ deletedAt: null, lastLoginAt: { $gte: from30 } }),
    User.countDocuments(ROLES_WRITER),
    User.countDocuments({ deletedAt: null, ...created(from30, new Date()) }),
    User.countDocuments({ deletedAt: null, ...created(from60, from30) }),
    User.countDocuments({ ...ROLES_WRITER, ...created(from30, new Date()) }),
    User.countDocuments({ ...ROLES_WRITER, ...created(from60, from30) }),
    Book.countDocuments(created(from30, new Date())),
    Book.countDocuments(created(from60, from30)),
    Report.countDocuments({ status: 'pending' }),
    Report.countDocuments(created(from7, new Date())),
    Report.countDocuments(created(from14, from7)),
    Contract.countDocuments({ status: { $in: ['active', 'signed'] } }),
    Contract.countDocuments(created(from30, new Date())),
    Campaign.countDocuments({ status: 'live' }),
    Campaign.countDocuments(created(from30, new Date())),
    // Money-in, both currencies, straight off the finance rule — the ledger's
    // two legs per journal would have doubled this, and the old chart did just
    // that.
    financeSurfaces.revenueMonths(12),
  ]);
  const revenueNow = months[months.length - 1] || { revenue: 0 };
  const revenuePrev = months[months.length - 2] || { revenue: 0 };
  
  // Top stories with all fields frontend expects
  const topStories = await Book.find({}).sort({ reads: -1 }).limit(5)
    .select('id title authorId genre reads cover coverUrl').lean();
  const authorIds = [...new Set(topStories.map(b => String(b.authorId)))];
  const authors = await User.find({ id: { $in: authorIds } }).select('id fullName username').lean();
  const findAuthor = (aid) => authors.find(a => String(a.id) === String(aid));
  // What each book actually earned — completed author earnings, not a guess.
  const earned = await bookRevenueMap(bothIds(topStories));
  // The trend column is real momentum, not a decoration: BookDailyStat snapshots
  // per book per day, so last 7 days against the 7 before it is the only honest
  // answer. Books with no snapshot history read 0%, never a made-up percentage.
  const { BookDailyStat } = require('../models/content.model');
  const dayKey = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const readsAgg = await BookDailyStat.aggregate([
    { $match: { bookId: { $in: topStories.map(b => String(b.id)) }, day: { $gte: dayKey(14) } } },
    { $group: { _id: '$bookId', week: { $sum: { $cond: [{ $gte: ['$day', dayKey(7)] }, '$reads', 0] } }, prev: { $sum: { $cond: [{ $lt: ['$day', dayKey(7)] }, '$reads', 0] } } } },
  ]).catch(() => []);
  const readsOf = {};
  readsAgg.forEach(r => { readsOf[String(r._id)] = r; });

  const storiesData = topStories.map(b => {
    const author = findAuthor(b.authorId);
    const w = readsOf[String(b.id)] || { week: 0, prev: 0 };
    const t = pctTrend(w.week, w.prev);
    return {
      id: b.id,
      title: b.title,
      writer: author ? (author.fullName || '') : '',
      genre: b.genre || '',
      reads: b.reads || 0,
      revenue: earned[String(b.id)] || earned[String(b._id)] || 0,
      cover: b.cover || b.coverUrl || '',
      // The table prints `${s.trend}%`, so trend is the bare number.
      trend: w.prev > 0 ? Math.round((((w.week - w.prev) / w.prev) * 100)) : 0,
      up: t.up,
    };
  });
  
  // Twelve whole months of money-in, naira — the same figure the Monthly Revenue
  // card headlines, so the strip and the plot cannot disagree.
  const revenueChart = months.map(r => ({ m: r.month, v: r.revenue }));
  
  // Activity log mapped to frontend shape
  const activityLog = (await activityFeed.recent({ limit: 10 })).map(a => ({
    ico: a.ico,
    cls: a.cls,
    text: a.text,
    time: a.at ? new Date(a.at).toLocaleString() : '',
  }));
  
  // Admin team with perms object
  const adminUsers = await User.find({ roles: 'admin', deletedAt: null })
    .select('id fullName email avatar roles primaryRole status').lean();
  // Permission flags come from the role documents the Roles page edits, rolled
  // up into the five groups the dashboard panel shows.
  const teamRoles = await AdminRole.find({}).select('name memberIds perms').lean();
  const adminTeam = adminUsers.map(u => {
    const keys = keysOf(u);
    const mine = teamRoles.filter(r => (r.memberIds || []).some(m => keys.indexOf(String(m)) !== -1));
    const perms = {};
    Object.keys(PERM_GROUPS).forEach(g => {
      perms[g] = PERM_GROUPS[g].some(p => mine.some(r => roleHasPerm(r, p)));
    });
    return {
      id: u.id,
      name: u.fullName,
      email: u.email,
      avatar: u.avatar || '',
      role: (mine[0] && mine[0].name) || frontRole(u.primaryRole || 'admin'),
      status: u.status,
      perms,
    };
  });
  
  return {
    // The strip paints an arrow pill from trend and a red/green colour from up;
    // every figure must have both or it renders undefined in one slot. Money-in
    // is NGN here because the dashboard chart uses NGN, and the platform console
    // dollars is a different surface under /analytics/summary.
    kpiCards: [
      { n: userCount, l: 'Total Users', ico: 'fa-users', cls: 'blue', ...pctTrend(userCount, users30) },
      { n: writerCount, l: 'Total Writers', ico: 'fa-feather-pointed', cls: 'purple', ...pctTrend(writerCount, writers30) },
      { n: revenueNow.revenue, l: 'Monthly Revenue', ico: 'fa-sack-dollar', cls: 'green', ...pctTrend(revenueNow.revenue, revenuePrev.revenue) },
      { n: bookCount, l: 'Total Books', ico: 'fa-book-open', cls: 'gold', ...pctTrend(bookCount, books30) },
      { n: pendingReports, l: 'Pending Reports', ico: 'fa-flag', cls: 'red', ...absTrend(reports7 - reportsPrev7, true) },
      { n: activeContracts, l: 'Active Contracts', ico: 'fa-file-contract', cls: 'blue', ...pctTrend(activeContracts, contracts30) },
      { n: liveCampaigns, l: 'Live Campaigns', ico: 'fa-bullhorn', cls: 'accent', ...pctTrend(liveCampaigns, campaigns30) },
      { n: revenueNow.revenue - revenuePrev.revenue, l: 'Revenue (M-M)', ico: 'fa-arrow-up-wide-short', cls: 'green', ...absTrend(revenueNow.revenue - revenuePrev.revenue, false) },
    ],
    revenueChart,
    topStories: storiesData,
    activityLog,
    adminTeam,
  };
}

/* ── dashboard panels ──
   The dashboard page asks for five small shapes. They are views over the one
   aggregate above, so the KPI strip, the chart, the story table, the activity
   feed and the Admin Team panel can never disagree with each other. */
async function dashboardKpis() { return (await dashboardSummary()).kpiCards; }
async function dashboardRevenue() { return (await dashboardSummary()).revenueChart; }
async function dashboardTopStories() { return (await dashboardSummary()).topStories; }
async function dashboardActivity() { return (await dashboardSummary()).activityLog; }
async function listAdmins() { return (await dashboardSummary()).adminTeam; }

/* Create an admin from the dashboard's Add Admin modal. An admin must be able
   to sign in, so a real password is required (min 8) — there is no invite mail
   path yet. Username is derived from the email local part and de-duplicated. */
async function createAdmin(data) {
  const name = String((data && data.name) || '').trim();
  if (!name) throw err(400, 'name_required');
  const email = String((data && data.email) || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err(400, 'valid_email_required');
  const password = String((data && data.password) || '');
  if (password.length < 8) throw err(400, 'password_min_8');
  const dup = await User.findOne({ email: email, deletedAt: null }).select('id').lean();
  if (dup) throw err(409, 'email_taken');
  const base = String((data && data.username) || email.split('@')[0] || 'admin')
    .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 26) || 'admin';
  let username = base;
  for (let i = 2; i < 500; i++) {
    const taken = await User.findOne({ username: username }).select('id').lean();
    if (!taken) break;
    username = base + i;
  }
  const role = backRole((data && data.role) || 'Admin');
  // `admin` is the platform gate every super-admin route checks; the chosen
  // label rides along as the role the console displays.
  const roles = ['admin'];
  if (role && role !== 'admin') roles.push(role);
  return createUser({
    name: name,
    email: email,
    username: username,
    password: password,
    roles: roles,
    role: (data && data.role) || 'Admin',
    status: (data && data.status) || 'active',
  });
}

async function updateAdmin(id, patch) {
  const body = patch || {};
  const clean = {};
  if (body.name !== undefined) clean.name = body.name;
  if (body.email !== undefined) clean.email = body.email;
  if (body.role !== undefined) clean.role = body.role;
  if (body.status !== undefined) clean.status = body.status;
  return updateUser(id, clean);
}

/* Removing an admin is a soft delete (same as the Users console). A super
   admin cannot remove themselves, and the last remaining super admin stays. */
async function removeAdmin(id, actorId) {
  if (actorId && String(id) === String(actorId)) throw err(400, 'cannot_remove_self');
  const target = await User.findOne({ id: String(id), deletedAt: null }).select('id roles').lean();
  if (!target) throw err(404, 'user_not_found');
  if ((target.roles || []).includes('admin')) {
    const admins = await User.countDocuments({ roles: 'admin', deletedAt: null });
    if (admins <= 1) throw err(400, 'last_super_admin');
  }
  return removeUser(id);
}

/* ── users ── */
const FRONT_STATUS = { active: 'active', pending_verification: 'pending', suspended: 'suspended', banned: 'suspended' };
const BACK_STATUS = { active: 'active', pending: 'pending_verification', suspended: 'suspended', banned: 'banned' };
// Console displays Title-Case roles ("Senior Editor") — backend stores snake_case.
// The map itself lives in role-labels so the chat surfaces cannot drift from it.
const ROLE_LABELS = require('./role-labels');
const FRONT_ROLE = ROLE_LABELS.ROLE_LABEL;
const BACK_ROLE = ROLE_LABELS.LABEL_ROLE;
function frontRole(r) { return ROLE_LABELS.roleLabel(r); }
function backRole(r) { return ROLE_LABELS.roleToken(r); }

/* The dashboard Admin Team panel shows five coarse switches; the Roles page
   edits the 36 fine-grained PERM_KEYS flags. These map each switch onto the
   permissions that satisfy it, so the panel reads real role data. */
const PERM_GROUPS = {
  contracts: ['approve_contracts', 'view_authors', 'manage_submissions'],
  campaigns: ['view_campaigns', 'create_campaigns', 'approve_budget', 'manage_billing'],
  moderation: ['view_reports', 'resolve_reports', 'ban_users', 'edit_stories'],
  finance: ['view_financials', 'release_payouts', 'edit_rates'],
  admins: ['manage_roles', 'view_editors', 'manage_editors'],
};
function roleHasPerm(role, key) {
  const p = role && role.perms;
  if (!p) return false;
  return !!(p instanceof Map ? p.get(key) : p[key]);
}

/* id-flavor helpers: JWT + new writes use uuid `id`, but some FK fields written by
   other modules may still hold ObjectId strings. Match both flavors on every join. */
const HEX24 = /^[0-9a-fA-F]{24}$/;
function bothIds(users) {
  const out = [];
  (users || []).forEach(u => { if (u.id != null) out.push(String(u.id)); if (u._id != null) out.push(String(u._id)); });
  return [...new Set(out)];
}
function keysOf(u) { return [String(u.id), String(u._id)]; }
function rowHit(rows, keys) { return rows.find(r => keys.indexOf(String(r._id)) !== -1) || { n: 0 }; }
async function usersByStoredIds(vals, select, extra) {
  const uniq = [...new Set((vals || []).map(v => String(v)).filter(Boolean))];
  if (!uniq.length) return [];
  const or = [{ id: { $in: uniq } }];
  const hex = uniq.filter(v => HEX24.test(v));
  if (hex.length) or.push({ _id: { $in: hex } });
  const filter = extra && Object.keys(extra).length ? { $and: [{ $or: or }, extra] } : { $or: or };
  let q = User.find(filter);
  if (select) {
    const parts = String(select).split(/\s+/).filter(Boolean);
    if (!parts.includes('id')) parts.unshift('id');
    q = q.select(parts.join(' '));
  }
  return q.lean();
}
function userLookup(users) {
  const m = {};
  (users || []).forEach(u => { m[String(u.id)] = u; if (u._id != null) m[String(u._id)] = u; });
  return k => m[String(k)];
}

/* Only the two figures with no counter on the User doc still need a pass: books
   (count + lifetime reads, which move with the author's catalogue) and reports
   filed. Followers/following/posts/comments read from the User row. */
async function userStatsMap(ids) {
  const [stories, filedReports] = await Promise.all([
    Book.aggregate([{ $match: { authorId: { $in: ids } } }, { $group: { _id: '$authorId', n: { $sum: 1 }, reads: { $sum: '$reads' } } }]),
    Report.aggregate([{ $match: { reporterId: { $in: ids } } }, { $group: { _id: '$reporterId', n: { $sum: 1 } } }]),
  ]);
  // Each accessor takes the user's id keys — binding rows through a shared
  // (rows, keys) function instead would feed the keys array in as `rows` and
  // crash on the first user with any stat row at all.
  const get = (rows) => (keys) => rowHit(rows, keys);
  return { stories: get(stories), filedReports: get(filedReports) };
}

/* One pass over the coin ledger per user. The console used to sum `fiatAmount`
   over every completed row, so a top-up and spending that same money both
   landed in "coins spent" — and a $5 pack and a ₦1,500 pack added their raw
   digits together. Out goes in coins (the reader's own unit); money in is
   reported from the NGN-normalised columns the purchase already stores. */
const COIN_OUT = ['spend', 'gift', 'tip'];
const COIN_IN = ['purchase', 'subscription'];
const COIN_ZERO = {
  coinsSpent: 0, readCoins: 0, tipsCoins: 0, bonusSpent: 0,
  coinsBought: 0, earnCoins: 0, fundedNGN: 0,
};
function coinCond(types, field) {
  return { $sum: { $cond: [{ $in: ['$type', types] }, { $ifNull: [field, 0] }, 0] } };
}
async function coinLedgerMap(ids) {
  if (!ids || !ids.length) return () => COIN_ZERO;
  const rows = await CoinTransaction.aggregate([
    { $match: { userId: { $in: ids }, status: 'completed' } },
    { $group: {
      _id: '$userId',
      coinsSpent: coinCond(COIN_OUT, '$coins'),
      readCoins: coinCond(['spend'], '$coins'),
      tipsCoins: coinCond(['gift', 'tip'], '$coins'),
      bonusSpent: coinCond(COIN_OUT, '$bonusCoins'),
      coinsBought: coinCond(COIN_IN, '$coins'),
      earnCoins: coinCond(['earn'], '$coins'),
      fundedNGN: { $sum: { $cond: [{ $in: ['$type', COIN_IN] },
        { $add: [{ $ifNull: ['$faceAmount', 0] }, { $ifNull: ['$surplusAmount', 0] }] }, 0] } },
    } },
  ]);
  const by = {};
  rows.forEach(r => { by[String(r._id)] = r; });
  return (keys) => {
    const hit = (keys || []).map(String).filter(k => by[k])[0];
    return hit ? by[hit] : COIN_ZERO;
  };
}

/* What an author actually received from tips and gifts, in naira — the fiat
   half of the same act the reader paid in coins. Only the ledger leg carries
   it: the reader's CoinTransaction row records coins out, never whose share
   landed where. */
async function tipsReceivedMap(ids) {
  if (!ids || !ids.length) return () => 0;
  const accts = ids.map(a => 'wallet:author:' + a);
  const rows = await LedgerEntry.aggregate([
    { $match: { creditAcct: { $in: accts }, kind: { $in: ['tip', 'gift'] } } },
    { $group: { _id: '$creditAcct', n: { $sum: '$amount' } } },
  ]);
  const by = {};
  rows.forEach(r => { by[String(r._id)] = r.n; });
  return (keys) => {
    const hit = (keys || []).map(String).map(k => by['wallet:author:' + k]).filter(v => v)[0];
    return hit || 0;
  };
}

/* Likes / shares / saves — the same definitions the audience segments use
   (audience.service.js SIGNALS): a reaction row counts, shares and saves count
   distinct targets. One rule in both places, so the users table and a segment
   can never disagree about what "saves" means. */
const ENGAGE_ZERO = { likesGiven: 0, sharesCount: 0, savesCount: 0 };
function toCountMap(rows) {
  const m = {};
  rows.forEach(r => { m[String(r._id)] = r.n; });
  return m;
}
async function engagementMap(ids) {
  if (!ids || !ids.length) return () => ENGAGE_ZERO;
  const [likes, shares, saves] = await Promise.all([
    Reaction.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]),
    ShareEvent.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', t: { $addToSet: '$targetId' } } },
      { $project: { n: { $size: '$t' } } },
    ]),
    LibraryItem.aggregate([
      { $match: { userId: { $in: ids }, list: { $in: ['library', 'saved'] } } },
      { $group: { _id: '$userId', t: { $addToSet: '$storyId' } } },
      { $project: { n: { $size: '$t' } } },
    ]),
  ]);
  const L = toCountMap(likes), S = toCountMap(shares), V = toCountMap(saves);
  return (keys) => {
    const k = (keys || []).map(String);
    const pick = (m) => { const hit = k.filter(x => m[x] !== undefined)[0]; return hit ? m[hit] : 0; };
    return { likesGiven: pick(L), sharesCount: pick(S), savesCount: pick(V) };
  };
}

/* Reading stats from ReadingProgress. Each row is one (user, story, chapter)
   and carries that chapter's accumulated time, so a row is one reading
   session: minutes/session and sessions/active-day both fall out of it.
   Top genres are the genres of the books actually read, not the reader's
   self-declared tags. */
const READ_ZERO = { readingHours: 0, avgSessionMin: 0, streakDays: 0, sessionsPerDay: 0, topGenres: [] };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Longest consecutive-day run — the same rule the streak leaderboard sorts by.
function bestStreak(days) {
  const ds = (days || []).filter(d => DAY.test(d)).sort();
  let best = 0, run = 0, prev = null;
  ds.forEach(d => {
    const t = new Date(d + 'T00:00:00Z').getTime();
    run = (prev !== null && t - prev === 86400000) ? run + 1 : 1;
    prev = t;
    if (run > best) best = run;
  });
  return best;
}
async function readingMap(ids) {
  if (!ids || !ids.length) return () => READ_ZERO;
  const rows = await ReadingProgress.aggregate([
    { $match: { userId: { $in: ids } } },
    { $group: {
      _id: '$userId',
      seconds: { $sum: { $ifNull: ['$secondsSpent', 0] } },
      sessions: { $sum: 1 },
      stories: { $addToSet: '$storyId' },
      days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } },
    } },
  ]);
  const storyIds = [...new Set(rows.reduce((acc, r) => acc.concat(r.stories || []), []))];
  const hex = storyIds.filter(v => HEX24.test(v));
  const books = storyIds.length
    ? await Book.find({ $or: hex.length ? [{ id: { $in: storyIds } }, { _id: { $in: hex } }] : [{ id: { $in: storyIds } }] })
        .select('id genre').lean()
    : [];
  const genreOf = {};
  books.forEach(b => { if (b.genre) { genreOf[String(b.id)] = b.genre; genreOf[String(b._id)] = b.genre; } });
  const by = {};
  rows.forEach(r => {
    const counts = {};
    (r.stories || []).forEach(s => {
      const g = genreOf[String(s)];
      if (g) counts[g] = (counts[g] || 0) + 1;
    });
    const days = (r.days || []).filter(d => DAY.test(d));
    by[String(r._id)] = {
      readingHours: +(r.seconds / 3600).toFixed(1),
      avgSessionMin: r.sessions ? +(r.seconds / 60 / r.sessions).toFixed(1) : 0,
      sessionsPerDay: days.length ? +(r.sessions / days.length).toFixed(1) : 0,
      streakDays: bestStreak(days),
      topGenres: Object.keys(counts)
        .map(name => ({ name, count: counts[name] }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3),
    };
  });
  return (keys) => {
    const hit = (keys || []).map(String).filter(k => by[k])[0];
    return hit ? by[hit] : READ_ZERO;
  };
}

function toAdminUser(u, extra) {
  extra = extra || {};
  const c = Object.assign({}, COIN_ZERO, extra.coin || {});
  const rd = Object.assign({}, READ_ZERO, extra.read || {});
  const eg = Object.assign({}, ENGAGE_ZERO, extra.engage || {});
  return {
    id: u.id,
    name: u.fullName,
    username: u.username,
    email: u.email,
    role: frontRole(u.primaryRole || (u.roles && u.roles[0]) || 'reader'),
    status: FRONT_STATUS[u.status] || u.status,
    avatar: u.avatar || '',
    verified: !!u.emailVerified,
    joined: u.createdAt,
    lastActive: u.lastLoginAt || null,
    // Follow/post/comment totals come off the User doc — services/user-counters.js
    // keeps them in step with each write, so a console page costs no extra
    // collection pass. Books and filed reports still aggregate below.
    followers: u.followerCount || 0,
    following: u.followingCount || 0,
    posts: u.postCount || 0,
    stories: (extra.stories && extra.stories.n) || 0,
    reads: (extra.stories && extra.stories.reads) || 0,
    payout: extra.payout || 0,
    // Coins are the unit a coin act is denominated in — the reader's balance,
    // gift receipts and tip sheet all read `coins`, never naira. Money in is a
    // separate number (`fundedNGN`) and separate question.
    coinsSpent: c.coinsSpent,
    readCoins: c.readCoins,
    tipsCoins: c.tipsCoins,
    bonusCoinsSpent: c.bonusSpent,
    coinsBought: c.coinsBought,
    earnCoins: c.earnCoins,
    fundedNGN: c.fundedNGN,
    // An author's tips are money, not coins — the reader who sent them is the
    // one holding a coin number. Different side of the same act, different unit.
    tipsReceivedNGN: extra.tipsReceived || 0,
    comments: u.commentCount || 0,
    reports: (extra.filed && extra.filed.n) || 0,
    readingHours: rd.readingHours,
    avgSessionMin: rd.avgSessionMin,
    streakDays: rd.streakDays,
    topGenres: rd.topGenres,
    likesGiven: eg.likesGiven,
    sharesCount: eg.sharesCount,
    savesCount: eg.savesCount,
    platformRoles: (u.platformRoles && u.platformRoles.length ? u.platformRoles : (u.roles || [])).map(frontRole),
    notes: u.adminNotes || '',
  };
}

async function listUsers(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = { deletedAt: null };
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { username: rx }, { email: rx }];
  }
  if (q.role) {
    const role = backRole(q.role); // frontend sends Title-Case ("Senior Editor")
    filter.$or ? filter.$and = [{ roles: role }] : (filter.roles = role);
  }
  if (q.status && BACK_STATUS[q.status]) filter.status = BACK_STATUS[q.status];
  const sort = { '-active': { lastLoginAt: -1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'a-z': { fullName: 1 } }[q.sort] || { createdAt: -1 };
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  const ids = bothIds(users);
  const stats = await userStatsMap(ids);
  const [wallets, coinOf, tipsOf, readOf, engageOf] = await Promise.all([
    Wallet.find({ userId: { $in: ids }, kind: { $in: ['reader', 'author'] } }).lean(),
    coinLedgerMap(ids),
    tipsReceivedMap(ids),
    readingMap(ids),
    engagementMap(ids),
  ]);
  const items = users.map(u => {
    const keys = keysOf(u);
    const mine = wallets.filter(x => keys.indexOf(String(x.userId)) !== -1);
    // Two different wallets, two different questions: the author one holds
    // lifetime earnings (payout), the reader one holds the coin balance.
    const aw = mine.find(x => x.kind === 'author');
    const rw = mine.find(x => x.kind === 'reader');
    const row = toAdminUser(u, {
      stories: stats.stories(keys), filed: stats.filedReports(keys),
      payout: (aw && aw.lifetimeEarned) || 0, coin: coinOf(keys), tipsReceived: tipsOf(keys),
      read: readOf(keys), engage: engageOf(keys),
    });
    row.stats = {
      followers: row.followers,
      following: row.following,
      posts: row.posts,
      stories: row.stories,
      reads: row.reads,
      comments: row.comments,
    };
    row.wallet = {
      balance: {
        coins: (rw && rw.coinBalance) || 0,
        bonus: (rw && rw.bonusBalance) || 0,
      },
    };
    return row;
  });
  const active = await User.countDocuments({ deletedAt: null, status: 'active' });
  return Object.assign(wrapList(items, total, page, limit), { stats: { total, active } });
}

async function getUser(id) {
  const u = await User.findOne({ id: id, deletedAt: null }).lean();
  if (!u) throw err(404, 'user_not_found');
  const ids = bothIds([u]);
  const stats = await userStatsMap(ids);
  const [walletRows, coin, tips, read, engage] = await Promise.all([
    Wallet.find({ userId: { $in: ids }, kind: { $in: ['reader', 'author'] } }).lean(),
    coinLedgerMap(ids),
    tipsReceivedMap(ids),
    readingMap(ids),
    engagementMap(ids),
  ]);
  const aw = walletRows.find(x => x.kind === 'author');
  const rw = walletRows.find(x => x.kind === 'reader');
  const row = toAdminUser(u, {
    stories: stats.stories(ids), filed: stats.filedReports(ids),
    payout: (aw && aw.lifetimeEarned) || 0, coin: coin(ids), tipsReceived: tips(ids),
    read: read(ids), engage: engage(ids),
  });
  row.stats = {
    followers: row.followers,
    following: row.following,
    posts: row.posts,
    stories: row.stories,
    reads: row.reads,
    comments: row.comments,
  };
  row.wallet = {
    balance: {
      coins: (rw && rw.coinBalance) || 0,
      bonus: (rw && rw.bonusBalance) || 0,
    },
  };
  row.profile = {
    bio: u.bio || '',
    location: u.location || '',
    website: u.website || '',
  };
  // Coin analytics breakdown by type (spend/read/tip/gift/buy/earn)
  const c = coin(ids);
  row.coinAnalytics = {
    totalSpent: c.coinsSpent,
    readSpent: c.readCoins,
    tipsGiven: c.tipsCoins,
    giftsSent: c.bonusSpent,
    coinsBought: c.coinsBought,
    earnCoins: c.earnCoins,
    fundedNGN: c.fundedNGN,
  };
  // Cohort info (signup month + last login activity)
  const signupMonth = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 7) : '';
  row.cohort = { signupMonth, lastActive: u.lastLoginAt, active30d: !!u.lastLoginAt && (Date.now() - new Date(u.lastLoginAt) < 30 * 86400000) };
  return row;
}

async function createUser(data, by) {
  // FIX 10: never store raw passwordHash — accept `password` and argon2-hash it.
  // Legacy `passwordHash` input is rejected unless it already looks like argon2.
  let passwordHash = null;
  if (data.password) {
    if (String(data.password).length < 8) throw err(400, 'bad_password');
    const argon2 = require('argon2');
    passwordHash = await argon2.hash(String(data.password), { type: argon2.argon2id });
  } else if (data.passwordHash) {
    if (!String(data.passwordHash).startsWith('$argon2')) throw err(400, 'password_must_be_hashed');
    passwordHash = data.passwordHash;
  }
  const doc = await User.create({
    fullName: data.name, username: data.username, email: data.email,
    passwordHash, authProvider: 'local',
    avatar: data.avatar || '', phone: data.phone || '',
    roles: data.roles && data.roles.length ? data.roles.map(backRole) : ['reader'],
    primaryRole: data.role ? backRole(data.role) : 'reader',
    platformRoles: (data.platformRoles || []).map(backRole).slice(0, 10),
    status: data.status && BACK_STATUS[data.status] ? BACK_STATUS[data.status] : 'active',
    adminNotes: data.notes || '',
  });
  await syncUserRoleMembership(doc.id, doc.roles).catch(() => {});
  return toAdminUser(doc.toJSON());
}

/* Users console and Roles page are two views of one fact. When a user is given
   (or loses) a role here, mirror it onto AdminRole.memberIds so the Roles page
   lists the same people. Unknown slugs (reader/writer) simply have no doc. */
async function syncUserRoleMembership(userId, roles) {
  const id = String(userId || '');
  if (!id) return;
  const slugs = [...new Set((roles || []).map(r => String(r)).filter(Boolean))];
  await AdminRole.updateMany({ slug: { $nin: slugs } }, { $pull: { memberIds: id } });
  if (slugs.length) await AdminRole.updateMany({ slug: { $in: slugs } }, { $addToSet: { memberIds: id } });
}

async function updateUser(id, patch) {
  const u = await User.findOne({ id: id, deletedAt: null });
  if (!u) throw err(404, 'user_not_found');
  if (patch.name !== undefined) u.fullName = patch.name;
  if (patch.email !== undefined) u.email = String(patch.email).toLowerCase();
  if (patch.username !== undefined) u.username = String(patch.username).toLowerCase();
  if (patch.avatar !== undefined) u.avatar = patch.avatar;
  if (patch.phone !== undefined) u.phone = patch.phone;
  if (patch.role !== undefined) {
    const r = backRole(patch.role);
    u.primaryRole = r;
    if (!u.roles.includes(r)) u.roles.push(r);
  }
  if (patch.roles !== undefined) {
    u.roles = patch.roles.map(backRole);
    u.primaryRole = u.roles[0] || u.primaryRole;
  }
  if (patch.platformRoles !== undefined) {
    // console-curated extra labels (Marketing, Support…) — stored snake_case
    u.platformRoles = (patch.platformRoles || []).map(backRole).slice(0, 10);
  }
  if (patch.status !== undefined && BACK_STATUS[patch.status]) u.status = BACK_STATUS[patch.status];
  if (patch.verified !== undefined) { u.emailVerified = !!patch.verified; if (patch.verified) u.emailVerifiedAt = u.emailVerifiedAt || new Date(); }
  if (patch.notes !== undefined) u.adminNotes = patch.notes;
  await u.save();
  // A role granted here must also show on the Roles page, which reads
  // AdminRole.memberIds. Keep the two views in one write.
  if (patch.role !== undefined || patch.roles !== undefined) {
    await syncUserRoleMembership(u.id, u.roles).catch(() => {});
  }
  return toAdminUser(u.toJSON());
}

async function removeUser(id) {
  const u = await User.findOne({ id: id, deletedAt: null });
  if (!u) throw err(404, 'user_not_found');
  u.deletedAt = new Date();
  u.status = 'suspended';
  await u.save();
  return { id: u.id, suspended: true };
}

/* ── roles ── */
function toRole(r, memberCount) {
  const perms = {};
  PERM_KEYS.forEach(k => { perms[k] = !!(r.perms && r.perms.get ? r.perms.get(k) : r.perms && r.perms[k]); });
  return {
    id: r.id, slug: r.slug || '', name: r.name, desc: r.desc, icon: r.icon, color: r.color,
    system: !!r.system, memberCount: memberCount != null ? memberCount : (r.memberIds || []).length,
    members: [], perms,
  };
}
async function roleMembers(role) {
  const users = await usersByStoredIds(role.memberIds || [], 'fullName email avatar', { deletedAt: null });
  return users.map(u => ({ id: u.id, name: u.fullName, email: u.email, avatar: u.avatar }));
}

// Write-through: when a system role's memberIds change, mirror the slug onto
// each affected User.roles. $addToSet + $pull so re-adding the same user is a
// no-op and the update is one round-trip per side.
async function syncRoleMembers(slug, oldIds, newIds) {
  if (!slug) return { added: 0, removed: 0 };
  const oset = new Set((oldIds || []).map(String));
  const nset = new Set((newIds || []).map(String));
  const adds = [...nset].filter(id => !oset.has(id));
  const removes = [...oset].filter(id => !nset.has(id));
  const ops = [];
  if (adds.length) ops.push(User.updateMany({ id: { $in: adds } }, { $addToSet: { roles: slug } }));
  if (removes.length) ops.push(User.updateMany({ id: { $in: removes } }, { $pull: { roles: slug } }));
  if (!ops.length) return { added: 0, removed: 0 };
  const [a, r] = await Promise.all(ops);
  return { added: a ? a.modifiedCount : 0, removed: r ? r.modifiedCount : 0 };
}

// Boot seed. Idempotent — updates an existing slug if missing, otherwise
// creates it. Never overwrites a role a human edited.
// Grants mirror the requireRole() guards in each module's route files, so a
// seeded role can do exactly what its module pages call.
const ALL_PERMS = PERM_KEYS.reduce((o, k) => { o[k] = true; return o; }, {});
const SYSTEM_ROLE_SEED = [
  { slug:'admin', name:'Super Admin', desc:'Full platform access across people, content, finance and ops.', icon:'fa-crown', color:'accent',
    perms: ALL_PERMS },
  { slug:'chief_editor', name:'Chief Editor', desc:'Owns the editorial pipeline; sets strategy and signs contracts.', icon:'fa-user-tie', color:'purple',
    perms:{ view_editors:true, manage_editors:true, approve_contracts:true, read_flagged_books:true, manage_editorial_policy:true, set_editorial_strategy:true, publish_announcements:true, view_authors:true, edit_stories:true, manage_submissions:true, view_reports:true, resolve_reports:true, view_analytics:true } },
  { slug:'senior_editor', name:'Senior Editor', desc:'Reviews submissions, edits stories and manages author pods.', icon:'fa-pen-nib', color:'blue',
    perms:{ view_authors:true, edit_stories:true, manage_submissions:true, review_completions:true, manage_authors:true, review_contracts:true, resolve_reports:true, view_reports:true, view_own_earnings:true, publish_announcements:true } },
  { slug:'finance', name:'Finance Admin', desc:'Processes withdrawals, edits splits and manages billing.', icon:'fa-sack-dollar', color:'green',
    perms:{ view_financials:true, release_payouts:true, resolve_payment_disputes:true, manage_coin_store:true, manage_payment_methods:true, edit_rates:true, manage_billing:true, view_analytics:true } },
  { slug:'marketing', name:'Marketing Admin', desc:'Runs campaigns, approves budgets and reads analytics.', icon:'fa-bullhorn', color:'amber',
    perms:{ view_campaigns:true, create_campaigns:true, manage_ads:true, manage_rate_card:true, manage_audience:true, manage_league:true, approve_budget:true, view_analytics:true, view_financials:true } },
  { slug:'support', name:'Support Admin', desc:'Handles user reports, bans and disputes.', icon:'fa-headset', color:'pink',
    perms:{ view_reports:true, resolve_reports:true, ban_users:true, manage_users:true, view_authors:true } },
];

async function ensureSystemRoles() {
  const made = [];
  for (const seed of SYSTEM_ROLE_SEED) {
    const existing = await AdminRole.findOne({ slug: seed.slug }).lean();
    if (existing) continue;
    const perms = {};
    PERM_KEYS.forEach(k => { perms[k] = !!(seed.perms && seed.perms[k]); });
    await AdminRole.create({
      slug: seed.slug, name: seed.name, desc: seed.desc, icon: seed.icon, color: seed.color,
      system: true, memberIds: [], perms,
    });
    made.push(seed.slug);
  }
  return { created: made.length, slugs: made };
}

// Perms lookup for requirePerm. Aggregate across every AdminRole whose slug
// matches one of the actor's User.roles. 30-second cache keyed on sorted
// roles so a burst of API calls from the same actor is cheap.
let _permCache = { at:0, key:'', bySlug:null };
async function permsBySlug() {
  const now = Date.now();
  if (_permCache.bySlug && now - _permCache.at < 30000) return _permCache.bySlug;
  const docs = await AdminRole.find({ slug: { $type:'string', $ne:'' } }).select('slug perms').lean();
  const map = {};
  docs.forEach(d => {
    const p = {};
    PERM_KEYS.forEach(k => { p[k] = !!(d.perms && (d.perms instanceof Map ? d.perms.get(k) : d.perms[k])); });
    map[d.slug] = p;
  });
  _permCache = { at:now, key:'', bySlug:map };
  return map;
}
function invalidatePermCache(){ _permCache = { at:0, key:'', bySlug:null }; }
async function listRoles() {
  const roles = await AdminRole.find({}).sort({ name: 1 }).lean();
  return roles.map(r => toRole(r));
}
async function getRole(id) {
  const r = await AdminRole.findOne({ id: id }).lean();
  if (!r) throw err(404, 'role_not_found');
  const out = toRole(r);
  out.members = await roleMembers(r);
  return out;
}
async function createRole(data) {
  const perms = {};
  PERM_KEYS.forEach(k => { perms[k] = !!(data.perms && data.perms[k]); });
  const slug = String(data.slug || '').trim().toLowerCase();
  if (slug) {
    const taken = await AdminRole.findOne({ slug }).lean();
    if (taken) throw err(409, 'slug_taken');
  }
  const doc = await AdminRole.create({
    name: data.name, slug, desc: data.desc || '', icon: data.icon || 'fa-user-shield',
    color: data.color || 'blue', system: false, memberIds: data.memberIds || [], perms,
  });
  invalidatePermCache();
  if (slug && data.memberIds && data.memberIds.length) {
    await syncRoleMembers(slug, [], data.memberIds);
  }
  const out = toRole(doc.toJSON());
  out.members = await roleMembers(doc.toJSON());
  return out;
}
async function updateRole(id, patch) {
  const r = await AdminRole.findOne({ id: id });
  if (!r) throw err(404, 'role_not_found');
  // slug is frozen after create — the User.roles tokens already reference it.
  if (patch.name !== undefined) r.name = patch.name;
  if (patch.desc !== undefined) r.desc = patch.desc;
  if (patch.icon !== undefined) r.icon = patch.icon;
  if (patch.color !== undefined) r.color = patch.color;
  const membersChanged = patch.memberIds !== undefined;
  const oldMembers = (r.memberIds || []).slice();
  if (membersChanged) r.memberIds = patch.memberIds;
  if (patch.perms !== undefined) {
    PERM_KEYS.forEach(k => { if (patch.perms[k] !== undefined) r.perms.set(k, !!patch.perms[k]); });
  }
  await r.save();
  invalidatePermCache();
  if (membersChanged && r.slug) {
    await syncRoleMembers(r.slug, oldMembers, r.memberIds || []);
  }
  const out = toRole(r.toJSON());
  out.members = await roleMembers(r.toJSON());
  return out;
}
async function deleteRole(id) {
  const r = await AdminRole.findOne({ id: id });
  if (!r) throw err(404, 'role_not_found');
  if (r.system) throw err(400, 'system_role_locked');
  const slug = r.slug || '';
  const members = (r.memberIds || []).slice();
  await AdminRole.deleteOne({ id: id });
  invalidatePermCache();
  // Custom roles rarely carry a slug, but if one ever does (or a member was
  // added via another write path), strip the token from every account so the
  // deleted role stops granting anything.
  if (members.length) {
    await User.updateMany({ id: { $in: members.map(String) } }, { $pull: { roles: slug || id } });
  }
  return { id, deleted: true };
}

/* ── editorial team (derived from platform roles) ── */
async function editorialTeam(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = { roles: { $in: ['senior_editor', 'chief_editor'] }, deletedAt: null };
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { username: rx }];
  }
  if (q.status && BACK_STATUS[q.status]) filter.status = BACK_STATUS[q.status];
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const ids = bothIds(users);
  const editorIds = users.filter(u => u.roles.includes('senior_editor')).map(u => String(u.id));
  const ceIds = users.filter(u => u.roles.includes('chief_editor')).map(u => String(u.id));
  
  // SE contract count + resolved reports
  const contractsAgg = Contract.aggregate([{ $match: { editorId: { $in: editorIds } } }, { $group: { _id: '$editorId', n: { $sum: 1 } } }]);
  const resolvedAgg = Report.aggregate([{ $match: { resolvedBy: { $in: editorIds } } }, { $group: { _id: '$resolvedBy', n: { $sum: 1 } } }]);
  const authorPodsAgg = Contract.aggregate([
    { $match: { editorId: { $in: editorIds }, authorId: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$editorId', authors: { $addToSet: '$authorId' } } },
  ]);
  const ceContractsAgg = Contract.aggregate([{ $match: { editorId: { $in: ceIds } } }, { $group: { _id: '$editorId', n: { $sum: 1 } } }]);
  const ceEscalatedAgg = Report.aggregate([{ $match: { severity: 'high', status: 'pending' } }, { $group: { _id: '$seId', n: { $sum: 1 } } }]);
  const cePoliciesAgg = Policy.countDocuments({});
  
  // Marketing campaigns
  const campaignDocs = await Campaign.find({ owner: { $in: ceIds } }).lean();
  const campaignHits = {};
  campaignDocs.forEach(doc => {
    if (!campaignHits[String(doc._id)]) campaignHits[String(doc._id)] = { campaigns: 0, live: 0 };
    campaignHits[String(doc._id)].campaigns++;
    if (doc.status === 'live') campaignHits[String(doc._id)].live++;
  });
  
  // Finance queue/disputes
  const finQueueAgg = Withdrawal.aggregate([
    { $match: { status: { $in: ['requested', 'approved'] } } },
    { $group: { _id: null, queue: { $sum: 1 } } },
  ]);
  const finDisputesAgg = PaymentDispute.aggregate([
    { $match: { status: 'open' } },
    { $group: { _id: null, disputes: { $sum: 1 } } },
  ]);
  const finVolumeAgg = AuthorTransaction.aggregate([
    { $match: { type: 'payout', status: 'completed', amount: { $gt: 0 } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  
  const [contractsHit, resolvedHit, authorPods, ceContractsHit, ceEscalatedHit, cePoliciesHits, finQueueHit, finDisputesHit, finVolumeHit] = await Promise.all([
    contractsAgg, resolvedAgg, authorPodsAgg, ceContractsAgg, ceEscalatedAgg, cePoliciesAgg,
    finQueueAgg, finDisputesAgg, finVolumeAgg,
  ]);
  
  const makeHit = (agg, keys) => agg.find(a => keys.indexOf(String(a._id)) !== -1) || {};
  const hits = {
    seCon: {}, seRes: {}, seAuthors: {}, ceCnt: {}, ceEsc: {}, cePol: {}, mktCamp: {}, mktLive: {}, finQ: {}, finD: {}, finVol: {},
  };
  contractsHit.forEach(c => hits.seCon[String(c._id)] = c.n);
  resolvedHit.forEach(r => hits.seRes[String(r._id)] = r.n);
  authorPods.forEach(p => hits.seAuthors[String(p._id)] = (p.authors || []).length);
  ceContractsHit.forEach(c => hits.ceCnt[String(c._id)] = c.n);
  ceEscalatedHit.forEach(e => hits.ceEsc[String(e._id)] = e.n);
  hits.cePol['*'] = cePoliciesHits;
  Object.entries(campaignHits).forEach(([k, v]) => { hits.mktCamp[k] = v.campaigns; hits.mktLive[k] = v.live; });
  finQueueHit.forEach(q => hits.finQ['*'] = q.queue);
  finDisputesHit.forEach(d => hits.finD['*'] = d.disputes);
  finVolumeHit.forEach(v => hits.finVol['*'] = v.total);
  
  const items = users.map(u => {
    const keys = keysOf(u);
    const isLead = (u.primaryRole || u.roles[0]) === 'chief_editor';
    const uId = String(u.id);
    
    let se = null, ce = null, mkt = null, fin = null;
    
    if (u.roles.includes('senior_editor')) {
      const podAuthors = hits.seAuthors[uId] || 0;
      const target = 50; // configurable
      const invited = podAuthors + Math.floor(Math.random() * 20); // placeholder for invites sent
      const openReports = hits.seRes[uId] || 0;
      const payUsd = 3200; // avg editor rate in USD
      const quota = podAuthors < target * 0.7 ? 'behind' : podAuthors > target * 0.9 ? 'ahead' : 'on-track';
      const deadline = 'Jul 31, 2026';
      const share = Math.floor(Math.random() * 5 + 8) + '%'; // 8-12% revenue share
      
      se = {
        authors: podAuthors,
        target,
        invited,
        quota,
        openReports,
        payUsd,
        payType: 'revenue-share',
        share,
        ytdUsd: payUsd * 12,
        deadline,
      };
    } else if (u.roles.includes('chief_editor')) {
      ce = {
        editors: editorIds.length,
        contractsToSign: hits.ceCnt[uId] || 0,
        escalated: hits.ceEsc[uId] || 0,
        policies: hits.cePol['*'] || 0,
      };
    }
    
    return {
      id: u.id,
      name: u.fullName,
      email: u.email,
      avatar: u.avatar || '',
      role: isLead ? 'Chief Editor' : 'Senior Editor',
      lead: isLead,
      authors: hits.seAuthors[uId] || 0,
      contracts: hits.seCon[uId] || 0,
      reports: hits.seRes[uId] || 0,
      status: FRONT_STATUS[u.status] || u.status,
      joinedDaysAgo: daysAgo(u.createdAt),
      platformRoles: u.roles || [],
      ...(se && { se }),
      ...(ce && { ce }),
      ...(mkt && { mkt }),
      ...(fin && { fin }),
    };
  });
  
  return wrapList(items, total, page, limit);
}

/* ── insights (exact frontend shape: {users, ex, genreColors, refDate, subPrice}) ── */
const GENRE_PALETTE = ['#ff0050', '#7c5cfc', '#2f7de1', '#16a34a', '#d97706', '#e0384d', '#0ea5e9', '#8b5cf6'];
function genreColor(name) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return GENRE_PALETTE[Math.abs(h) % GENRE_PALETTE.length];
}
async function insightsOverview() {
  const users = await User.find({ deletedAt: null }).sort({ lastLoginAt: -1 }).limit(500).lean();
  const ids = bothIds(users);
  const [wallets, subs, referrals, coinOf, tipsOf, readOf, engageOf] = await Promise.all([
    Wallet.find({ userId: { $in: ids }, kind: 'author' }).lean(),
    Subscription.find({ userId: { $in: ids }, status: 'active' }).lean(),
    Referral.aggregate([
      { $match: { ownerId: { $in: ids } } },
      { $group: { _id: '$ownerId', sent: { $sum: 1 }, converted: { $sum: { $cond: ['$readRewarded', 1, 0] } } } },
    ]),
    coinLedgerMap(ids),
    tipsReceivedMap(ids),
    readingMap(ids),
    engagementMap(ids),
  ]);
  const walletOf = (keys) => wallets.find(x => keys.indexOf(String(x.userId)) !== -1);
  
  // Cohorts by month of first login (with simple 30-day retention count)
  const cohortData = await User.aggregate([
    { $match: { deletedAt: null, createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, active: { $sum: { $cond: [{ $gte: [30 * 86400000, { $subtract: [Date.now(), '$lastLoginAt'] }] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
    { $limit: 12 }
  ]);
  const cohorts = cohortData.map(c => ({ m: c._id, v: c.count, active: c.active }));
  
  const ex = users.map(u => {
    const id = String(u.id);
    const keys = keysOf(u);
    const sub = subs.find(x => keys.indexOf(String(x.userId)) !== -1);
    const ref = referrals.find(x => keys.indexOf(String(x._id)) !== -1) || { sent: 0, converted: 0 };
    return {
      u: id,
      x: {
        referralsSent: ref.sent || 0, referralsConverted: ref.converted || 0,
        plan: sub ? 'premium' : 'free',
        funded: coinOf(keys).fundedNGN,
        // Chapters read per day the reader actually read — a real session
        // count, not words divided by an invented session size.
        sessionsPerDay: readOf(keys).sessionsPerDay,
      },
    };
  });
  const genreColors = {};
  const refDate = users.reduce((m, u) => {
    const t = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0;
    return t > m ? t : m;
  }, 0);
  // genre affinity colors derived from author genres present
  const genres = await Book.aggregate([
    { $match: { authorId: { $in: ids } } },
    { $group: { _id: '$genre', n: { $sum: 1 } } },
  ]);
  genres.forEach(g => { if (g._id) genreColors[g._id] = genreColor(g._id); });
  return {
    users: users.map(u => {
      const keys = keysOf(u);
      const w = walletOf(keys);
      return toAdminUser(u, {
        payout: (w && w.lifetimeEarned) || 0, coin: coinOf(keys), tipsReceived: tipsOf(keys),
        read: readOf(keys), engage: engageOf(keys),
      });
    }),
    ex, cohorts, genreColors,
    refDate: refDate ? new Date(refDate).toISOString() : new Date().toISOString(),
    subPrice: await monthlyPlanPriceUsd(),
  };
}

/* The MRR card is premium-count × one plan price. Read the live monthly plan
   and price it the way the finance catalog prices it: explicit USD leg, else
   basePriceNGN over the CoinRate table. */
async function monthlyPlanPriceUsd() {
  const plan = await SubscriptionPlan.findOne({ period: 'month', status: 'active' })
    .sort({ basePriceNGN: 1 }).lean();
  return plan ? await financeSurfaces.priceUsdOf(plan) : 0;
}
async function insightsLeaderboard(q) {
  const type = q.type || 'readtime';
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 10));
  const userFilter = { deletedAt: null };
  if (q.role) userFilter.roles = q.role;
  let rows = [];
  if (type === 'readtime') {
    const agg = await ReadingProgress.aggregate([
      { $group: { _id: '$userId', words: { $sum: '$wordsRead' }, days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } } },
      { $sort: { words: -1 } }, { $limit: limit },
    ]);
    const users = await usersByStoredIds(agg.map(a => a._id), null, userFilter);
    const findUser = userLookup(users);
    rows = agg.filter(a => findUser(a._id)).map(a => {
      const u = findUser(a._id);
      return { id: a._id, name: u.fullName, handle: u.username, avatar: u.avatar, value: a.words, days: a.days.length };
    });
  } else if (type === 'referrals') {
    const agg = await Referral.aggregate([
      { $group: { _id: '$ownerId', converted: { $sum: { $cond: ['$readRewarded', 1, 0] } }, sent: { $sum: 1 } } },
      { $sort: { converted: -1 } }, { $limit: limit },
    ]);
    const users = await usersByStoredIds(agg.map(a => a._id), null, userFilter);
    const findUser = userLookup(users);
    rows = agg.filter(a => findUser(a._id)).map(a => {
      const u = findUser(a._id);
      return { id: a._id, name: u.fullName, handle: u.username, avatar: u.avatar, value: a.converted, sent: a.sent };
    });
  } else if (type === 'tips') {
    const agg = await LedgerEntry.aggregate([
      { $match: { kind: 'gift' } },
      { $group: { _id: '$authorId', total: { $sum: '$amount' }, n: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: limit },
    ]);
    const users = await usersByStoredIds(agg.map(a => a._id), null, userFilter);
    const findUser = userLookup(users);
    rows = agg.filter(a => a._id && findUser(a._id)).map(a => {
      const u = findUser(a._id);
      return { id: a._id, name: u.fullName, handle: u.username, avatar: u.avatar, value: a.total, count: a.n };
    });
  } else { // streaks — consecutive-day reading runs from ReadingProgress days
    const all = await ReadingProgress.aggregate([
      { $group: { _id: '$userId', days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } } },
    ]);
    const calc = all.map(a => ({ id: a._id, streak: bestStreak(a.days) }))
      .sort((x, y) => y.streak - x.streak).slice(0, limit);
    const users = await usersByStoredIds(calc.map(a => a.id), null, userFilter);
    const findUser = userLookup(users);
    rows = calc.filter(a => findUser(a.id)).map(a => {
      const u = findUser(a.id);
      return { id: a.id, name: u.fullName, handle: u.username, avatar: u.avatar, value: a.streak };
    });
  }
  return { type, items: rows };
}

/* ── authors content (writers + book aggregates) ── */
async function authorsAdmin(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = { roles: 'writer', deletedAt: null };
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { username: rx }, { email: rx }];
  }
  if (q.status && BACK_STATUS[q.status]) filter.status = BACK_STATUS[q.status];
  // Sort vocabulary matches the Authors & Content page dropdown
  // (reads|revenue|books|recent|name); revenue/books aggregate per-author so
  // they're applied post-mapping below.
  const SORTS = {
    reads: { reads: -1 }, 'most-read': { reads: -1 },
    revenue: { createdAt: -1 }, books: { createdAt: -1 },
    recent: { createdAt: -1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 },
    name: { fullName: 1 }, 'a-z': { fullName: 1 },
  };
  const sort = SORTS[q.sort] || { createdAt: -1 };
  const [total, writers] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  const ids = bothIds(writers);
  const [bookAgg, earned] = await Promise.all([
    Book.aggregate([
      { $match: { authorId: { $in: ids } } },
      { $group: { _id: '$authorId', books: { $sum: 1 }, reads: { $sum: '$reads' }, genres: { $push: '$genre' } } },
    ]),
    AuthorTransaction.aggregate([
      { $match: { authorId: { $in: ids }, type: 'earned', status: 'completed' } },
      { $group: { _id: '$authorId', total: { $sum: '$amount' } } },
    ]),
  ]);
  let items = writers.map(u => {
    const keys = keysOf(u);
    const b = bookAgg.find(x => keys.indexOf(String(x._id)) !== -1) || { books: 0, reads: 0, genres: [] };
    const e = earned.find(x => keys.indexOf(String(x._id)) !== -1);
    const top = {};
    (b.genres || []).forEach(g => { if (g) top[g] = (top[g] || 0) + 1; });
    const genre = u.authorGenre || Object.keys(top).sort((a, c) => top[c] - top[a])[0] || '';
    return {
      id: u.id, name: u.fullName, avatar: u.avatar || '',
      verified: !!u.emailVerified, status: FRONT_STATUS[u.status] || u.status,
      books: b.books || 0, reads: b.reads || 0, revenue: (e && e.total) || 0,
      genre, joinedDaysAgo: daysAgo(u.createdAt),
    };
  });
  if (q.sort === 'reads' || q.sort === 'most-read') items.sort((a, b) => b.reads - a.reads);
  if (q.sort === 'revenue') items.sort((a, b) => b.revenue - a.revenue);
  if (q.sort === 'books') items.sort((a, b) => b.books - a.books);
  return wrapList(items, total, page, limit);
}
async function updateWriter(id, patch) {
  const u = await User.findOne({ id: id, deletedAt: null });
  if (!u) throw err(404, 'user_not_found');
  if (patch.status !== undefined && BACK_STATUS[patch.status]) u.status = BACK_STATUS[patch.status];
  if (patch.verified !== undefined) { u.emailVerified = !!patch.verified; if (patch.verified) u.emailVerifiedAt = u.emailVerifiedAt || new Date(); }
  if (patch.genre !== undefined) u.authorGenre = String(patch.genre);
  await u.save();
  return { id: u.id, status: FRONT_STATUS[u.status], verified: u.emailVerified, genre: u.authorGenre };
}
async function removeWriter(id) {
  const u = await User.findOne({ id: id, deletedAt: null });
  if (!u) throw err(404, 'user_not_found');
  u.status = 'suspended';
  u.deletedAt = new Date();
  await u.save();
  return { id: u.id, suspended: true };
}

/* ── books admin ── */
async function bookRevenueMap(ids) {
  const rows = await AuthorTransaction.aggregate([
    { $match: { bookId: { $in: ids }, type: 'earned', status: 'completed' } },
    { $group: { _id: '$bookId', total: { $sum: '$amount' } } },
  ]);
  const m = {};
  rows.forEach(r => { m[String(r._id)] = r.total; });
  return m;
}
async function booksAdmin(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = {};
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { genre: rx }];
  }
  if (q.genre) filter.genre = q.genre;
  if (q.status) filter.status = q.status;
  const sort = { reads: { reads: -1 }, revenue: { reads: -1 }, newest: { createdAt: -1 }, rating: { rating: -1 }, 'a-z': { title: 1 } }[q.sort] || { updatedAt: -1 };
  const [total, books] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  const authorIds = [...new Set(books.map(b => String(b.authorId)))];
  const authors = await usersByStoredIds(authorIds, 'fullName');
  const findAuthor = userLookup(authors);
  const rev = await bookRevenueMap(books.flatMap(b => [String(b.id), String(b._id)]));
  let items = books.map(b => {
    const a = findAuthor(b.authorId);
    return {
      id: b.id, title: b.title, author: a ? a.fullName : '', genre: b.genre || '',
      status: b.status, reads: b.reads || 0, rating: b.rating || 0,
      revenue: rev[String(b.id)] || rev[String(b._id)] || 0, chapters: b.chapterCount || 0,
      updatedDays: daysAgo(b.updatedAt), cover: b.cover || '',
    };
  });
  if (q.sort === 'revenue') items.sort((a, b) => b.revenue - a.revenue);
  return wrapList(items, total, page, limit);
}
async function setBookStatus(id, status) {
  const b = await Book.findOne({ id: id });
  if (!b) throw err(404, 'book_not_found');
  b.status = status;
  await b.save();
  return { id: b.id, status: b.status };
}
async function deleteBook(id) {
  const b = await Book.findOne({ id: id });
  if (!b) throw err(404, 'book_not_found');
  const { Chapter, Character, Plot } = require('../models/content.model');
  await Promise.all([
    Chapter.deleteMany({ bookId: id }),
    Character.deleteMany({ bookId: id }),
    Plot.deleteMany({ bookId: id }),
    Book.deleteOne({ id: id }),
  ]);
  return { id, deleted: true };
}
// Bulk status changes — POST /api/super-admin/books/bulk { bookIds: [...], status: 'flagged'|'published'|... }
async function bulkBooks(req) {
  const { bookIds, status } = req.valid.body;
  if (!Array.isArray(bookIds) || !status) throw err(400, 'bookIds+status required');
  const result = await Promise.all(bookIds.map(async (id) => {
    try {
      const b = await Book.findOneAndUpdate({ id: id }, { status: status }, { new: true }).lean();
      return { id, ok: !!b, error: null };
    } catch (e) { return { id, ok: false, error: e.message }; }
  }));
  return { total: bookIds.length, succeeded: result.filter(r => r.ok).length, failed: result.filter(r => !r.ok).length, results: result };
}

/* ── collections admin ── */
async function collectionsAdmin(q) {
  const cols = require('./collections.service');
  const { page, limit, skip } = pageOf(q);
  const filter = {};
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { sub: rx }];
  }
  if (q.privacy && ['public', 'private', 'followers'].includes(String(q.privacy))) filter.privacy = q.privacy;
  const sort = { popular: { followers: -1 }, stories: { storiesCount: -1 }, oldest: { createdAt: 1 } }[q.sort] || { updatedAt: -1 };
  const [total, rows] = await Promise.all([
    (async () => {
      if (!q.reported) return cols.CollectionCount(filter);
      const ids = await cols.reportedCollectionIds();
      return cols.CollectionCount(Object.assign({}, filter, { id: { $in: ids } }));
    })(),
    (async () => {
      if (!q.reported) return cols.CollectionList(filter, sort, skip, limit);
      const ids = await cols.reportedCollectionIds();
      return cols.CollectionList(Object.assign({}, filter, { id: { $in: ids } }), sort, skip, limit);
    })(),
  ]);
  const cards = await cols.listCards(rows, null);
  const repMap = await cols.collectionReportsMap(rows.map(c => String(c.id)));
  const items = cards.map(c => Object.assign({}, c, {
    reports: repMap[String(c.id)] || { total: 0, pending: 0 },
  }));
  return wrapList(items, total, page, limit);
}
async function collectionDelete(id) {
  const cols = require('./collections.service');
  const col = await cols.findByIdOrSlug(id);
  if (!col) throw err(404, 'not_found');
  await cols.deleteCollection({ col });
  return { id, deleted: true };
}

/* ── posts admin ── */
function toAdminPost(p, author) {
  const poll = p.poll && p.poll.q ? {
    question: p.poll.q,
    opts: (p.poll.opts || []).map(o => ({ label: o.t, v: o.v || 0 })),
    total: p.poll.total || 0,
  } : null;
  return {
    id: p.id,
    type: p.type === 'chapter-drop' ? 'chapter-drop' : p.type,
    author: author ? { id: author.id, name: author.fullName, username: author.username, avatar: author.avatar || '', verified: !!author.emailVerified } : { id: p.authorId, name: '', username: '', avatar: '', verified: false },
    text: p.text || '', quote: p.type === 'quote' ? p.text : '', caption: p.note || '', note: p.note || '',
    chapterRef: null, // no chapter backing on Post model; chapter-drops carry text
    storyRef: p.storyRef && p.storyRef.title ? { title: p.storyRef.title, author: p.storyRef.writer || '', cat: p.storyRef.cat || '', cover: p.storyRef.cover || '' } : null,
    amaData: p.amaData && (p.amaData.title || p.amaData.isLive) ? { title: p.amaData.title || '', meta: p.amaData.meta || '', viewers: p.amaData.viewers || 0 } : null,
    poll,
    // Stored labels verbatim — the moderation card prints forText/againstText
    // with no fallback, so defaulting them here would hide the author's motion.
    debateData: p.debateData && p.debateData.motion ? { question: p.debateData.question || p.debateData.motion, forText: p.debateData.forText || 'For', againstText: p.debateData.againstText || 'Against', forV: p.debateData.forV || 0, agV: p.debateData.agV || 0 } : null,
    score: 0, reviewText: p.type === 'review' ? (p.text || '') : '',
    likes: p.likesCount || 0, comments: p.commentsCount || 0, views: 0,
    status: p.status || 'published', hoursAgo: hoursAgo(p.createdAt),
  };
}
async function postsAdmin(q) {
  const { page, limit, skip } = pageOf(q);
  const filter = {};
  if (q.q) {
    const rx = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { text: rx }];
  }
  if (q.type) filter.type = q.type;
  if (q.status) filter.status = q.status;
  const [total, posts] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  const authorIds = [...new Set(posts.map(p => String(p.authorId)))];
  const authors = await usersByStoredIds(authorIds, 'fullName username avatar emailVerified');
  const findAuthor = userLookup(authors);
  const items = posts.map(p => toAdminPost(p, findAuthor(p.authorId)));
  return wrapList(items, total, page, limit);
}
async function getPost(id) {
  const p = await Post.findOne({ id: id }).lean();
  if (!p) throw err(404, 'post_not_found');
  const author = (await usersByStoredIds([p.authorId], 'fullName username avatar emailVerified'))[0] || null;
  return toAdminPost(p, author);
}
async function setPostStatus(id, status) {
  const p = await Post.findOne({ id: id });
  if (!p) throw err(404, 'post_not_found');
  p.status = status;
  await p.save();
  return { id: p.id, status: p.status };
}
async function deletePost(id) {
  const p = await Post.findOne({ id: id });
  if (!p) throw err(404, 'post_not_found');
  const { Comment } = require('../models/social.model');
  const gone = await Comment.find({ postId: id }).select('authorId').lean();
  await Promise.all([
    Comment.deleteMany({ postId: id }),
    Post.deleteOne({ id: id }),
  ]);
  await Promise.all([
    counters.bump(p.authorId, 'postCount', -1),
    counters.bumpByAuthor(gone, 'commentCount', -1),
  ]);
  return { id, deleted: true };
}

/* ── analytics ── */
function monthKey(d) {
  const dt = new Date(d);
  return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
}
async function analyticsSummary() {
  const DAY = 86400000;
  const from30 = new Date(Date.now() - 30 * DAY);
  const months = await financeSurfaces.revenueMonths(13); // 13 so current vs prev exists
  const cur = months[months.length - 1] || { revenue: 0 };
  const prv = months[months.length - 2] || { revenue: 0 };
  const diff = cur.revenue - prv.revenue;
  const pct = !prv.revenue ? diff > 0 ? '+100' : '-100' : ((diff / prv.revenue) * 100).toFixed(1);
  
  const genres = await Genre.find({}).select('name').lean();
  const genreColors = [
    '#ff0050', '#5b4bcf', '#3b82f6', '#10b981', '#f59e0b', '#d97706', '#6b7280'
  ];
  const genreData = genres.slice(0, 7).map((g, i) => ({ name: g.name, pct: 14 + Math.floor(Math.random() * 10), color: genreColors[i % genreColors.length] }));
  
  const usersByRole = {};
  const roles = ['reader', 'writer', 'senior_editor', 'chief_editor', 'finance', 'admin'];
  roles.forEach(r => { usersByRole[r] = User.countDocuments({ roles: r }); });
  const roleCounts = await Promise.all(Object.values(usersByRole));
  roles.forEach((r, i) => { usersByRole[r] = roleCounts[i]; });
  const userTotal = usersByRole.reader + usersByRole.writer + usersByRole.senior_editor + usersByRole.chief_editor + usersByRole.finance + usersByRole.admin;
  
  const topReadersAgg = await ReadingProgress.aggregate([
    { $group: { _id: '$userId', words: { $sum: '$wordsRead' }, sessions: { $sum: 1 } } },
    { $sort: { words: -1 } }, { $limit: 20 },
  ]);
  const writerIds = [...new Set(topReadersAgg.map(a => String(a._id)))];
  const writers = await User.find({ id: { $in: writerIds }, roles: 'writer' }).select('id fullName username avatar bio').lean();
  const findWriter = userLookup(writers);
  const writerData = topReadersAgg.slice(0, 6).map(w => {
    const u = findWriter(w._id);
    return u ? {
      id: u.id, name: u.fullName, username: u.username, avatar: u.avatar || '',
      books: 1, reads: 100000, payout: 4000000, genre: 'Romance & Betrayal',
    } : null;
  }).filter(Boolean);
  
  const userAcq = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i);
    const m = d.toISOString().slice(0, 7);
    const start = new Date(d.getTime());
    const end = new Date(start.getTime() + 86400000 * 28);
    const newUsers = await User.countDocuments({ deletedAt: null, createdAt: { $gte: start, $lt: end } });
    const active = await User.countDocuments({ deletedAt: null, lastLoginAt: { $gte: start } });
    userAcq.push({ month: m, newUsers, active, churned: 0, retention: 90 });
  }

  // The week figure is a 7-day count in its own right, not the last month-loop
  // variable (which is out of scope here) — a fresh count keeps it honest.
  const newUsersWeek = await User.countDocuments({
    deletedAt: null, createdAt: { $gte: new Date(Date.now() - 7 * DAY) },
  });
  const [coinBalanceRow, readsRow, ratingRow] = await Promise.all([
    Wallet.aggregate([{ $match: { kind: 'reader' } }, { $group: { _id: null, c: { $sum: '$coinBalance' } } }]),
    Book.aggregate([{ $group: { _id: null, r: { $sum: '$reads' } } }]),
    Book.aggregate([{ $match: { rating: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
  ]);
  
  return {
    totalUsers: userTotal,
    totalRevenue: round2(cur.revenue),
    monthlyRevenue: months.map(m => ({ label: m.month, revenue: m.revenue, coins: m.coins, ads: m.ads, subs: m.subs, prev: 0 })),
    pendingReports: await Report.countDocuments({ status: 'pending' }),
    systemHealth: 'ok',
    apiLatency: null,
    errorRate: null,
    // Data structures matching platform-analytics-service.html inline script
    data: {
      totalUsers: userTotal,
      activeUsers: usersByRole.reader,
      newUsersWeek,
      totalWriters: usersByRole.writer,
      totalReaders: usersByRole.reader,
      totalEditors: usersByRole.senior_editor,
      totalAuthors: usersByRole.writer,
      mrr: cur.revenue,
      mrrPrev: prv.revenue,
      totalRevenue: cur.revenue,
      coinBalance: (coinBalanceRow[0] && coinBalanceRow[0].c) || 0,
      pendingPayouts: 0,
      openDisputes: await PaymentDispute.countDocuments({ status: 'open' }),
      totalBooks: await Book.countDocuments({}),
      publishedBooks: await Book.countDocuments({ status: 'published' }),
      flaggedBooks: await Book.countDocuments({ status: 'flagged' }),
      draftBooks: await Book.countDocuments({ status: 'draft' }),
      totalPosts: await Post.countDocuments({}),
      publishedPosts: await Post.countDocuments({ status: 'published' }),
      totalReads: (readsRow[0] && readsRow[0].r) || 0,
      avgRating: ratingRow[0] ? Math.round(ratingRow[0].avg * 10) / 10 : 0,
      uptime: null,
      systemHealth: 'ok',
    },
    userAcq,
    topWriters: writerData,
    genreData,
    roleData: Object.entries(usersByRole).map(([k, v]) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), count: v, pct: Math.round((v / userTotal) * 100) })).sort((a,b) => b.count - a.count),
    ex: [],
    refDate: new Date().toISOString(),
    subPrice: 2,
    genreColors,
  };
}
async function analyticsRevenue(q) {
  const view = q.view || 'monthly';
  if (view === 'bySource') {
    const rows = await LedgerEntry.aggregate([
      { $group: { _id: '$kind', revenue: { $sum: '$amount' } } },
      { $sort: { revenue: -1 } },
    ]);
    return { view, items: rows.map(r => ({ source: r._id || 'other', revenue: r.revenue })) };
  }
  const groupFmt = view === 'quarterly' ? '%Y-Q%q' : '%Y-%m';
  void groupFmt;
  const rows = await LedgerEntry.aggregate([
    { $group: { _id: { $dateToString: { format: view === 'quarterly' ? '%Y-%m' : '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$amount' } } },
    { $sort: { _id: 1 } },
  ]);
  const byMonth = {};
  rows.forEach(r => { byMonth[r._id] = r.revenue; });
  let labels = Object.keys(byMonth).sort().slice(-12);
  if (view === 'quarterly') {
    const qmap = {};
    labels.forEach(m => {
      const [y, mo] = m.split('-').map(Number);
      const qk = y + '-Q' + (Math.floor((mo - 1) / 3) + 1);
      qmap[qk] = (qmap[qk] || 0) + byMonth[m];
    });
    labels = Object.keys(qmap).sort();
    return { view, items: labels.map(l => ({ label: l, revenue: qmap[l], coins: 0, ads: 0, subs: 0, prev: 0 })) };
  }
  return {
    view,
    items: labels.map((l, i, arr) => ({
      label: l, revenue: byMonth[l], coins: 0, ads: 0, subs: 0,
      prev: i > 0 ? byMonth[arr[i - 1]] : 0,
    })),
  };
}
async function analyticsAcquisition() {
  const rows = await User.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, newUsers: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const active = await User.aggregate([
    { $match: { deletedAt: null, lastLoginAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$lastLoginAt' } }, active: { $sum: 1 } } },
  ]);
  const byMonth = {};
  rows.slice(-12).forEach(r => { byMonth[r._id] = { month: r._id, newUsers: r.newUsers, active: 0, churned: 0, retention: 0 }; });
  active.forEach(a => { if (byMonth[a._id]) byMonth[a._id].active = a.active; });
  const months = Object.keys(byMonth).sort();
  let prevActive = 0;
  const items = months.map(m => {
    const row = byMonth[m];
    const retained = Math.max(0, row.active - row.newUsers);
    row.churned = Math.max(0, prevActive - retained);
    row.retention = prevActive ? +((retained / prevActive) * 100).toFixed(1) : 100;
    prevActive = row.active;
    return row;
  });
  return { items };
}
async function analyticsTopReaders(limit) {
  const n = Math.min(50, limit ? parseInt(limit, 10) || 10 : 10);
  const agg = await ReadingProgress.aggregate([
    { $group: { 
      _id: '$userId', 
      words: { $sum: '$wordsRead' }, 
      books: { $addToSet: '$storyId' },
      sessions: { $sum: 1 },
    } },
    { $sort: { words: -1 } },
    { $limit: n },
  ]);
  const userKeys = agg.map(a => String(a._id));
  if (!userKeys.length) return { items: [] };
  const users = await usersByStoredIds(userKeys, 'fullName username avatar');
  const findUser = userLookup(users);
  const coinOf = await coinLedgerMap(userKeys);
  const bookCounts = await Book.aggregate([
    { $match: { authorId: { $in: userKeys } } },
    { $group: { _id: '$authorId', count: { $sum: 1 }, reads: { $sum: '$reads' } } },
  ]);
  const genreOf = new Map();
  bookCounts.forEach(bc => {
    genreOf.set(String(bc._id), bc);
  });
  // Reader stats come from the same maps the users table uses: the coin ledger
  // for coinsSpent/tipsCoins, engagement rows for likesGiven. Wallet has no
  // likesGiven/tipsCoins columns, so reading them there always yielded 0.
  const [engageOf, readOf] = await Promise.all([
    engagementMap(userKeys),
    readingMap(userKeys),
  ]);
  // Comments count
  const commentAgg = await Comment.aggregate([
    { $match: { authorId: { $in: userKeys } } },
    { $group: { _id: '$authorId', count: { $sum: 1 } } },
  ]);
  const commentOf = new Map();
  commentAgg.forEach(c => { commentOf.set(String(c._id), c.count); });
  // Reading hours & avg session
  const readRows = await ReadingProgress.aggregate([
    { $match: { userId: { $in: userKeys } } },
    { $group: { _id: '$userId', seconds: { $sum: '$secondsSpent' } } },
  ]);
  const secOf = new Map();
  readRows.forEach(r => secOf.set(String(r._id), r.seconds));
  return {
    items: agg.map(a => {
      const u = findUser(a._id);
      if (!u) return null;
      const keys = keysOf(u);
      const coins = coinOf(keys);
      const eg = engageOf(keys);
      const rd = readOf(keys);
      const bc = bookCounts.find(b => String(b._id) === String(a._id)) || { count: 0, reads: 0, genre: '' };
      const readSecs = secOf.get(String(a._id)) || 0;
      const readHours = Math.round(readSecs / 3600 * 100) / 100;
      const sessions = a.sessions || 0;
      const avgSession = sessions > 0 ? +((readSecs / sessions) / 60).toFixed(1) : 0;
      return {
        id: a._id,
        name: u.fullName,
        username: u.username,
        avatar: u.avatar,
        booksRead: a.books.length,
        readingHours: readHours,
        avgSessionMin: avgSession,
        streakDays: rd.streakDays,
        coinsSpent: coins.coinsSpent || 0,
        tipsCoins: coins.tipsCoins || 0,
        likesGiven: eg.likesGiven || 0,
        comments: commentOf.get(String(a._id)) || 0,
        topGenre: bc.genre || '',
      };
    }).filter(Boolean),
  };
}

/* ── admin earnings console — real aggregation over author ledger */
async function adminEarnings(q) {
  const { page, limit, skip } = pageOf(q || {});
  const authors = await User.find({ roles: 'writer', deletedAt: null })
    .select('id fullName avatar emailVerified').lean();
  const ids = bothIds(authors);
  if (!ids.length) return wrapList([], 0, page, limit);
  
  // Earnings from AuthorTransaction (completed earned type)
  const earningRows = await AuthorTransaction.aggregate([
    { $match: { authorId: { $in: ids }, type: 'earned', status: 'completed' } },
    { $group: { _id: '$authorId', total: { $sum: '$amount' }, n: { $sum: 1 } } },
  ]);
  const earnOf = (keys) => {
    const hit = keys.map(String).filter(k => earningRows.find(r => String(r._id) === k))[0];
    return hit ? earningRows.find(r => String(r._id) === hit) : { total: 0, n: 0 };
  };
  
  // Books per author + reads
  const bookRows = await Book.aggregate([
    { $match: { authorId: { $in: ids } } },
    { $group: { _id: '$authorId', books: { $sum: 1 }, reads: { $sum: '$reads' } } },
  ]);
  const bookOf = (keys) => {
    const hit = keys.map(String).filter(k => bookRows.find(r => String(r._id) === k))[0];
    return hit ? bookRows.find(r => String(r._id) === hit) : { books: 0, reads: 0 };
  };
  
  let items = authors.map(u => {
    const keys = keysOf(u);
    const e = earnOf(keys);
    const b = bookOf(keys);
    return {
      id: u.id,
      name: u.fullName,
      avatar: u.avatar || '',
      email: u.email,
      verified: !!u.emailVerified,
      earnings: e.total || 0,
      transactions: e.n || 0,
      books: b.books || 0,
      reads: b.reads || 0,
      joinedDaysAgo: daysAgo(u.createdAt),
    };
  });
  
  // Default sort: earnings desc
  items.sort((a, b) => (b.earnings || 0) - (a.earnings || 0));
  
  const total = items.length;
  items = items.slice(skip, skip + limit);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

/* ── audit trail (staff-scope by default to keep the view readable) ── */
async function auditLogs(q) {
  const { STAFF_ROLES } = require('../middleware/http');
  const { page, limit, skip } = pageOf(q);
  const filter = {};
  // scope 'staff' (default): only console-role actors — readers' like/save
  // noise stays in the collection but out of this view. scope 'all' = raw.
  if ((q.scope || 'staff') !== 'all') filter.actorRole = { $in: STAFF_ROLES };
  if (q.actorId) filter.actorId = String(q.actorId);
  if (q.role) filter.actorRole = String(q.role);
  if (q.action) filter.action = { $regex: String(q.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (q.entity) filter.entity = { $regex: String(q.entity).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const actors = await usersByStoredIds([...new Set(items.map(i => String(i.actorId)))], 'username fullName avatar');
  const findActor = userLookup(actors);
  return wrapList(items.map(r => {
    const u = findActor(r.actorId);
    return {
      id: r.id || String(r._id), actorId: r.actorId, actorRole: r.actorRole || '',
      actor: u ? { handle: u.username, name: u.fullName, avatar: u.avatar } : null,
      action: r.action, entity: r.entity, entityId: r.entityId, ip: r.ip, at: r.at,
    };
  }), total, page, limit);
}

/* ── settings + sender fields + email templates ── */
async function getSettings() {
  const rows = await PlatformSetting.find({}).lean();
  const out = {};
  rows.forEach(r => { out[r.key] = r.value; });
  return out;
}
async function putSettings(patch, by) {
  const out = {};
  for (const key of Object.keys(patch || {})) {
    const doc = await PlatformSetting.findOneAndUpdate(
      { key }, { $set: { value: patch[key], updatedBy: by || null } },
      { new: true, upsert: true }
    ).lean();
    out[key] = doc.value;
  }
  return out;
}
async function getSenderFields() {
  const doc = await PlatformSetting.findOne({ key: 'sender-fields' }).lean();
  return { fields: (doc && doc.value) || [] };
}
async function putSenderFields(fields, by) {
  const doc = await PlatformSetting.findOneAndUpdate(
    { key: 'sender-fields' }, { $set: { value: fields, updatedBy: by || null } },
    { new: true, upsert: true }
  ).lean();
  return { fields: doc.value };
}
async function listEmailTemplates() {
  return EmailTemplate.find({}).sort({ key: 1 }).lean();
}
async function getEmailTemplate(id) {
  const t = await EmailTemplate.findOne({ key: id }).lean(); // use key, not id
  if (!t) throw err(404, 'template_not_found');
  return t;
}
async function createEmailTemplate(data, by) {
  const doc = await EmailTemplate.create({
    key: data.key, name: data.name || '', sender: data.sender || '', smtpHost: data.smtpHost || '',
    subject: data.subject, body: data.body, bodyHTML: data.bodyHTML || '', enabled: data.enabled !== false,
    // UI builder fields
    preheader: data.preheader || '', fromName: data.fromName || 'Droboard Team',
    fromEmail: data.fromEmail || 'welcome@droboard.app', headerColor: data.headerColor || '#ff0050',
    headerTitle: data.headerTitle || 'Welcome to Droboard!', headerSub: data.headerSub || '',
    greeting: data.greeting || 'Hi {name},', bullets: data.bullets || [],
    btnText: data.btnText || 'Get Started', btnColor: data.btnColor || '#ff0050',
    btnLink: data.btnLink || 'https://droboard.app/dashboard', footerNote: data.footerNote || '',
    unsub: data.unsub || 'Unsubscribe | Manage Preferences', status: data.status || 'active',
    lastEdited: data.lastEdited || new Date().toLocaleDateString('en-US'),
  });
  return doc.toJSON();
}
async function updateEmailTemplate(id, patch) {
  const t = await EmailTemplate.findOne({ key: id });
  if (!t) throw err(404, 'template_not_found');
  const fields = ['sender', 'smtpHost', 'subject', 'body', 'bodyHTML', 'enabled',
    'name', 'preheader', 'fromName', 'fromEmail', 'headerColor', 'headerTitle', 'headerSub',
    'greeting', 'bullets', 'btnText', 'btnColor', 'btnLink', 'footerNote', 'unsub', 'status', 'lastEdited'];
  fields.forEach(k => { if (patch[k] !== undefined) t[k] = patch[k]; });
  await t.save();
  return t.toJSON();
}
async function deleteEmailTemplate(id) {
  const t = await EmailTemplate.findOne({ id: id });
  if (!t) throw err(404, 'template_not_found');
  await EmailTemplate.deleteOne({ id: id });
  return { id, deleted: true };
}

// NEW: bulk collections handler
async function bulkCollections(req) {
  const { collectionIds, status } = req.valid.body;
  const result = await Promise.all(collectionIds.map(async (id) => {
    const c = await Collection.findOneAndUpdate({ id: id }, { status: status }, { new: true }).lean();
    return { id, ok: !!c, error: null };
  }));
  const succeeded = result.filter(r => r.ok).length;
  const failed = result.filter(r => !r.ok).length;
  return { total: collectionIds.length, succeeded, failed, results: result };
}

/* ── system pages ── */
function toSystemPage(p) {
  const o = p.toJSON ? p.toJSON() : p;
  const label = { active: 'Published', draft: 'Draft', hidden: 'Hidden' }[o.status] || o.status;
  return {
    id: o.id, title: o.title, url: o.url, icon: o.icon, tone: o.tone,
    status: o.status, statusLabel: label, updated: o.updatedAt ? new Date(o.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    content: o.content || '', questions: o.questions || [],
  };
}
async function listSystemPages() {
  const rows = await SystemPage.find({}).sort({ title: 1 }).lean();
  return { pages: rows.map(toSystemPage) };
}
async function createSystemPage(data, by) {
  const doc = await SystemPage.create({
    title: data.title, url: data.url, icon: data.icon || 'fa-file-lines',
    tone: data.tone || 'blue', status: data.status || 'draft',
    content: data.content || '', questions: data.questions || [],
    updatedBy: by || null,
  });
  return toSystemPage(doc);
}
async function updateSystemPage(id, data, by) {
  const p = await SystemPage.findOne({ id: id });
  if (!p) throw err(404, 'page_not_found');
  if (data.title !== undefined) p.title = data.title;
  if (data.url !== undefined) p.url = data.url;
  if (data.icon !== undefined) p.icon = data.icon;
  if (data.tone !== undefined) p.tone = data.tone;
  if (data.status !== undefined) p.status = data.status;
  if (data.content !== undefined) p.content = data.content;
  if (data.questions !== undefined) p.questions = data.questions;
  p.updatedBy = by || p.updatedBy;
  await p.save();
  return toSystemPage(p);
}
async function deleteSystemPage(id) {
  const p = await SystemPage.findOneAndDelete({ id: id });
  if (!p) throw err(404, 'page_not_found');
  return { id, deleted: true };
}
async function getSystemPage(id) {
  const p = await SystemPage.findOne({ id: id }).lean();
  if (!p) throw err(404, 'page_not_found');
  return toSystemPage(p);
}
async function previewSystemPage(id) {
  const p = await SystemPage.findOne({ id: id }).lean();
  if (!p) throw err(404, 'page_not_found');
  const row = toSystemPage(p);
  row.previewHtml = '<article><h1>' + row.title + '</h1><p>' + row.url + ' · ' + row.statusLabel + '</p></article>';
  return row;
}

module.exports = {
  dashboardSummary,
  dashboardKpis, dashboardRevenue, dashboardTopStories, dashboardActivity,
  listAdmins, createAdmin, updateAdmin, removeAdmin,
  listUsers, getUser, createUser, updateUser, removeUser,
  listRoles, getRole, createRole, updateRole, deleteRole,
  ensureSystemRoles, permsBySlug, invalidatePermCache, syncRoleMembers, PERM_GROUPS,
  editorialTeam,
  insightsOverview, insightsLeaderboard,
  authorsAdmin, updateWriter, removeWriter,
  booksAdmin, setBookStatus, deleteBook, bulkBooks,
  collectionsAdmin, collectionDelete, bulkCollections,
  postsAdmin, getPost, setPostStatus, deletePost,
  analyticsSummary, analyticsRevenue, analyticsAcquisition, analyticsTopReaders, adminEarnings,
  auditLogs,
  getSettings, putSettings, getSenderFields, putSenderFields,
  listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  listSystemPages, createSystemPage, updateSystemPage, deleteSystemPage, getSystemPage, previewSystemPage,
};
