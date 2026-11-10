'use strict';
/**
 * services/statuses.service.js — ephemeral stories (statuses).
 * Docs expire via the Status.expiresAt TTL index; viewedBy tracks per-viewer reads.
 */
const { Status } = require('../models/social.model');
const { User } = require('../models/user.model');

const DEFAULT_TTL_HOURS = 24;
// Ceiling on the per-status view log; past this the oldest reads drop off.
const MAX_VIEW_RECORDS = 2000;

// The composer's "no photo needed" presets (post-composer.js STATUS_BGS).
// Fixed constants, not user CSS — safe to store and render as backgrounds.
const GRADIENT_BGS = new Set([
  'linear-gradient(135deg,#000000,#1c1c1e)',
  'linear-gradient(135deg,#2b2b2f,#101013)',
  'linear-gradient(135deg,#1c1917,#0c0a09)',
  'linear-gradient(135deg,#4b2e2b,#241414)',
  'linear-gradient(135deg,#5b3a29,#241407)',
  'linear-gradient(135deg,#3e2723,#160d0b)',
  'linear-gradient(135deg,#b08968,#6b4a2f)',
  'linear-gradient(135deg,#4c0519,#1c0208)',
  'linear-gradient(135deg,#701a2e,#2b0a13)',
  'linear-gradient(135deg,#7f1d1d,#220909)',
  'linear-gradient(135deg,#172554,#0a0f1e)',
  'linear-gradient(135deg,#14532d,#071a0e)',
  'linear-gradient(135deg,#3b0764,#150427)',
  'linear-gradient(135deg,#334155,#0b1220)',
]);

function toStatus(s, viewerId, opts) {
  const o = s.toJSON ? s.toJSON() : s;
  const ownerId = String(o.userId);
  const viewers = (o.viewedBy || []).map(String);
  const uid = viewerId ? String(viewerId) : '';
  const isOwner = !!(uid && uid === ownerId);
  // Owner previews never inflate their own counter. Records are the source
  // of truth; docs written before the log existed fall back to viewedBy.
  const records = (o.viewerRecords || []).filter(r => !(r.user && String(r.user) === ownerId));
  const views = Math.max(records.length, viewers.filter(v => v !== ownerId).length);
  const out = {
    id: o.id || o._id, userId: o.userId, bg: o.bg, quote: o.quote || '',
    caption: o.caption || '', likes: o.likes || 0,
    liked: uid ? ((o.likedBy || []).map(String).includes(uid)) : false,
    isLive: !!o.isLive,
    // Per-viewer truth. The legacy author-level `viewed` bool never drives
    // anybody else's ring.
    viewed: uid ? viewers.includes(uid) : false,
    isMine: isOwner,
    storyRef: o.storyRef && o.storyRef.id
      ? { id: String(o.storyRef.id), title: o.storyRef.title || '', author: o.storyRef.author || '', cover: o.storyRef.cover || '' }
      : null,
    expiresAt: o.expiresAt, createdAt: o.createdAt,
  };
  if (isOwner) out.views = views;
  return out;
}

async function homeStatuses({ userId }) {
  const { Follow } = require('../models/social.model');
  let ids = [];
  if (userId) {
    const follows = await Follow.find({ followerId: String(userId) }).select('followingId').lean();
    ids = follows.map(f => String(f.followingId));
    ids.push(String(userId));
  }
  const filter = { expiresAt: { $gt: new Date() } };
  if (ids.length) filter.userId = { $in: ids };
  const rows = await Status.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const uids = [...new Set(rows.map(r => String(r.userId)))];
  const hex = uids.filter(v => /^[0-9a-fA-F]{24}$/.test(v));
  const users = await User.find(hex.length ? { $or: [{ id: { $in: uids } }, { _id: { $in: hex } }] } : { id: { $in: uids } }).select('id username fullName avatar').lean();
  const um = {};
  users.forEach(u => { um[String(u.id)] = u; if (u._id) um[String(u._id)] = u; });
  return {
    items: rows.map(r => Object.assign(toStatus(r, userId), {
      user: um[String(r.userId)] ? { id: um[String(r.userId)].id, name: um[String(r.userId)].fullName, handle: um[String(r.userId)].username, avatar: um[String(r.userId)].avatar || '' } : { id: r.userId },
    })),
  };
}

/* Status-row roster (top strip on feed.html and index.html).
   scope='any'     — feed.html: every role, writers and readers together.
   scope='authors' — index.html: only users with the 'writer' role; a reader's
                     status never appears on the homepage.
   Ordering: authors the viewer follows first (most-recent live slide within
   each bucket), then fill to `limit` with any eligible author so the row
   always has `limit` entries when the DB offers that many. Never invents a
   status — authors without a live Status doc are simply omitted. */
async function statusRoster({ userId, scope = 'any', limit = 20 } = {}) {
  const { Follow } = require('../models/social.model');
  const cap = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
  const now = new Date();
  const liveFilter = { expiresAt: { $gt: now } };
  if (scope === 'authors') {
    // The roles array lives on User, not Status, so resolve the writer id-set
    // up-front; a $lookup inside this query would be another round trip.
    const authors = await User.find({ roles: 'writer', deletedAt: null })
      .select('id').lean();
    liveFilter.userId = { $in: authors.map(a => String(a.id)) };
    if (!liveFilter.userId.$in.length) return [];
  }
  const rows = await Status.find(liveFilter).sort({ createdAt: 1 }).lean();
  if (!rows.length) return [];
  const uids = [...new Set(rows.map(r => String(r.userId)))];
  const hex = uids.filter(v => /^[0-9a-fA-F]{24}$/.test(v));
  const users = await User.find(
    hex.length ? { $or: [{ id: { $in: uids } }, { _id: { $in: hex } }] } : { id: { $in: uids } }
  ).select('id username fullName avatar roles deletedAt').lean();
  const um = {};
  users.forEach(u => { um[String(u.id)] = u; if (u._id) um[String(u._id)] = u; });
  const groups = {};
  rows.forEach(r => { (groups[String(r.userId)] = groups[String(r.userId)] || []).push(r); });
  const latestMs = {};
  Object.keys(groups).forEach(id => {
    latestMs[id] = groups[id].reduce((mx, r) => {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      return t > mx ? t : mx;
    }, 0);
  });
  const follows = userId
    ? await Follow.find({ followerId: String(userId) }).select('followingId').lean()
    : [];
  const following = new Set(follows.map(f => String(f.followingId)));
  // Only authors that still exist, aren't soft-deleted, and (scope=authors)
  // really carry the writer role. Belt-and-braces after the $in filter above.
  const eligible = Object.keys(groups).filter(id => {
    const u = um[id];
    if (!u || u.deletedAt) return false;
    if (scope === 'authors' && !(u.roles || []).includes('writer')) return false;
    return true;
  });
  eligible.sort((a, b) => {
    const af = following.has(a) ? 0 : 1;
    const bf = following.has(b) ? 0 : 1;
    if (af !== bf) return af - bf;
    return latestMs[b] - latestMs[a];
  });
  return eligible.slice(0, cap).map(id => {
    const u = um[id];
    const isMine = !!userId && String(id) === String(userId);
    const slides = groups[id].map(r => {
      const t = toStatus(r, userId, { owner: isMine });
      return {
        id: t.id, bg: t.bg, quote: t.quote, caption: t.caption,
        time: relTimeLabel(r.createdAt),
        ts: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
        viewed: t.viewed, likes: t.likes, liked: t.liked, isLive: t.isLive,
        views: t.views, storyRef: t.storyRef,
      };
    });
    const unseen = slides.filter(s => !s.viewed).length;
    return {
      id: u.id, name: u.username || u.fullName || '', handle: u.username || '',
      avatar: u.avatar || '', isLive: slides.some(s => s.isLive),
      isMine, isYou: isMine,
      ring: unseen > 0 ? 'ring-has' : 'ring-viewed',
      likes: 0, threads: slides.length, statuses: slides,
    };
  });
}

// Frontend contract: GET /api/statuses/me → { statuses: [{bg,quote,caption,time}] }
async function myStatuses({ userId }) {
  const rows = await Status.find({ userId: String(userId), expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).limit(20).lean();
  return {
    statuses: rows.map(s => {
      const o = toStatus(s, userId, { owner: true });
      return {
        id: o.id, bg: o.bg, quote: o.quote, caption: o.caption,
        time: relTimeLabel(o.createdAt), ts: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
        likes: o.likes, views: o.views || 0, viewed: o.viewed, isLive: o.isLive,
        storyRef: o.storyRef, expiresAt: o.expiresAt,
      };
    }),
  };
}

/* Frontend contract: GET /api/statuses/writers?handles=a,b,c
   → [{ handle, statuses: [{ bg, quote, caption, time, ... }] }]
   The live source behind every "Top Writers" ring. Only real, unexpired
   Status docs are returned — a writer with no live story gets an empty list
   and therefore renders no ring. Nothing here invents a status, and viewed
   state stays client-side in StatusStore. */
async function writersByHandles({ handles, userId }) {
  const wanted = [...new Set((Array.isArray(handles) ? handles : [])
    .map(h => String(h || '').replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean))].slice(0, 40);
  if (!wanted.length) return [];
  const users = await User.find({ username: { $in: wanted }, deletedAt: null })
    .collation({ locale: 'en', strength: 2 })
    .select('id username').lean();
  const handleOf = {};
  users.forEach(u => { handleOf[String(u.id)] = String(u.username).toLowerCase(); });
  const ids = Object.keys(handleOf);
  const rows = ids.length
    ? await Status.find({ userId: { $in: ids }, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 }).lean()
    : [];
  const groups = {};
  rows.forEach(r => {
    const handle = handleOf[String(r.userId)];
    if (!handle) return;
    const o = toStatus(r, userId);
    groups[handle] = groups[handle] || [];
    groups[handle].push({
      id: o.id, bg: o.bg, quote: o.quote, caption: o.caption,
      time: relTimeLabel(o.createdAt),
      ts: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
      likes: o.likes, liked: o.liked, isLive: o.isLive, viewed: o.viewed,
      storyRef: o.storyRef, expiresAt: o.expiresAt,
    });
  });
  return wanted.map(handle => ({ handle, statuses: groups[handle] || [] }));
}

function relTimeLabel(d) {
  if (!d) return 'Just now';
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// File upload (preferred) OR JSON {bg: <uploaded media URL>}.
// bg-as-URL must pass validateMediaUrl (Cloudflare Images delivery only) —
// clients upload via POST /api/uploads/image first, then post the URL.
async function createStatus({ userId, file, data }) {
  let bg;
  if (file && file.buffer && file.buffer.length) {
    const { uploadImageBuffer, validateMediaUrl } = require('./media.service');
    const url = await uploadImageBuffer(file.buffer, file.mimetype, file.originalname);
    bg = validateMediaUrl(url, 'bg');
  } else if (data && data.bg) {
    const raw = String(data.bg).trim();
    if (GRADIENT_BGS.has(raw)) {
      bg = raw;
    } else {
      const { validateMediaUrl } = require('./media.service');
      bg = validateMediaUrl(data.bg, 'bg');
      if (!bg) { const e = new Error('bad_bg'); e.status = 400; throw e; }
    }
  } else {
    const e = new Error('no_file'); e.status = 400; throw e;
  }
  const ttlH = Math.min(72, Math.max(1, (data && data.ttlHours) || DEFAULT_TTL_HOURS));
  const storyRef = { id: '', title: '', author: '', cover: '' };
  if (data && data.storyRef && data.storyRef.id) {
    const { validateMediaUrl } = require('./media.service');
    storyRef.id = String(data.storyRef.id).slice(0, 120);
    storyRef.title = String(data.storyRef.title || '').slice(0, 200);
    storyRef.author = String(data.storyRef.author || '').slice(0, 120);
    // Chip cover is decorative: an untrusted URL drops the image, not the post.
    try { storyRef.cover = validateMediaUrl(String(data.storyRef.cover || ''), 'cover') || ''; }
    catch (e) { storyRef.cover = ''; }
  }
  const doc = await Status.create({
    userId: String(userId), bg,
    quote: (data && data.quote) || '', caption: (data && data.caption) || '',
    isLive: !!(data && data.isLive), storyRef,
    expiresAt: new Date(Date.now() + ttlH * 3600000),
  });
  const out = toStatus(doc, userId);
  out.time = 'Just now';
  out.ts = doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now();
  return out;
}

async function loadOr404(id) {
  const s = await Status.findOne({ id });
  if (!s) { const e = new Error('not_found'); e.status = 404; throw e; }
  return s;
}
function canWrite(status, user) {
  if (!user) return false;
  if ((user.roles || []).includes('admin')) return true;
  return String(status.userId) === String(user.id);
}

async function viewStatus({ status, userId, anonId }) {
  const ownerId = String(status.userId);
  const uid = userId ? String(userId) : '';
  // The author viewing their own story is a preview, not a counted view.
  if (uid && uid === ownerId) return toStatus(status, userId, { owner: true });

  // Signed-out viewers are identified by a persistent client id so repeat
  // opens don't inflate the count. No id at all → count the open, no dedupe.
  const guest = uid ? '' : String(anonId || '').trim().slice(0, 80);
  const records = status.viewerRecords || [];
  const seen = uid
    ? records.some(r => String(r.user || '') === uid)
    : (guest ? records.some(r => !r.user && String(r.anon || '') === guest) : false);

  if (!seen && (uid || guest)) {
    const rec = { user: uid, anon: guest, at: new Date() };
    const upd = { $push: { viewerRecords: { $each: [rec], $slice: -MAX_VIEW_RECORDS } } };
    if (uid) upd.$addToSet = { viewedBy: uid };
    await Status.updateOne({ _id: status._id }, upd);
    status.viewerRecords.push(rec);
    if (uid) status.viewedBy.push(uid);
  }
  return toStatus(status, userId);
}

/* Owner/admin "seen by" list: named viewers with timestamps + guest total.
   Guest ids are never exposed — only how many signed-out reads there were. */
async function statusViewers({ status, user }) {
  if (!canWrite(status, user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
  const ownerId = String(status.userId);
  let rows = (status.viewerRecords || [])
    .filter(r => !(r.user && String(r.user) === ownerId))
    .map(r => ({ user: String(r.user || ''), anon: String(r.anon || ''), at: r.at || null }))
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  // Pre-log statuses still have names in viewedBy, just no timestamp.
  if (!rows.length) {
    rows = (status.viewedBy || [])
      .map(String).filter(v => v !== ownerId)
      .map(userId => ({ user: userId, anon: '', at: null }));
  }

  const guests = rows.filter(r => !r.user).length;
  const ids = [...new Set(rows.map(r => r.user).filter(Boolean))];
  const hex = ids.filter(v => /^[0-9a-fA-F]{24}$/.test(v));
  const users = ids.length
    ? await User.find(hex.length ? { $or: [{ id: { $in: ids } }, { _id: { $in: hex } }] } : { id: { $in: ids } })
      .select('id username fullName penName avatar').lean()
    : [];
  const um = {};
  users.forEach(u => {
    const row = { id: String(u.id || u._id), name: u.fullName || u.penName || u.username || '', handle: u.username || '', avatar: u.avatar || '' };
    um[String(u.id)] = row;
    if (u._id) um[String(u._id)] = row;
  });

  const seen = new Set();
  const named = [];
  rows.forEach(r => {
    if (!r.user || seen.has(r.user)) return;
    seen.add(r.user);
    const u = um[r.user];
    named.push({
      id: r.user,
      name: (u && u.name) || '',
      handle: (u && u.handle) || '',
      avatar: (u && u.avatar) || '',
      at: r.at ? new Date(r.at).toISOString() : null,
    });
  });

  return {
    id: String(status.id || status._id),
    views: named.length + guests,
    named,
    guests,
    lastAt: rows[0] && rows[0].at ? new Date(rows[0].at).toISOString() : null,
  };
}

/* Cross-surface ring state for a set of handles.
   GET /api/statuses/state?handles=a,b,c
   → { states: { a: {has,total,unseen,seen,ring,lastAt} } } */
async function stateStatuses({ viewerId, handles }) {
  const wanted = [...new Set((handles || [])
    .map(h => String(h || '').replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean))].slice(0, 80);
  const states = {};
  wanted.forEach(h => {
    states[h] = { handle: h, has: false, total: 0, unseen: 0, seen: 0, ring: 'ring-none', lastAt: null };
  });
  if (!wanted.length) return { states };

  const users = await User.find({ username: { $in: wanted } })
    .collation({ locale: 'en', strength: 2 })
    .select('id username').lean();
  if (!users.length) return { states };
  const byId = {};
  users.forEach(u => { byId[String(u.id)] = String(u.username).toLowerCase(); });

  const rows = await Status.find({
    userId: { $in: Object.keys(byId) },
    expiresAt: { $gt: new Date() },
  }).select('userId viewedBy createdAt').sort({ createdAt: 1 }).lean();

  const uid = viewerId ? String(viewerId) : '';
  rows.forEach(r => {
    const handle = byId[String(r.userId)];
    const st = handle && states[handle];
    if (!st) return;
    st.has = true;
    st.total += 1;
    const seen = uid && (r.viewedBy || []).map(String).includes(uid);
    if (seen) st.seen += 1; else st.unseen += 1;
    const at = r.createdAt ? new Date(r.createdAt).toISOString() : null;
    if (at && (!st.lastAt || at > st.lastAt)) st.lastAt = at;
  });
  Object.keys(states).forEach(k => {
    const st = states[k];
    st.ring = !st.total ? 'ring-none' : (st.unseen > 0 ? 'ring-has' : 'ring-viewed');
  });
  return { states };
}

async function toggleLike({ status, userId }) {
  const uid = String(userId);
  const i = (status.likedBy || []).map(String).indexOf(uid);
  if (i === -1) { status.likedBy.push(uid); status.likes = (status.likes || 0) + 1; }
  else { status.likedBy.splice(i, 1); status.likes = Math.max(0, (status.likes || 0) - 1); }
  await status.save();
  return { liked: i === -1, likes: status.likes };
}

async function deleteStatus({ status }) {
  await status.deleteOne();
  return { ok: true };
}

module.exports = { toStatus, homeStatuses, statusRoster, myStatuses, writersByHandles, createStatus, loadOr404, canWrite, viewStatus, statusViewers, toggleLike, deleteStatus, stateStatuses };
