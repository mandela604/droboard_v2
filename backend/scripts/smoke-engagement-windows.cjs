'use strict';
// Voting windows: chapter poll/pred close on next live chapter; book poll/pred
// close on book completion; debates never auto-close.
process.env.NODE_ENV = 'test';
process.env.PORT = '4213';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4213';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ::  ' + JSON.stringify(detail).slice(0, 220) : ''}`);
  console.log(out[out.length - 1]);
}
const delay = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000, startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('dro_eng_windows');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await delay(250); }

  const { User } = require('../src/models/user.model');
  const { Book, Chapter } = require('../src/models/content.model');
  const { signAccess } = require('../src/middleware/auth');
  const mk = async n => User.create({ fullName: n, email: n + '@t.co', username: n + Date.now(), passwordHash: 'x', roles: ['reader'], status: 'active' });
  const a = await mk('a'), b = await mk('b');
  const H = u => ({ Authorization: 'Bearer ' + signAccess({ id: u.id, roles: u.roles }), 'Content-Type': 'application/json' });
  const uniq = Date.now();
  const book = await Book.create({
    title: 'Windows Book ' + uniq, slug: 'windows-' + uniq, authorId: String(a.id), status: 'ongoing',
    polls: [{ id: 'bpoll', q: 'Q', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] }],
    predictions: [{ id: 'bpred', q: 'Q', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] }],
    debates: [{ id: 'bdeb', motion: 'M', forV: 0, agV: 0 }],
  });
  const ch1 = await Chapter.create({
    bookId: String(book.id), n: 1, title: 'One', status: 'live',
    poll: { id: 'cpoll', q: 'Q', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] },
    prediction: { id: 'cpred', q: 'Q', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }] },
    debate: { id: 'cdeb', motion: 'M', forV: 0, agV: 0 },
  });
  const ch2 = await Chapter.create({ bookId: String(book.id), n: 2, title: 'Two', status: 'draft' });

  const voteCh = (u, key, kind, body) => fetch(`${BASE}/api/stories/${book.id}/chapters/${key}/${kind}/vote`, { method: 'POST', headers: H(u), body: JSON.stringify(body) });
  const chEng = () => fetch(`${BASE}/api/stories/${book.id}/chapters/1/engagement`, { headers: H(a) }).then(r => r.json());
  const voteBook = (u, kind, body) => fetch(`${BASE}/api/stories/${book.id}/engagement/vote`, { method: 'POST', headers: H(u), body: JSON.stringify(Object.assign({ kind }, body)) });
  const bookEng = () => fetch(`${BASE}/api/stories/${book.id}/engagement`, { headers: H(a) }).then(r => r.json());

  // before ch2 live
  check('ch poll open before next chapter', (await voteCh(a, ch1.id, 'poll', { option: 0 })).status === 200);
  check('ch prediction open before next chapter', (await voteCh(a, ch1.id, 'prediction', { option: 0 })).status === 200);
  check('ch debate open before next chapter', (await voteCh(a, ch1.id, 'debate', { side: 'for' })).status === 200);
  let e = await chEng();
  check('ch closed flags all false before next chapter', !e.closed.poll && !e.closed.prediction && !e.closed.debate, e.closed);

  await Chapter.updateOne({ id: String(ch2.id) }, { $set: { status: 'live' } });

  e = await chEng();
  check('ch flags: poll+pred closed, debate open after next chapter', e.closed.poll && e.closed.prediction && !e.closed.debate, e.closed);
  check('ch poll vote 409 after next chapter', (await voteCh(b, ch1.id, 'poll', { option: 1 })).status === 409);
  check('ch prediction vote 409 after next chapter', (await voteCh(b, ch1.id, 'prediction', { option: 1 })).status === 409);
  check('ch debate vote still 200 after next chapter', (await voteCh(b, ch1.id, 'debate', { side: 'against' })).status === 200);

  // book-wide while ongoing
  check('book poll open while ongoing', (await voteBook(a, 'poll', { id: 'bpoll', option: 0 })).status === 200);
  check('book prediction open while ongoing', (await voteBook(a, 'prediction', { id: 'bpred', option: 0 })).status === 200);
  check('book debate open while ongoing', (await voteBook(a, 'debate', { id: 'bdeb', side: 'for' })).status === 200);
  let be = await bookEng();
  check('book flags all open while ongoing', !be.engagement.polls[0].closed && !be.engagement.predictions[0].closed && !be.engagement.debates[0].closed, {
    p: be.engagement.polls[0].closed, pr: be.engagement.predictions[0].closed, d: be.engagement.debates[0].closed,
  });

  await Book.updateOne({ id: String(book.id) }, { $set: { status: 'completed' } });

  be = await bookEng();
  check('book flags: poll+pred closed, debate open when complete', be.engagement.polls[0].closed && be.engagement.predictions[0].closed && !be.engagement.debates[0].closed, {
    p: be.engagement.polls[0].closed, pr: be.engagement.predictions[0].closed, d: be.engagement.debates[0].closed,
  });
  check('book poll vote 409 when complete', (await voteBook(b, 'poll', { id: 'bpoll', option: 1 })).status === 409);
  check('book prediction vote 409 when complete', (await voteBook(b, 'prediction', { id: 'bpred', option: 1 })).status === 409);
  check('book debate vote still 200 when complete', (await voteBook(b, 'debate', { id: 'bdeb', side: 'against' })).status === 200);

  fs.writeFileSync(__dirname + '/smoke-engagement-windows.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-engagement-windows.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
