'use strict';
const crypto = require('crypto');
const rules = require('./earn-rules');
const txn = require('./txn');
const { Wallet, CoinTransaction, EarnClaim, Entitlement, AuthorTransaction, Withdrawal, PaymentMethod, PaymentDispute, CoinPack, CoinBundle, SubscriptionPlan, Subscription, Gift, EarnReward } = require('../models/money.model');
const { PoolBalance, CoinRate, ContractPricing, AdImpression } = require('../models/revenue.model');
const ledger = require('./ledger.service');
const revenue = require('./revenue.service');
const editorEarnings = require('./editor-earnings.service');

async function getOrCreateWallet(userId, kind) {
  let w = await Wallet.findOne({ userId, kind: kind || 'reader' });
  if (!w) w = await Wallet.create({ userId, kind: kind || 'reader' });
  return w;
}

// Reader balance as the client sees it. `coins` is the spendable total (bonus
// included — it unlocks chapters); `paid` is the part that may also tip, so the
// picker can refuse before the server does with bonus_no_tip.
function readerBalance(w) {
  const coins = (w && w.coinBalance) || 0;
  const bonus = Math.max(0, Math.min(coins, (w && w.bonusBalance) || 0));
  return { coins, bonus, paid: coins - bonus };
}

async function bumpPool(pool, amount, session) {
  await PoolBalance.updateOne({ pool }, { $inc: { balance: amount }, $set: { recomputedAt: new Date() } }, { upsert: true, session });
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Naira per unit of the receipt currency: the configured rate wins; with none
// set, the pack's own naira price is used so the purchase books zero surplus
// rather than inventing an exchange rate.
function fxOf(live, cur, gross, basisNGN) {
  const map = (live && live.fx) || {};
  const raw = typeof map.get === 'function' ? map.get(cur) : map[cur];
  const v = Number(raw);
  if (Number.isFinite(v) && v > 0) return v;
  return gross > 0 && basisNGN > 0 ? basisNGN / gross : 1;
}

// Balance without touching anything — reported as the same split the store's
// GET /balance gives, so a write's answer can refresh the card faithfully.
async function balanceOf(userId, session) {
  const w = await Wallet.findOne({ userId: String(userId), kind: 'reader' }).select('coinBalance bonusBalance').session(session).lean();
  return readerBalance(w);
}

// Ownership row. $setOnInsert + the unique triple means re-recording an existing
// unlock is a no-op, so a retry after a half-finished write repairs the row
// instead of opening a second charge.
async function recordEntitlement(session, { userId, bookId, chapterId, priceCoins, kind, journalId }) {
  await Entitlement.updateOne(
    { userId: String(userId), bookId: String(bookId), chapterId: String(chapterId) },
    { $setOnInsert: { userId: String(userId), bookId: String(bookId), chapterId: String(chapterId), kind: kind || 'coin', priceCoins: priceCoins || 0, journalId: journalId || '' } },
    txn.withSession(session, { upsert: true }));
}

// Purchase: credit coins AFTER external verification (caller verifies first).
// The ledger row is the gate, not an after-the-fact report: its unique
// idempotency key decides the winner, so a client /verify and the provider
// webhook for the same transaction cannot both add coins — on a replica set or
// a standalone mongod (ledger.post swallows the duplicate instead of throwing).
//
// Posted in naira. A coin is always worth coins x coinFaceNGN internally, so a
// foreign receipt is converted at the live rate in CoinRate.fx and any amount
// above the internal value is platform surplus; anything below it is a discount
// platform absorbs. The store commission is also charged here, for the channel
// that actually took the money. Result: platform's pool equals the cash it
// really has, and the spend-time split is identical for every channel.
// A purchase credits two kinds of coin. `paidCoins` were bought and may later
// fund the writer/editor/marketing split; `bonusCoins` are promo money that
// leaves the reader's balance but earns nobody anything (see unlockChapter).
// Only the paid part is booked as liability, so the bonus costs the platform
// nothing and no balancing leg is needed.
async function creditPurchase({ userId, coins, paidCoins, bonusCoins, fiatAmount, fiatCurrency, channel, storeRef, packCode, kind, fee, packNgn }) {
  const ch = channel || 'web';
  const cur = String(fiatCurrency || 'NGN').toUpperCase();
  const key = 'purchase:' + (storeRef || (ch + ':' + userId + ':' + Date.now()));
  const gross = Math.round((Number(fiatAmount) || 0) * 100) / 100;
  const cfg = await revenue.activeConfig();
  const storeFee = revenue.storeFeeFor({ gross, fee, channel: ch, cfg });
  const net = Math.round((gross - storeFee) * 100) / 100;

  const total = Number(coins) || 0;
  const paid = paidCoins === undefined ? total : Math.max(0, Number(paidCoins) || 0);
  const bonus = bonusCoins === undefined ? Math.max(0, total - paid) : Math.max(0, Number(bonusCoins) || 0);

  const live = await CoinRate.findOne({ key: 'live' }).lean();
  const faceRate = ((live && live.coinFaceNGN) || 15);
  const coinFace = round2(faceRate * paid);
  const fx = cur === 'NGN' ? 1 : fxOf(live, cur, gross, Number(packNgn) > 0 ? Number(packNgn) : coinFace);
  const grossNGN = round2(gross * fx);
  const feeNGN = round2(storeFee * fx);
  // Subscriptions hold no coin liability; their pool distributes separately.
  const liability = paid > 0 ? coinFace : grossNGN;
  const surplusNGN = round2(grossNGN - liability);

  let fresh = false;
  await txn.run(async (session) => {
    const legs = [{ debit: 'store:' + ch, credit: 'wallet:' + userId, amount: liability, coins: total }];
    // Fee and premium both run through the store clearing account, so its
    // balance always equals the cash the channel will actually settle.
    if (feeNGN > 0) {
      legs.push({ debit: 'pool:platform', credit: 'store:' + ch, amount: feeNGN, coins: 0 });
    }
    if (surplusNGN > 0) {
      legs.push({ debit: 'store:' + ch, credit: 'pool:platform', amount: surplusNGN, coins: 0 });
    } else if (surplusNGN < 0) {
      legs.push({ debit: 'pool:platform', credit: 'store:' + ch, amount: -surplusNGN, coins: 0 });
    }
    const posted = await ledger.post({
      legs,
      saleId: storeRef || null, kind: 'purchase',
      memo: 'pack ' + (packCode || '') + ' via ' + ch + (storeFee ? ' (fee ' + storeFee + ')' : ''),
      idempotencyKey: key, session,
    });
    if (!posted.duplicate) {
      await CoinTransaction.create([{
        userId, type: kind === 'subscription' ? 'subscription' : 'purchase', coins,
        paidCoins: paid, bonusCoins: bonus, fiatAmount: gross,
        fiatCurrency: fiatCurrency || 'NGN', channel: ch,
        storeRef: storeRef || '', status: 'completed',
        feeAmount: storeFee, netAmount: net,
        faceAmount: liability, surplusAmount: surplusNGN,
        note: (kind === 'subscription' ? 'Subscription ' : 'Coin purchase ') + (packCode || '')
          + (bonus > 0 ? ' (+' + bonus + ' bonus)' : ''),
      }], txn.withSession(session));
      await Wallet.updateOne({ userId, kind: 'reader' },
        { $inc: { coinBalance: coins, bonusBalance: bonus } }, txn.withSession(session, { upsert: true }));
      const platformDelta = round2(surplusNGN - feeNGN);
      if (platformDelta !== 0) await bumpPool('platform', platformDelta, session);
      fresh = true;
    }
  });
  const w = await Wallet.findOne({ userId, kind: 'reader' }).lean();
  return {
    coins: (w && w.coinBalance) || 0, duplicate: !fresh,
    fee: storeFee, net, face: liability, surplus: surplusNGN,
  };
}

// Chapter unlock: spend coins at per-chapter price, run waterfall immediately.
async function unlockChapter({ userId, bookId, chapterId, priceCoins, coinFaceNGN }) {
  if (!priceCoins || priceCoins < 0) { const e = new Error('bad_price'); e.status = 400; throw e; }
  const key = 'unlock:' + userId + ':' + bookId + ':' + chapterId;
  return txn.run(async (session) => {
    // Ownership is server truth: a chapter this reader already unlocked is never
    // charged for again, whatever the device has cached or retried.
    const owned = await Entitlement.findOne({
      userId: String(userId), bookId: String(bookId), chapterId: String(chapterId),
    }).session(session).lean();
    if (owned) return { balance: await balanceOf(userId, session), alreadyOwned: true, writerShare: 0 };
    const wallet = await Wallet.findOne({ userId, kind: 'reader' }).session(session);
    if (!wallet || wallet.coinBalance < priceCoins) { const e = new Error('insufficient'); e.status = 402; throw e; }
    // Bonus first: it is the part that owes nobody. The paid remainder is the
    // only money that reaches the writer, editors and marketing pools.
    const bonusDraw = Math.min(Math.max(0, Number(wallet.bonusBalance) || 0), priceCoins);
    const paidDraw = priceCoins - bonusDraw;
    const gross = paidDraw * coinFaceNGN; // fiat-equivalent of the spend
    const cfg = await revenue.activeConfig();
    // The store cut was booked at purchase per channel, so the full face value
    // is distributed here and platform takes the store share.
    const s = revenue.splitSale(gross, cfg);
    const { Book } = require('../models/content.model');
    const { AuthorTransaction } = require('../models/money.model');
    const book = await Book.findOne({ id: bookId }).select('authorId title').session(session).lean();
    const authorId = book ? String(book.authorId) : null;
    const legs = [
      { debit: 'wallet:' + userId, credit: 'pool:sales', amount: gross, coins: priceCoins },
    ];
    if (paidDraw > 0) {
      legs.push(
        { debit: 'pool:sales', credit: 'pool:marketing', amount: s.marketing, coins: 0 },
        { debit: 'pool:sales', credit: 'pool:editors', amount: s.editors, coins: 0 },
        { debit: 'pool:sales', credit: 'wallet:author:' + (authorId || 'unassigned'), amount: s.writer, coins: 0 },
        { debit: 'pool:sales', credit: 'pool:platform', amount: s.platform, coins: 0 },
      );
    }
    // The journal is also the gate: its unique key picks the winner between two
    // racing taps, so the loser leaves no charge behind — with or without a
    // replica set (ledger.post reports the duplicate instead of throwing).
    const posted = await ledger.post({
      legs,
      authorId, saleId: key, kind: 'spend', memo: 'unlock ch ' + chapterId,
      idempotencyKey: key, configVersion: cfg.version, session,
    });
    if (posted.duplicate) {
      // Paid for already, ownership row lost (a crash between the two writes on
      // a standalone mongod): restore it, charge nothing.
      await recordEntitlement(session, { userId, bookId, chapterId, priceCoins, journalId: key });
      return { balance: await balanceOf(userId, session), alreadyOwned: true, writerShare: 0 };
    }
    wallet.coinBalance -= priceCoins;
    wallet.bonusBalance -= bonusDraw;
    await wallet.save({ session });
    if (authorId && s.writer > 0) {
      const [earned] = await AuthorTransaction.create([{
        authorId, type: 'earned', desc: 'Chapter unlock' + (book ? ' — ' + book.title : ''),
        amount: s.writer, bookId, status: 'completed',
      }], txn.withSession(session));
      // Editor commission rides on the same credit; sales fund the editors pool.
      await editorEarnings.accrueSafe({
        authorId, authorTxnId: earned.id, amount: s.writer, kind: 'sale', bookId, session,
      });
      await Wallet.updateOne({ userId: authorId, kind: 'author' },
        { $inc: { fiatAvail: s.writer, lifetimeEarned: s.writer } }, txn.withSession(session, { upsert: true }));
    }
    await bumpPool('marketing', s.marketing, session);
    await bumpPool('editors', s.editors, session);
    await bumpPool('platform', s.platform, session);
    // Reader-facing history row (the ledger is staff-only accounting). The fiat
    // column reports only the paid part, so a bonus-funded unlock reads 0 — the
    // coins still left the balance, and the note says why no author was paid.
    await CoinTransaction.create([{
      userId, type: 'spend', coins: priceCoins, paidCoins: paidDraw, bonusCoins: bonusDraw, fiatAmount: gross,
      note: 'Unlocked chapter' + (book && book.title ? ' — ' + book.title : '')
        + (bonusDraw > 0 ? (paidDraw > 0 ? ' (' + bonusDraw + ' bonus coins)' : ' (bonus coins)') : ''),
    }], txn.withSession(session));
    await recordEntitlement(session, { userId, bookId, chapterId, priceCoins, journalId: posted.journalId || '' });
    return { balance: readerBalance(wallet), writerShare: s.writer };
  });
}

/* Rewarded ad unlock — the video IS the payment, so no coins are minted and no
   waterfall runs. A coin reward here would be a debt with no cash behind it:
   10 coins promise ₦69 of writer/marketing/editor claims, while one rewarded
   view is worth a few naira. What is recorded is the completion, with its book
   and author, so the author can be paid from the ad money when it is known
   (a campaign's rewarded price at completion, or the network's report later).
   The start/claim pair only proves elapsed time — it cannot prove a video
   played; that needs the network's server-to-server reward callback, the same
   gap watch_ad has. */
const AD_UNLOCK_TTL_MS = 30 * 60 * 1000;
const AD_UNLOCK_MIN_MS = 15 * 1000;

function adCode(bookId, chapterId) { return 'ad_unlock:' + bookId + ':' + chapterId; }

async function adTarget(bookId, chapterId) {
  const engagement = require('./engagement.service');
  const ch = await engagement.loadChapter(bookId, chapterId);
  const cid = String(ch.id || chapterId);
  const price = Math.max(0, Math.floor(Number(ch.price) || 0));
  if (price <= 0) { const e = new Error('free_chapter'); e.status = 400; throw e; }
  const terms = await ContractPricing.findOne({ bookId: String(bookId) }).select('allowAdUnlock').lean();
  if (terms && terms.allowAdUnlock === false) { const e = new Error('ad_unlock_disabled'); e.status = 403; throw e; }
  const { Book } = require('../models/content.model');
  const book = await Book.findOne({ id: String(bookId) }).select('authorId title').lean();
  return { chapterId: cid, price, authorId: book ? String(book.authorId) : '', title: (book && book.title) || '' };
}

async function adUnlockStart({ userId, bookId, chapterId }) {
  const t = await adTarget(bookId, chapterId);
  const owned = await Entitlement.findOne({
    userId: String(userId), bookId: String(bookId), chapterId: t.chapterId,
  }).lean();
  if (owned) return { ok: true, alreadyOwned: true, token: null, price: 0, chapterId: t.chapterId };
  const nonce = crypto.randomBytes(16).toString('hex');
  return {
    ok: true, alreadyOwned: false, token: signTask(userId, adCode(bookId, t.chapterId), nonce),
    minWatchSec: Math.round(AD_UNLOCK_MIN_MS / 1000), price: t.price, chapterId: t.chapterId,
  };
}

async function unlockByAd({ userId, bookId, chapterId, token }) {
  const t = await adTarget(bookId, chapterId);
  const tok = readTask(token, userId, adCode(bookId, t.chapterId));
  if (!tok) { const e = new Error('ad_token'); e.status = 400; throw e; }
  const age = Date.now() - Number(tok.i || 0);
  if (age > AD_UNLOCK_TTL_MS) { const e = new Error('ad_expired'); e.status = 400; throw e; }
  if (age < AD_UNLOCK_MIN_MS) {
    const e = new Error('ad_too_soon'); e.status = 425;
    e.retryAfterSec = Math.ceil((AD_UNLOCK_MIN_MS - age) / 1000);
    throw e;
  }
  return txn.run(async (session) => {
    // The unique entitlement row is the gate: two devices claiming the same
    // token cannot both book a completion.
    const owned = await Entitlement.findOne({
      userId: String(userId), bookId: String(bookId), chapterId: t.chapterId,
    }).session(session).lean();
    if (owned) return { ok: true, alreadyOwned: true, price: 0, chapterId: t.chapterId, balance: await balanceOf(userId, session) };
    await recordEntitlement(session, {
      userId, bookId, chapterId: t.chapterId, priceCoins: t.price, kind: 'ad',
    });
    await AdImpression.create([{
      userId: String(userId), bookId: String(bookId), chapterId: t.chapterId,
      authorId: t.authorId, network: 'direct', adUnitId: 'rewarded:overlay',
      kind: 'rewarded_unlock', verified: false, settled: false, completedAt: new Date(),
    }], txn.withSession(session));
    return { ok: true, alreadyOwned: false, price: t.price, chapterId: t.chapterId, balance: await balanceOf(userId, session) };
  });
}

// Tips/gifts: flat writer/platform split of coin face. Coin-only, no cash.
// The journal key is the double-send guard. A client that can hand over a
// requestId (one per open sheet) gets an exact "same request twice" check; one
// that cannot falls back to a 10-second bucket of the same
// (reader, author, gift, amount) — so a slipped double tap stops crediting
// twice instead of silently doing so.
const TIP_DEDUPE_MS = 10 * 1000;
// Author ids are uuidv7 strings, so this sentinel cannot collide with one.
const PLATFORM_TARGET = 'platform';
function tipKey({ fromUserId, authorId, coins, giftCode, requestId }) {
  const stamp = requestId ? String(requestId).slice(0, 60)
    : Math.floor(Date.now() / TIP_DEDUPE_MS) + ':' + coins;
  return 'tip:' + fromUserId + ':' + authorId + ':' + (giftCode || '') + ':' + stamp;
}
async function sendTip({ fromUserId, authorId, coins, giftCode, coinFaceNGN, requestId }) {
  if (!coins || coins < 1) { const e = new Error('bad_amount'); e.status = 400; throw e; }
  const key = tipKey({ fromUserId, authorId, coins, giftCode, requestId });
  return txn.run(async (session) => {
    const wallet = await Wallet.findOne({ userId: fromUserId, kind: 'reader' }).session(session);
    if (!wallet || wallet.coinBalance < coins) { const e = new Error('insufficient'); e.status = 402; throw e; }
    // A tip is a gift of real money, so it is paid from bought coins only.
    // Bonus coins read chapters and nothing else: letting them tip would either
    // credit the author for money that was never collected, or send a gift the
    // reader paid for and the author sees nothing of. Either is worse than
    // telling the reader their bonus doesn't stretch this far.
    const bonusHeld = Math.max(0, Math.min(wallet.coinBalance, Number(wallet.bonusBalance) || 0));
    const paidBalance = wallet.coinBalance - bonusHeld;
    if (paidBalance < coins) { const e = new Error('bonus_no_tip'); e.status = 402; throw e; }
    const face = coins * coinFaceNGN;
    // "Support Droboard": the tip buys nothing, so there is no split — the
    // whole paid face goes to platform revenue and no author leg is written.
    if (authorId === PLATFORM_TARGET) {
      const posted = await ledger.post({
        legs: [{ debit: 'wallet:' + fromUserId, credit: 'pool:platform', amount: face, coins }],
        authorId: null, saleId: key, kind: giftCode ? 'gift' : 'tip',
        memo: (giftCode ? 'gift ' + giftCode : 'support tip') + ' -> platform',
        idempotencyKey: key, session,
      });
      if (posted.duplicate) return { balance: readerBalance(wallet), writerShare: 0, duplicate: true };
      wallet.coinBalance -= coins;
      await wallet.save({ session });
      await bumpPool('platform', face, session);
      await CoinTransaction.create([{
        userId: fromUserId, type: giftCode ? 'gift' : 'tip', target: 'platform',
        coins, paidCoins: coins, bonusCoins: 0, fiatAmount: face,
        note: (giftCode ? 'Gift ' + giftCode : 'Support tip') + ' to Droboard',
      }], txn.withSession(session));
      return { balance: readerBalance(wallet), writerShare: 0 };
    }
    const cfg = await revenue.activeConfig(authorId);
    const s = revenue.splitGift(face, cfg);
    const posted = await ledger.post({
      legs: [
        { debit: 'wallet:' + fromUserId, credit: 'pool:tips', amount: face, coins },
        { debit: 'pool:tips', credit: 'wallet:author:' + authorId, amount: s.writer, coins: 0 },
        { debit: 'pool:tips', credit: 'pool:platform', amount: s.platform, coins: 0 },
      ],
      authorId, saleId: key, kind: giftCode ? 'gift' : 'tip',
      memo: (giftCode ? 'gift ' + giftCode : 'tip'),
      idempotencyKey: key, configVersion: cfg.version, session,
    });
    if (posted.duplicate) return { balance: readerBalance(wallet), writerShare: 0, duplicate: true };
    wallet.coinBalance -= coins;
    await wallet.save({ session });
    await bumpPool('platform', s.platform, session);
    await CoinTransaction.create([{
      userId: fromUserId, type: giftCode ? 'gift' : 'tip', coins, paidCoins: coins, bonusCoins: 0, fiatAmount: face,
      note: (giftCode ? 'Gift ' + giftCode : 'Tip') + ' to author ' + authorId,
    }], txn.withSession(session));
    const [earned] = await AuthorTransaction.create([{
      authorId, type: 'earned', desc: (giftCode ? 'Gift' : 'Tip') + ' from reader',
      amount: s.writer, status: 'completed',
    }], txn.withSession(session));
    // Tips never feed pool:editors, so this commission is funded by the platform.
    await editorEarnings.accrueSafe({
      authorId, authorTxnId: earned.id, amount: s.writer, kind: 'tip', session,
    });
    await Wallet.updateOne({ userId: authorId, kind: 'author' },
      { $inc: { fiatAvail: s.writer, lifetimeEarned: s.writer } }, txn.withSession(session, { upsert: true }));
    return { balance: readerBalance(wallet), writerShare: s.writer }; // tip/gift flow
  });
}

/* Earn tasks ("watch ad", "daily check-in", blog reads…). The client can name a
   reward but never an amount, a destination or a watch time: all of that comes
   from the validated EarnReward row (earn-rules.js). A reward that fails
   validation is not served and cannot be claimed, so "no ad URL ⇒ free coins"
   is closed.
   Tasks that send the reader away must be STARTED first — earnStart issues a
   single-use, timestamped token and earnClaim refuses without it, so coins can
   no longer be minted by POSTing the claim endpoint or by tapping Claim before
   the video finishes. What it still cannot prove is that an ad actually
   played; that needs the ad network's own server-to-server reward callback, and
   the cooldown stays the backstop until one is wired. */
const TOKEN_TTL_MS = 30 * 60 * 1000;
function earnKey() {
  return crypto.createHash('sha256').update('droboard:earn-token:' + require('../config/env').jwtAccessSecret).digest();
}
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) {
  const b = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b, 'base64').toString('utf8');
}
function signTask(userId, code, nonce) {
  const payload = b64url(JSON.stringify({ u: String(userId), c: String(code), n: nonce, i: Date.now() }));
  const sig = b64url(crypto.createHmac('sha256', earnKey()).update('v1.' + payload).digest());
  return 'v1.' + payload + '.' + sig;
}
function readTask(token, userId, code) {
  const p = String(token || '').split('.');
  if (p.length !== 3 || p[0] !== 'v1') return null;
  const want = b64url(crypto.createHmac('sha256', earnKey()).update('v1.' + p[1]).digest());
  if (want.length !== p[2].length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(p[2]))) return null;
  let j;
  try { j = JSON.parse(unb64url(p[1])); } catch (e) { return null; }
  if (!j || String(j.u) !== String(userId) || String(j.c) !== String(code)) return null;
  return j;
}

function earnErr(name, status, extra) {
  const e = new Error(name);
  e.status = status;
  if (extra) Object.assign(e, extra);
  return e;
}

// The reward, as the server is willing to pay for it. Unvalidated rows are
// invisible here, which is what makes the store list and this check agree.
async function loadReward(code) {
  const doc = await EarnReward.findOne({ code: String(code) }).lean();
  if (!doc) return null;
  if (String(doc.status || 'active') !== 'active') return null;
  const shaped = rules.shaped(doc);
  if (!shaped) return null;
  return { doc, shaped, wait: rules.cooldownMs(shaped.cooldown) };
}

// The claim window is opened atomically on the EarnClaim row (unique on
// userId+code), so two taps — or two devices — cannot both get paid, with or
// without a replica set.
async function takeClaimWindow(userId, code, wait, type, coins) {
  const now = new Date();
  const eligibleBefore = new Date(now.getTime() - wait);
  const gate = { userId: String(userId), code: String(code), lastClaimedAt: { $lte: eligibleBefore } };
  const res = await EarnClaim.updateOne(gate, {
    $set: { lastClaimedAt: now, type: type, coins: coins, pending: null },
    $inc: { claimCount: 1 },
  });
  if (res.modifiedCount === 1) return { ok: true };
  const existing = await EarnClaim.findOne({ userId: String(userId), code: String(code) });
  if (existing) {
    const dueAt = new Date(new Date(existing.lastClaimedAt).getTime() + wait);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((dueAt - Date.now()) / 1000)) };
  }
  // First claim for this user + reward: the unique index makes the winner.
  try {
    await EarnClaim.create({ userId: String(userId), code: String(code), type, coins, claimCount: 1, lastClaimedAt: now, pending: null });
    return { ok: true };
  } catch (e) {
    if (e.code === 11000) return { ok: false, retryAfterSec: Math.max(1, Math.ceil(wait / 1000)) };
    throw e;
  }
}

// Step 1: the reader taps a task. Record a single-use challenge so the later
// claim can be tied to THIS start, and tell the client what it must satisfy.
async function earnStart({ userId, code }) {
  const r = await loadReward(code);
  if (!r) throw earnErr('unknown_reward', 404);
  const s = r.shaped;
  if (!s.needsProof) return { ok: true, code: s.code, type: s.type, coins: s.coins, token: null };
  const prior = await EarnClaim.findOne({ userId: String(userId), code: String(code) });
  if (prior && r.wait > 0 && new Date(new Date(prior.lastClaimedAt).getTime() + r.wait) > new Date()) {
    throw earnErr('earn_cooldown', 429, { retryAfterSec: Math.ceil((new Date(new Date(prior.lastClaimedAt).getTime() + r.wait) - Date.now()) / 1000) });
  }
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const pending = {
    h: crypto.createHash('sha256').update(nonce).digest('hex'),
    at: now,
    exp: now + TOKEN_TTL_MS,
  };
  // Starting a task must not burn the cooldown, so a brand-new row is stamped
  // at the epoch and only the claim moves lastClaimedAt.
  await EarnClaim.updateOne(
    { userId: String(userId), code: String(code) },
    { $set: { pending }, $setOnInsert: { lastClaimedAt: new Date(0), claimCount: 0, type: s.type, coins: s.coins } },
    { upsert: true, setDefaultsOnInsert: false });
  return {
    ok: true, code: s.code, type: s.type, coins: s.coins, label: s.label,
    target: s.target, minWatchSec: s.minWatchSec || 0, cooldownSec: s.cooldownSec,
    token: signTask(userId, code, nonce),
  };
}

async function earnClaim({ userId, code, token }) {
  const r = await loadReward(code);
  if (!r) throw earnErr('unknown_reward', 404);
  const s = r.shaped;
  const coins = s.coins;
  if (!coins) throw earnErr('reward_disabled', 400);

  if (s.needsProof) {
    const t = readTask(token, userId, code);
    if (!t) throw earnErr('earn_token', 400);
    const row = await EarnClaim.findOne({ userId: String(userId), code: String(code) });
    const pending = row && row.pending;
    if (!pending || !pending.h) throw earnErr('earn_not_started', 400);
    const h = crypto.createHash('sha256').update(String(t.n)).digest('hex');
    if (h !== String(pending.h)) throw earnErr('earn_token_used', 400);
    const age = Date.now() - Number(pending.at || 0);
    if (Date.now() > Number(pending.exp || 0)) throw earnErr('earn_expired', 400);
    if (s.needsWatch && (s.minWatchSec || 0) > 0 && age < (s.minWatchSec * 1000)) {
      throw earnErr('earn_too_soon', 425, { retryAfterSec: Math.ceil(((s.minWatchSec * 1000) - age) / 1000) });
    }
  }

  const win = await takeClaimWindow(userId, code, r.wait, s.type, coins);
  if (!win.ok) throw earnErr('earn_cooldown', 429, { retryAfterSec: win.retryAfterSec });

  await txn.run(async (session) => {
    await Wallet.updateOne({ userId: String(userId), kind: 'reader' },
      { $inc: { coinBalance: coins, bonusBalance: coins } }, txn.withSession(session, { upsert: true }));
    await CoinTransaction.create([{
      userId: String(userId), type: 'earn', coins, paidCoins: 0, bonusCoins: coins, fiatAmount: 0, channel: 'reward',
      note: (s.action || s.code) + ' (' + s.code + ')',
    }], txn.withSession(session));
  });

  const w = await Wallet.findOne({ userId: String(userId), kind: 'reader' }).lean();
  return { ok: true, coins, reward: { code: s.code, action: s.action, type: s.type }, balance: readerBalance(w), nextInSec: Math.round(r.wait / 1000) };
}

// Reader's own coin history: purchases, subscriptions, gifts/tips, unlocks and
// reward claims, newest first. Feeds the store History tab and lets a report
// name the exact charge it disputes.
async function history({ userId, limit }) {
  const lim = Math.min(200, Math.max(1, Number(limit) || 50));
  const [rows, claims, wallet] = await Promise.all([
    CoinTransaction.find({ userId: String(userId) }).sort({ createdAt: -1 }).limit(lim).lean(),
    EarnClaim.find({ userId: String(userId) }).lean(),
    Wallet.findOne({ userId: String(userId), kind: 'reader' }).select('coinBalance bonusBalance').lean(),
  ]);
  const nextAt = {};
  claims.forEach(c => { nextAt[c.code] = c.lastClaimedAt; });
  const items = rows.map(r => ({
    id: String(r._id || r.id || ''), type: r.type, coins: r.coins, fiatAmount: r.fiatAmount, fiatCurrency: r.fiatCurrency || 'NGN',
    channel: r.channel, note: r.note || '', status: r.status, at: r.createdAt,
  }));
  return {
    balance: readerBalance(wallet),
    items,
    earnNextAt: nextAt,
  };
}

// Reader entitlements: current plan (daily/weekly/monthly/yearly/merge),
// adsFree = any active plan (readers go ad-free),
// adsFreeEverywhere = Merge Pass only (ad-free on every page but Discover).
const PLAN_DAYS = { 'sub-daily': 1, 'sub-weekly': 7, 'sub-monthly': 30, 'sub-yearly': 365, 'sub-merge': 30 };
async function entitlements(userId) {
  const [sub, w] = await Promise.all([
    Subscription.findOne({ userId: String(userId), status: 'active' }).sort({ startedAt: -1 }).lean(),
    Wallet.findOne({ userId: String(userId), kind: 'reader' }).select('coinBalance').lean(),
  ]);
  let expiresAt = null;
  if (sub && PLAN_DAYS[sub.planCode] && sub.startedAt) {
    expiresAt = new Date(new Date(sub.startedAt).getTime() + PLAN_DAYS[sub.planCode] * 86400000).toISOString();
  }
  return {
    plan: sub ? sub.planCode : null,
    status: sub ? sub.status : 'none',
    adsFree: !!sub,
    adsFreeEverywhere: !!sub && sub.planCode === 'sub-merge',
    expiresAt,
    coins: (w && w.coinBalance) || 0,
  };
}

module.exports = { getOrCreateWallet, readerBalance, creditPurchase, unlockChapter, adUnlockStart, unlockByAd, sendTip, earnStart, earnClaim, history, entitlements };
