'use strict';
// services/referrals.service.js — production referral program.
//
// Policy (env-driven, defaults in config/env.js):
//   - Every user owns ONE reusable code: User.referralCode (unique, uppercase).
//   - Inviter-only rewards: +3 coins on invitee signup, +2 when inviteereads
//     >= 30 min total within 7 days of signup. Invitee gets nothing.
//   - Coins go to reader-wallet coinBalance AND bonusBalance (tagged bonus: they
//     read chapters but fund no author share and cannot tip — see
//     wallet.unlockChapter and wallet.sendTip) with a double-entry ledger row
//     kind=referral.
//   - All credits are idempotent (ledger idempotencyKey + signupRewarded/
//     readRewarded flags), safe to retry / double-submit.
const crypto = require('crypto');
const env = require('../config/env');
const { User } = require('../models/user.model');
const { Referral, ReadingProgress, Notification } = require('../models/social.model');
const { Wallet, LedgerEntry } = require('../models/money.model');
const { EditorAssignment } = require('../models/chief.model');
const { userRefFilter } = require('./user-ref');
const ledger = require('./ledger.service');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

// Resolve any id form (public uuid OR legacy _id) to the account's public id —
// notification rows are keyed by `User.id`, so writing an _id here makes the
// row invisible in the recipient's inbox.
async function publicUserId(ref) {
  if (!ref) return '';
  const key = String(ref);
  const q = /^[0-9a-fA-F]{24}$/.test(key) ? { $or: [{ id: key }, { _id: key }] } : { id: key };
  const u = await User.findOne(q).select('id').lean();
  return u ? String(u.id) : '';
}

// "You invited someone and they registered." One row per invitee per inviter.
async function notifyInviteJoined(inviterRef, newUser, editorInvite) {
  const recipientId = await publicUserId(inviterRef);
  if (!recipientId || String(recipientId) === String(newUser && newUser.id)) return;
  try {
    const { notifyActor } = require('./notifications.service');
    await notifyActor({
      recipientId,
      actorId: String(newUser.id),
      type: 'referral_joined',
      title: '{@' + String(newUser.username || '') + '|' + String(newUser.fullName || newUser.username || 'Your invitee') + '} joined using your invite',
      desc: editorInvite
        ? 'A new writer signed up with your editor invite code and is assigned to you.'
        : 'Your referral signed up. You earned coins — 30 more minutes of reading unlocks the bonus.',
      link: editorInvite ? 'senior-editor/invite-authors.html' : 'Pages/refer.html',
      linkLabel: 'See invites',
      key: 'referral:' + String(newUser.id),
    });
  } catch (e) { /* notifications never fail signup */ }
}

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
  const u = await User.findOne(userRefFilter([userId])).select('_id id username referralCode');
  if (!u) { const e = new Error('no_user'); e.status = 404; throw e; }
  if (u.referralCode) return u.referralCode;
  const code = await mintUserCode(u.username);
  try {
    u.referralCode = code;
    await u.save();
  } catch (e) {
    if (e.code === 11000) { // rare race — re-read winner
      const fresh = await User.findOne(userRefFilter([userId])).select('referralCode').lean();
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
  await notifyInviteJoined(inviter.id, newUser, true);
  return { inviterId: String(inviter.id), editor: true };
}

// Credit inviter wallet. Idempotent via ledger duplicate detection.
async function creditInviter({ inviterId, inviteeId, stage, coins }) {
  if (!coins || coins <= 0) return { credited: false };
  // Always resolve to the PUBLIC id before touching money. Wallet rows written
  // under a legacy _id are invisible to every read path (wallet.service reads
  // User.id), so coins credited there can never be spent.
  const ownerPublicId = (await publicUserId(inviterId)) || String(inviterId);
  const key = 'referral:' + stage + ':' + String(inviteeId);
  // One credit per invitee per stage, regardless of which account it targets.
  // The ledger key below always carries the wallet suffix, so two different
  // inviters could otherwise both be paid for the same friend.
  const already = await LedgerEntry.exists({ saleId: key });
  if (already) return { credited: false, duplicate: true };
  const post = await ledger.post({
    legs: [{ debit: 'pool:referral', credit: 'wallet:' + ownerPublicId, amount: 0, coins }],
    saleId: key, kind: 'referral', memo: stage + ' reward for ' + String(inviteeId),
    idempotencyKey: key,
  });
  if (post.duplicate) return { credited: false, duplicate: true };
  await Wallet.updateOne(
    { userId: ownerPublicId, kind: 'reader' },
    // Tagged as bonus: the ledger row above books amount 0, so these coins
    // spend for the reader but pay no author share (wallet.unlockChapter).
    { $inc: { coinBalance: coins, bonusBalance: coins } },
    { upsert: true }
  );
  try {
    await Notification.create({
      recipientId: ownerPublicId, actorId: String(inviteeId),
      type: 'coins', title: '+' + coins + ' referral coins',
      desc: stage === 'stage1' ? 'A friend joined with your link (+3 now, +2 when they read 30 min).' : 'Your referral hit 30 min of reading — bonus unlocked.',
      link: '/Pages/refer.html',
      key: 'referral-coins:' + stage + ':' + String(inviteeId),
    });
  } catch (e) { /* notifications never block rewards */ }
  return { credited: true, coins, inviterId: ownerPublicId };
}

// Called from register()/google signup AFTER the new user is created.
// Returns { inviterId, stage1 } or { inviterId: null } when no/invalid code.
async function applyReferral(newUser, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { inviterId: null };
  const inviter = await User.findOne({ referralCode: code }).select('_id username').lean();
  if (!inviter) return { inviterId: null, invalid: true };
  if (String(inviter._id) === String(newUser._id)) return { inviterId: null, self: true };
  // The inviter's PUBLIC id must be used everywhere: stats/list are queried by
  // req.user.id (the public uuid). Storing the raw _id here made every referral
  // invisible on the refer page even though signup credited the coins.
  const ownerPublicId = await publicUserId(inviter._id);
  const inviteePublicId = await publicUserId(newUser._id);

  // One invitee, one inviter — forever. A second signup (Google after email,
  // a retry, a repair run) must never re-home an existing referral or pay a
  // second account for the same friend. This is exactly how one invitee ended
  // up credited to two accounts and one referrer lost their row.
  const existing = await Referral.findOne({ referredUserId: inviteePublicId })
    .select('ownerId signupRewarded').lean();
  if (existing) {
    // Self-heal a crash between row creation and the credit, but only ever pay
    // the owner already recorded on the row.
    if (!existing.signupRewarded) {
      const r = await creditInviter({
        inviterId: existing.ownerId, inviteeId: inviteePublicId,
        stage: 'stage1', coins: env.referralStage1Coins,
      });
      if (r.credited || r.duplicate) {
        await Referral.updateOne(
          { _id: existing._id, signupRewarded: false },
          { $set: { signupRewarded: true }, $inc: { earnedCoins: r.credited ? env.referralStage1Coins : 0 } }
        );
      }
    }
    return { inviterId: String(existing.ownerId), alreadyAttributed: true, stage1: { credited: false, duplicate: true } };
  }
  // referredByUserId written by an earlier attempt is authoritative even when
  // its Referral row is missing (crash between the two writes).
  if (newUser.referredByUserId) {
    const previousOwner = await publicUserId(newUser.referredByUserId);
    if (previousOwner && previousOwner !== ownerPublicId) {
      return { inviterId: previousOwner, alreadyAttributed: true };
    }
  }

  // Link invitee -> inviter once; never overwrite an existing attribution.
  try {
    await User.updateOne(
      { _id: newUser._id, $or: [{ referredByUserId: null }, { referredByUserId: '' }] },
      { $set: { referredByUserId: String(inviter._id) } }
    );
  } catch (e) { /* non-fatal */ }
  let doc = null;
  try {
    doc = await Referral.create({
      code, ownerId: ownerPublicId,
      referredUserId: inviteePublicId, referredHandle: newUser.username || '',
      status: 'joined', signupRewarded: false, readRewarded: false, earnedCoins: 0,
    });
  } catch (e) {
    if (e.code !== 11000) return { inviterId: ownerPublicId };
    doc = await Referral.findOne({ referredUserId: inviteePublicId });
    if (!doc) return { inviterId: ownerPublicId };
    if (String(doc.ownerId) !== String(ownerPublicId)) {
      return { inviterId: String(doc.ownerId), alreadyAttributed: true };
    }
  }
  if (doc && doc.signupRewarded) return { inviterId: ownerPublicId, stage1: { credited: false, duplicate: true } };
  const r = await creditInviter({
    inviterId: ownerPublicId, inviteeId: inviteePublicId,
    stage: 'stage1', coins: env.referralStage1Coins,
  });
  if (r.credited) {
    await Referral.updateOne(
      { _id: doc._id, signupRewarded: false },
      { $set: { signupRewarded: true }, $inc: { earnedCoins: env.referralStage1Coins } }
    );
  }
  await notifyInviteJoined(inviter._id, newUser, false);
  return { inviterId: ownerPublicId, stage1: r };
}

// Called whenever reading progress is recorded. Credits stage-2 (+2) once the
// invitee totals >= REFERRAL_READ_SECONDS within REFERRAL_WINDOW_DAYS of signup.
async function checkReadReward(inviteeId) {
  const invitee = await User.findOne(userRefFilter([inviteeId])).select('_id id createdAt referredByUserId').lean();
  if (!invitee || !invitee.referredByUserId) return { qualified: false };
  const ageMs = Date.now() - new Date(invitee.createdAt).getTime();
  if (ageMs > env.referralWindowDays * 86400000) return { qualified: false, expired: true };
  // referredByUserId is stored as the inviter's _id; the Referral row is keyed
  // by public ids. Resolve both sides before querying or stage-2 never fires.
  const ownerPublicId = await publicUserId(invitee.referredByUserId);
  const inviteePublicId = String(invitee.id || invitee._id);
  // One row per invitee. If the row belongs to someone else, this attribution
  // is inconsistent — never pay stage-2 from the wrong account.
  const ref = await Referral.findOne({ referredUserId: inviteePublicId });
  if (!ref || ref.readRewarded) return { qualified: false };
  if (String(ref.ownerId) !== String(ownerPublicId)) return { qualified: false, mismatch: true };
  const agg = await ReadingProgress.aggregate([
    { $match: { userId: String(inviteeId) } },
    { $group: { _id: null, secs: { $sum: '$secondsSpent' } } },
  ]);
  const total = (agg[0] && agg[0].secs) || 0;
  if (total < env.referralReadSeconds) return { qualified: false, totalSecs: total };
  const r = await creditInviter({
    inviterId: ownerPublicId, inviteeId: inviteePublicId,
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

// A Referral row may still carry the inviter's legacy _id (older signups).
// Query both forms so those invites do not vanish from stats/list.
async function ownerRefs(ownerId) {
  const key = String(ownerId || '');
  if (!key) return [];
  const u = await User.findOne(userRefFilter([key])).select('id _id').lean();
  return Array.from(new Set([key, u && String(u.id), u && String(u._id)].filter(Boolean)));
}

// Frontend refer.html contracts (also used by super-admin stats elsewhere).
async function getStats(ownerId) {
  const rows = await Referral.find({ ownerId: { $in: await ownerRefs(ownerId) } }).select('status signupRewarded readRewarded earnedCoins referredUserId createdAt').lean();
  const joined = rows.filter(r => r.status === 'joined').length;
  const earned = rows.reduce((s, r) => s + (r.earnedCoins || 0), 0);
  return { invited: rows.length, joined, earned };
}

async function listReferred(ownerId, { limit } = {}) {
  const rows = await Referral.find({ ownerId: { $in: await ownerRefs(ownerId) } }).sort({ createdAt: -1 }).limit(Math.min(100, Math.max(1, limit || 50))).lean();
  const ids = rows.map(r => r.referredUserId).filter(Boolean);
  // ids are now public uuids (legacy rows may hold an old _id) — resolve both.
  const users = ids.length ? await User.find(userRefFilter(ids)).select('id _id username fullName avatar createdAt').lean() : [];
  const m = {};
  users.forEach(u => { m[String(u.id)] = u; m[String(u._id)] = u; });
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
