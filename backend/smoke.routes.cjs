'use strict';
/* No-DB smoke: stubs db.connect, boots the API, verifies every new route is
 * mounted with correct auth gating (401/403) and zod validation (400s).
 * Success-path (200) tests need a live Mongo — see smoke.superadmin.cjs. */
const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
}

async function main() {
  process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';
  process.env.MFA_SECRET_KEY = 'test-mfa';
  process.env.PORT = '4560';
  const db = require('./src/config/db');
  db.connect = async () => null; // no DB in this pass
  require('mongoose').plugin(require('./src/models/ids').plugin); // mirror db.connect
  require('./src/server.js');
  await new Promise(r => setTimeout(r, 2000));
  const BASE = 'http://localhost:4560';

  const { signAccess } = require('./src/middleware/auth');
  const atoken = signAccess({ id: 'usr-admin1', roles: ['admin'] });
  const wtoken = signAccess({ id: 'usr-writer1', roles: ['writer'] });

  async function call(method, path, token, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) { /* empty */ }
    return { status: res.status, json };
  }
  const G = (p, t) => call('GET', p, t);

  const cases = [
    // [name, method, path, token, body, expectStatus]
    ['health', 'GET', '/health', null, null, 200],
    ['dashboard no-auth 401', 'GET', '/api/super-admin/dashboard/summary', null, null, 401],
    ['dashboard writer 403', 'GET', '/api/super-admin/dashboard/summary', wtoken, null, 403],
    ['users invalid query 400', 'GET', '/api/super-admin/users?page=' + 'x'.repeat(10), atoken, null, 400],
    ['users create invalid 400', 'POST', '/api/super-admin/users', atoken, {}, 400],
    ['roles create invalid 400', 'POST', '/api/super-admin/roles', atoken, {}, 400],
    ['leaderboard bad type 400', 'GET', '/api/super-admin/insights/leaderboard?type=bogus', atoken, null, 400],
    ['books bad sort 400', 'GET', '/api/super-admin/books?sort=' + 'x'.repeat(30), atoken, null, 400],
    ['book status empty 400', 'PATCH', '/api/super-admin/books/bk-1/status', atoken, {}, 400],
    ['posts bad status-len 400', 'GET', '/api/super-admin/posts?status=' + 'x'.repeat(30), atoken, null, 400],
    ['post status empty 400', 'PATCH', '/api/super-admin/posts/pst-1/status', atoken, {}, 400],
    ['revenue bad view 400', 'GET', '/api/super-admin/analytics/revenue?view=nope', atoken, null, 400],
    ['settings sender-fields bad 400', 'PUT', '/api/super-admin/settings/sender-fields', atoken, { fields: 'nope' }, 400],
    ['email tpl missing subject 400', 'POST', '/api/super-admin/email-templates', atoken, { key: 'k', body: 'b' }, 400],
    ['pages missing title 400', 'POST', '/api/super-admin/pages', atoken, { url: '/x' }, 400],
    ['revenue save missing 400', 'POST', '/api/super-admin/revenue/config', atoken, { google: 30 }, 400],
    ['revenue google!=30 400', 'POST', '/api/super-admin/revenue/config', atoken, { google: 25, marketing: 20, editors: 10, writerShare: 45 }, 400],
    ['revenue sum!=100 400', 'POST', '/api/super-admin/revenue/config', atoken, { google: 30, marketing: 20, editors: 10, writerShare: 41 }, 400],
    ['override google!=30 400', 'POST', '/api/super-admin/revenue/config/author/usr-1', atoken, { google: 0, marketing: 20, editors: 10, writerShare: 40 }, 400],
    ['revenue gift!=30 400', 'POST', '/api/super-admin/revenue/config', atoken, { google: 30, marketing: 20, editors: 10, writerShare: 40, giftWriterPct: 50 }, 400],
    ['revenue sub!=100 400', 'POST', '/api/super-admin/revenue/config', atoken, { google: 30, marketing: 20, editors: 10, writerShare: 40, subPlatformPct: 60, subWritersPct: 30 }, 400],
    ['subscriptions bad period 400', 'GET', '/api/super-admin/revenue/subscriptions?period=2026-13', atoken, null, 400],
    ['awards create missing name 400', 'POST', '/api/awards', atoken, {}, 400],
    ['awards grant missing handle 400', 'POST', '/api/awards/awd-1/grant', atoken, {}, 400],
    ['awards create writer 403', 'POST', '/api/awards', wtoken, { name: 'X' }, 403],
    ['comment edit empty 400', 'PATCH', '/api/comments/cmt-1', atoken, {}, 400],
    ['comment react missing rid 400', 'POST', '/api/comments/cmt-1/react', atoken, {}, 400],
    ['post react missing rid 400', 'POST', '/api/posts/pst-1/react', atoken, {}, 400],
    ['post share missing channel 400', 'POST', '/api/posts/pst-1/share', atoken, {}, 400],
    ['post share writer 403-free (auth order)', 'POST', '/api/posts/pst-1/share', null, { channel: 'x' }, 401],
    ['status create missing bg 400', 'POST', '/api/statuses', atoken, {}, 400],
    ['library add bad list 400', 'POST', '/api/library/items', atoken, { storyId: 'bk-1', list: 'nope' }, 400],
    ['library move bad to 400', 'PATCH', '/api/library/items/bk-1/move', atoken, { from: 'library', to: 'nope' }, 400],
    ['saves state missing story 400', 'GET', '/api/saves/state', atoken, null, 400],
    ['saves quick bad key 400', 'POST', '/api/saves/quick', atoken, { storyId: 'bk-1', key: 'nope' }, 400],
    ['saves collection missing name 400', 'POST', '/api/saves/collections', atoken, {}, 400],
    ['collections create no-auth 401', 'POST', '/api/collections', null, { title: 'X' }, 401],
    ['collections create missing name 400', 'POST', '/api/collections', atoken, {}, 400],
    ['collections create bad privacy 400', 'POST', '/api/collections', atoken, { title: 'X', privacy: 'galaxy' }, 400],
    ['collections follow no-auth 401', 'POST', '/api/collections/col-1/follow', null, null, 401],
    ['collections share no-auth 401', 'POST', '/api/collections/col-1/share', null, { channel: 'x' }, 401],
    ['collections bad sort 400', 'GET', '/api/collections?sort=nope', null, null, 400],
  ];
  for (const [name, method, path, token, body, want] of cases) {
    const r = await call(method, path, token, body);
    check(name, r.status === want, 'got ' + r.status + (r.json ? ' ' + JSON.stringify(r.json).slice(0, 100) : ''));
  }

  // pure-logic unit checks (no DB)
  const revenue = require('./src/services/revenue.service');
  try { revenue.checkFlat({ google: 30, marketing: 20, editors: 10, writerShare: 40 }); check('checkFlat valid', true); }
  catch (e) { check('checkFlat valid', false, e.message); }
  try { revenue.checkFlat({ google: 25, marketing: 20, editors: 10, writerShare: 45 }); check('checkFlat google!=30 throws', false); }
  catch (e) { check('checkFlat google!=30 throws', e.status === 400, e.message); }
  const flat = revenue.toFlat({ id: 'cfg-1', version: 2, storeFeePct: 30, marketingPct: 20, editorsPct: 10, writerShareOfNetPct: 40, note: 'n', updatedBy: 'u', updatedAt: new Date() });
  check('toFlat maps waterfall->flat', flat.google === 30 && flat.writerShare === 40 && flat.version === 2, JSON.stringify(flat).slice(0, 120));
  const sp = revenue.splitGross(1000, { storeFeePct: 30, marketingPct: 20, editorsPct: 10, writerShareOfNetPct: 40 });
  check('splitGross math', sp.storeFee === 300 && sp.writer === 160 && sp.platform === 240, JSON.stringify(sp));
  const { AdminRole, SystemPage, Award, UserAward } = require('./src/models/admin.model');
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const madeIds = [
    new AdminRole({ name: 'x' }).id, new SystemPage({ title: 't', url: '/u' }).id,
    new Award({ name: 'a' }).id, new UserAward({ awardId: 'a', handle: 'h' }).id,
  ];
  check('ids uuidv7', madeIds.every(id => uuidRe.test(String(id))), madeIds.map(String).join(','));

  const failed = results.filter(x => !x.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' passed ====');
  if (failed.length) console.log('FAILED: ' + failed.map(f => f.name).join(', '));
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('SMOKE FATAL', e); process.exit(2); });
