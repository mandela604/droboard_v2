'use strict';
// 1:1 user messaging. Conversations are two-participant docs; the peer of
// the viewer is derived per row. Unread lives two ways: Message.read=false
// from the peer (badge count) and Conversation.unreadBy (quick membership).
// Message images follow the upload-only media rule (Cloudflare delivery URL).
const { Conversation, Message } = require('../models/social.model');
const { User } = require('../models/user.model');
const { validateMediaUrl } = require('./media.service');

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
  const users = await User.find({ $or: [{ id: { $in: uniq } }, { _id: { $in: uniq } }] })
    .select('id username fullName avatar emailVerified roles').lean().catch(() => []);
  const byId = {};
  (users || []).forEach(u => {
    const key = String(u.id || u._id || '');
    if (key) byId[key] = u;
  });
  return byId;
}

function peerShape(u) {
  if (!u) return { id: '', handle: '', name: 'User', avatar: '', verified: false };
  return {
    id: String(u.id || u._id || ''), handle: u.username || '',
    name: u.fullName || u.username || 'User', avatar: u.avatar || '',
    verified: !!u.emailVerified,
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
  const peer = await User.findOne({ id: pid }).select('id username fullName avatar emailVerified').lean();
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
  return {
    id: m.id, conversationId: m.conversationId,
    text: m.text || '', image: m.image || '',
    edited: !!m.edited, read: !!m.read,
    senderId: String(m.senderId), fromRole: m.fromRole || 'user',
    isMine: String(m.senderId) === String(userId),
    sender: peerShape(s), createdAt: m.createdAt,
  };
}

async function listMessages({ userId, convId, page, limit }) {
  const conv = await loadConv(convId, userId);
  const { page: pg, limit: lim } = paging({ page, limit });
  const [items, total] = await Promise.all([
    Message.find({ conversationId: conv.id }).sort({ createdAt: -1 })
      .skip((pg - 1) * lim).limit(lim).lean(),
    Message.countDocuments({ conversationId: conv.id }),
  ]);
  const byId = await loadUsers([userId, peerOf(conv, userId)]);
  return { items: items.map(m => toMessage(m, byId, userId)), total, page: pg, limit: lim };
}

async function sendMessage({ userId, convId, text, image }) {
  const conv = await loadConv(convId, userId);
  const me = await User.findOne({ id: String(userId) }).select('id username fullName avatar roles').lean();
  const msg = await Message.create({
    conversationId: conv.id, senderId: String(userId),
    fromRole: fromRoleFor(me),
    text: String(text || '').slice(0, 4000),
    image: validateMediaUrl(image, 'image'),
  });
  const peers = (conv.participants || []).map(String).filter(p => p !== String(userId));
  conv.preview = previewLabel(msg.toJSON());
  conv.updatedAt = new Date();
  conv.unreadBy = [...new Set([...(conv.unreadBy || []).map(String), ...peers])];
  await conv.save();
  const byId = { [String(userId)]: me };
  const out = toMessage(msg.toJSON(), byId, userId);
  try {
    const { emitToUser } = require('../socket');
    peers.forEach(p => emitToUser(p, 'message', out));
  } catch (e) { /* socket not initialized (tests/scripts) */ }
  return out;
}

async function markRead({ userId, convId }) {
  const conv = await loadConv(convId, userId);
  await Message.updateMany(
    { conversationId: conv.id, senderId: { $ne: String(userId) }, read: false },
    { read: true },
  );
  conv.unreadBy = (conv.unreadBy || []).map(String).filter(u => u !== String(userId));
  await conv.save();
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
