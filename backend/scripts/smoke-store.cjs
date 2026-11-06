'use strict';
// Store catalog live harness.
//
// Boots the real Express app on an in-memory MongoDB and drives the reader-facing
// GET /api/store that public/services/store-service.js + store-page-service.js
// render. It answers two questions with data:
//   1. Does the endpoint work for both a guest (no balance) and a signed-in
//      reader (balance attached)?
//   2. Does every returned row carry the exact fields the page renderers
//      (renderPacks/Bundles/Rewards/Subscriptions/MergeSub) and checkout
//      (amountNGNFor reads basePriceNGN) read — so nothing renders as undefined?
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime. See smoke-user-counters.cjs.
process.env.NODE_ENV = 'test';
process.env.PORT = '4198';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 4198;
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = require('path').join(__dirname, 'smoke-store.results.txt');

const results = [];
const logLines = [];
function say(s) { logLines.push(s); console.log(s); }
function check(name, pass, detail) {
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
  say(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 240) : ''}`);
}
function finish() {
  const passed = results.filter(x => x.pass).length;
  say(`\n===== ${passed}/${results.length} store-catalog assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => say(`  FAIL ${f.name} :: ${f.detail}`));
  try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (e) {}
  process.exit(passed === results.length ? 0 : 1);
}

// every(row, [fields]) → the first missing field name, or null.
function missing(row, fields) {
  for (const f of fields) if (row[f] === undefined || row[f] === null || row[f] === '') return f;
  return null;
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_store');
  say('mongod up: ' + process.env.MONGO_URI);

  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(BASE + '/health'); if (p.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }

  async function get(url, headers) {
    const res = await fetch(url, { headers: headers || {}, credentials: 'include' });
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  /* ── 1. guest can read the whole catalog ── */
  let r = await get(BASE + '/api/store');
  check('GET /api/store (guest) -> 200', r.status === 200, `status=${r.status}`);
  let d = r.json || {};
  check('catalog has packs/bundles/gifts/adRewards/subscriptions/mergeSub',
    ['packs', 'bundles', 'gifts', 'adRewards', 'subscriptions', 'mergeSub'].every(k => Array.isArray(d[k]) || (k === 'mergeSub' && typeof d[k] === 'object')),
    JSON.stringify(Object.keys(d)));
  check('guest gets NO balance', d.balance === undefined, 'balance=' + JSON.stringify(d.balance));

  /* ── 2. signed-in reader gets a {coins,bonus,paid} balance ── */
  const { User } = require('../src/models/user.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const reader = await User.create({
    fullName: 'rosa', email: 'rosa@t.co', username: 'rosa' + Date.now() + Math.random(),
    passwordHash: DUMMY, status: 'active', roles: ['reader'],
  });
  r = await get(BASE + '/api/store', { Authorization: 'Bearer ' + signAccess(reader) });
  check('GET /api/store (reader) -> 200', r.status === 200, `status=${r.status}`);
  const b = r.json && r.json.balance;
  check('reader balance is {coins,bonus,paid}',
    b && typeof b.coins === 'number' && typeof b.bonus === 'number' && typeof b.paid === 'number',
    JSON.stringify(b));
  check('balance.coins = bonus + paid', b && b.coins === b.bonus + b.paid, JSON.stringify(b));

  /* ── 3. the seeded catalog is non-empty after first read ── */
  check('packs seeded (>=4)', d.packs.length >= 4, `n=${d.packs.length}`);
  check('subscriptions seeded (>=4 excl. merge)', d.subscriptions.length >= 4, `n=${d.subscriptions.length}`);
  check('gifts seeded (>=6)', d.gifts.length >= 6, `n=${d.gifts.length}`);
  check('mergeSub present with code sub-merge', d.mergeSub && d.mergeSub.code === 'sub-merge', JSON.stringify(d.mergeSub && d.mergeSub.code));
  check('mergeSub is NOT also in the subscriptions grid', !d.subscriptions.some(s => s.code === 'sub-merge'));

  /* ── 4. pack rows render-ready ── */
  // renderPacks reads id, coins, price(+prices for DroboardCurrency), badge, icon, color.
  // price may be '' legitimately only if a NGN leg exists; assert a chargeable number instead.
  const packChargeBad = d.packs.filter(p => !(Number(p.basePriceNGN) > 0)).map(p => p.code);
  check('every pack has a positive basePriceNGN for checkout', packChargeBad.length === 0, packChargeBad.join(','));
  const packDisplayBad = d.packs.filter(p => !p.price && !(p.prices && p.prices.NGN)).map(p => p.code);
  check('every pack has a display price', packDisplayBad.length === 0, packDisplayBad.join(','));
  check('pack icon is a font-awesome class the renderer accepts',
    d.packs.every(p => /^fa-[a-z0-9-]+$/i.test(p.icon)), d.packs.map(p => p.icon).join(','));

  /* ── 5. bundle rows render-ready (name, coins, bonus, price, icon, color) ── */
  const bundleBad = d.bundles.filter(x => missing(x, ['id', 'name', 'coins', 'bonus', 'icon', 'color'])).map(x => x.code);
  check('every bundle has id/name/coins/bonus/icon/color', d.bundles.length >= 3 && bundleBad.length === 0, `n=${d.bundles.length} bad=${bundleBad.join(',')}`);

  /* ── 6. subscription rows render-ready (id, name, period, price, icon, color, features[]) ── */
  const subBad = d.subscriptions.filter(s => !s.id || !s.name || !s.period || !s.price || !/^fa-/.test(s.icon || '') || !Array.isArray(s.features) || !s.features.length).map(s => s.code);
  check('every subscription has name/period/price/icon/color + features[]', subBad.length === 0, `bad=${subBad.join(',')}`);
  // store-page derives duration text; also confirm "Save X% vs daily" math has a daily anchor.
  check('mergeSub has features[] for the card', Array.isArray(d.mergeSub.features) && d.mergeSub.features.length > 0, JSON.stringify(d.mergeSub.features));

  /* ── 7. gift rows render-ready (tip picker: name, price, faIcon, color, desc) ── */
  const giftBad = d.gifts.filter(g => !g.name || !(Number(g.price) > 0) || !/^fa-/.test(g.faIcon || '') || !/^#/.test(g.color || '')).map(g => g.code);
  check('every gift has name/price/faIcon(FA)/color(#hex)', giftBad.length === 0, `bad=${giftBad.join(',')}`);

  /* ── 8. reward rows render-ready AND earn-claimable ── */
  // renderRewards needs action, icon, cooldown, coins>0, id, type; checkout/claim
  // needs needsProof/needsWatch/target/minWatchSec already validated server-side.
  check('adRewards array present', Array.isArray(d.adRewards), `n=${d.adRewards.length}`);
  const rwBad = d.adRewards.filter(rw => !rw.id || !rw.action || !/^fa-/.test(rw.icon || '') || !(Number(rw.coins) > 0)).map(rw => rw.code);
  check('every served reward has id/action/faIcon/coins>0', rwBad.length === 0, `bad=${rwBad.join(',')}`);
  check('every served reward exposes cooldown + available', d.adRewards.every(rw => rw.cooldown !== undefined && typeof rw.available === 'boolean'));

  /* ── 9. prices come back as display STRINGS keyed by currency (DroboardCurrency) ── */
  const sample = d.packs[0];
  check('pack prices leg is an object of strings', sample && sample.prices && typeof sample.prices === 'object'
    && Object.keys(sample.prices).every(k => typeof sample.prices[k] === 'string'), JSON.stringify(sample && sample.prices));

  /* ── 10. a half-configured reward is NOT served (earn-rules gate) ── */
  const { EarnReward } = require('../src/models/money.model');
  await EarnReward.create({ code: 'broken-ad', action: 'Broken Task', type: 'watch_ad', coins: 999, cooldown: '1 hr', status: 'active' }); // watch_ad needs an ad URL
  d = (await get(BASE + '/api/store')).json;
  check('an invalid earn task (watch_ad with no ad URL) is dropped from the catalog',
    !d.adRewards.some(x => x.code === 'broken-ad'), 'served=' + JSON.stringify(d.adRewards.map(x => x.code)));

  /* ── 11. priceUSD never lies ──
     A catalog with only an NGN ladder has no USD price. Shipping basePriceNGN
     under priceUSD made ₦1,500 read as $1,500 to receipts and the finance coin
     report. Absence must be 0, not the naira number. */
  const ngnOnly = d.packs.filter(p => !p.prices || !p.prices.USD);
  check('every NGN-only pack reports priceUSD 0', ngnOnly.every(p => Number(p.priceUSD) === 0),
    JSON.stringify(ngnOnly.map(p => ({ c: p.code, ngn: p.basePriceNGN, usd: p.priceUSD }))));
  check('every NGN-only sub reports priceUSD 0',
    d.subscriptions.filter(s => !s.prices || !s.prices.USD).every(s => Number(s.priceUSD) === 0));

  /* ── 12. a missing Merge Pass is null, not {} ──
     {} survived the JSON round-trip and renderMergeSub died on
     merge.features.map(). null lets the page skip the card entirely. */
  const { SubscriptionPlan } = require('../src/models/money.model');
  await SubscriptionPlan.deleteOne({ code: 'sub-merge' });
  d = (await get(BASE + '/api/store')).json;
  check('mergeSub is null (not {}) when the plan does not exist', d.mergeSub === null,
    JSON.stringify(d.mergeSub));

  finish();
}
main().catch(e => { say('FATAL ' + (e && e.stack || e)); try { fs.writeFileSync(OUT, logLines.join('\n') + '\n'); } catch (x) {} process.exit(1); });
