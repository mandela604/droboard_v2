'use strict';
const argon2 = require('argon2');
const crypto = require('crypto');
const { User, RefreshFamily } = require('../models/user.model');
const { Book, Chapter, Genre } = require('../models/content.model');
const { Follow, Block, Mute, ReadingProgress, LibraryItem, Notification, Referral, Post, Status } = require('../models/social.model');
const { validateMediaUrl } = require('./media.service');

const WRITER_ROLES = ['writer', 'senior_editor', 'chief_editor', 'admin'];

function joinedLabel(d) {
  if (!d) return '';
  try {
    return 'Joined ' + new Date(d).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch (e) { return ''; }
}

// Frontend card time: "Just now" / "2h" / "3d" / "2w" / "May 12".
function relTime(d) {
  if (!d) return '';
  const t = new Date(d).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  if (s < 2592000) return Math.floor(s / 604800) + 'w';
  try {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) { return ''; }
}

// Post model → frontend post-card shape (profile/feed card contract).
function toCardPost(p, viewerId) {
  const o = p.toJSON ? p.toJSON() : p;
  const poll = o.poll && o.poll.opts ? {
    q: o.poll.q || '',
    opts: (o.poll.opts || []).map(x => ({ t: x.t, v: x.v || 0 })),
    total: o.poll.total || 0,
    voted: viewerId ? (o.poll.votedBy || []).map(String).indexOf(String(viewerId)) : -1,
  } : null;
  return {
    id: o.id, type: o.type, time: relTime(o.createdAt), pinned: !!o.pinned,
    liked: viewerId ? ((o.likedBy || []).map(String).includes(String(viewerId))) : false,
    likes: o.likesCount || 0, comments: o.commentsCount || 0,
    saved: viewerId ? ((o.savedBy || []).map(String).includes(String(viewerId))) : false,
    text: o.text || '', quote: o.quote || '', caption: o.caption || '', note: o.note || '',
    image: o.image || '', poll,
    amaData: o.amaData || null,
    debateData: o.debateData && o.debateData.motion ? {
      motion: o.debateData.motion, forV: o.debateData.forV || 0, agV: o.debateData.agV || 0,
      userVote: null,
    } : null,
    storyRef: o.storyRef && o.storyRef.title ? {
      title: o.storyRef.title, cat: o.storyRef.cat || '', author: o.storyRef.writer || '',
      cover: o.storyRef.cover || '',
    } : null,
    shares: o.sharesCount || 0,
  };
}

// Status doc → story-slide shape ({bg, quote, caption, time}).
function toSlide(s) {
  const o = s.toJSON ? s.toJSON() : s;
  return {
    id: o.id, bg: o.bg, quote: o.quote || '', caption: o.caption || '',
    time: relTime(o.createdAt), likes: o.likes || 0, viewed: !!o.viewed,
    ts: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
    expiresAt: o.expiresAt,
  };
}

function publicShape(u) {
  return {
    id: u.id, username: u.username, handle: u.username,
    fullName: u.fullName, name: u.fullName,
    avatar: u.avatar || '', cover: u.cover || '', bio: u.bio || '',
    location: u.location || '', about: u.about || null, genres: u.genres || [],
    country: u.country || '',
    roles: u.roles, primaryRole: u.primaryRole,
    isWriter: (u.roles || []).some(r => WRITER_ROLES.includes(r)),
    verified: !!u.emailVerified,
    status: u.status, createdAt: u.createdAt, joinedLabel: joinedLabel(u.createdAt),
  };
}

// Card-ready row for following/followers lists ({name, av, meta, following}).
function toFollowRow(u, following) {
  const bio = String(u.bio || '').split('\n')[0].slice(0, 60);
  const meta = bio || ((u.roles || []).includes('writer') ? 'Writer on Droboard' : 'Reader on Droboard');
  return {
    name: u.username, handle: u.username, av: u.avatar || '', avatar: u.avatar || '',
    fullName: u.fullName, meta, following: !!following,
    verified: !!u.emailVerified, isWriter: (u.roles || []).some(r => WRITER_ROLES.includes(r)),
  };
}

// Reader stats: hours, finished books, day-streak from ReadingProgress.
async function readingStatsFor(userId) {
  try {
    const [agg, finished, days] = await Promise.all([
      ReadingProgress.aggregate([
        { $match: { userId: String(userId) } },
        { $group: { _id: null, seconds: { $sum: '$secondsSpent' }, words: { $sum: '$wordsRead' } } },
      ]),
      ReadingProgress.countDocuments({ userId, finished: true }),
      ReadingProgress.aggregate([
        { $match: { userId: String(userId) } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastReadAt' } } } },
        { $sort: { _id: -1 } }, { $limit: 60 },
      ]),
    ]);
    let streak = 0;
    const dayKeys = days.map(d => d._id);
    if (dayKeys.length) {
      const today = new Date();
      const fmt = (dt) => dt.toISOString().slice(0, 10);
      let cursor = new Date(today);
      // streak may start today or yesterday (today's read not yet logged)
      if (dayKeys[0] !== fmt(cursor)) {
        cursor = new Date(today.getTime() - 86400000);
        if (dayKeys[0] !== fmt(cursor)) return { hoursRead: Math.round(((agg[0] && agg[0].seconds) || 0) / 3600), booksFinished: finished, dayStreak: 0 };
      }
      const set = new Set(dayKeys);
      while (set.has(fmt(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - 86400000); }
    }
    return {
      hoursRead: Math.round(((agg[0] && agg[0].seconds) || 0) / 3600),
      wordsRead: (agg[0] && agg[0].words) || 0,
      booksFinished: finished,
      dayStreak: streak,
    };
  } catch (e) {
    return { hoursRead: 0, wordsRead: 0, booksFinished: 0, dayStreak: 0 };
  }
}

// Profile tabs: library items joined with books (card shape).
async function libraryFor(userId) {
  const rows = await LibraryItem.find({ userId: String(userId), list: { $in: ['library', 'saved', 'continue'] } })
    .sort({ updatedAt: -1 }).limit(60).lean();
  if (!rows.length) return [];
  const books = await Book.find({ id: { $in: rows.map(r => String(r.storyId)) } })
    .select('id title cover genre authorId reads').lean();
  const authorIds = [...new Set(books.map(b => String(b.authorId)))];
  const authors = authorIds.length
    ? await User.find({ id: { $in: authorIds } }).select('id username fullName').lean()
    : [];
  const bm = {}; books.forEach(b => { bm[String(b.id)] = b; });
  const am = {}; authors.forEach(a => { am[String(a.id)] = a; });
  return rows.filter(r => bm[String(r.storyId)]).map(r => {
    const b = bm[String(r.storyId)];
    const a = am[String(b.authorId)];
    return {
      id: String(r.storyId), title: b.title, cover: b.cover || '', cat: b.genre || '',
      author: a ? (a.fullName || a.username) : '', authorHandle: a ? a.username : '',
      badge: r.status === 'finished' ? 'done' : (r.list === 'saved' ? 'saved' : ''),
      ch: r.currentChN ? 'Ch. ' + r.currentChN : '', pct: r.pct || 0, list: r.list,
    };
  });
}

// Achievements chips from the awards console ({label, icon, color}).
async function achievementsFor(handle) {
  try {
    const rows = await require('./awards.service').grantsForHandle(handle);
    return rows.filter(r => r.award).map(r => ({
      label: r.award.name, icon: r.award.icon || 'fa-award', color: r.award.color || 'gold',
      grantedAt: r.grantedAt,
    }));
  } catch (e) { return []; }
}

function escRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function me(userId) {
  const u = await User.findOne({ id: userId }).lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  const [following, followers, reads, ent, wallet, vipApp] = await Promise.all([
    Follow.countDocuments({ followerId: userId }),
    Follow.countDocuments({ followingId: userId }),
    ReadingProgress.countDocuments({ userId, finished: true }),
    require('./wallet.service').entitlements(userId).catch(() => null),
    require('../models/money.model').Wallet.findOne({ userId: String(userId), kind: 'reader' })
      .select('coinBalance bonusBalance level currency').lean().catch(() => null),
    require('../models/application.model').VipApplication.findOne({ authorId: userId })
      .select('status').sort({ createdAt: -1 }).lean().catch(() => null),
  ]);
  // subscription detail row (planCode/status/dates) for the Store tab
  let sub = null;
  try {
    const { Subscription } = require('../models/money.model');
    sub = await Subscription.findOne({ userId: String(userId), status: 'active' })
      .sort({ startedAt: -1 }).lean();
  } catch (e) { /* store down — plan stays free */ }
  const plan = ent && ent.plan ? 'premium' : 'free';
  return Object.assign(publicShape(u), {
    email: u.email, emailVerified: u.emailVerified, phone: u.phone || null, phoneVerified: !!u.phoneVerified,
    following, followers, reads,
    mfaEnabled: !!u.mfaEnabled,
    settings: Object.assign({ theme: 'dark', notifications: true, privacy: 'public', readingActivity: true }, u.settings || {}),
    // store / plan (frontend: free|trial|premium + subscription detail)
    plan,
    subscription: sub ? {
      planCode: sub.planCode, status: sub.status,
      startedAt: sub.startedAt, expiresAt: sub.expiresAt,
      adsFree: !!(ent && ent.adsFree), adsFreeEverywhere: !!(ent && ent.adsFreeEverywhere),
    } : null,
    wallet: {
      coins: (wallet && wallet.coinBalance) || 0,
      bonusCoins: (wallet && wallet.bonusBalance) || 0,
      level: (wallet && wallet.level) || 'Starter',
      currency: (wallet && wallet.currency) || 'NGN',
    },
    referralCode: u.referralCode || null,
    platformRoles: u.platformRoles || [],
    vip: vipApp ? vipApp.status : 'none',
  });
}

// FIX 5 (privacy): private profiles return limited shape to non-owners.
// Enriched to the frontend profile-page contract: nested stats, card-ready
// posts, library rows, following rows, story-ring statuses, achievements.
async function profile(handle, viewerId) {
  const u = await User.findOne({
    $or: [{ username: String(handle).toLowerCase() }, { id: handle }],
  }).lean();
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  const privacy = (u.settings && u.settings.privacy) || 'public';
  const isOwner = viewerId && String(viewerId) === String(u.id);
  const isWriter = (u.roles || []).some(r => WRITER_ROLES.includes(r));
  const [following, followers] = await Promise.all([
    Follow.countDocuments({ followerId: u.id }),
    Follow.countDocuments({ followingId: u.id }),
  ]);
  if (privacy === 'private' && !isOwner) {
    return {
      id: u.id, username: u.username, handle: u.username,
      fullName: u.fullName, name: u.fullName,
      avatar: u.avatar || '', cover: '', bio: '', location: '', about: null, genres: [],
      country: '', roles: u.roles, primaryRole: u.primaryRole,
      isWriter, verified: !!u.emailVerified,
      status: u.status, createdAt: u.createdAt, joinedLabel: joinedLabel(u.createdAt),
      following, followers, books: 0, isPrivate: true, isOwner: false,
    };
  }
  let isFollowing = false;
  let isBlocked = false;
  if (viewerId && String(viewerId) !== String(u.id)) {
    const [f, b] = await Promise.all([
      Follow.exists({ followerId: viewerId, followingId: u.id }),
      Block.exists({ $or: [{ blockerId: viewerId, blockedId: u.id }, { blockerId: u.id, blockedId: viewerId }] }),
    ]);
    isFollowing = !!f;
    isBlocked = !!b;
  }
  // books (writers) — card shape the Books tab consumes
  const bookDocs = isWriter
    ? await Book.find({ authorId: u.id }).sort({ createdAt: -1 }).limit(50)
      .select('id title cover genre reads likes rating chapterCount status').lean()
    : [];
  const books = bookDocs.map(b => ({
    id: b.id, title: b.title, cat: b.genre || '', cover: b.cover || '',
    reads: b.reads || 0, likes: b.likes || 0, rating: b.rating || 0,
    chapters: b.chapterCount || 0, status: b.status || 'ongoing',
  }));
  const [readingStats, lib, ach, postDocs, followEdges, statusDocs] = await Promise.all([
    readingStatsFor(u.id),
    libraryFor(u.id),
    achievementsFor(u.username),
    Post.find({ authorId: u.id }).sort({ pinned: -1, createdAt: -1 }).limit(20).lean(),
    Follow.find({ followerId: u.id }).sort({ createdAt: -1 }).limit(12).select('followingId').lean(),
    Status.find({ userId: String(u.id), expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  // following rows for the Following tab
  let followingRows = [];
  if (followEdges.length) {
    const fu = await User.find({ id: { $in: followEdges.map(e => String(e.followingId)) } })
      .select('id username fullName avatar bio roles emailVerified').lean();
    const fm = {}; fu.forEach(x => { fm[String(x.id)] = x; });
    followingRows = followEdges
      .filter(e => fm[String(e.followingId)])
      .map(e => toFollowRow(fm[String(e.followingId)], true));
  }
  const base = publicShape(u);
  return Object.assign(base, {
    following, followers, books: books.length, isFollowing, isBlockedByViewer: isBlocked,
    isOwner: !!isOwner,
    stats: {
      following, followers,
      books: books.length,
      reads: bookDocs.reduce((n, b) => n + (b.reads || 0), 0),
      likes: bookDocs.reduce((n, b) => n + (b.likes || 0), 0),
      saved: lib.length,
      readingHours: readingStats.hoursRead,
      streak: readingStats.dayStreak,
    },
    readingStats,
    achievements: ach,
    books,
    library: lib,
    following: followingRows,
    posts: postDocs.map(p => toCardPost(p, viewerId)),
    statuses: statusDocs.map(toSlide),
  });
}

// FIX 1+4: self-update — name/bio/location/avatar/cover/about/genres/country/locale/username.
async function updateMe(userId, patch) {
  const u = await User.findOne({ id: userId }).select('+passwordHash');
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (patch.fullName !== undefined || patch.name !== undefined) {
    const v = String(patch.fullName !== undefined ? patch.fullName : patch.name).trim();
    if (v.length < 2 || v.length > 80) { const e = new Error('bad_fullName'); e.status = 400; throw e; }
    u.fullName = v;
  }
  if (patch.username !== undefined) {
    const v = String(patch.username).toLowerCase().trim();
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(v)) { const e = new Error('bad_username'); e.status = 400; throw e; }
    if (v !== u.username) {
      const taken = await User.exists({ username: v });
      if (taken) { const e = new Error('username_taken'); e.status = 409; throw e; }
      u.username = v;
    }
  }
  if (patch.bio !== undefined) {
    const v = String(patch.bio || '');
    if (v.length > 500) { const e = new Error('bio_too_long'); e.status = 400; throw e; }
    u.bio = v;
  }
  if (patch.location !== undefined) {
    const v = String(patch.location || '');
    if (v.length > 120) { const e = new Error('location_too_long'); e.status = 400; throw e; }
    u.location = v;
  }
  if (patch.country !== undefined) {
    const v = String(patch.country || '').slice(0, 56);
    u.country = v;
  }
  if (patch.locale !== undefined) u.locale = String(patch.locale).slice(0, 10) || 'en';
  if (patch.avatar !== undefined) u.avatar = validateMediaUrl(patch.avatar, 'avatar');
  if (patch.cover !== undefined) u.cover = validateMediaUrl(patch.cover, 'cover');
  if (patch.about !== undefined) {
    const a = patch.about;
    if (a === null || a === '') u.about = null;
    else if (typeof a === 'string') {
      if (a.length > 2000) { const e = new Error('about_too_long'); e.status = 400; throw e; }
      u.about = a;
    } else if (typeof a === 'object') {
      u.about = a;
    } else { const e = new Error('bad_about'); e.status = 400; throw e; }
  }
  if (patch.genres !== undefined) {
    if (!Array.isArray(patch.genres)) { const e = new Error('bad_genres'); e.status = 400; throw e; }
    const g = patch.genres.map(s => String(s).slice(0, 40)).filter(Boolean).slice(0, 6);
    u.genres = g;
  }
  await u.save();
  return publicShape(u.toJSON ? u.toJSON() : u);
}

// FIX 2a: change password with old-password check + kill all other sessions.
async function changePassword(userId, { oldPassword, newPassword }) {
  const u = await User.findOne({ id: userId }).select('+passwordHash');
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (!u.passwordHash) { const e = new Error('oauth_only'); e.status = 400; throw e; }
  const ok = await argon2.verify(u.passwordHash, String(oldPassword || '')).catch(() => false);
  if (!ok) { const e = new Error('bad_old_password'); e.status = 401; throw e; }
  if (!newPassword || String(newPassword).length < 8 || String(newPassword).length > 128) {
    const e = new Error('bad_new_password'); e.status = 400; throw e;
  }
  u.passwordHash = await argon2.hash(String(newPassword), { type: argon2.argon2id });
  u.failedLoginCount = 0;
  u.lockedUntil = null;
  await u.save();
  await RefreshFamily.deleteMany({ userId: u.id });
  return { ok: true };
}

function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex');
}

// FIX 2b: request email change (password-checked), confirm via token.
async function requestEmailChange(userId, { newEmail, password }) {
  const u = await User.findOne({ id: userId }).select('+passwordHash');
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (u.passwordHash) {
    const ok = await argon2.verify(u.passwordHash, String(password || '')).catch(() => false);
    if (!ok) { const e = new Error('bad_password'); e.status = 401; throw e; }
  }
  const email = String(newEmail || '').toLowerCase().trim();
  if (!/.+@.+\..+/.test(email)) { const e = new Error('bad_email'); e.status = 400; throw e; }
  if (email === u.email) { const e = new Error('same_email'); e.status = 400; throw e; }
  const taken = await User.exists({ email });
  if (taken) { const e = new Error('email_taken'); e.status = 409; throw e; }
  const raw = crypto.randomBytes(24).toString('hex');
  u.pendingEmail = email;
  u.pendingEmailTokenHash = hashToken(raw);
  u.pendingEmailExpiresAt = new Date(Date.now() + 60 * 60000);
  await u.save();
  return { ok: true, verifyToken: raw };
}

async function confirmEmailChange(token) {
  const u = await User.findOne({
    pendingEmailTokenHash: hashToken(String(token || '')),
    pendingEmailExpiresAt: { $gt: new Date() },
  });
  if (!u || !u.pendingEmail) { const e = new Error('bad_token'); e.status = 400; throw e; }
  u.email = u.pendingEmail;
  u.emailVerified = false;
  u.emailVerifiedAt = null;
  u.pendingEmail = null;
  u.pendingEmailTokenHash = null;
  u.pendingEmailExpiresAt = null;
  // issue fresh verify token for the new address
  const raw = crypto.randomBytes(24).toString('hex');
  u.emailVerifyTokenHash = hashToken(raw);
  await u.save();
  return { ok: true, email: u.email, verifyToken: raw };
}

// FIX 3: self deactivation (soft delete + kill sessions + remove follows).
async function deleteMe(userId, { password }) {
  const u = await User.findOne({ id: userId }).select('+passwordHash');
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (u.passwordHash) {
    const ok = await argon2.verify(u.passwordHash, String(password || '')).catch(() => false);
    if (!ok) { const e = new Error('bad_password'); e.status = 401; throw e; }
  }
  u.deletedAt = new Date();
  u.status = 'suspended';
  u.suspendedReason = 'self_deactivated';
  await u.save();
  await Promise.all([
    RefreshFamily.deleteMany({ userId: u.id }),
    Follow.deleteMany({ $or: [{ followerId: u.id }, { followingId: u.id }] }),
  ]);
  return { ok: true, deleted: true };
}

// FIX 5: settings read/write.
async function getSettings(userId) {
  const u = await User.findOne({ id: userId }).select('settings').lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  return u.settings || { theme: 'dark', notifications: true, privacy: 'public' };
}

async function updateSettings(userId, patch) {
  const u = await User.findOne({ id: userId });
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  if (patch.theme !== undefined) {
    if (!['light', 'dark'].includes(patch.theme)) { const e = new Error('bad_theme'); e.status = 400; throw e; }
    u.settings.theme = patch.theme;
  }
  if (patch.notifications !== undefined) u.settings.notifications = !!patch.notifications;
  if (patch.privacy !== undefined) {
    if (!['public', 'private'].includes(patch.privacy)) { const e = new Error('bad_privacy'); e.status = 400; throw e; }
    u.settings.privacy = patch.privacy;
  }
  if (patch.readingActivity !== undefined) u.settings.readingActivity = !!patch.readingActivity;
  await u.save();
  return u.settings;
}

// FIX 7: paged public user search (card shape: handle/name/verified/isWriter).
async function searchUsers({ q, page, limit }) {
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const filter = { deletedAt: null };
  if (q) {
    const rx = new RegExp(escRx(q), 'i');
    filter.$or = [{ username: rx }, { fullName: rx }];
  }
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim)
      .select('username fullName avatar roles emailVerified bio').lean(),
  ]);
  return {
    items: rows.map(r => Object.assign(toFollowRow(r, false), { id: r.id, roles: r.roles })),
    total, page: pg, limit: lim,
  };
}

// FIX 7b: followers/following with q + filter (writers|verified).
async function followersOf(handle, { page, limit, q, filter }) {
  const u = await User.findOne({
    $or: [{ username: String(handle).toLowerCase() }, { id: handle }],
  }).select('id').lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const edges = await Follow.find({ followingId: u.id })
    .sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
  let userFilter = { id: { $in: edges.map(e => e.followerId) } };
  if (q) {
    const rx = new RegExp(escRx(q), 'i');
    userFilter.$or = [{ username: rx }, { fullName: rx }];
  }
  if (filter === 'writers') userFilter.roles = 'writer';
  if (filter === 'verified') userFilter.emailVerified = true;
  const users = await User.find(userFilter).select('username fullName avatar roles emailVerified bio').lean();
  // edges may be empty → users empty; keep total accurate
  return {
    items: users.map(x => Object.assign(toFollowRow(x, true), { id: x.id })),
    total: await Follow.countDocuments({ followingId: u.id }), page: pg, limit: lim,
  };
}

async function followingOf(handle, { page, limit, q }) {
  const u = await User.findOne({
    $or: [{ username: String(handle).toLowerCase() }, { id: handle }],
  }).select('id').lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const edges = await Follow.find({ followerId: u.id })
    .sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
  let userFilter = { id: { $in: edges.map(e => e.followingId) } };
  if (q) {
    const rx = new RegExp(escRx(q), 'i');
    userFilter.$or = [{ username: rx }, { fullName: rx }];
  }
  const users = await User.find(userFilter).select('username fullName avatar roles emailVerified bio').lean();
  return {
    items: users.map(x => Object.assign(toFollowRow(x, true), { id: x.id })),
    total: await Follow.countDocuments({ followerId: u.id }), page: pg, limit: lim,
  };
}

async function resolveTarget(target) {
  const t = await User.findOne({
    $or: [{ username: String(target).toLowerCase() }, { id: target }],
  }).select('id').lean();
  if (!t) { const e = new Error('not_found'); e.status = 404; throw e; }
  return t;
}

async function follow({ userId, target }) {
  const t = await resolveTarget(target);
  if (String(t.id) === String(userId)) { const e = new Error('self'); e.status = 400; throw e; }
  // FIX 6: cannot follow when either side blocked the other.
  const blocked = await Block.exists({
    $or: [{ blockerId: userId, blockedId: t.id }, { blockerId: t.id, blockedId: userId }],
  });
  if (blocked) { const e = new Error('blocked'); e.status = 403; throw e; }
  try {
    await Follow.create({ followerId: userId, followingId: t.id });
  } catch (e) { if (e.code !== 11000) throw e; }
  return { ok: true, following: true };
}

async function unfollow({ userId, target }) {
  const t = await resolveTarget(target);
  if (!t) { const e = new Error('not_found'); e.status = 404; throw e; }
  await Follow.deleteOne({ followerId: userId, followingId: t.id });
  return { ok: true, following: false };
}

// FIX 6: block / mute.
async function blockUser({ userId, target }) {
  const t = await resolveTarget(target);
  if (String(t.id) === String(userId)) { const e = new Error('self'); e.status = 400; throw e; }
  try {
    await Block.create({ blockerId: userId, blockedId: t.id });
  } catch (e) { if (e.code !== 11000) throw e; }
  // blocking also unfollows both directions
  await Promise.all([
    Follow.deleteOne({ followerId: userId, followingId: t.id }),
    Follow.deleteOne({ followerId: t.id, followingId: userId }),
  ]);
  return { ok: true, blocked: true };
}

async function unblockUser({ userId, target }) {
  const t = await resolveTarget(target);
  await Block.deleteOne({ blockerId: userId, blockedId: t.id });
  return { ok: true, blocked: false };
}

async function listBlocks(userId) {
  const rows = await Block.find({ blockerId: userId }).lean();
  const users = rows.length
    ? await User.find({ id: { $in: rows.map(r => r.blockedId) } }).select('username fullName avatar').lean()
    : [];
  return { items: users.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar })) };
}

async function muteUser({ userId, target }) {
  const t = await resolveTarget(target);
  if (String(t.id) === String(userId)) { const e = new Error('self'); e.status = 400; throw e; }
  try {
    await Mute.create({ muterId: userId, mutedId: t.id });
  } catch (e) { if (e.code !== 11000) throw e; }
  return { ok: true, muted: true };
}

async function unmuteUser({ userId, target }) {
  const t = await resolveTarget(target);
  await Mute.deleteOne({ muterId: userId, mutedId: t.id });
  return { ok: true, muted: false };
}

async function listMutes(userId) {
  const rows = await Mute.find({ muterId: userId }).lean();
  const users = rows.length
    ? await User.find({ id: { $in: rows.map(r => r.mutedId) } }).select('username fullName avatar').lean()
    : [];
  return { items: users.map(u => ({ id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar })) };
}

async function mutedIds(userId) {
  const rows = await Mute.find({ muterId: userId }).select('mutedId').lean();
  return new Set(rows.map(r => String(r.mutedId)));
}

async function blockedIds(userId) {
  const rows = await Block.find({
    $or: [{ blockerId: userId }, { blockedId: userId }],
  }).select('blockerId blockedId').lean();
  const s = new Set();
  rows.forEach(r => { s.add(String(r.blockerId)); s.add(String(r.blockedId)); });
  s.delete(String(userId));
  return s;
}

async function becomeWriter(userId, { firstBookTitle, genre } = {}) {
  const u = await User.findOne({ id: userId });
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  const writerRoles = ['writer', 'senior_editor', 'chief_editor', 'admin'];
  if ((u.roles || []).some(r => writerRoles.includes(r))) {
    const e = new Error('already_writer'); e.status = 400; throw e;
  }
  const title = String(firstBookTitle || '').trim();
  if (!title) { const e = new Error('bad_firstBookTitle'); e.status = 400; throw e; }
  let genreName = '';
  if (genre !== undefined && genre !== null && String(genre).trim() !== '') {
    genreName = String(genre).trim();
    const g = await Genre.findOne({ name: genreName, status: 'active' }).select('name').lean();
    if (!g) { const e = new Error('bad_genre'); e.status = 400; throw e; }
  }
  if (!u.roles.includes('writer')) u.roles.push('writer');
  if (u.primaryRole === 'reader') u.primaryRole = 'writer';
  await u.save();
  const book = await Book.create({ title, authorId: u.id, kind: 'long', genre: genreName, status: 'draft' });
  return { user: publicShape(u.toJSON ? u.toJSON() : u), book };
}

async function checkUsername(username) {
  const exists = await User.exists({ username: String(username || '').toLowerCase() });
  return { available: !exists };
}

async function exportData(userId) {
  const u = await User.findOne({ id: userId })
    .select('-passwordHash -mfaSecret -mfaBackupCodes -emailVerifyTokenHash -resetTokenHash')
    .lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  const bookIds = (await Book.find({ authorId: userId }).select('id').lean()).map(b => b.id);
  const [books, chapters, follows, readingProgress, library, notifications, referrals] = await Promise.all([
    Book.find({ authorId: userId }).lean(),
    bookIds.length ? Chapter.find({ bookId: { $in: bookIds } }).lean() : [],
    Follow.find({ $or: [{ followerId: userId }, { followingId: userId }] }).lean(),
    ReadingProgress.find({ userId }).lean(),
    LibraryItem.find({ userId }).lean(),
    Notification.find({ recipientId: userId }).lean(),
    Referral.find({ ownerId: userId }).lean(),
  ]);
  return {
    exportedAt: new Date(),
    user: u,
    books,
    chapters,
    follows,
    readingProgress,
    library,
    notifications,
    referrals,
  };
}

module.exports = {
  me, profile, searchUsers,
  updateMe, changePassword, requestEmailChange, confirmEmailChange, deleteMe,
  getSettings, updateSettings,
  followersOf, followingOf, follow, unfollow,
  blockUser, unblockUser, listBlocks, muteUser, unmuteUser, listMutes,
  mutedIds, blockedIds, publicShape,
  becomeWriter, checkUsername, exportData,
};
