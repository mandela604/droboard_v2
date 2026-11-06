'use strict'
// Live coin-ledger test for the super-admin console: boots the real Express app on
// an in-memory MongoDB, seeds one reader whose coin history is deliberately awkward
// (two currencies, granted coins mixed with bought ones, a refunded row), sends one
// real tip over HTTP so the write path is proven too, then reads the four surfaces
// that display coin spend and asserts every number is in COINS — with money kept
// separate as funding.
//
// The bug this locks out: `coinsSpent` used to be `$sum: fiatAmount` over every
// completed row, so a top-up and spending that same money both counted as spend,
// and a $5 pack added its 5 to a ₦1,500 pack's 1500.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime (mongod.exe aborts 0xC0000135
// without it). See scripts/smoke-staff-live.cjs for the same lock pass on CE/SE.
process.env.NODE_ENV = 'test';
process.env.PORT = '4181';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4181;
const BASE = 'http://127.0.0.1:' + PORT;
const SA = '/api/super-admin';
const W = '/api/wallet';
const OUT = require('path').join(__dirname, 'smoke-superadmin-coins.results.txt');

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  const line = `\n===== ${passed}/${results.length} live coin-ledger assertions passed =====`;
  say(line);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) { /* stdout already has it */ }
  // server.js holds the listen socket open: exit hard or the port squats and
  // every later run on this box dies with EADDRINUSE.
  process.exit(passed === results.length ? 0 : 1);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_coins_lock');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  // Boot ends with ensureIdIndexes(), so listen lands later than a fixed sleep
  // assumed — wait for /health instead of guessing.
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { CoinTransaction, Wallet } = require('../src/models/money.model');
  const { CoinRate } = require('../src/models/revenue.model');
  const { ReadingProgress } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');

  // No argon2 anywhere in this run: the hash is a dummy because every call here
  // authenticates with a signed JWT, and argon2 intermittently OOMs this box.
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const mk = async (role, extra) => User.create(Object.assign({
    fullName: 'Lock ' + role, email: `${role}${Date.now()}${Math.random()}@t.co`,
    username: role + Date.now() + Math.random(), passwordHash: DUMMY,
    status: 'active', roles: [role],
  }, extra || {}));

  const admin = await mk('admin');
  const reader = await mk('writer', { roles: ['reader', 'writer'] });
  const author = await mk('writer');
  const book = await Book.create({ title: 'Locked Coin Test', authorId: String(author.id), status: 'published' });
  await Chapter.create({ bookId: String(book.id), n: 1, title: 'Ch 1', price: 60, status: 'live' });

  const tok = (u) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + signAccess(u) });
  async function call(u, method, path, body) {
    const init = { method, headers: tok(u) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(BASE + path, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  /* ── the money side: one naira pack, one dollar pack, one reward grant ── */
  // The scheduler seeds CoinRate{key:'live'} from the FX feed on boot, so this
  // must overwrite that doc — a second create() hits the key_1 unique index.
  await CoinRate.findOneAndUpdate({ key: 'live' }, {
    $set: { key: 'live', coinFaceNGN: 15, fx: { USD: 1600, GBP: 2000 } },
  }, { upsert: true });
  const uid = String(reader.id);
  await CoinTransaction.create([
    // 100 coins bought for ₦1,500 — all of it cash behind it.
    { userId: uid, type: 'purchase', coins: 100, paidCoins: 100, bonusCoins: 0,
      fiatAmount: 1500, fiatCurrency: 'NGN', channel: 'paystack',
      feeAmount: 0, netAmount: 1500, faceAmount: 1500, surplusAmount: 0, status: 'completed' },
    // 200 coins bought for $5: the naira value is 3,000 face + 400 premium.
    { userId: uid, type: 'purchase', coins: 200, paidCoins: 200, bonusCoins: 0,
      fiatAmount: 5, fiatCurrency: 'USD', channel: 'play',
      feeAmount: 1.5, netAmount: 3.5, faceAmount: 3000, surplusAmount: 400, status: 'completed' },
    // 25 granted coins: money in = 0, and they can read but never tip.
    { userId: uid, type: 'earn', coins: 25, paidCoins: 0, bonusCoins: 25,
      fiatAmount: 0, channel: 'reward', status: 'completed' },
    // 60 coins out on a chapter, 20 of them granted.
    { userId: uid, type: 'spend', coins: 60, paidCoins: 40, bonusCoins: 20,
      fiatAmount: 600, status: 'completed', note: 'Unlocked chapter' },
    // 30 + 100 coins out to authors, all cash-backed.
    { userId: uid, type: 'tip', coins: 30, paidCoins: 30, bonusCoins: 0,
      fiatAmount: 450, status: 'completed' },
    { userId: uid, type: 'gift', coins: 100, paidCoins: 100, bonusCoins: 0,
      fiatAmount: 1500, status: 'completed' },
    // A refunded purchase must not count anywhere.
    { userId: uid, type: 'purchase', coins: 9999, paidCoins: 9999, bonusCoins: 0,
      fiatAmount: 99999, fiatCurrency: 'NGN', faceAmount: 99999, status: 'refunded' },
  ]);
  await Wallet.create({ userId: uid, kind: 'reader', coinBalance: 500, bonusBalance: 0 });
  await Wallet.create({ userId: String(author.id), kind: 'author', fiatAvail: 0, lifetimeEarned: 777000 });
  await ReadingProgress.create({ userId: uid, storyId: String(book.id), wordsRead: 12000, lastReadAt: new Date() });

  /* ── the write path: a real tip must stamp paid/bonus coins ── */
  const tipRes = await call(reader, 'POST', `${W}/tip`, { authorId: String(author.id), coins: 50, requestId: 'lock-tip-1' });
  check('POST /api/wallet/tip -> 200', tipRes.status === 200, `status=${tipRes.status} ${JSON.stringify(tipRes.json).slice(0, 200)}`);
  const tipRow = await CoinTransaction.findOne({ userId: uid, type: 'tip', coins: 50 }).lean();
  check('tip row stamps paidCoins = 50, bonusCoins = 0',
    !!tipRow && tipRow.paidCoins === 50 && tipRow.bonusCoins === 0,
    JSON.stringify(tipRow && { coins: tipRow.coins, p: tipRow.paidCoins, b: tipRow.bonusCoins, fiat: tipRow.fiatAmount }));

  // Expected, the eight seeded rows plus the live tip:
  const EXP = {
    coinsSpent: 60 + 30 + 100 + 50, readCoins: 60, tipsCoins: 30 + 100 + 50,
    bonusCoinsSpent: 20, coinsBought: 100 + 200, earnCoins: 25, fundedNGN: 1500 + 3400,
  };

  /* ── 1. the users list ── */
  let r = await call(admin, 'GET', `${SA}/users?q=${encodeURIComponent(reader.username)}&limit=10`);
  check('GET /super-admin/users -> 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const row = (r.json.items || []).find(x => x.id === uid);
  check('users row exists', !!row, JSON.stringify((r.json.items || []).map(x => x.id)));
  check('coinsSpent is coins, not naira', row && row.coinsSpent === EXP.coinsSpent,
    `got=${row && row.coinsSpent} want=${EXP.coinsSpent}`);
  check('spend is NOT the old fiat sum', !row || row.coinsSpent !== 1500 + 5 + 0 + 600 + 450 + 1500 + 450,
    `old formula would say ${1500 + 5 + 0 + 600 + 450 + 1500 + 450}`);
  check('readCoins counts chapter unlocks only', row && row.readCoins === EXP.readCoins, `got=${row && row.readCoins}`);
  check('tipsCoins counts tips + gifts', row && row.tipsCoins === EXP.tipsCoins, `got=${row && row.tipsCoins}`);
  check('bonusCoinsSpent isolates granted coins', row && row.bonusCoinsSpent === EXP.bonusCoinsSpent, `got=${row && row.bonusCoinsSpent}`);
  check('coinsBought counts the two packs, refunds excluded', row && row.coinsBought === EXP.coinsBought, `got=${row && row.coinsBought}`);
  check('earnCoins reports the reward grant', row && row.earnCoins === EXP.earnCoins, `got=${row && row.earnCoins}`);
  check('fundedNGN converts the USD pack to naira', row && row.fundedNGN === EXP.fundedNGN,
    `got=${row && row.fundedNGN} want=${EXP.fundedNGN} (1500 NGN + 3000 face + 400 premium)`);

  // Same endpoint, one row with a real stat behind it. userStatsMap used to hand
  // the keys array to a (rows, keys) function, so the first user list that wasn't
  // empty died with a 500 — the empty dev DB never showed it.
  r = await call(admin, 'GET', `${SA}/users?limit=50`);
  const all = (r.json.items || []);
  const authorRow = all.find(x => x.id === String(author.id));
  check('users list survives stat rows', r.status === 200 && all.length === 3,
    `status=${r.status} rows=${all.length}`);
  check('author row carries its book count', !!authorRow && authorRow.stories === 1,
    `stories=${authorRow && authorRow.stories}`);
  check('author row keeps lifetimeEarned as payout', !!authorRow && authorRow.payout === 777000 + 225,
    // 225 = the writer share the live tip above credited (50 coins x 15 face / 2)
    `payout=${authorRow && authorRow.payout}`);
  check('author with no coin history reads zeros', !!authorRow &&
    authorRow.coinsSpent === 0 && authorRow.coinsBought === 0 && authorRow.fundedNGN === 0,
    JSON.stringify(authorRow && { s: authorRow.coinsSpent, b: authorRow.coinsBought, f: authorRow.fundedNGN }));
  // The fiat half of the same act: the reader sent coins, the author holds naira.
  check('author tipsReceivedNGN comes off the ledger tip leg',
    !!authorRow && authorRow.tipsReceivedNGN === tipRes.json.writerShare,
    `got=${authorRow && authorRow.tipsReceivedNGN} share=${tipRes.json && tipRes.json.writerShare}`);
  check('a reader has no tips-received money', !!row && row.tipsReceivedNGN === 0,
    `reader tipsReceivedNGN=${row && row.tipsReceivedNGN}`);

  /* ── 2. the single-user insight ── */
  r = await call(admin, 'GET', `${SA}/users/${uid}`);
  const one = r.json || {};
  check('GET /users/:id -> 200', r.status === 200, `status=${r.status}`);
  check('detail page agrees with the list',
    one.coinsSpent === EXP.coinsSpent && one.tipsCoins === EXP.tipsCoins && one.fundedNGN === EXP.fundedNGN,
    JSON.stringify({ s: one.coinsSpent, t: one.tipsCoins, f: one.fundedNGN }));
  check('tipsAmount key is gone (tipsCoins replaced it)', one.tipsAmount === undefined, `tipsAmount=${one.tipsAmount}`);

  /* ── 3. insights overview: money grid + funding ── */
  r = await call(admin, 'GET', `${SA}/insights/overview`);
  check('GET /insights/overview -> 200', r.status === 200, `status=${r.status}`);
  const iu = ((r.json || {}).users || []).find(x => x.id === uid);
  check('overview users carry coins, not naira', !!iu && iu.coinsSpent === EXP.coinsSpent, JSON.stringify(iu && { s: iu.coinsSpent, b: iu.coinsBought }));
  const exRow = ((r.json || {}).ex || []).find(x => x.u === uid);
  check('funded = cash the reader paid in', !!exRow && exRow.x.funded === EXP.fundedNGN,
    JSON.stringify(exRow && exRow.x));
  check('funded is no longer the author wallet', !exRow || exRow.x.funded !== 777000,
    `author lifetimeEarned=777000, funded=${exRow && exRow.x.funded}`);

  /* ── 4. top readers table ── */
  r = await call(admin, 'GET', `${SA}/analytics/top-readers?limit=10`);
  check('GET /analytics/top-readers -> 200', r.status === 200, `status=${r.status}`);
  const tr = ((r.json || {}).items || []).find(x => String(x.id) === uid);
  check('top readers expose coinsSpent + tipsCoins',
    !!tr && tr.coinsSpent === EXP.coinsSpent && tr.tipsCoins === EXP.tipsCoins,
    JSON.stringify(tr && { s: tr.coinsSpent, t: tr.tipsCoins, w: tr.words }));

  /* ── 5. the reader sees the same unit ── */
  r = await call(reader, 'GET', `${W}/transactions?limit=50`);
  const items = ((r.json || {}).items || []).filter(x => x.status === 'completed');
  const out = items.filter(x => ['spend', 'tip', 'gift'].indexOf(x.type) !== -1)
    .reduce((s, x) => s + x.coins, 0);
  check('reader history sums to the console number', r.status === 200 && out === EXP.coinsSpent,
    `reader=${out} console=${EXP.coinsSpent}`);
  check('reader balance still reports coins', r.json && r.json.balance && typeof r.json.balance.coins === 'number',
    JSON.stringify(r.json && r.json.balance));

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
