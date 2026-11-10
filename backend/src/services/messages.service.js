'use strict';
// 1:1 user messaging. Conversations are two-participant docs; the peer of
// the viewer is derived per row. Unread lives two ways: Message.read=false
// from the peer (badge count) and Conversation.unreadBy (quick membership).
// Message images follow the upload-only media rule (Cloudflare delivery URL).
const { Conversation, Message } = require('../models/social.model');
const { User } = require('../models/user.model');
const { validateMediaUrl } = require('./media.service');
const { userRefFilter } = require('./user-ref');
const { roleLabelFor } = require('./role-labels');
const { isOnline } = require('../socket');

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function paging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit };
}

function fromRoleFor(user) {
  const roles = (user && user.roles) || [];
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('senior_editor') || roles.includes('chief_editor') || roles.includes('editor')) return 'editor';
  if (roles.includes('writer')) return 'author';
  return 'user';
}

async function loadUsers(ids) {
  const uniq = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!uniq.length) return {};
  const users = await User.find(userRefFilter(uniq))
    .select('id username fullName avatar emailVerified roles primaryRole').lean().catch(() => []);
  const byId = {};
  (users || []).forEach(u => {
    const key = String(u.id || u._id || '');
    if (key) byId[key] = u;
  });
  return byId;
}

function peerShape(u) {
  if (!u) return { id: '', handle: '', name: 'User', avatar: '', verified: false, role: 'Reader', online: false };
  return {
    id: String(u.id || u._id || ''), handle: u.username || '',
    name: u.fullName || u.username || 'User', avatar: u.avatar || '',
    verified: !!u.emailVerified,
    role: roleLabelFor(u),
    online: isOnline(String(u.id || u._id || '')),
  };
}

function peerOf(conv, userId) {
  const uid = String(userId);
  return (conv.participants || []).map(String).find(p => p !== uid) || '';
}

async function assertParticipant(conv, userId) {
  if (!(conv.participants || []).map(String).includes(String(userId))) err('forbidden', 403);
  return conv;
}

function previewLabel(msg) {
  if (msg.image && msg.text) return String(msg.text).slice(0, 80);
  if (msg.image) return '[Image]';
  return String(msg.text || '').slice(0, 80);
}

async function refreshConversation(conversationId) {
  // Recompute preview + updatedAt from the latest surviving message.
  const last = await Message.findOne({ conversationId }).sort({ createdAt: -1 }).lean();
  await Conversation.updateOne({ id: conversationId }, {
    preview: last ? previewLabel(last) : '',
    updatedAt: last ? last.createdAt : new Date(),
  });
}

async function listConversations({ userId }) {
  const convs = await Conversation.find({ participants: String(userId) })
    .sort({ updatedAt: -1 }).limit(100).lean();
  if (!convs.length) return { items: [] };
  const peerIds = convs.map(c => peerOf(c, userId));
  const byId = await loadUsers(peerIds);
  const counts = await Message.aggregate([
    { $match: { conversationId: { $in: convs.map(c => c.id) }, read: false, senderId: { $ne: String(userId) } } },
    { $group: { _id: '$conversationId', n: { $sum: 1 } } },
  ]);
  const unreadByConv = {};
  counts.forEach(r => { unreadByConv[String(r._id)] = r.n; });
  return {
    items: convs.map(c => ({
      id: c.id, peer: peerShape(byId[peerOf(c, userId)]),
      preview: c.preview || '', unread: unreadByConv[c.id] || 0,
      updatedAt: c.updatedAt,
    })),
  };
}

async function openOrCreate({ userId, peerId }) {
  const pid = String(peerId);
  if (pid === String(userId)) err('invalid_peer', 400);
  const peer = await User.findOne({ id: pid }).select('id username fullName avatar emailVerified roles primaryRole').lean();
  if (!peer) err('peer_not_found', 404);
  let conv = await Conversation.findOne({ participants: { $all: [String(userId), pid], $size: 2 } }).lean();
  if (!conv) {
    const doc = await Conversation.create({ participants: [String(userId), pid], preview: '', unreadBy: [] });
    conv = doc.toJSON();
  }
  const unread = await Message.countDocuments({ conversationId: conv.id, senderId: pid, read: false });
  return { id: conv.id, peer: peerShape(peer), preview: conv.preview || '', unread, updatedAt: conv.updatedAt };
}

async function loadConv(id, userId) {
  const conv = await Conversation.findOne({ id: String(id) });
  if (!conv) err('not_found', 404);
  await assertParticipant(conv, userId);
  return conv;
}

function toMessage(m, byId, userId) {
  const s = byId[String(m.senderId)] || {};
  const out = {
    id: m.id, conversationId: m.conversationId,
    text: m.text || '', image: m.image || '',
    edited: !!m.edited, read: !!m.read,
    senderId: String(m.senderId), fromRole: m.fromRole || 'user',
    isMine: String(m.senderId) === String(userId),
    sender: peerShape(s), createdAt: m.createdAt,
  };
  if (m.replyTo) out.replyTo = m.replyTo;
  return out;
}

async function listMessages({ userId, convId, page, limit }) {
  const conv = await loadConv(convId, userId);
  const { page: pg, limit: lim } = paging({ page, limit });
  const [items, total] = await Promise.all([
    Message.find({ conversationId: conv.id }).sort({ createdAt: -1 })
      .skip((pg - 1) * lim).limit(lim).lean(),
    Message.countDocuments({ conversationId: conv.id }),
  ]);
  // Load all quoted messages referenced in this page
  const quotedIds = [...new Set(items.map(m => m.replyTo).filter(Boolean))];
  let quotedMsgs = {};
  if (quotedIds.length) {
    const quoted = await Message.find({ id: { $in: quotedIds } }).lean();
    quoted.forEach(q => { quotedMsgs[q.id] = q; });
  }
  const byId = await loadUsers([userId, peerOf(conv, userId)]);
  return {
    items: items.map(m => {
      const msg = toMessage(m, byId, userId);
      if (m.replyTo && quotedMsgs[m.replyTo]) {
        const q = quotedMsgs[m.replyTo];
        msg.quoted = {
          id: q.id, text: q.text, image: q.image,
          sender: q.senderId === String(userId) ? 'You' : (byId[String(q.senderId)] && byId[String(q.senderId)].fullName) || 'User',
        };
      }
      return msg;
    }),
    total, page: pg, limit: lim
  };
}

// One unread notification per conversation, not one per message: the count
// climbs while it is unread and starts over once the thread has been opened.
async function notifyPeer({ peerId, sender, conv, preview }) {
  const { Notification } = require('../models/social.model');
  const { notify } = require('./notifications.service');
  const key = 'dm:' + conv.id;
  const prev = await Notification.findOne({ recipientId: peerId, key }).lean();
  const count = prev && prev.unread ? ((prev.payload && prev.payload.count) || 0) + 1 : 1;
  // Re-created rather than updated so a reply to an old thread jumps to the top.
  if (prev) await Notification.deleteOne({ id: prev.id });
  await notify({
    recipientId: peerId, actorId: String(sender.id), type: 'direct_message',
    title: sender.fullName || sender.username || 'User',
    desc: preview, link: 'Pages/chat.html?contact=' + conv.id, linkLabel: 'Reply',
    key, count, badge: 'chat', avatar: sender.avatar || undefined,
  });
}

async function sendMessage({ userId, convId, text, image, replyTo }) {
  const conv = await loadConv(convId, userId);
  const me = await User.findOne({ id: String(userId) }).select('id username fullName avatar emailVerified roles primaryRole').lean();
  const msg = await Message.create({
    conversationId: conv.id, senderId: String(userId),
    fromRole: fromRoleFor(me),
    text: String(text || '').slice(0, 4000),
    image: validateMediaUrl(image, 'image'),
    replyTo: replyTo || null,
  });
  const peers = (conv.participants || []).map(String).filter(p => p !== String(userId));
  conv.preview = previewLabel(msg.toJSON());
  conv.updatedAt = new Date();
  conv.unreadBy = [...new Set([...(conv.unreadBy || []).map(String), ...peers])];
  await conv.save();
  const byId = { [String(userId)]: me };
  try {
    const { emitToUser } = require('../socket');
    // Each recipient gets the row from THEIR point of view: isMine is relative to
    // the reader, so one shared payload would render an incoming message as your own.
    peers.forEach(p => emitToUser(p, 'message', toMessage(msg.toJSON(), byId, p)));
  } catch (e) { /* socket not initialized (tests/scripts) */ }
  // The message is already saved: a notification failure must not fail the send.
  for (const p of peers) {
    try { await notifyPeer({ peerId: p, sender: me, conv, preview: conv.preview }); } catch (e) {}
  }
  return toMessage(msg.toJSON(), byId, userId);
}

async function markRead({ userId, convId }) {
  const conv = await loadConv(convId, userId);
  await Message.updateMany(
    { conversationId: conv.id, senderId: { $ne: String(userId) }, read: false },
    { read: true },
  );
  conv.unreadBy = (conv.unreadBy || []).map(String).filter(u => u !== String(userId));
  await conv.save();
  // Opening the thread is reading the notification too — the bell must not stay
  // blue for a conversation the viewer has already looked at.
  try {
    const { Notification } = require('../models/social.model');
    await Notification.updateMany({ recipientId: userId, key: 'dm:' + conv.id }, { unread: false });
  } catch (e) { /* notifications are best-effort alongside the read receipt */ }
  return { ok: true };
}

async function loadOwnMessage(msgId, userId) {
  const msg = await Message.findOne({ id: String(msgId) });
  if (!msg) err('not_found', 404);
  if (String(msg.senderId) !== String(userId)) err('forbidden', 403);
  return msg;
}

async function editMessage({ userId, msgId, text }) {
  const msg = await loadOwnMessage(msgId, userId);
  msg.text = String(text || '').slice(0, 4000);
  msg.edited = true;
  await msg.save();
  // If it is the thread's latest message, keep the conversation preview in sync.
  const last = await Message.findOne({ conversationId: msg.conversationId }).sort({ createdAt: -1 }).select('id').lean();
  if (last && last.id === msg.id) {
    await Conversation.updateOne({ id: msg.conversationId }, { preview: previewLabel(msg.toJSON()) });
  }
  const byId = await loadUsers([userId]);
  return toMessage(msg.toJSON(), byId, userId);
}

async function deleteMessage({ userId, msgId }) {
  const msg = await loadOwnMessage(msgId, userId);
  await msg.deleteOne();
  await refreshConversation(msg.conversationId);
  return { ok: true };
}

module.exports = { listConversations, openOrCreate, listMessages, sendMessage, markRead, editMessage, deleteMessage };
