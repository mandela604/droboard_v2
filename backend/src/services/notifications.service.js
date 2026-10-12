'use strict';
const { Notification } = require('../models/social.model');

async function list({ userId, unread, page, limit }) {
  const filter = { recipientId: userId };
  if (unread === 'true' || unread === true) filter.unread = true;
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientId: userId, unread: true }),
  ]);
  return { items, total, unreadCount, page: pg, limit: lim };
}

async function unreadCount(userId) {
  return { count: await Notification.countDocuments({ recipientId: userId, unread: true }) };
}

async function markRead({ userId, id }) {
  if (id) await Notification.updateOne({ id, recipientId: userId }, { unread: false });
  else await Notification.updateMany({ recipientId: userId, unread: true }, { unread: false });
  return { ok: true };
}

async function notify({ recipientId, actorId, type, title, desc, link }) {
  const { User } = require('../models/user.model');
  const recipient = await User.findOne({ id: recipientId }).select('settings.notifications').lean();
  if (recipient && recipient.settings && recipient.settings.notifications === false) {
    return { skipped: true };
  }
  const n = await Notification.create({ recipientId, actorId, type, title, desc: desc || '', link: link || '' });
  try {
    const { emitToUser } = require('../socket');
    emitToUser(recipientId, 'notify', n.toJSON());
  } catch (e) {}
  return n.toJSON();
}

module.exports = { list, unreadCount, markRead, notify };
