'use strict';
const { Notification } = require('../models/social.model');
const { TYPES, CATS, PAYLOAD_KEYS, LINK_LABELS } = require('./notification-types');

// Project a stored row into exactly the object the frontend renderer
// (component/notification-item.js) and store (services/notification-store.js)
// read. The DB keeps recipientId/type/title/desc/link/thumb/unread; the card
// needs cat/kind/audience/at and the milestone/digest fields from `payload`.
function shape(doc) {
  const t = TYPES[doc.type] || {};
  const cat = doc.cat || t.cat || 'system';
  const c = CATS[cat] || {};
  const p = doc.payload || {};
  const out = {
    id: doc.id,
    type: doc.type,
    cat,
    kind: doc.kind || t.kind || 'row',
    audience: doc.audience || t.audience || 'both',
    pushEligible: !!t.push,
    unread: !!doc.unread,
    at: new Date(doc.createdAt).getTime(),
    title: doc.title,
    desc: doc.desc || '',
    actorId: doc.actorId || undefined,
    thumb: doc.thumb || p.thumb || undefined,
    link: doc.link ? { href: doc.link, label: p.linkLabel || LINK_LABELS[doc.type] || undefined }
      : (p.link || (p.linkLabel || LINK_LABELS[doc.type] ? { href: '', label: p.linkLabel || LINK_LABELS[doc.type] } : null)),
  };
  if (doc.key != null) out.key = doc.key;
  PAYLOAD_KEYS.forEach(k => { if (p[k] !== undefined) out[k] = p[k]; });
  if (out.key === undefined) out.key = 'notif:' + doc.id;
  if (!out.icon && !out.avatar) out.icon = { name: c.icon || 'fa-bell', bg: c.bg, color: c.color };
  return out;
}

async function list({ userId, unread, page, limit }) {
  const filter = { recipientId: userId };
  if (unread === 'true' || unread === true) filter.unread = true;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: userId, unread: true }),
  ]);
  return { items: rows.map(shape), total, unreadCount, page: pg, limit: lim };
}

async function unreadCount(userId) {
  const filter = { recipientId: userId, unread: true };
  // The bell paints its count blue when a chat is in there, so the split has to
  // come from the server — the client only holds the current page of rows.
  const [count, chats] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, type: 'direct_message' }),
  ]);
  return { count, chats };
}

async function markRead({ userId, id }) {
  if (id) await Notification.updateOne({ id, recipientId: userId }, { unread: false });
  else await Notification.updateMany({ recipientId: userId, unread: true }, { unread: false });
  return { ok: true };
}

// notification-store.js contract: PATCH /api/notifications/:id — read flips
// unread, deleted removes the row. An absent read AND deleted is a no-op, never
// a silent delete (the old code deleted when read was omitted).
async function patchOne({ userId, id, read, deleted }) {
  if (deleted === true) { await Notification.deleteOne({ id, recipientId: userId }); return { ok: true, deleted: true }; }
  if (read === true || read === false) {
    await Notification.updateOne({ id, recipientId: userId }, { unread: !read });
    return { ok: true };
  }
  return { ok: true, changed: false };
}

// notification-store.js contract: PUT /api/notifications/settings — the full
// channel matrix from DroboardNotifStore.saveSettings, stored verbatim.
async function saveSettings({ userId, body }) {
  const { User } = require('../models/user.model');
  await User.updateOne({ id: userId }, { $set: { 'settings.notificationChannels': body } });
  return { ok: true, settings: body };
}

async function getSettings(userId) {
  const { User } = require('../models/user.model');
  const u = await User.findOne({ id: userId }).select('settings.notificationChannels').lean();
  return { settings: (u && u.settings && u.settings.notificationChannels) || null };
}

// A server cron owns the same `key` dedupe the client store uses, so emit() is
// idempotent: re-running a milestone backfill cannot create a second row.
async function notify({ recipientId, actorId, type, title, desc, link, key, audience, metrics, chips, icon, badge, medal, cover, avatar, rank, rankNote, iconName, tier, tierClass, color, count, linkLabel, thumb }) {
  const { User } = require('../models/user.model');
  const t = TYPES[type] || {};
  const recipient = await User.findOne({ id: recipientId }).select('settings.notifications').lean();
  if (recipient && recipient.settings && recipient.settings.notifications === false) {
    return { skipped: true };
  }
  if (key) {
    const dup = await Notification.findOne({ recipientId, key });
    if (dup) return dup.toJSON();
  }
  const payload = {};
  if (metrics) payload.metrics = metrics;
  if (chips) payload.chips = chips;
  if (icon) payload.icon = icon;
  if (badge) payload.badge = badge;
  if (medal) payload.medal = medal;
  if (cover) payload.cover = cover;
  if (avatar) payload.avatar = avatar;
  if (rank != null) payload.rank = rank;
  if (rankNote) payload.rankNote = rankNote;
  if (iconName) payload.iconName = iconName;
  if (tier) payload.tier = tier;
  if (tierClass) payload.tierClass = tierClass;
  if (color) payload.color = color;
  if (count != null) payload.count = count;
  if (linkLabel) payload.linkLabel = linkLabel;
  if (thumb) payload.thumb = thumb;
  const n = await Notification.create({
    recipientId, actorId, type, title, desc: desc || '', link: link || '',
    thumb: thumb || '',
    key: key || undefined,
    cat: t.cat, kind: t.kind, audience: audience || t.audience,
    payload,
  });
  try {
    const { emitToUser } = require('../socket');
    emitToUser(recipientId, 'notify', shape(n.toJSON()));
  } catch (e) {}
  return shape(n.toJSON());
}

// Types a client may legitimately raise about ITSELF — deadlines it can
// detect (a poll closed, a debate settled), milestones of the user's own
// catalogue, and the account's own security events. Activity rows
// (like/comment/reply/mention/follow/direct_message) are raised by the server
// when the OTHER party acts, so a client can never fake them.
const SELF_TYPES = new Set([
  'debate_verdict', 'poll_closed', 'prediction_settled', 'status_24h', 'reading_streak',
  'league_finish', 'reader_weekly', 'weekly_stats', 'weekly_earnings',
  'trending_enter', 'top_ten', 'editor_pick', 'featured',
  'new_chapter', 'chapter_live', 'schedule_failed',
  'payout', 'tip', 'coins', 'save', 'share', 'repost',
  'achievement', 'security', 'announcement',
  'contract_update', 'book_change_result', 'review_result', 'verification',
]);
const URL_OK = /^https?:\/\//i;
function _img(v) {
  const s = String(v || '').trim();
  return URL_OK.test(s) ? s.slice(0, 2800) : '';
}

// POST /api/notifications — the signed-in user raises a notification about
// their own account. The recipient is always the caller.
async function createSelf({ userId, body }) {
  const b = body || {};
  if (!SELF_TYPES.has(b.type)) { const e = new Error('type_not_allowed'); e.status = 400; throw e; }
  if (!b.title && !b.desc) { const e = new Error('empty_notification'); e.status = 400; throw e; }
  const t = TYPES[b.type] || {};
  return notify({
    recipientId: userId,
    type: b.type,
    title: String(b.title || '').slice(0, 300),
    desc: String(b.desc || '').slice(0, 600),
    link: String(b.link || '').slice(0, 400),
    key: b.key ? String(b.key).slice(0, 160) : undefined,
    audience: b.audience || t.audience,
    metrics: b.metrics, chips: b.chips,
    badge: b.badge, medal: b.medal, icon: b.icon,
    cover: _img(b.cover), avatar: _img(b.avatar), thumb: _img(b.thumb),
    rank: b.rank, rankNote: b.rankNote,
    iconName: b.iconName, tier: b.tier, tierClass: b.tierClass, color: b.color,
    count: b.count, linkLabel: b.linkLabel,
  });
}

module.exports = { list, unreadCount, markRead, patchOne, saveSettings, getSettings, notify, createSelf };
