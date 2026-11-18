'use strict';
// Expiry is the ONLY gate: no expiry = open forever + no result notification;
// an end time closes votes and sends one result report to every voter when it passes.
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
  const { Notification } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const { notifyExpiredEngagement } = require('../src/services/engagement.service');
  const mk = async n => User.create({ fullName: n, email: n + '@t.co', username: n + Date.now(), passwordHash: 'x', roles: ['reader'], status: 'active' });
  const a = await mk('a'), b = await mk('b'), c = await mk('c');
  const H = u => ({ Authorization: 'Bearer ' + signAccess({ id: u.id, roles: u.roles }), 'Content-Type': 'application/json' });
  const uniq = Date.now();
  const opts = [{ t: 'A', v: 0 }, { t: 'B', v: 0 }];
  const past = new Date(Date.now() - 3600e3);
  const future = new Date(Date.now() + 86400e3);

  const book = await Book.create({
    title: 'Windows Book ' + uniq, slug: 'windows-' + uniq, authorId: String(a.id), status: 'ongoing',
    polls: [
      { id: 'bpoll_open', q: 'Q', opts: JSON.parse(JSON.stringify(opts)) },
      { id: 'bpoll_past', q: 'Q', opts: JSON.parse(JSON.stringify(opts)), expiresAt: past },
      { id: 'bpoll_future', q: 'Q', opts: JSON.parse(JSON.stringify(opts)), expiresAt: future },
    ],
    predictions: [{ id: 'bpred_open', q: 'Q', opts: JSON.parse(JSON.stringify(opts)) }],
    debates: [{ id: 'bdeb_open', motion: 'M', forV: 0, agV: 0 }],
  });
  // Chapter 1: no-expiry poll + prediction + debate; chapter 2 goes live later.
  const ch1 = await Chapter.create({
    bookId: String(book.id), n: 1, title: 'One', status: 'live',
    poll: { id: 'cpoll_open', q: 'Q', opts: JSON.parse(JSON.stringify(opts)) },
    prediction: { id: 'cpred_open', q: 'Q', opts: JSON.parse(JSON.stringify(opts)) },
    debate: { id: 'cdeb_open', motion: 'M', forV: 0, agV: 0 },
  });
  const ch2 = await Chapter.create({ bookId: String(book.id), n: 2, title: 'Two', status: 'draft' });
  // Chapter 3 already-live with an expired poll — must be closed + notify voters.
  const ch3 = await Chapter.create({
    bookId: String(book.id), n: 3, title: 'Three', status: 'live',
    poll: { id: 'cpoll_past', q: 'Q', opts: JSON.parse(JSON.stringify(opts)), expiresAt: past },
  });

  const voteCh = (u, key, kind, body) => fetch(`${BASE}/api/stories/${book.id}/chapters/${key}/${kind}/vote`, { method: 'POST', headers: H(u), body: JSON.stringify(body) });
  const chEng = (key) => fetch(`${BASE}/api/stories/${book.id}/chapters/${key}/engagement`, { headers: H(a) }).then(r => r.json());
  const voteBook = (u, body) => fetch(`${BASE}/api/stories/${book.id}/engagement/vote`, { method: 'POST', headers: H(u), body: JSON.stringify(body) });
  const bookEng = () => fetch(`${BASE}/api/stories/${book.id}/engagement`, { headers: H(a) }).then(r => r.json());

  // --- no-expiry chapter engagements stay open across chapter + book lifecycle ---
  check('ch poll open (no expiry)', (await voteCh(a, ch1.id, 'poll', { option: 0 })).status === 200);
  check('ch prediction open (no expiry)', (await voteCh(a, ch1.id, 'prediction', { option: 0 })).status === 200);
  check('ch debate open (no expiry)', (await voteCh(a, ch1.id, 'debate', { side: 'for' })).status === 200);
  await Chapter.updateOne({ id: String(ch2.id) }, { $set: { status: 'live' } });
  await Book.updateOne({ id: String(book.id) }, { $set: { status: 'completed' } });
  check('ch poll STILL open after next chapter + book complete', (await voteCh(b, ch1.id, 'poll', { option: 1 })).status === 200);
  let e = await chEng(ch1.id);
  check('ch flags all open (no expiry)', !e.closed.poll && !e.closed.prediction && !e.closed.debate, e.closed);

  // --- expired chapter poll is closed ---
  e = await chEng(ch3.id);
  check('expired ch poll flagged closed', e.closed.poll === true, e.closed);
  check('expired ch poll vote 409', (await voteCh(c, ch3.id, 'poll', { option: 0 })).status === 409);

  // --- book-wide: no expiry stays open even when complete; past expiry closes ---
  check('book poll no-expiry open even when complete', (await voteBook(a, { kind: 'poll', id: 'bpoll_open', option: 0 })).status === 200);
  check('book prediction no-expiry open', (await voteBook(a, { kind: 'prediction', id: 'bpred_open', option: 0 })).status === 200);
  check('book debate no-expiry open', (await voteBook(a, { kind: 'debate', id: 'bdeb_open', side: 'for' })).status === 200);
  check('book poll past-expiry vote 409', (await voteBook(b, { kind: 'poll', id: 'bpoll_past', option: 0 })).status === 409);
  let be = await bookEng();
  const byId = id => (be.engagement.polls.concat(be.engagement.predictions)).find(x => x.id === id);
  check('book flags: open=no expiry, closed=past, open=future', byId('bpoll_open').closed === false && byId('bpoll_past').closed === true && byId('bpoll_future').closed === false, {
    open: byId('bpoll_open').closed, past: byId('bpoll_past').closed, future: byId('bpoll_future').closed,
  });

  // --- result reports only on expiry, once per voter ---
  // Vote BEFORE expiry, then move the end time into the past, then run the job.
  const expiring = await Book.create({
    title: 'Expiring ' + uniq, slug: 'expiring-' + uniq, authorId: String(a.id), status: 'ongoing',
    polls: [{ id: 'bpoll_exp', q: 'Q', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }], expiresAt: future }],
  });
  check('vote on a live expiring poll', (await fetch(`${BASE}/api/stories/${expiring.id}/engagement/vote`, { method: 'POST', headers: H(c), body: JSON.stringify({ kind: 'poll', id: 'bpoll_exp', option: 0 }) })).status === 200);
  await Book.updateOne({ id: String(expiring.id) }, { $set: { 'polls.0.expiresAt': past } });
  const r1 = await notifyExpiredEngagement();
  const notes1 = await Notification.countDocuments({ recipientId: String(c.id), type: 'poll_closed', key: `poll-closed:${expiring.id}:bpoll_exp:${c.id}` });
  check('voter gets result report on expiry', notes1 === 1, { sent: r1.sent, notes1 });
  await notifyExpiredEngagement(); // idempotent retry
  const notes2 = await Notification.countDocuments({ recipientId: String(c.id), type: 'poll_closed', key: `poll-closed:${expiring.id}:bpoll_exp:${c.id}` });
  check('result report is not duplicated on retry', notes2 === 1, { notes2 });
  const noExpiryNotes = await Notification.countDocuments({ recipientId: String(a.id), type: 'poll_closed' });
  check('no-expiry poll produces NO result report', noExpiryNotes === 0, { noExpiryNotes });

  fs.writeFileSync(__dirname + '/smoke-engagement-windows.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-engagement-windows.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
