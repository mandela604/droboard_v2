'use strict';
// services/referrals.service.js — production referral program.
//
// Policy (env-driven, defaults in config/env.js):
//   - Every user owns ONE reusable code: User.referralCode (unique, uppercase).
//   - Inviter-only rewards: +3 coins on invitee signup, +2 when inviteereads
//     >= 30 min total within 7 days of signup. Invitee gets nothing.
//   - Coins go to reader-wallet coinBalance (spendable — bonusBalance has no
//     spend path/expiry job yet) with a double-entry ledger row kind=referral.
//   - All credits are idempotent (ledger idempotencyKey + signupRewarded/
//     readRewarded flags), safe to retry / double-submit.
const crypto = require('crypto');
const env = require('../config/env');
const { User } = require('../models/user.model');
const { Referral, ReadingProgress } = require('../models/social.model');
const { Wallet } = require('../models/money.model');
const { EditorAssignment } = require('../models/chief.model');
const ledger = require('./ledger.service');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomSuffix(n) {
  let s = '';
  const buf = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return s;
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
}

// Generate a fresh per-user code: PREFIX(<=6 from username)-XXXX. Retries on collision.
async function mintUserCode(username) {
  const prefix = String(username || 'DRO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DRO';
  for (let i = 0; i < 5; i++) {
    const code = prefix + '-' + randomSuffix(4);
    const clash = await User.exists({ referralCode: code });
    if (!clash) return code;
  }
  return prefix + '-' + randomSuffix(6);
}

async function ensureCode(userId) {
  const u = await User.findById(userId).select('_id username referralCode');
  if (!u) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (u.referralCode) return u.referralCode;
  const code = await mintUserCode(u.username);
  try {
    u.referralCode = code;
    await u.save();
  } catch (e) {
    if (e.code === 11000) { // rare race — re-read winner
      const fresh = await User.findById(userId).select('referralCode').lean();
      return fresh.referralCode;
    }
    throw e;
  }
  return code;
}

// ── Editor-invite codes (senior_editor only) ──────────────────────────────
// Deliberately a DIFFERENT field from User.referralCode: that one is the
// reader/coin program (anyone can hold one); this one is author recruitment
// by a senior editor and grants the writer role on signup.
// No Referral doc + no coins here — the reward is the author, not wallet coins.

async function mintEditorCode() {
  for (let i = 0; i < 6; i++) {
    const code = 'SE-' + randomSuffix(6);
    const clash = await User.exists({ editorInviteCode: code });
    if (!clash) return code;
  }
  return 'SE-' + randomSuffix(8);
}

// Lazily mint (and persist) the code for a senior_editor. Idempotent.
async function ensureEditorCode(userId) {
  const u = await User.findOne({ id: String(userId) }).select('id username roles editorInviteCode');
  if (!u) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (!(u.roles || []).includes('senior_editor')) {
    const e = new Error('forbidden'); e.status = 403; throw e;
  }
  if (u.editorInviteCode) return u.editorInviteCode;
  const code = await mintEditorCode();
  try {
    u.editorInviteCode = code;
    await u.save();
  } catch (e) {
    if (e.code === 11000) {
      const fresh = await User.findOne({ id: String(userId) }).select('editorInviteCode').lean();
      return fresh.editorInviteCode;
    }
    throw e;
  }
  return code;
}

async function rotateEditorCode(userId) {
  const u = await User.findOne({ id: String(userId) }).select('id roles');
  if (!u) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (!(u.roles || []).includes('senior_editor')) {
    const e = new Error('forbidden'); e.status = 403; throw e;
  }
  const code = await mintEditorCode();
  await User.updateOne({ id: String(userId) }, { $set: { editorInviteCode: code } });
  return code;
}

// Called from register() when the signup carries a referral code. Returns
// { inviterId, editor: true } only when the code resolves to a senior_editor's
// editorInviteCode. Invalid/reader codes fall through to applyReferral().
async function applyEditorInvite(newUser, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { inviterId: null };
  const inviter = await User.findOne({ editorInviteCode: code })
    .select('id _id roles').lean();
  if (!inviter) return { inviterId: null };
  if (!(inviter.roles || []).includes('senior_editor')) return { inviterId: null };
  if (String(inviter.id) === String(newUser.id)) return { inviterId: null, self: true };
  // Provenance (same field/shape the reader referral uses — no coin path runs
  // for editor invites, so checkReadReward stays inert on these accounts).
  try {
    await User.updateOne({ _id: newUser._id }, { $set: { referredByUserId: String(inviter._id) } });
  } catch (e) { /* non-fatal: never fail signup */ }
  // Ownership. authorIds hold the custom `id` (uuidv7) — same space as
  // EditorAssignment written by chief-editors.saveAssignments + Book.authorId.
  try {
    await EditorAssignment.updateOne(
      { editorId: String(inviter.id) },
      { $addToSet: { authorIds: String(newUser.id) }, $setOnInsert: { quota: {} } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (e) { /* non-fatal: chief can still assign manually */ }
  return { inviterId: String(inviter.id), editor: true };
}

// Credit inviter wallet. Idempotent via ledger duplicate detection.
async function creditInviter({ inviterId, inviteeId, stage, coins }) {
  if (!coins || coins <= 0) return { credited: false };
  const key = 'referral:' + stage + ':' + String(inviteeId);
  const post = await ledger.post({
    legs: [{ debit: 'pool:referral', credit: 'wallet:' + String(inviterId), amount: 0, coins }],
    saleId: key, kind: 'referral', memo: stage + ' reward for ' + String(inviteeId),
    idempotencyKey: key,
  });
  if (post.duplicate) return { credited: false, duplicate: true };
  await Wallet.updateOne(
    { userId: String(inviterId), kind: 'reader' },
    { $inc: { coinBalance: coins } },
    { upsert: true }
  );
  try {
    const { Notification } = require('../models/social.model');
    await Notification.create({
      recipientId: String(inviterId), actorId: String(inviteeId),
      type: 'coins', title: '+' + coins + ' referral coins',
      desc: stage === 'stage1' ? 'A friend joined with your link (+3 now, +2 when they read 30 min).' : 'Your referral hit 30 min of reading — bonus unlocked.',
      link: 'refer.html',
    });
  } catch (e) { /* notifications never block rewards */ }
  return { credited: true, coins };
}

// Called from register()/google signup AFTER the new user is created.
// Returns { inviterId, stage1 } or { inviterId: null } when no/invalid code.
async function applyReferral(newUser, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { inviterId: null };
  const inviter = await User.findOne({ referralCode: code }).select('_id username').lean();
  if (!inviter) return { inviterId: null, invalid: true };
  if (String(inviter._id) === String(newUser._id)) return { inviterId: null, self: true };
  // Link invitee -> inviter (best-effort; never fails signup)
  try {
    await User.updateOne({ _id: newUser._id }, { $set: { referredByUserId: String(inviter._id) } });
  } catch (e) { /* non-fatal */ }
  let doc = null;
  try {
    doc = await Referral.create({
      code, ownerId: String(inviter._id),
      referredUserId: String(newUser._id), referredHandle: newUser.username || '',
      status: 'joined', signupRewarded: false, readRewarded: false, earnedCoins: 0,
    });
  } catch (e) {
    if (e.code !== 11000) return { inviterId: String(inviter._id) };
    doc = await Referral.findOne({ ownerId: String(inviter._id), referredUserId: String(newUser._id) });
    if (!doc) return { inviterId: String(inviter._id) };
  }
  if (doc && doc.signupRewarded) return { inviterId: String(inviter._id), stage1: { credited: false, duplicate: true } };
  const r = await creditInviter({
    inviterId: String(inviter._id), inviteeId: String(newUser._id),
    stage: 'stage1', coins: env.referralStage1Coins,
  });
  if (r.credited) {
    await Referral.updateOne(
      { _id: doc._id, signupRewarded: false },
      { $set: { signupRewarded: true }, $inc: { earnedCoins: env.referralStage1Coins } }
    );
  }
  return { inviterId: String(inviter._id), stage1: r };
}

// Called whenever reading progress is recorded. Credits stage-2 (+2) once the
// invitee totals >= REFERRAL_READ_SECONDS within REFERRAL_WINDOW_DAYS of signup.
async function checkReadReward(inviteeId) {
  const invitee = await User.findById(inviteeId).select('_id createdAt referredByUserId').lean();
  if (!invitee || !invitee.referredByUserId) return { qualified: false };
  const ageMs = Date.now() - new Date(invitee.createdAt).getTime();
  if (ageMs > env.referralWindowDays * 86400000) return { qualified: false, expired: true };
  const ref = await Referral.findOne({ ownerId: String(invitee.referredByUserId), referredUserId: String(inviteeId) });
  if (!ref || ref.readRewarded) return { qualified: false };
  const agg = await ReadingProgress.aggregate([
    { $match: { userId: String(inviteeId) } },
    { $group: { _id: null, secs: { $sum: '$secondsSpent' } } },
  ]);
  const total = (agg[0] && agg[0].secs) || 0;
  if (total < env.referralReadSeconds) return { qualified: false, totalSecs: total };
  const r = await creditInviter({
    inviterId: String(invitee.referredByUserId), inviteeId: String(inviteeId),
    stage: 'stage2', coins: env.referralStage2Coins,
  });
  if (r.credited) {
    await Referral.updateOne(
      { _id: ref._id, readRewarded: false },
      { $set: { readRewarded: true }, $inc: { earnedCoins: env.referralStage2Coins } }
    );
  }
  return { qualified: true, totalSecs: total, stage2: r };
}

// Frontend refer.html contracts (also used by super-admin stats elsewhere).
async function getStats(ownerId) {
  const rows = await Referral.find({ ownerId: String(ownerId) }).select('status signupRewarded readRewarded earnedCoins referredUserId createdAt').lean();
  const joined = rows.filter(r => r.status === 'joined').length;
  const earned = rows.reduce((s, r) => s + (r.earnedCoins || 0), 0);
  return { invited: rows.length, joined, earned };
}

async function listReferred(ownerId, { limit } = {}) {
  const rows = await Referral.find({ ownerId: String(ownerId) }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, limit || 50))).lean();
  const ids = rows.map(r => r.referredUserId).filter(Boolean);
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select('username fullName avatar createdAt').lean() : [];
  const m = {};
  users.forEach(u => { m[String(u._id)] = u; });
  return rows.map(r => {
    const u = m[String(r.referredUserId)] || {};
    return {
      name: u.fullName || r.referredHandle || '', handle: u.username || r.referredHandle || '',
      avatar: u.avatar || '', when: r.createdAt || null,
      status: r.status === 'joined' ? 'joined' : 'invited',
      earned: r.earnedCoins || 0, readRewarded: !!r.readRewarded,
    };
  });
}

module.exports = {
  mintUserCode, ensureCode, normalizeCode, applyReferral, checkReadReward, getStats, listReferred, creditInviter,
  mintEditorCode, ensureEditorCode, rotateEditorCode, applyEditorInvite,
};
