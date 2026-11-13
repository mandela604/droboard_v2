'use strict';
/* Local E2E for the role -> dashboard chain.
   Grants one account admin + chief_editor + senior_editor through the console
   API, then signs in as that account and asks the API who it is, so the menu
   can be fed from the live answer instead of the login-time snapshot.

   Boots the real app against an in-memory Mongo (same code path as prod).
   Usage: node backend/scripts/smoke-role-views.cjs
*/
process.env.NODE_ENV = 'test';
const PORT = process.env.E2E_PORT || '4293';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.ADMIN_EMAILS = 'roles.admin@droboard.test';
const BASE = 'http://127.0.0.1:' + PORT;
const PASSWORD = 'Dro!board2026#QA';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 400) : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  let res;
  try {
    res = await fetch(BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) { return { status: 0, json: null, error: String(e && e.message || e) }; }
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

async function waitReady() {
  for (let i = 0; i < 160; i++) {
    const r = await call('GET', '/health');
    if (r.status === 200) return;
    await sleep(250);
  }
  throw new Error('api never came up');
}

(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000, startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('dro_role_views');
  require('../src/server');
  await waitReady();

  const stamp = Date.now().toString().slice(-7);
  const adminEmail = 'roles.admin@droboard.test';
  const targetEmail = `roles.target.${stamp}@droboard.test`;

  // The admin account: ADMIN_EMAILS promotes it at boot.
  let r = await call('POST', '/api/auth/register', {
    fullName: 'Roles Admin', name: 'Roles Admin', username: `roles_admin_${stamp}`,
    email: adminEmail, password: PASSWORD, country: 'NG',
  });
  check('admin account registered', r.status >= 200 && r.status < 300, `${r.status}`);

  r = await call('POST', '/api/auth/login', { email: adminEmail, password: PASSWORD });
  const adminToken = (r.json && (r.json.access || r.json.token)) || '';
  check('admin signed in', !!adminToken, `${r.status} ${JSON.stringify(r.json && r.json.error)}`);
  check('ADMIN_EMAILS promoted the account to admin',
    (r.json && r.json.user && (r.json.user.roles || []).indexOf('admin') !== -1),
    JSON.stringify(r.json && r.json.user && r.json.user.roles));

  r = await call('GET', '/api/super-admin/users?limit=50', undefined, adminToken);
  check('console lists users', r.status === 200, `${r.status}`);

  // The target account.
  r = await call('POST', '/api/auth/register', {
    fullName: 'Roles Target', name: 'Roles Target', username: `roles_t_${stamp}`,
    email: targetEmail, password: PASSWORD, country: 'NG',
  });
  const targetId = r.json && r.json.user && r.json.user.id;
  check('target account registered', r.status >= 200 && r.status < 300 && !!targetId, `${r.status}`);

  r = await call('GET', '/api/super-admin/users?limit=50', undefined, adminToken);
  const target = ((r.json && (r.json.items || r.json.users)) || []).find(u => String(u.id) === String(targetId));
  check('console shows the target row', !!target, `status=${r.status}`);

  // Grant three roles through the console API (exactly what the Users page does).
  r = await call('PATCH', `/api/super-admin/users/${encodeURIComponent(targetId)}`,
    { roles: ['Admin', 'Chief Editor', 'Senior Editor'] }, adminToken);
  check('console grants admin + chief editor + senior editor',
    r.status === 200 && (r.json.roles || []).length === 3,
    `${r.status} roles=${JSON.stringify(r.json && r.json.roles)}`);

  // Sign in as the target: the login payload must carry every role.
  r = await call('POST', '/api/auth/login', { email: targetEmail, password: PASSWORD });
  const targetToken = (r.json && (r.json.access || r.json.token)) || '';
  const loginRoles = (r.json && r.json.user && r.json.user.roles) || [];
  check('login payload carries all three roles',
    r.status === 200 && ['admin', 'chief_editor', 'senior_editor'].every(x => loginRoles.indexOf(x) !== -1),
    `${r.status} roles=${JSON.stringify(loginRoles)}`);
  check('login payload carries primaryRole=admin',
    (r.json && r.json.user && r.json.user.primaryRole) === 'admin',
    `primaryRole=${r.json && r.json.user && r.json.user.primaryRole}`);

  // The live "who am I" read — what the menu should trust.
  r = await call('GET', '/api/users/me', undefined, targetToken);
  const meRoles = (r.json && r.json.roles) || [];
  check('GET /api/users/me returns the live role set',
    r.status === 200 && ['admin', 'chief_editor', 'senior_editor'].every(x => meRoles.indexOf(x) !== -1),
    `${r.status} roles=${JSON.stringify(meRoles)}`);

  // The dashboards those roles unlock must accept this account.
  for (const [name, path] of [
    ['super admin', '/api/super-admin/users?limit=1'],
    ['chief editor', '/api/chief/categories?limit=1'],
    ['senior editor', '/api/senior-editor/review-queue?limit=1'],
  ]) {
    const res = await call('GET', path, undefined, targetToken);
    check(`${name} dashboard API accepts the multi-role account`, res.status === 200,
      `${path} -> ${res.status} ${JSON.stringify(res.json && res.json.error)}`);
  }

  // The menu mapping itself: ROLE_DASHBOARDS keys must line up with the roles
  // the API returns, so every held role produces a dashboard entry.
  const ROLE_DASHBOARDS = {
    admin: 'Super Admin Dashboard',
    chief_editor: 'Chief Editor Dashboard',
    senior_editor: 'Senior Editor Dashboard',
    finance: 'Finance Dashboard',
    marketing: 'Marketing Dashboard',
  };
  const normalize = (r) => String(r || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const shown = meRoles.map(normalize).filter(r => ROLE_DASHBOARDS[r]);
  check('menu would list every held role\'s dashboard',
    shown.length === 3 && shown.indexOf('chief_editor') !== -1 && shown.indexOf('senior_editor') !== -1,
    JSON.stringify(shown));

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} role-view assertions passed =====`);
  results.filter(x => !x.pass).forEach(f => console.log('  FAIL ' + f.name + ' :: ' + f.detail));

  const { default: mongoose } = require('mongoose');
  await mongoose.disconnect();
  await mongod.stop().catch(() => {});
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('E2E CRASH', e && e.stack || e); process.exit(2); });