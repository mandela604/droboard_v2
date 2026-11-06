'use strict';
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4200';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
delete process.env.GOOGLE_CLIENT_ID;

const { MongoMemoryServer } = require('mongodb-memory-server');
const out = [];
function check(name, pass, detail) {
  out.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + String(detail).slice(0, 300) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dro_storywide_create');
  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await new Promise(r => setTimeout(r, 250));
  }
  async function call(method, path, body, access) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = `Bearer ${access}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');

  let r = await call('POST', '/api/auth/signup', { name: 'Eng Tester', username: 'engtester123', email: 'et@test.co', password: 'SecurePass123!' });
  check('Signup -> 2xx', r.status >= 200 && r.status < 300, `${r.status}`);
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'engtester123', password: 'SecurePass123!' });
  check('Login -> 2xx + access token', r.status === 200 && !!r.json.access, `${r.status}`);
  const token = r.json.access;
  const author = r.json.user;
  const book = await Book.create({ title: 'Book Eng Test', authorId: String(author.id), status: 'published', synopsis: 'x' });
  const AE = `/api/author/books/${book.id}/engagement`;

  r = await call('GET', AE, undefined, token);
  check('T1 GET /author/books/:id/engagement -> 200 + polls/predictions/debates arrays',
    r.status === 200 && r.json && !r.json.polls?.length && !r.json.predictions?.length && !r.json.debates?.length,
    `${r.status} ${JSON.stringify(Object.keys(r.json))}`);

  r = await call('POST', AE, { kind: 'poll', question: 'Who wins?', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] }, token);
  check('T2 POST /author/books/:id/engagement poll -> 201',
    r.status === 201 && !!r.json.id && r.json.q === 'Who wins?' && r.json.opts.length === 2 && r.json.kind === 'poll',
    `${r.status} ${JSON.stringify(r.json && { id: r.json.id, q: r.json.q })}`);
  const pollId = r.json && r.json.id;

  r = await call('GET', AE, undefined, token);
  check('T3 GET after create shows poll',
    r.status === 200 && r.json.polls?.length === 1 && r.json.polls[0].q === 'Who wins?' && r.json.polls[0].id === pollId,
    `${r.status} polls=${r.json.polls.length}`);

  r = await call('POST', AE, { kind: 'prediction', question: 'Will they marry?', opts: [{ t: 'Yes', v: 0 }, { t: 'No', v: 0 }] }, token);
  check('T4 POST prediction -> 201', r.status === 201 && r.json.kind === 'prediction', `${r.status} kind=${r.json.kind}`);

  r = await call('POST', AE, { kind: 'debate', motion: 'Close the market?', forText: 'Yes', againstText: 'No' }, token);
  check('T5 POST debate with forText/againstText -> 201',
    r.status === 201 && r.json.forText === 'Yes' && r.json.againstText === 'No',
    `${r.status} forV=${r.json.forV} agV=${r.json.agV}`);

  r = await call('DELETE', `${AE}/poll/${pollId}`, undefined, token);
  check('T6 DELETE poll/{id} -> 200', r.status === 200 && r.json.ok === true, `${r.status} ok=${r.json.ok}`);

  r = await call('GET', AE, undefined, token);
  check('T7 GET after delete -> polls empty, pred/debate intact',
    r.json.polls.length === 0 && r.json.predictions.length === 1 && r.json.debates.length === 1,
    `{${r.status} polls=${r.json.polls.length}}`);

  // The debates array stores the motion under `motion` (there is no `q`
  // field on it) — writing q here would be stripped and the row born blank.
  r = await call('GET', AE, undefined, token);
  const deb = r.json.debates[0];
  check('T8 debate row persists motion/forText/againstText',
    !!deb && deb.motion === 'Close the market?' && deb.forText === 'Yes' && deb.againstText === 'No',
    `${r.status} ${JSON.stringify(deb && { motion: deb.motion, ft: deb.forText })}`);

  // Ownership: a second authenticated author must not be able to write into
  // a book that is not theirs. 404, not 403, so ids never enumerate.
  r = await call('POST', '/api/auth/signup', { name: 'Intruder', username: 'intruder912', email: 'in@test.co', password: 'SecurePass123!' });
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'intruder912', password: 'SecurePass123!' });
  const other = r.json.access;
  r = await call('POST', AE, { kind: 'poll', question: 'Planted by a stranger?', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] }, other);
  check('T9 stranger POST into another author\'s book -> 404', r.status === 404, `${r.status} ${JSON.stringify(r.json)}`);

  r = await call('DELETE', `${AE}/debate/${deb.id}`, undefined, other);
  check('T10 stranger DELETE from another author\'s book -> 404', r.status === 404, `${r.status}`);

  r = await call('GET', AE, undefined, token);
  check('T11 intrusion left no trace (polls still empty, debate intact)',
    r.json.polls.length === 0 && r.json.debates.length === 1,
    `polls=${r.json.polls.length} debates=${r.json.debates.length}`);

  // Payload validation mirrors the sheet's own rules.
  r = await call('POST', AE, { kind: 'poll', question: 'Blank option?', opts: [{ t: 'A', v: 0 }, { t: '', v: 0 }] }, token);
  check('T12 poll with a blank option -> 400', r.status === 400, `${r.status}`);
  r = await call('POST', AE, { kind: 'poll', question: '', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] }, token);
  check('T13 poll with empty question -> 400', r.status === 400, `${r.status}`);
  r = await call('POST', AE, { kind: 'debate', motion: '   ' }, token);
  check('T14 debate with whitespace motion -> 400', r.status === 400, `${r.status}`);

  // Owner can still remove their own debate — the array name is the irregular
  // plural (debate -> debates), so `${kind}s` would pull from nothing.
  r = await call('DELETE', `${AE}/debate/${deb.id}`, undefined, token);
  check('T15 owner DELETE debate -> 200', r.status === 200 && r.json.ok === true, `${r.status}`);
  r = await call('GET', AE, undefined, token);
  check('T16 debate actually gone after delete',
    r.json.debates.length === 0 && r.json.predictions.length === 1,
    `debates=${r.json.debates.length} preds=${r.json.predictions.length}`);

  const failed = out.filter(x => !x.pass);
  console.log('\n' + (out.length - failed.length) + '/' + out.length + ' passed');
  failed.forEach(f => console.log('  - ' + f.name));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
