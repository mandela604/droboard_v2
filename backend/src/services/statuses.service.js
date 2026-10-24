'use strict';
/**
 * services/statuses.service.js — ephemeral stories (statuses).
 * Docs expire via the Status.expiresAt TTL index; viewedBy tracks per-viewer reads.
 */
const { Status } = require('../models/social.model');
const { User } = require('../models/user.model');

const DEFAULT_TTL_HOURS = 24;

function toStatus(s, viewerId, opts) {
  const o = s.toJSON ? s.toJSON() : s;
  const ownerId = String(o.userId);
  const viewers = (o.viewedBy || []).map(String);
  const uid = viewerId ? String(viewerId) : '';
  const isOwner = !!(uid && uid === ownerId);
  // Owner previews never inflate their own counter.
  const views = viewers.filter(v => v !== ownerId).length;
  const out = {
    id: o.id || o._id, userId: o.userId, bg: o.bg, quote: o.quote || '',
    caption: o.caption || '', likes: o.likes || 0,
    liked: uid ? ((o.likedBy || []).map(String).includes(uid)) : false,
    isLive: !!o.isLive,
    // Per-viewer truth. The legacy author-level `viewed` bool never drives
    // anybody else's ring.
    viewed: uid ? viewers.includes(uid) : false,
    isMine: isOwner,
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
        likes: o.likes, views: o.views || 0, viewed: o.viewed, isLive: o.isLive, expiresAt: o.expiresAt,
      };
    }),
  };
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
    const { validateMediaUrl } = require('./media.service');
    bg = validateMediaUrl(data.bg, 'bg');
    if (!bg) { const e = new Error('bad_bg'); e.status = 400; throw e; }
  } else {
    const e = new Error('no_file'); e.status = 400; throw e;
  }
  const ttlH = Math.min(72, Math.max(1, (data && data.ttlHours) || DEFAULT_TTL_HOURS));
  const doc = await Status.create({
    userId: String(userId), bg,
    quote: (data && data.quote) || '', caption: (data && data.caption) || '',
    isLive: !!(data && data.isLive), expiresAt: new Date(Date.now() + ttlH * 3600000),
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

async function viewStatus({ status, userId }) {
  const ownerId = String(status.userId);
  const uid = userId ? String(userId) : '';
  const viewers = (status.viewedBy || []).map(String);
  // The author viewing their own story is a preview, not a counted view.
  if (uid && uid !== ownerId && !viewers.includes(uid)) {
    status.viewedBy.push(uid);
    await status.save();
  }
  return toStatus(status, userId, { owner: uid === ownerId });
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

module.exports = { toStatus, homeStatuses, myStatuses, createStatus, loadOr404, canWrite, viewStatus, toggleLike, deleteStatus, stateStatuses };
