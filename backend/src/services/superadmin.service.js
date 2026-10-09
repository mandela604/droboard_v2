'use strict';
/**
 * services/superadmin.service.js — data + actions for the Super Admin console.
 * Every function below backs a super-admin page service (call-and-render);
 * list endpoints return { items, total, page, limit, pages } unless the
 * frontend contract fixes another shape (insights overview, system-pages,
 * revenue-splits — see inline notes).
 */
const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const { Post, Follow, ReadingProgress, Referral, Notification } = require('../models/social.model');
const { Wallet, LedgerEntry, CoinTransaction, AuthorTransaction, Withdrawal, Subscription } = require('../models/money.model');
const { Contract } = require('../models/contract.model');
const { Report, Announcement } = require('../models/editorial.model');
const { PlatformSetting, EmailTemplate, ActivityLog } = require('../models/platform.model');
const { AdminRole, SystemPage, PERM_KEYS } = require('../models/admin.model');

function err(status, message) { return Object.assign(new Error(message), { status }); }
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
async function dashboardSummary() {
  const [userCount, bookCount, postCount, ledgers, admins] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Book.countDocuments({}),
    Post.countDocuments({}),
    LedgerEntry.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    User.find({ roles: 'admin', deletedAt: null }).select('id fullName email avatar roles status').lean(),
  ]);
  const revenue = (ledgers[0] && ledgers[0].total) || 0;
  const topStories = await Book.find({}).sort({ reads: -1 }).limit(5)
    .select('id title authorId reads likes status').lean();
  const activity = await ActivityLog.find({}).sort({ at: -1 }).limit(10).lean();
  return {
    kpis: { users: userCount, books: bookCount, posts: postCount, revenue },
    revenue: { total: revenue },
    topStories: topStories.map(b => ({ id: b.id, title: b.title, authorId: b.authorId, reads: b.reads, likes: b.likes, status: b.status })),
    activity: activity.map(a => ({ id: a.id, userLabel: a.userLabel, action: a.action, type: a.type, detail: a.detail, at: a.at })),
    admins: admins.map(u => ({ id: u.id, name: u.fullName, email: u.email, avatar: u.avatar, roles: u.roles, status: u.status })),
  };
}

/* ── users ── */
const FRONT_STATUS = { active: 'active', pending_verification: 'pending', suspended: 'suspended', banned: 'suspended' };
const BACK_STATUS = { active: 'active', pending: 'pending_verification', suspended: 'suspended', banned: 'banned' };

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

async function userStatsMap(ids) {
  const [followers, following, stories, comments, filedReports] = await Promise.all([
    Follow.aggregate([{ $match: { followingId: { $in: ids } } }, { $group: { _id: '$followingId', n: { $sum: 1 } } }]),
    Follow.aggregate([{ $match: { followerId: { $in: ids } } }, { $group: { _id: '$followerId', n: { $sum: 1 } } }]),
    Book.aggregate([{ $match: { authorId: { $in: ids } } }, { $group: { _id: '$authorId', n: { $sum: 1 }, reads: { $sum: '$reads' } } }]),
    Post.aggregate([{ $match: { authorId: { $in: ids } } }, { $group: { _id: '$authorId', n: { $sum: 1 } } }]),
    Report.aggregate([{ $match: { reporterId: { $in: ids } } }, { $group: { _id: '$reporterId', n: { $sum: 1 } } }]),
  ]);
  const get = (rows, keys) => rowHit(rows, keys);
  return { followers: get, following: get, stories: get, comments: get, filedReports: get };
}

function toAdminUser(u, extra) {
  extra = extra || {};
  return {
    id: u.id,
    name: u.fullName,
    username: u.username,
    email: u.email,
    role: u.primaryRole || (u.roles && u.roles[0]) || 'reader',
    status: FRONT_STATUS[u.status] || u.status,
    avatar: u.avatar || '',
    verified: !!u.emailVerified,
    joined: u.createdAt,
    lastActive: u.lastLoginAt || null,
    followers: (extra.followers && extra.followers.n) || 0,
    following: (extra.following && extra.following.n) || 0,
    stories: (extra.stories && extra.stories.n) || 0,
    reads: (extra.stories && extra.stories.reads) || 0,
    payout: extra.payout || 0,
    coinsSpent: extra.coinsSpent || 0,
    comments: (extra.comments && extra.comments.n) || 0,
    reports: (extra.filed && extra.filed.n) || 0,
    readingHours: extra.readingHours || 0,
    avgSessionMin: extra.avgSessionMin || 0,
    streakDays: extra.streakDays || 0,
    topGenres: extra.topGenres || [],
    likesGiven: 0,
    sharesCount: 0,
    savesCount: 0,
    tipsAmount: extra.tipsAmount || 0,
    platformRoles: u.roles || [],
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
  if (q.role) filter.$or ? filter.$and = [{ roles: q.role }] : (filter.roles = q.role);
  if (q.status && BACK_STATUS[q.status]) filter.status = BACK_STATUS[q.status];
  const sort = { '-active': { lastLoginAt: -1 }, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'a-z': { fullName: 1 } }[q.sort] || { createdAt: -1 };
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);
  const ids = bothIds(users);
  const stats = await userStatsMap(ids);
  const [wallets, spends] = await Promise.all([
    Wallet.find({ userId: { $in: ids }, kind: 'author' }).lean(),
    CoinTransaction.aggregate([{ $match: { userId: { $in: ids }, status: 'completed' } }, { $group: { _id: '$userId', n: { $sum: '$fiatAmount' } } }]),
  ]);
  const items = users.map(u => {
    const keys = keysOf(u);
    const w = wallets.find(x => keys.indexOf(String(x.userId)) !== -1);
    const s = spends.find(x => keys.indexOf(String(x._id)) !== -1);
    return toAdminUser(u, {
      followers: stats.followers(keys), following: stats.following(keys),
      stories: stats.stories(keys), comments: stats.comments(keys), filed: stats.filedReports(keys),
      payout: (w && w.lifetimeEarned) || 0, coinsSpent: (s && s.n) || 0,
    });
  });
  const active = await User.countDocuments({ deletedAt: null, status: 'active' });
  return Object.assign(wrapList(items, total, page, limit), { stats: { total, active } });
}

async function getUser(id) {
  const u = await User.findOne({ id: id, deletedAt: null }).lean();
  if (!u) throw err(404, 'user_not_found');
  const ids = bothIds([u]);
  const stats = await userStatsMap(ids);
  const w = await Wallet.findOne({ userId: { $in: ids }, kind: 'author' }).lean();
  const s = await CoinTransaction.aggregate([{ $match: { userId: { $in: ids }, status: 'completed' } }, { $group: { _id: null, n: { $sum: '$fiatAmount' } } }]);
  return toAdminUser(u, {
    followers: stats.followers(ids), following: stats.following(ids),
    stories: stats.stories(ids), comments: stats.comments(ids), filed: stats.filedReports(ids),
    payout: (w && w.lifetimeEarned) || 0, coinsSpent: (s[0] && s[0].n) || 0,
  });
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
    roles: data.roles && data.roles.length ? data.roles : ['reader'],
    primaryRole: data.role || 'reader',
    status: data.status && BACK_STATUS[data.status] ? BACK_STATUS[data.status] : 'active',
    adminNotes: data.notes || '',
  });
  return toAdminUser(doc.toJSON());
}

async function updateUser(id, patch) {
  const u = await User.findOne({ id: id, deletedAt: null });
  if (!u) throw err(404, 'user_not_found');
  if (patch.name !== undefined) u.fullName = patch.name;
  if (patch.email !== undefined) u.email = String(patch.email).toLowerCase();
  if (patch.username !== undefined) u.username = String(patch.username).toLowerCase();
  if (patch.avatar !== undefined) u.avatar = patch.avatar;
  if (patch.phone !== undefined) u.phone = patch.phone;
  if (patch.role !== undefined) { u.primaryRole = patch.role; if (!u.roles.includes(patch.role)) u.roles.push(patch.role); }
  if (patch.roles !== undefined) { u.roles = patch.roles; u.primaryRole = patch.roles[0] || u.primaryRole; }
  if (patch.status !== undefined && BACK_STATUS[patch.status]) u.status = BACK_STATUS[patch.status];
  if (patch.verified !== undefined) { u.emailVerified = !!patch.verified; if (patch.verified) u.emailVerifiedAt = u.emailVerifiedAt || new Date(); }
  if (patch.notes !== undefined) u.adminNotes = patch.notes;
  await u.save();
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
    id: r.id, name: r.name, desc: r.desc, icon: r.icon, color: r.color,
    system: !!r.system, memberCount: memberCount != null ? memberCount : (r.memberIds || []).length,
    members: [], perms,
  };
}
async function roleMembers(role) {
  const users = await usersByStoredIds(role.memberIds || [], 'fullName email avatar', { deletedAt: null });
  return users.map(u => ({ id: u.id, name: u.fullName, email: u.email, avatar: u.avatar }));
}
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
  const doc = await AdminRole.create({
    name: data.name, desc: data.desc || '', icon: data.icon || 'fa-user-shield',
    color: data.color || 'blue', system: false, memberIds: data.memberIds || [], perms,
  });
  const out = toRole(doc.toJSON());
  out.members = await roleMembers(doc.toJSON());
  return out;
}
async function updateRole(id, patch) {
  const r = await AdminRole.findOne({ id: id });
  if (!r) throw err(404, 'role_not_found');
  if (patch.name !== undefined) r.name = patch.name;
  if (patch.desc !== undefined) r.desc = patch.desc;
  if (patch.icon !== undefined) r.icon = patch.icon;
  if (patch.color !== undefined) r.color = patch.color;
  if (patch.memberIds !== undefined) r.memberIds = patch.memberIds;
  if (patch.perms !== undefined) {
    PERM_KEYS.forEach(k => { if (patch.perms[k] !== undefined) r.perms.set(k, !!patch.perms[k]); });
  }
  await r.save();
  const out = toRole(r.toJSON());
  out.members = await roleMembers(r.toJSON());
  return out;
}
async function deleteRole(id) {
  const r = await AdminRole.findOne({ id: id });
  if (!r) throw err(404, 'role_not_found');
  if (r.system) throw err(400, 'system_role_locked');
  await AdminRole.deleteOne({ id: id });
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
  const [contracts, resolved] = await Promise.all([
    Contract.aggregate([{ $match: { editorId: { $in: ids } } }, { $group: { _id: '$editorId', n: { $sum: 1 } } }]),
    Report.aggregate([{ $match: { resolvedBy: { $in: ids } } }, { $group: { _id: '$resolvedBy', n: { $sum: 1 } } }]),
  ]);
  const items = users.map(u => {
    const keys = keysOf(u);
    const isLead = (u.primaryRole || u.roles[0]) === 'chief_editor';
    return {
      id: u.id, name: u.fullName, email: u.email, avatar: u.avatar || '',
      role: isLead ? 'Chief Editor' : 'Senior Editor', lead: isLead,
      authors: 0, // no assignment model yet; derived when author pod mapping ships
      contracts: rowHit(contracts, keys).n,
      reports: rowHit(resolved, keys).n,
      status: FRONT_STATUS[u.status] || u.status,
      joinedDaysAgo: daysAgo(u.createdAt),
      platformRoles: u.roles || [],
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
  const [wallets, subs, referrals, reads] = await Promise.all([
    Wallet.find({ userId: { $in: ids }, kind: 'author' }).lean(),
    Subscription.find({ userId: { $in: ids }, status: 'active' }).lean(),
    Referral.aggregate([
      { $match: { ownerId: { $in: ids } } },
      { $group: { _id: '$ownerId', sent: { $sum: 1 }, converted: { $sum: { $cond: ['$readRewarded', 1, 0] } } } },
    ]),
    ReadingProgress.aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } }, words: { $sum: '$wordsRead' } } },
    ]),
  ]);
  const ex = users.map(u => {
    const id = String(u.id);
    const keys = keysOf(u);
    const w = wallets.find(x => keys.indexOf(String(x.userId)) !== -1);
    const sub = subs.find(x => keys.indexOf(String(x.userId)) !== -1);
    const ref = referrals.find(x => keys.indexOf(String(x._id)) !== -1) || { sent: 0, converted: 0 };
    const rd = reads.find(x => keys.indexOf(String(x._id)) !== -1) || { days: [], words: 0 };
    return {
      u: id,
      x: {
        referralsSent: ref.sent || 0, referralsConverted: ref.converted || 0,
        plan: sub ? 'premium' : 'free', funded: (w && w.lifetimeEarned) || 0,
        sessionsPerDay: rd.days.length ? +(rd.words / 1000 / Math.max(1, rd.days.length)).toFixed(1) : 0,
      },
    };
  });
  const genreColors = {};
  users.forEach(u => { (u.topGenres || []).forEach(() => {}); });
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
    users: users.map(u => toAdminUser(u)),
    ex, genreColors,
    refDate: refDate ? new Date(refDate).toISOString() : new Date().toISOString(),
    subPrice: 5,
  };
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
    const calc = all.map(a => {
      const ds = a.days.sort();
      let best = 0, run = 0, prev = null;
      ds.forEach(d => {
        const t = new Date(d + 'T00:00:00Z').getTime();
        run = (prev !== null && t - prev === 86400000) ? run + 1 : 1;
        prev = t; best = Math.max(best, run);
      });
      return { id: a._id, streak: best };
    }).sort((x, y) => y.streak - x.streak).slice(0, limit);
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
  const sort = { 'most-read': undefined, newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'a-z': { fullName: 1 } }[q.sort] || { createdAt: -1 };
  const [total, writers] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort === undefined ? { createdAt: -1 } : sort).skip(skip).limit(limit).lean(),
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
  if (q.sort === 'most-read') items.sort((a, b) => b.reads - a.reads);
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
    debateData: p.debateData && p.debateData.motion ? { question: p.debateData.motion, forText: 'For', againstText: 'Against', forV: p.debateData.forV || 0, agV: p.debateData.agV || 0 } : null,
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
  await Promise.all([
    Comment.deleteMany({ postId: id }),
    Post.deleteOne({ id: id }),
  ]);
  return { id, deleted: true };
}

/* ── analytics ── */
function monthKey(d) {
  const dt = new Date(d);
  return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0');
}
async function analyticsSummary() {
  const [totalUsers, activeUsers, books, posts, ledgers, reports] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, lastLoginAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    Book.countDocuments({}),
    Post.countDocuments({}),
    LedgerEntry.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Report.countDocuments({ status: 'pending' }),
  ]);
  return {
    totalUsers, activeUsers, totalBooks: books, totalPosts: posts,
    revenue: (ledgers[0] && ledgers[0].total) || 0, pendingReports: reports,
    systemHealth: 'ok', apiLatency: null, errorRate: null,
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
  const agg = await ReadingProgress.aggregate([
    { $group: { _id: '$userId', words: { $sum: '$wordsRead' }, books: { $addToSet: '$storyId' } } },
    { $sort: { words: -1 } }, { $limit: Math.min(50, limit || 10) },
  ]);
  const users = await usersByStoredIds(agg.map(a => a._id), 'fullName username avatar');
  const findUser = userLookup(users);
  return {
    items: agg.map(a => {
      const u = findUser(a._id);
      if (!u) return null;
      return { id: a._id, name: u.fullName, handle: u.username, avatar: u.avatar, words: a.words, books: a.books.length };
    }).filter(Boolean),
  };
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
  const t = await EmailTemplate.findOne({ id: id }).lean();
  if (!t) throw err(404, 'template_not_found');
  return t;
}
async function createEmailTemplate(data, by) {
  const doc = await EmailTemplate.create({
    key: data.key, sender: data.sender || '', smtpHost: data.smtpHost || '',
    subject: data.subject, body: data.body, enabled: data.enabled !== false,
  });
  return doc.toJSON();
}
async function updateEmailTemplate(id, patch) {
  const t = await EmailTemplate.findOne({ id: id });
  if (!t) throw err(404, 'template_not_found');
  ['sender', 'smtpHost', 'subject', 'body', 'enabled'].forEach(k => { if (patch[k] !== undefined) t[k] = patch[k]; });
  await t.save();
  return t.toJSON();
}
async function deleteEmailTemplate(id) {
  const t = await EmailTemplate.findOne({ id: id });
  if (!t) throw err(404, 'template_not_found');
  await EmailTemplate.deleteOne({ id: id });
  return { id, deleted: true };
}

/* ── system pages ── */
function toSystemPage(p) {
  const o = p.toJSON ? p.toJSON() : p;
  const label = { active: 'Published', draft: 'Draft', hidden: 'Hidden' }[o.status] || o.status;
  return {
    id: o.id, title: o.title, url: o.url, icon: o.icon, tone: o.tone,
    status: o.status, statusLabel: label, updated: o.updatedAt ? new Date(o.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
  };
}
async function listSystemPages() {
  const rows = await SystemPage.find({}).sort({ title: 1 }).lean();
  return { pages: rows.map(toSystemPage) };
}
async function createSystemPage(data, by) {
  const doc = await SystemPage.create({
    title: data.title, url: data.url, icon: data.icon || 'fa-file-lines',
    tone: data.tone || 'blue', status: data.status || 'draft', updatedBy: by || null,
  });
  return toSystemPage(doc);
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
  listUsers, getUser, createUser, updateUser, removeUser,
  listRoles, getRole, createRole, updateRole, deleteRole,
  editorialTeam,
  insightsOverview, insightsLeaderboard,
  authorsAdmin, updateWriter, removeWriter,
  booksAdmin, setBookStatus, deleteBook,
  collectionsAdmin, collectionDelete,
  postsAdmin, getPost, setPostStatus, deletePost,
  analyticsSummary, analyticsRevenue, analyticsAcquisition, analyticsTopReaders,
  getSettings, putSettings, getSenderFields, putSenderFields,
  listEmailTemplates, getEmailTemplate, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
  listSystemPages, createSystemPage, getSystemPage, previewSystemPage,
};
