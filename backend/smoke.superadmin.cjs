'use strict';
/* Smoke: boots API on in-memory mongo, seeds admin+writer, hits every new
 * super-admin endpoint + awards, checks status codes and response shapes. */
const { MongoMemoryServer } = require('mongodb-memory-server');

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra });
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';
  process.env.MFA_SECRET_KEY = 'test-mfa';
  process.env.PORT = '4559';
  require('./src/server.js');
  await new Promise(r => setTimeout(r, 2500));
  const BASE = 'http://localhost:4559';

  const { User } = require('./src/models/user.model');
  const { signAccess } = require('./src/middleware/auth');
  const admin = await User.create({ fullName: 'Root Admin', username: 'rootadmin', email: 'root@x.io', roles: ['admin'], primaryRole: 'admin', status: 'active' });
  const writer = await User.create({ fullName: 'Wanda Writer', username: 'wanda', email: 'wanda@x.io', roles: ['writer'], primaryRole: 'writer', status: 'active' });
  const atoken = signAccess({ id: String(admin.id), roles: ['admin'] });
  const wtoken = signAccess({ id: String(writer.id), roles: ['writer'] });

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
  const P = (p, t, b) => call('POST', p, t, b);

  // health + auth gating
  let r = await G('/health');
  check('health', r.status === 200 && r.json.ok === true);
  r = await G('/api/super-admin/dashboard/summary');
  check('no-token 401', r.status === 401, 'got ' + r.status);
  r = await G('/api/super-admin/dashboard/summary', wtoken);
  check('writer 403', r.status === 403, 'got ' + r.status);

  // dashboard
  r = await G('/api/super-admin/dashboard/summary', atoken);
  check('dashboard 200 + shape', r.status === 200 && r.json.kpis && Array.isArray(r.json.topStories) && Array.isArray(r.json.admins), 'got ' + r.status);

  // users
  r = await G('/api/super-admin/users?q=wanda', atoken);
  check('users list + search', r.status === 200 && r.json.total === 1 && r.json.items[0].email === 'wanda@x.io', 'got ' + r.status);
  r = await P('/api/super-admin/users', atoken, { name: 'New Guy', username: 'newguy', email: 'new@g.io' });
  check('users create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const newId = r.json.id;
  r = await call('PATCH', '/api/super-admin/users/' + newId, atoken, { status: 'suspended', notes: 'test note' });
  check('users patch', r.status === 200 && r.json.status === 'suspended' && r.json.notes === 'test note', 'got ' + r.status);
  r = await call('DELETE', '/api/super-admin/users/' + newId, atoken);
  check('users delete', r.status === 200 && r.json.suspended === true, 'got ' + r.status);

  // roles
  r = await P('/api/super-admin/roles', atoken, { name: 'Tester', perms: { view_reports: true, ban_users: 'yes' } });
  check('roles create (bad perm coerced)', r.status === 201 && r.json.perms.view_reports === true, 'got ' + r.status);
  const roleId = r.json.id;
  r = await G('/api/super-admin/roles', atoken);
  check('roles list', r.status === 200 && r.json.items.length >= 1, 'got ' + r.status);
  r = await call('PUT', '/api/super-admin/roles/' + roleId, atoken, { desc: 'hello' });
  check('roles put', r.status === 200 && r.json.desc === 'hello', 'got ' + r.status);
  r = await call('DELETE', '/api/super-admin/roles/' + roleId, atoken);
  check('roles delete', r.status === 200, 'got ' + r.status);
  r = await P('/api/super-admin/roles', atoken, {});
  check('roles invalid 400', r.status === 400, 'got ' + r.status);

  // editorial team (empty but shaped)
  r = await G('/api/super-admin/editorial-team', atoken);
  check('editorial-team shape', r.status === 200 && Array.isArray(r.json.items) && typeof r.json.total === 'number', 'got ' + r.status);

  // insights
  r = await G('/api/super-admin/insights/overview', atoken);
  check('insights overview shape', r.status === 200 && Array.isArray(r.json.users) && Array.isArray(r.json.ex) && r.json.subPrice === 5 && typeof r.json.refDate === 'string', 'got ' + r.status);
  r = await G('/api/super-admin/insights/leaderboard?type=readtime', atoken);
  check('leaderboard readtime', r.status === 200 && r.json.type === 'readtime' && Array.isArray(r.json.items), 'got ' + r.status);
  r = await G('/api/super-admin/insights/leaderboard?type=bogus', atoken);
  check('leaderboard bad type 400', r.status === 400, 'got ' + r.status);

  // authors
  r = await G('/api/super-admin/authors', atoken);
  check('authors list', r.status === 200 && r.json.total === 1 && r.json.items[0].name === 'Wanda Writer', 'got ' + r.status);
  r = await call('PATCH', '/api/super-admin/authors/' + writer.id, atoken, { verified: true, genre: 'Romance' });
  check('authors patch', r.status === 200 && r.json.verified === true && r.json.genre === 'Romance', 'got ' + r.status);

  // books + posts (empty but shaped)
  r = await G('/api/super-admin/books', atoken);
  check('books list shape', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status);
  r = await G('/api/super-admin/posts', atoken);
  check('posts list shape', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status);

  // awards (documented contract)
  r = await P('/api/awards', atoken, { name: 'Top Romance 2026', criteria: { metric: 'reads', op: '>=', value: 1000000 } });
  check('awards create 201', r.status === 201 && !!r.json.id, 'got ' + r.status);
  const awardId = r.json.id;
  r = await G('/api/awards', atoken);
  check('awards list public', r.status === 200 && r.json.total === 1, 'got ' + r.status);
  r = await P('/api/awards/' + awardId + '/grant', atoken, { handle: 'wanda' });
  check('awards grant', r.status === 200 && r.json.handle === 'wanda', JSON.stringify(r.json).slice(0, 120));
  r = await P('/api/awards/' + awardId + '/grant', atoken, { handle: 'wanda' });
  check('awards grant duplicate', r.status === 200 && r.json.duplicate === true, 'got ' + r.status);
  r = await G('/api/awards/' + awardId + '/holders', atoken);
  check('awards holders', r.status === 200 && r.json.length === 1, 'got ' + r.status);
  r = await G('/api/awards/user/wanda', atoken);
  check('awards by handle', r.status === 200 && r.json.length === 1 && !!r.json[0].award, 'got ' + r.status);
  r = await G('/api/awards/' + awardId + '/evaluate?handle=wanda', atoken);
  check('awards evaluate', r.status === 200 && r.json.eligible === false, JSON.stringify(r.json).slice(0, 120));
  r = await P('/api/awards/' + awardId + '/revoke', atoken, { handle: 'wanda' });
  check('awards revoke', r.status === 200 && r.json.revoked === true, 'got ' + r.status);
  r = await P('/api/awards/run-auto-grant', atoken, {});
  check('awards auto-grant', r.status === 200 && typeof r.json.granted === 'number', 'got ' + r.status);
  r = await call('DELETE', '/api/awards/' + awardId, atoken);
  check('awards delete', r.status === 200, 'got ' + r.status);

  // analytics
  r = await G('/api/super-admin/analytics/summary', atoken);
  check('analytics summary', r.status === 200 && typeof r.json.totalUsers === 'number', 'got ' + r.status);
  r = await G('/api/super-admin/analytics/revenue?view=bySource', atoken);
  check('analytics revenue bySource', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status);
  r = await G('/api/super-admin/analytics/acquisition', atoken);
  check('analytics acquisition', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status);
  r = await G('/api/super-admin/analytics/top-readers', atoken);
  check('analytics top-readers', r.status === 200 && Array.isArray(r.json.items), 'got ' + r.status);

  // settings + email templates
  r = await call('PUT', '/api/super-admin/settings', atoken, { siteName: 'Droboard' });
  check('settings put', r.status === 200 && r.json.siteName === 'Droboard', 'got ' + r.status);
  r = await G('/api/super-admin/settings', atoken);
  check('settings get', r.status === 200 && r.json.siteName === 'Droboard', 'got ' + r.status);
  r = await call('PUT', '/api/super-admin/settings/sender-fields', atoken, { fields: [{ label: 'Support', email: 'a@b.io' }] });
  check('sender-fields put', r.status === 200 && r.json.fields.length === 1, 'got ' + r.status);
  r = await P('/api/super-admin/email-templates', atoken, { key: 'welcome', subject: 'Hi', body: 'Hello' });
  check('email tpl create', r.status === 201 && r.json.key === 'welcome', 'got ' + r.status);
  const tplId = r.json.id;
  r = await G('/api/super-admin/email-templates', atoken);
  check('email tpl list', r.status === 200 && r.json.length === 1, 'got ' + r.status);

  // system pages
  r = await P('/api/super-admin/pages', atoken, { title: 'Home Page', url: '/home', status: 'active' });
  check('pages create', r.status === 201 && r.json.statusLabel === 'Published', 'got ' + r.status);
  const pageId = r.json.id;
  r = await G('/api/super-admin/pages', atoken);
  check('pages list {pages}', r.status === 200 && Array.isArray(r.json.pages) && r.json.pages.length === 1, 'got ' + r.status);
  r = await G('/api/super-admin/pages/' + pageId + '/preview', atoken);
  check('pages preview', r.status === 200 && !!r.json.previewHtml, 'got ' + r.status);

  // revenue-splits console (flat shape)
  r = await G('/api/super-admin/revenue/config/active', atoken);
  check('revenue active defaults', r.status === 200 && r.json.version === 1, JSON.stringify(r.json).slice(0, 160));
  r = await P('/api/super-admin/revenue/config', atoken, { google: 30, marketing: 20, editors: 10, writerShare: 40, note: 'launch' });
  check('revenue save v1', r.status === 201 && r.json.version === 1, 'got ' + r.status + ' ' + JSON.stringify(r.json).slice(0, 120));
  r = await P('/api/super-admin/revenue/config', atoken, { google: 25, marketing: 20, editors: 10, writerShare: 45 });
  check('revenue google!=30 rejected 400', r.status === 400, 'got ' + r.status);
  r = await P('/api/super-admin/revenue/config', atoken, { google: 30, marketing: 20, editors: 10, writerShare: 41 });
  check('revenue sum!=100 rejected 400', r.status === 400, 'got ' + r.status);
  r = await G('/api/super-admin/revenue/config/history', atoken);
  check('revenue history {versions}', r.status === 200 && Array.isArray(r.json.versions) && r.json.versions.length === 1, 'got ' + r.status);
  r = await P('/api/super-admin/revenue/config/author/' + writer.id, atoken, { google: 30, marketing: 15, editors: 10, writerShare: 45 });
  check('revenue override save', r.status === 201, 'got ' + r.status + ' ' + JSON.stringify(r.json).slice(0, 120));
  r = await G('/api/super-admin/revenue/config/author', atoken);
  check('revenue overrides {overrides}', r.status === 200 && r.json.overrides.length === 1 && r.json.overrides[0].name === 'Wanda Writer', 'got ' + r.status);
  r = await G('/api/super-admin/revenue/authors?q=wan', atoken);
  check('revenue authors search', r.status === 200 && r.json.authors.length === 1, 'got ' + r.status);
  r = await call('DELETE', '/api/super-admin/revenue/config/author/' + writer.id, atoken);
  check('revenue override delete', r.status === 200, 'got ' + r.status);
  r = await G('/api/super-admin/revenue/pools', atoken);
  check('revenue pools {pools}', r.status === 200 && Array.isArray(r.json.pools) && r.json.pools.length === 4, 'got ' + r.status);
  // legacy shape still works
  r = await P('/api/super-admin/revenue/config', atoken, { scope: 'global', marketingPct: 22, note: 'legacy' });
  check('revenue legacy shape 201', r.status === 201, 'got ' + r.status + ' ' + JSON.stringify(r.json).slice(0, 120));

  const failed = results.filter(x => !x.pass);
  console.log('\n==== ' + (results.length - failed.length) + '/' + results.length + ' passed ====');
  if (failed.length) console.log('FAILED: ' + failed.map(f => f.name).join(', '));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}

main().catch(e => { console.error('SMOKE FATAL', e); process.exit(2); });
