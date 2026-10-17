'use strict';
/**
 * services/statuses.service.js — ephemeral stories (statuses).
 * Docs expire via the Status.expiresAt TTL index; viewedBy tracks per-viewer reads.
 */
const { Status } = require('../models/social.model');
const { User } = require('../models/user.model');

const DEFAULT_TTL_HOURS = 24;

function toStatus(s, viewerId) {
  const o = s.toJSON ? s.toJSON() : s;
  const seen = ((o.viewedBy || []).map(String).includes(String(viewerId || ''))) || !!o.viewed;
  return {
    id: o.id || o._id, userId: o.userId, bg: o.bg, quote: o.quote || '',
    caption: o.caption || '', likes: o.likes || 0,
    liked: viewerId ? ((o.likedBy || []).map(String).includes(String(viewerId))) : false,
    isLive: !!o.isLive, viewed: seen, expiresAt: o.expiresAt, createdAt: o.createdAt,
  };
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
      const o = toStatus(s, userId);
      return {
        id: o.id, bg: o.bg, quote: o.quote, caption: o.caption,
        time: relTimeLabel(o.createdAt), ts: o.createdAt ? new Date(o.createdAt).getTime() : Date.now(),
        likes: o.likes, viewed: o.viewed, isLive: o.isLive, expiresAt: o.expiresAt,
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
  if (userId && !(status.viewedBy || []).map(String).includes(String(userId))) {
    status.viewedBy.push(String(userId));
    await status.save();
  }
  return toStatus(status, userId);
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

module.exports = { toStatus, homeStatuses, myStatuses, createStatus, loadOr404, canWrite, viewStatus, toggleLike, deleteStatus };
