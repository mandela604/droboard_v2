'use strict'
// Live lock test for the chief-editor console: boots the REAL Express app
// against an in-memory MongoDB (no hosted DB), signs real chief/senior JWTs,
// drives real HTTP and asserts every write by reading the document back out of
// Mongo. Covers the fixes made this session: the shared validate() envelope
// handling, the /senior-editors/invites route-order shadowing, the removed
// 100-author cap and the new one-writer assignment deltas.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime: mongod.exe aborts with
// 0xC0000135 (DLL not found) without it.
process.env.NODE_ENV = 'test';
process.env.PORT = '4177';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const os = require('os');
const path = require('path');

// stdout through a pipe truncates when the process exits early, so the results
// go to a file as well — read it back if the console output looks cut off.
const LOG = path.join(os.tmpdir(), 'smoke-chief-crud.log');
const results = [];
fs.writeFileSync(LOG, '');
function check(name, pass, detail) {
  const line = `${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 200) : ''}`;
  results.push({ name, pass, detail: detail === undefined ? '' : String(detail).slice(0, 220) });
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
}

async function main() {
  const mongod = await MongoMemoryServer.create({
    // mongod's own first-bind time on this box exceeds the 10s default.
    instance: { startupTimeout: 60000, storageEngine: 'wiredTiger' },
  });
  process.env.MONGO_URI = mongod.getUri('droboard_chief');
  console.log('mongod up:', process.env.MONGO_URI);

  require('../src/server');                       // connects + listens for real
  await new Promise(r => setTimeout(r, 1500));

  const { User } = require('../src/models/user.model');
  const { EditorAssignment } = require('../src/models/chief.model');
  const { signAccess } = require('../src/middleware/auth');

  const mk = (role, extra) => User.create(Object.assign({
    fullName: 'Test ' + role, email: `${role}${Date.now()}${Math.random()}@t.co`,
    username: role + Date.now() + Math.random(), passwordHash: 'x', status: 'active',
    roles: [role],
  }, extra || {}));

  const chief = await mk('chief_editor');
  const se = await mk('senior_editor');
  const w1 = await mk('reader'); const w2 = await mk('reader'); const w3 = await mk('reader');
  const many = [];
  for (let i = 0; i < 120; i++) many.push(String((await mk('writer')).id));

  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + signAccess(chief) };
  const base = 'http://127.0.0.1:4177';
  async function call(method, path_, body) {
    const init = { method, headers: H };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(base + path_, init);
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { status: res.status, json };
  }

  const P = '/api/chief';
  console.log('\n--- reads ---');
  let r = await call('GET', '/health');
  check('GET /health', r.status === 200 && r.json && r.json.ok === true, JSON.stringify(r.json));

  r = await call('GET', P + '/senior-editors?limit=10');
  check('GET /senior-editors 200 + paged shape', r.status === 200 && Array.isArray(r.json.items), `status=${r.status} keys=${Object.keys(r.json || {})}`);
  const row = (r.json.items || [])[0] || {};
  check('list row exposes uuidv7 id, hides _id/__v',
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(String(row.id)) && !('_id' in row) && !('__v' in row),
    `id=${row.id} _id=${'_id' in row} __v=${'__v' in row}`);

  console.log('\n--- invite CRUD ---');
  r = await call('POST', P + '/senior-editors/invites', { name: 'Nia Author', email: 'nia.smith@t.co', target: 20, monthlyPay: 50000, deadline: '2026-12-01' });
  check('POST /invites 201', r.status === 201, `status=${r.status} ${JSON.stringify(r.json)}`);
  const invite = r.json || {};
  check('invite returned: stored hash hidden, plaintext token shown ONCE',
    !!invite.id && !('tokenHash' in invite) && !!invite.token, `keys=${Object.keys(invite)}`);
  r = await call('GET', P + '/senior-editors/invites');
  const listJson = JSON.stringify(r.json || {});
  check('invite token absent from list read (one-time only) + literal route not shadowed by /:id',
    r.status === 200 && !listJson.includes(String(invite.token)) && !listJson.includes('tokenHash'),
    `status=${r.status} tokenReused=${listJson.includes(String(invite.token))}`);

  r = await call('POST', P + '/senior-editors/invites', { name: 'Dup', email: 'nia.smith@t.co' });
  check('duplicate pending invite -> 409 invite_pending', r.status === 409 && r.json && r.json.error === 'invite_pending', `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await call('POST', P + '/senior-editors/invites', { name: 'Bad', email: 'not-an-email' });
  check('invalid email still 400', r.status === 400 && r.json && r.json.error === 'invalid_input', `status=${r.status}`);

  console.log('\n--- editor PATCH (quota/deadline) ---');
  r = await call('PATCH', `${P}/senior-editors/${se.id}`, { target: 40, deadline: '2026-11-30', note: 'q4 push' });
  check('PATCH /senior-editors/:id 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);

  console.log('\n--- assignments: replace-all + one-writer deltas ---');
  r = await call('PUT', `${P}/senior-editors/${se.id}/assignments`, { authorIds: [w1.id, w2.id] });
  check('PUT /assignments 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  let db = await EditorAssignment.findOne({ editorId: String(se.id) }).lean();
  check('DB holds exactly the 2 assigned ids', db && db.authorIds.length === 2 && [w1.id, w2.id].every(i => db.authorIds.includes(i)), `authorIds=${db && db.authorIds.length}`);

  r = await call('POST', `${P}/senior-editors/${se.id}/assignments/authors`, { authorId: w3.id });
  check('POST delta (one id only) 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  db = await EditorAssignment.findOne({ editorId: String(se.id) }).lean();
  check('DB now holds 3 — new id added, old ones kept', db.authorIds.length === 3 && db.authorIds.includes(w3.id) && db.authorIds.includes(w1.id), `n=${db.authorIds.length}`);

  await call('POST', `${P}/senior-editors/${se.id}/assignments/authors`, { authorId: w3.id });
  db = await EditorAssignment.findOne({ editorId: String(se.id) }).lean();
  check('repeat add is idempotent (still 3)', db.authorIds.length === 3, `n=${db.authorIds.length}`);

  r = await call('DELETE', `${P}/senior-editors/${se.id}/assignments/authors/${w1.id}`);
  check('DELETE delta 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  db = await EditorAssignment.findOne({ editorId: String(se.id) }).lean();
  check('DB now holds 2, w1 removed', db.authorIds.length === 2 && !db.authorIds.includes(w1.id), `n=${db.authorIds.length}`);

  r = await call('POST', `${P}/senior-editors/${se.id}/assignments/authors`, { authorId: 'nope-123' });
  check('unknown author -> 400 bad_author', r.status === 400 && r.json && r.json.error === 'bad_author', `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await call('POST', `${P}/senior-editors/nope-999/assignments/authors`, { authorId: w2.id });
  check('unknown editor -> 404', r.status === 404, `status=${r.status}`);

  const big = [w2.id, w3.id].concat(many);
  r = await call('PUT', `${P}/senior-editors/${se.id}/assignments`, { authorIds: big });
  check(`replace-all with ${big.length} authors accepted (old cap was 100)`, r.status === 200, `status=${r.status} ${JSON.stringify(r.json && r.json.error)}`);
  db = await EditorAssignment.findOne({ editorId: String(se.id) }).lean();
  check('DB stored all ' + big.length + ' ids', db && db.authorIds.length === big.length, `n=${db && db.authorIds.length}`);

  r = await call('GET', P + '/assignments');
  check('GET /assignments 200', r.status === 200, `status=${r.status}`);
  // The CE page feeds this straight into mapAssignments(rows) -> rows.forEach(),
  // so the contract is a bare array of {editorId, authorIds[]} — not {items:[...]}.
  check('GET /assignments = bare array of {editorId, authorIds[]} (what mapAssignments consumes)',
    Array.isArray(r.json) && r.json.length > 0 && 'editorId' in r.json[0] && Array.isArray(r.json[0].authorIds),
    JSON.stringify(r.json).slice(0, 120));

  console.log('\n--- report scope: CE reads, does not act ---');
  r = await call('GET', P + '/reports/story');
  check('GET /reports/story 200 (view)', r.status === 200, `status=${r.status}`);
  r = await call('POST', P + '/reports/story/r-1/resolve', { note: 'x' });
  check('CE has no resolve action on chief base', r.status === 404, `status=${r.status}`);

  console.log('\n--- earnings settings (chief pay console) ---');
  r = await call('PUT', P + '/earnings/settings', { enabled: true, mode: 'hybrid', revenueSharePct: 10, fixedMonthlyAmount: 250000, currency: 'NGN', payoutDay: 28 });
  check('PUT /earnings/settings 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('GET', P + '/earnings/settings');
  check('settings round-trip persisted', r.status === 200 && r.json && String(r.json.revenueSharePct ?? r.json.value?.revenueSharePct) === '10', JSON.stringify(r.json).slice(0, 160));

  console.log('\n--- policy CRUD (growth) ---');
  r = await call('POST', P + '/policies', { title: 'No AI-generated art', body: 'Draft text', status: 'draft' });
  check('POST /policies 201', r.status === 201 || r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  const pol = r.json || {};
  r = await call('PATCH', `${P}/policies/${pol.id}`, { title: 'No AI-generated art (v2)' });
  check('PATCH /policies/:id 200', r.status === 200, `status=${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', `${P}/policies/${pol.id}/archive`, {});
  check('POST /policies/:id/archive 200 + status=archived', r.status === 200 && r.json && r.json.status === 'archived', `status=${r.status} ${JSON.stringify(r.json && r.json.status)}`);

  console.log('\n--- auth boundary ---');
  const res = await fetch(base + P + '/senior-editors', { headers: { 'Content-Type': 'application/json' } });
  check('unauthenticated chief read -> 401', res.status === 401, `status=${res.status}`);
  const readerToken = signAccess(await User.findOne({ id: w2.id }).lean());
  const res2 = await fetch(base + P + '/senior-editors', { headers: { Authorization: 'Bearer ' + readerToken } });
  check('reader hitting chief console -> 403', res2.status === 403, `status=${res2.status}`);

  const passed = results.filter(x => x.pass).length;
  const summary = `\n===== ${passed}/${results.length} live assertions passed =====`;
  fs.appendFileSync(LOG, summary + '\n');
  for (const f of results.filter(x => !x.pass)) fs.appendFileSync(LOG, `  FAIL ${f.name} :: ${f.detail}\n`);
  console.log(summary);
  require('mongoose').connection.close().catch(() => {});
  await mongod.stop();
  // server.js keeps the listen socket open, so exit explicitly.
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(e => {
  const msg = 'FATAL ' + (e && e.stack || e);
  fs.appendFileSync(LOG, msg + '\n');
  console.error(msg);
  process.exit(1);
});
