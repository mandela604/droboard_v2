'use strict';
// Does story-wide (book-level) engagement actually work end to end?
// Seeds a Book with embedded polls/predictions/debates the way a create path
// would, then drives the three reader endpoints over real HTTP.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4199';
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
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_storywide');
  require('../src/server');
  const base = 'http://127.0.0.1:' + PORT;
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch(base + '/health'); if (p.ok) break; } catch (e) { /* not up */ }
    await new Promise(r => setTimeout(r, 250));
  }
  async function call(method, path, body, access) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (access) headers.Authorization = 'Bearer ' + access;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { signAccess } = require('../src/middleware/auth');
  const DUMMY = '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const reader = await User.create({ fullName: 'Story Reader', email: 'sr@t.co', username: 'sr' + Date.now(), passwordHash: DUMMY, status: 'active', roles: ['reader'] });
  const tok = signAccess(reader);

  // Embedded docs written straight to the model — the shape a create route would have to produce.
  const book = await Book.create({
    title: 'Story-wide Probe', authorId: String(reader.id), status: 'published',
    polls: [{ q: 'Who wins?', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }], expiresAt: null }],
    predictions: [{ q: 'Who dies?', opts: [{ t: 'X', v: 0 }, { t: 'Y', v: 0 }], expiresAt: null }],
    debates: [{ motion: 'Close the market?', forText: 'Yes', againstText: 'No', forV: 0, agV: 0, expiresAt: null }],
  });
  const B = '/api/stories/' + book.id + '/engagement';
  check('T1 story-wide arrays stored with ids', !!(book.polls[0].id && book.debates[0].id),
    JSON.stringify({ pollId: book.polls[0].id, debateId: book.debates[0].id }));

  let r = await call('GET', B, undefined, tok);
  check('T2 GET /stories/:id/engagement -> 200 + polls/predictions/debates/myVotes',
    r.status === 200 && !!(r.json && r.json.polls && r.json.predictions && r.json.debates && r.json.myVotes),
    `${r.status} ${JSON.stringify(r.json && Object.keys(r.json))}`);

  r = await call('POST', B + '/vote', { id: book.polls[0].id, kind: 'poll', option: 1 }, tok);
  check('T3 vote on a story-wide POLL -> 200 and count moved',
    r.status === 200 && r.json && r.json.opts && r.json.opts[1].v === 1,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || r.json.opts))}`);

  r = await call('POST', B + '/vote', { id: book.debates[0].id, kind: 'debate', side: 'for' }, tok);
  check('T4 vote on a story-wide DEBATE (side:for) -> 200 and forV moved',
    r.status === 200 && r.json && r.json.forV === 1,
    `${r.status} ${JSON.stringify(r.json && (r.json.error || { forV: r.json.forV, agV: r.json.agV }))}`);

  r = await call('DELETE', B + '/debate', undefined, tok);
  check('T5 retract story-wide debate -> 200', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);

  // Is there ANY way to create these through the API?
  const attempts = [];
  r = await call('PATCH', '/api/books/' + book.id, { polls: [{ q: 'Created by PATCH?', opts: ['a', 'b'] }] }, tok);
  attempts.push(['PATCH /api/books/:id {polls}', `${r.status} ${JSON.stringify(r.json && r.json.error)}`]);
  r = await call('POST', '/api/books/batch', {
    book: { title: 'Probe 2', polls: [{ q: 'x' }] , synopsis: 'y' },
    chapters: [{ n: 1, content: 'z', words: 1 }],
  }, tok);
  attempts.push(['POST /api/books/batch book.polls', `${r.status} ${JSON.stringify(r.json && r.json.error)}`]);
  r = await call('POST', B, { kind: 'poll', q: 'Standalone create?', opts: ['a', 'b'] }, tok);
  attempts.push(['POST /api/stories/:id/engagement', `${r.status}`]);
  attempts.forEach(([n, d]) => console.log('  create-attempt ' + n + ' -> ' + d));
  const fresh = await Book.findById(book._id).lean();
  check('T6 no API path can create story-wide engagement (arrays unchanged)',
    fresh.polls.length === 1 && fresh.debates.length === 1,
    JSON.stringify({ polls: fresh.polls.length, debates: fresh.debates.length }));

  const failed = out.filter(x => !x.pass);
  console.log('\n' + (out.length - failed.length) + '/' + out.length + ' passed');
  failed.forEach(f => console.log('  - ' + f.name));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
