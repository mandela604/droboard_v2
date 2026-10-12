'use strict';
const argon2 = require('argon2');
const crypto = require('crypto');
const { User, RefreshFamily } = require('../models/user.model');
const { Book, Chapter, Genre } = require('../models/content.model');
const { Follow, Block, Mute, ReadingProgress, LibraryItem, Notification, Referral } = require('../models/social.model');
const { validateMediaUrl } = require('./media.service');

function publicShape(u) {
  return {
    id: u.id, username: u.username, fullName: u.fullName, name: u.fullName,
    avatar: u.avatar || '', cover: u.cover || '', bio: u.bio || '',
    location: u.location || '', about: u.about || null, genres: u.genres || [],
    country: u.country || '',
    roles: u.roles, primaryRole: u.primaryRole,
    isWriter: (u.roles || []).some(r => ['writer', 'senior_editor', 'chief_editor', 'admin'].includes(r)),
    status: u.status, createdAt: u.createdAt,
  };
}

function escRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function me(userId) {
  const u = await User.findOne({ id: userId }).lean();
  if (!u) { const e = new Error('not_found'); e.status = 404; throw e; }
  const [following, followers, reads] = await Promise.all([
    Follow.countDocuments({ followerId: userId }),
    Follow.countDocuments({ followingId: userId }),
    ReadingProgress.countDocuments({ userId, finished: true }),
  ]);
  return Object.assign(publicShape(u), {
    email: u.email, emailVerified: u.emailVerified, phone: u.phone || null, phoneVerified: !!u.phoneVerified,
    following, followers, reads,
    mfaEnabled: !!u.mfaEnabled,
    settings: u.settings || { theme: 'dark', notifications: true, privacy: 'public' },
  });
}

// FIX 5 (privacy): private profiles return limited shape to non-owners.
async function profile(handle, viewerId) {
  const u = await User.findOne({
    $or: [{ username: String(handle).toLowerCase() }, { id: handle }],
  }).lean();
  if (!u || u.deletedAt) { const e = new Error('not_found'); e.status = 404; throw e; }
  const privacy = (u.settings && u.settings.privacy) || 'public';
  const isOwner = viewerId && String(viewerId) === String(u.id);
  const [following, followers, books] = await Promise.all([
    Follow.countDocuments({ followerId: u.id }),
    Follow.countDocuments({ followingId: u.id }),
    Book.countDocuments({ authorId: u.id }),
  ]);
  if (privacy === 'private' && !isOwner) {
    return {
      id: u.id, username: u.username, fullName: u.fullName, name: u.fullName,
      avatar: u.avatar || '', cover: '', bio: '', location: '', about: null, genres: [],
      country: '', roles: u.roles, primaryRole: u.primaryRole,
      isWriter: (u.roles || []).some(r => ['writer', 'senior_editor', 'chief_editor', 'admin'].includes(r)),
      status: u.status, createdAt: u.createdAt,
      following, followers, books: 0, isPrivate: true,
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
  return Object.assign(publicShape(u), { following, followers, books, isFollowing, isBlockedByViewer: isBlocked });
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

// FIX 7: paged public user search.
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
      .select('username fullName avatar roles').lean(),
  ]);
  return { items: rows.map(r => ({ id: r.id, username: r.username, fullName: r.fullName, avatar: r.avatar, roles: r.roles })), total, page: pg, limit: lim };
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
  const users = await User.find(userFilter).select('username fullName avatar roles emailVerified').lean();
  return { items: users, total: await Follow.countDocuments({ followingId: u.id }), page: pg, limit: lim };
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
  const users = await User.find(userFilter).select('username fullName avatar roles').lean();
  return { items: users, total: await Follow.countDocuments({ followerId: u.id }), page: pg, limit: lim };
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
