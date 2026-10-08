'use strict';
// Senior-editor workspace: senior editors are User docs whose roles[] contains
// 'senior_editor'. Users are NEVER created here — every editor must already be
// a registered platform user before they can be invited to any role.
// Quota fields live on EditorAssignment.quota (Mixed); User schema untouched.
const argon2 = require('argon2');
const crypto = require('crypto');
const { User } = require('../models/user.model');
const { EditorInvite, EditorAssignment } = require('../models/chief.model');
const { Follow } = require('../models/social.model');
const { Book } = require('../models/content.model');

// Invite lifetime: 72h from issue, refreshed on every resend.
function inviteExpiry() { return new Date(Date.now() + 72 * 3600 * 1000); }
function isExpired(inv) {
  if (!inv || !inv.expiresAt) return true; // fail closed (incl. legacy docs)
  return new Date(inv.expiresAt).getTime() < Date.now();
}

const QUOTA_KEYS = ['target', 'invited', 'paymentType', 'monthlyPay', 'revenueShare', 'deadline', 'note'];

function hashToken(t) {
  return crypto.createHash('sha256').update(String(t)).digest('hex');
}

function escRx(s) {  return String(s).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pgOf(query) {
  const pg = Math.max(1, parseInt(query.page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(query.pageSize || query.limit, 10) || 20));
  return { pg, lim };
}

function err(code, status) {
  const e = new Error(code); e.status = status; return e;
}

function stripInvite(doc) {
  const o = doc.toJSON ? doc.toJSON() : doc;
  delete o.tokenHash;
  return o;
}

async function followersMap(ids) {
  if (!ids.length) return {};
  const rows = await Follow.aggregate([
    { $match: { followingId: { $in: ids.map(String) } } },
    { $group: { _id: '$followingId', n: { $sum: 1 } } },
  ]);
  const m = {};
  rows.forEach(r => { m[String(r._id)] = r.n; });
  return m;
}

async function assignmentsMap(editorIds) {
  if (!editorIds.length) return {};
  const rows = await EditorAssignment.find({ editorId: { $in: editorIds.map(String) } }).lean();
  const m = {};
  rows.forEach(r => { m[String(r.editorId)] = r; });
  return m;
}

function editorShape(u, extra) {
  extra = extra || {};
  const asg = extra.assignment || null;
  return {
    id: u.id, fullName: u.fullName, name: u.fullName,
    username: u.username, email: u.email, avatar: u.avatar,
    bio: u.bio, country: u.country, roles: u.roles, primaryRole: u.primaryRole,
    status: u.status, createdAt: u.createdAt, updatedAt: u.updatedAt,
    followers: extra.followers || 0,
    assignedAuthors: asg ? (asg.authorIds || []).length : 0,
    quota: (asg && asg.quota) || {},
    assignment: asg,
  };
}

async function listSeniorEditors({ q, status, sort, page, pageSize, limit }) {
  const filter = { roles: 'senior_editor' };
  if (status) filter.status = status;
  if (q) {
    const rx = { $regex: escRx(q), $options: 'i' };
    filter.$or = [{ fullName: rx }, { email: rx }, { username: rx }];
  }
  const { pg, lim } = pgOf({ page, pageSize, limit });
  const users = await User.find(filter).lean();
  const ids = users.map(u => String(u.id));
  const [fmap, amap] = await Promise.all([followersMap(ids), assignmentsMap(ids)]);
  let items = users.map(u => editorShape(u, {
    followers: fmap[String(u.id)] || 0,
    assignment: amap[String(u.id)] || null,
  }));
  const s = sort || 'newest';
  if (s === 'name') items.sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
  else if (s === 'followers') items.sort((a, b) => (b.followers || 0) - (a.followers || 0));
  else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = items.length;
  items = items.slice((pg - 1) * lim, pg * lim);
  // Pending invites are pending editors: surfaced alongside the list.
  let invites = [];
  if (!status || status === 'pending') {
    const iq = { status: 'pending' };
    if (q) {
      const rx = { $regex: escRx(q), $options: 'i' };
      iq.$or = [{ name: rx }, { email: rx }];
    }
    invites = (await EditorInvite.find(iq).sort({ createdAt: -1 }).lean())
      .map(d => Object.assign(stripInvite(d), { kind: 'invite' }));
  }
  return { items, total, page: pg, limit: lim, invites };
}

async function quotas() {
  const [inviteGroups, editorGroups] = await Promise.all([
    EditorInvite.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.aggregate([{ $match: { roles: 'senior_editor' } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const invites = { pending: 0, accepted: 0, cancelled: 0 };
  inviteGroups.forEach(r => { if (invites[r._id] !== undefined) invites[r._id] = r.n; });
  const editors = {};
  let seniorEditors = 0;
  editorGroups.forEach(r => { editors[String(r._id)] = r.n; seniorEditors += r.n; });
  const totalInvites = invites.pending + invites.accepted + invites.cancelled;
  return { invites, editors, total: { seniorEditors, pendingInvites: invites.pending, totalInvites } };
}

async function loadSeniorOr404(id) {
  const u = await User.findOne({id: id}).lean();
  if (!u || !(u.roles || []).includes('senior_editor')) throw err('not_found', 404);
  return u;
}

async function decorate(u) {
  const [fmap, asg] = await Promise.all([
    followersMap([String(u.id)]),
    EditorAssignment.findOne({ editorId: String(u.id) }).lean(),
  ]);
  const [books] = await Promise.all([
    Book.countDocuments({ authorId: String(u.id) }).catch(() => 0),
  ]);
  return Object.assign(editorShape(u, {
    followers: fmap[String(u.id)] || 0,
    assignment: asg || null,
  }), { books });
}

async function getSeniorEditor(id) {
  return decorate(await loadSeniorOr404(id));
}

async function patchSeniorEditor(id, data, actorId) {
  const u = await User.findOne({id: id});
  if (!u || !(u.roles || []).includes('senior_editor')) throw err('not_found', 404);
  if (data.status !== undefined) {
    const allowed = ['active', 'suspended', 'banned', 'pending_verification'];
    if (!allowed.includes(data.status)) throw err('bad_status', 400);
    u.status = data.status;
    await u.save();
  }
  const quota = {};
  QUOTA_KEYS.forEach(k => { if (data[k] !== undefined) quota[k] = data[k]; });
  if (quota.deadline !== undefined && quota.deadline !== null && quota.deadline !== '') {
    const d = new Date(quota.deadline);
    if (isNaN(d.getTime())) throw err('bad_deadline', 400);
    quota.deadline = d;
  }
  if (Object.keys(quota).length) {
    await EditorAssignment.findOneAndUpdate(
      { editorId: String(u.id) },
      { $set: Object.assign({ updatedBy: actorId || null },
        ...Object.keys(quota).map(k => ({ ['quota.' + k]: quota[k] }))) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return decorate(await loadSeniorOr404(id));
}

function parseDeadline(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw err('bad_deadline', 400);
  return d;
}

async function createInvite(data, invitedBy) {
  const email = String(data.email || '').toLowerCase().trim();
  if (!email) throw err('bad_email', 400);
  // FIX 9: invites work for new emails too — no not_registered 404.
  // If the email is already registered we link the invite; otherwise the
  // invitee registers during accept (token proves email ownership).
  const holder = await User.findOne({ email }).select('id').lean();
  const dupe = await EditorInvite.findOne({ email, status: 'pending' }).lean();
  if (dupe && !isExpired(dupe)) throw err('invite_pending', 409);
  if (dupe) await EditorInvite.deleteOne({ id: dupe.id }); // expired stub never reused
  const token = crypto.randomBytes(24).toString('hex');
  const doc = await EditorInvite.create({
    name: data.name, email,
    target: data.target !== undefined ? data.target : 0,
    paymentType: data.paymentType || '',
    monthlyPay: data.monthlyPay !== undefined ? data.monthlyPay : 0,
    revenueShare: data.revenueShare !== undefined ? data.revenueShare : 0,
    deadline: parseDeadline(data.deadline),
    note: data.note || '',
    status: 'pending',
    tokenHash: hashToken(token),
    expiresAt: inviteExpiry(),
    invitedBy: invitedBy || null,
  });
  // Deliver the invite email (fire-and-forget — invite stays valid if mail fails).
  try {
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    const link = base + '/public/senior-editor/accept-invite.html?token=' + token;
    const mail = require('./mail.service');
    mail.sendMail({
      to: email,
      subject: 'You’re invited as a Droboard Senior Editor',
      html: '<p>Hi ' + escapeHtml(data.name || '') + ',</p>'
        + '<p>You have been invited to join Droboard as a <b>Senior Editor</b>. Accept within <b>72 hours</b>:</p>'
        + '<p><a href="' + link + '">Accept invite</a></p>'
        + '<p>If the button doesn’t work, paste this link into your browser:<br>' + link + '</p>',
    }).catch(() => {});
  } catch (e) {}
  return Object.assign(stripInvite(doc), { token, isNew: !holder }); // token returned ONCE
}

async function listInvites({ status, page, pageSize, limit }) {
  const filter = {};
  if (status) filter.status = status;
  const { pg, lim } = pgOf({ page, pageSize, limit });
  const [rows, total] = await Promise.all([
    EditorInvite.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    EditorInvite.countDocuments(filter),
  ]);
  return { items: rows.map(d => stripInvite(d)), total, page: pg, limit: lim };
}

async function patchInvite(id, data) {
  const inv = await EditorInvite.findOne({id: id});
  if (!inv) throw err('not_found', 404);
  if (inv.status !== 'pending') throw err('not_pending', 409);
  ['name', 'target', 'paymentType', 'monthlyPay', 'revenueShare', 'note'].forEach(k => {
    if (data[k] !== undefined) inv[k] = data[k];
  });
  if (data.deadline !== undefined) inv.deadline = parseDeadline(data.deadline);
  await inv.save();
  return stripInvite(inv);
}

async function resendInvite(id) {
  const inv = await EditorInvite.findOne({id: id});
  if (!inv) throw err('not_found', 404);
  if (inv.status !== 'pending') throw err('not_pending', 409);
  const token = crypto.randomBytes(24).toString('hex');
  inv.tokenHash = hashToken(token);
  inv.expiresAt = inviteExpiry(); // resend restarts the 72h window
  await inv.save();
  return Object.assign(stripInvite(inv), { token }); // rotated token returned ONCE
}

async function cancelInvite(id) {
  const inv = await EditorInvite.findOne({id: id});
  if (!inv) throw err('not_found', 404);
  if (inv.status !== 'pending') throw err('not_pending', 409);
  inv.status = 'cancelled';
  await inv.save();
  return { ok: true };
}

async function getByToken(token) {
  const inv = await EditorInvite.findOne({ tokenHash: hashToken(token), status: 'pending' }).lean();
  if (!inv) throw err('bad_token', 404);
  if (isExpired(inv)) throw err('expired', 410);
  const o = stripInvite(inv);
  return {
    name: o.name, email: o.email, target: o.target, paymentType: o.paymentType,
    monthlyPay: o.monthlyPay, revenueShare: o.revenueShare,
    deadline: o.deadline, note: o.note, status: o.status,
    expiresAt: inv.expiresAt,
  };
}

async function acceptInvite({ token, password, username, fullName }) {
  const inv = await EditorInvite.findOne({ tokenHash: hashToken(token), status: 'pending' });
  if (!inv) throw err('bad_token', 400);
  if (isExpired(inv)) throw err('expired', 410);
  // Existing account: prove ownership with password, then grant role.
  let user = await User.findOne({ email: String(inv.email).toLowerCase() }).select('+passwordHash');
  if (user) {
    let ok = false;
    try { ok = await argon2.verify(String(user.passwordHash || ''), String(password || '')); }
    catch (e) { ok = false; }
    if (!ok) throw err('bad_credentials', 401);
    if (!(user.roles || []).includes('senior_editor')) {
      user.roles = Array.from(new Set((user.roles || []).concat(['senior_editor'])));
      if (!user.primaryRole || user.primaryRole === 'reader') user.primaryRole = 'senior_editor';
      await user.save();
    }
  } else {
    // FIX 9: new email — register inline. Token proves email ownership.
    if (!password || String(password).length < 8) throw err('bad_password', 400);
    const uname = String(username || String(inv.email).split('@')[0] || '')
      .toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    if (!/^[a-z][a-z0-9_]{2,19}$/.test(uname)) throw err('bad_username', 400);
    if (await User.exists({ username: uname })) throw err('username_taken', 409);
    if (await User.exists({ email: String(inv.email).toLowerCase() })) throw err('email_taken', 409);
    const name = String(fullName || inv.name || uname).trim().slice(0, 80);
    if (name.length < 2) throw err('bad_fullName', 400);
    const passwordHash = await argon2.hash(String(password), { type: argon2.argon2id });
    user = await User.create({
      fullName: name, username: uname, email: String(inv.email).toLowerCase(),
      emailVerified: true, emailVerifiedAt: new Date(),
      passwordHash, authProvider: 'local',
      roles: ['senior_editor', 'reader'], primaryRole: 'senior_editor', status: 'active',
      referralCode: uname.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(),
    });
  }
  inv.status = 'accepted';
  inv.tokenHash = undefined;
  inv.expiresAt = undefined;
  await inv.save();
  return { id: user.id, username: user.username, email: user.email, fullName: user.fullName, roles: user.roles };
}

async function listAuthors({ q, page, pageSize, limit }) {
  // NOTE: User has no genre field, so `genre` is accepted and ignored.
  const filter = { roles: 'writer' };
  if (q) {
    const rx = { $regex: escRx(q), $options: 'i' };
    filter.$or = [{ fullName: rx }, { email: rx }, { username: rx }];
  }
  const { pg, lim } = pgOf({ page, pageSize, limit });
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    User.countDocuments(filter),
  ]);
  const ids = rows.map(u => String(u.id));
  const [fmap] = await Promise.all([followersMap(ids)]);
  const items = await Promise.all(rows.map(async u => ({
    id: u.id, fullName: u.fullName, name: u.fullName, username: u.username,
    email: u.email, avatar: u.avatar, bio: u.bio, country: u.country,
    roles: u.roles, primaryRole: u.primaryRole, status: u.status,
    followers: fmap[String(u.id)] || 0,
    books: await Book.countDocuments({ authorId: String(u.id) }).catch(() => 0),
    createdAt: u.createdAt,
  })));
  return { items, total, page: pg, limit: lim };
}

async function getAssignments() {
  const rows = await EditorAssignment.find({}).sort({ updatedAt: -1 }).lean();
  return rows.map(r => Object.assign({}, r, { id: r.id }));
}

async function saveAssignments(editorId, { authorIds }, updatedBy) {
  await loadSeniorOr404(editorId); // editor must be a senior_editor
  const list = Array.from(new Set((authorIds || []).map(String)));
  if (list.length > 100) throw err('too_many', 400);
  if (list.length) {
    const n = await User.countDocuments({ id: { $in: list }, roles: 'writer' });
    if (n !== list.length) throw err('bad_author', 400);
  }
  const doc = await EditorAssignment.findOneAndUpdate(
    { editorId: String(editorId) },
    { $set: { authorIds: list, updatedBy: updatedBy || null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.toJSON();
}

module.exports = {
  listSeniorEditors, quotas, getSeniorEditor, patchSeniorEditor,
  createInvite, listInvites, patchInvite, resendInvite, cancelInvite,
  getByToken, acceptInvite, listAuthors, getAssignments, saveAssignments,
};
