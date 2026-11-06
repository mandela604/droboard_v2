'use strict';
// Reader story page (bridge) end-to-end: the story read, story-wide votes on
// several rows per kind, reactions, hubs, tips, similar. Real HTTP + in-memory
// Mongo, because a shape the page cannot vote with is not production ready.
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4201';
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
  process.env.MONGO_URI = mongod.getUri('dro_bridge_read');
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

  const { Book, Chapter, Category, Genre } = require('../src/models/content.model');
  const { LedgerEntry, Mute } = Object.assign({}, require('../src/models/money.model'), require('../src/models/social.model'));
  // Slug is minted by books.service.createBook, not the schema, so a seeded
  // book needs the same shape or the slug-addressed checks hit /undefined/.
  const { slugify } = require('../src/services/books.service');

  // ── seed: author, reader, a live book with 3 chapters and a real hub ──
  let r = await call('POST', '/api/auth/signup', { name: 'Bridge Author', username: 'bridgeauth1', email: 'ba@test.co', password: 'SecurePass123!' });
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'bridgeauth1', password: 'SecurePass123!' });
  const authorToken = r.json.access;
  const authorId = String(r.json.user.id);

  r = await call('POST', '/api/auth/signup', { name: 'Bridge Reader', username: 'bridgereader1', email: 'br@test.co', password: 'SecurePass123!' });
  r = await call('POST', '/api/auth/login', { emailOrUsername: 'bridgereader1', password: 'SecurePass123!' });
  const readerToken = r.json.access;
  const readerId = String(r.json.user.id);

  const cat = await Category.create({ name: 'Betrayal', slug: 'betrayal', icon: '💔', status: 'active' });
  await Genre.create({ name: 'Betrayal', slug: 'betrayal-g', categoryId: cat.id, status: 'active' });
  const book = await Book.create({
    title: 'The Photograph', authorId, status: 'published', genre: 'Betrayal', categoryId: cat.id,
    synopsis: 'A marriage and a grief.', tropes: ['Second Chance', 'Secret Baby'], tags: ['grief'],
    reads: 1234, chapterCount: 3,
  });
  book.slug = slugify(book.title) + '-' + String(book.id).slice(-6);
  await book.save();
  for (let n = 1; n <= 3; n++) {
    await Chapter.create({ bookId: book.id, n, title: 'Chapter ' + n, words: 700, status: 'live', price: n === 3 ? 20 : 0 });
  }
  // A second live book, same tropes — the more-like-this row's proof.
  const other = await Book.create({
    title: 'Quiet Sister', authorId, status: 'published', genre: 'Betrayal', categoryId: cat.id,
    tropes: ['Second Chance'], reads: 999,
  });
  const B = '/api/books/' + book.id;
  const AE = '/api/author/books/' + book.id + '/engagement';

  // ── the single story read ──
  r = await call('GET', B);
  const d = r.json || {};
  check('B1 GET /api/books/:id -> 200 with chapters + writer + engagement + stats',
    r.status === 200 && d.chapters.length === 3 && d.writer && d.engagement && d.stats,
    `${r.status} ch=${(d.chapters || []).length}`);
  check('B2 writer card carries the fields the card renders',
    !!d.writer && !!d.writer.name && d.writer.handle.startsWith('@') && 'followers' in d.writer &&
    'verified' in d.writer && 'following' in d.writer && 'stories' in d.writer && 'reads' in d.writer &&
    'rating' in d.writer && 'bio' in d.writer,
    JSON.stringify(d.writer && Object.keys(d.writer)));
  check('B3 writer stats come from the live catalogue (2 books, reads summed)',
    d.writer.stories === 2 && d.writer.reads === 1234 + 999,
    `stories=${d.writer.stories} reads=${d.writer.reads}`);
  check('B4 stats block: comments/reads/shares/rating/likes all present',
    d.stats.reads === 1234 && 'comments' in d.stats && 'shares' in d.stats && 'likes' in d.stats && 'ratingCount' in d.stats,
    JSON.stringify(d.stats));
  check('B5 all ten reaction keys, anonymous sees userRx null',
    !!d.reactions && ['love', 'crying', 'angry', 'shocked', 'broken', 'emotional', 'savage', 'sus', 'twist', 'laughing']
      .every(k => k in d.reactions.counts) && d.reactions.userRx === null,
    JSON.stringify(d.reactions && Object.keys(d.reactions.counts || {})));
  check('B6 chapter rows keep price + engagement so the list renders locked/free',
    d.chapters[2].price === 20 && d.chapters[0].price === 0,
    JSON.stringify(d.chapters.map(c => c.price)));
  check('B7 board hub is a real joined-able board, circle is not shipped',
    d.hubs && d.hubs.board && d.hubs.board.name === 'Betrayal' && d.hubs.board.joined === false && d.hubs.circle === null,
    JSON.stringify(d.hubs));
  check('B8 similar excludes self and stays live-only',
    Array.isArray(d.similar) && d.similar.length === 1 && d.similar[0].id === other.id && !!d.similar[0].author,
    JSON.stringify((d.similar || []).map(s => s.title)));
  check('B9 anonymous gets null personal state (no crash, no fake vote)',
    d.continueReading === null && d.save.saved === false,
    JSON.stringify({ c: d.continueReading, s: d.save }));
  check('B10 tipCount starts at 0 (ledger, not a made-up number)', d.tipCount === 0, `${d.tipCount}`);

  // ── the author sets story-wide engagement (2 polls: the old index could not) ──
  r = await call('POST', AE, { kind: 'poll', question: 'Who was at fault?', opts: [{ t: 'Him', v: 0 }, { t: 'Nobody', v: 0 }] }, authorToken);
  check('B11 author creates poll #1 -> 201', r.status === 201 && !!r.json.id, `${r.status}`);
  const poll1 = r.json.id;
  r = await call('POST', AE, { kind: 'poll', question: 'Should she stay?', opts: [{ t: 'Stay', v: 0 }, { t: 'Leave', v: 0 }, { t: 'Wait', v: 0 }] }, authorToken);
  check('B12 author creates poll #2 -> 201', r.status === 201 && !!r.json.id, `${r.status}`);
  const poll2 = r.json.id;
  r = await call('POST', AE, { kind: 'prediction', question: 'What happens in Ch 4?', opts: [{ t: 'Twist', v: 0 }, { t: 'Silence', v: 0 }] }, authorToken);
  const pred1 = r.json.id;
  check('B13 author creates prediction -> 201', r.status === 201 && !!pred1, `${r.status}`);
  r = await call('POST', AE, {
    kind: 'debate', motion: 'She should fight for the marriage',
    forText: 'Fight', againstText: 'Walk away',
  }, authorToken);
  const deb1 = r.json.id;
  check('B14 author creates debate with custom side labels -> 201', r.status === 201 && !!deb1, `${r.status}`);
  r = await call('POST', AE, {
    kind: 'poll', question: 'Closed poll?', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }],
    expiresAt: Date.now() - 60000,
  }, authorToken);
  const deadPoll = r.json.id;
  check('B15 author creates an already-expired poll -> 201', r.status === 201 && !!deadPoll, `${r.status}`);

  const V = '/api/stories/' + book.id + '/engagement/vote';

  // ── reader votes: the bug was that this route always 400ed ──
  r = await call('POST', V, { id: poll1, kind: 'poll', option: 0 }, readerToken);
  check('B16 story-wide poll vote -> 200 (was 400 bad_kind)',
    r.status === 200 && r.json.item.totalVotes === 1 && r.json.item.myVote === 0 && r.json.item.opts[0].v === 1,
    `${r.status} ${JSON.stringify(r.json && r.json.item && { t: r.json.item.totalVotes, my: r.json.item.myVote })}`);
  check('B17 voted option carries a percentage for the bar',
    r.status === 200 && r.json.item.opts[0].pct === 100 && r.json.item.opts[0].picked === true && r.json.item.opts[1].pct === 0,
    JSON.stringify(r.json && r.json.item && r.json.item.opts));

  r = await call('POST', V, { id: poll2, kind: 'poll', option: 2 }, readerToken);
  check('B18 the SAME reader votes a SECOND poll on the same book -> 200 (one row per vote now)',
    r.status === 200 && r.json.item.myVote === 2 && r.json.item.totalVotes === 1,
    `${r.status} ${JSON.stringify(r.json && { s: r.json.error || null, my: r.json.item && r.json.item.myVote })}`);

  r = await call('POST', V, { id: poll1, kind: 'poll', option: 1 }, readerToken);
  check('B19 voting poll #1 twice -> 409 already_voted', r.status === 409, `${r.status} ${JSON.stringify(r.json)}`);

  r = await call('POST', V, { id: deb1, kind: 'debate', side: 'against' }, readerToken);
  check('B20 debate vote -> 200 with agV and side-word myVote + labels survive',
    r.status === 200 && r.json.item.agV === 1 && r.json.item.myVote === 'against' &&
    r.json.item.forText === 'Fight' && r.json.item.againstText === 'Walk away',
    `${r.status} ${JSON.stringify(r.json && r.json.item && { agV: r.json.item.agV, my: r.json.item.myVote, ft: r.json.item.forText })}`);

  r = await call('POST', V, { id: deadPoll, kind: 'poll', option: 0 }, readerToken);
  check('B21 vote on an expired poll -> 409 closed', r.status === 409, `${r.status} ${JSON.stringify(r.json)}`);

  r = await call('POST', V, { id: pred1, kind: 'poll', option: 0 }, readerToken);
  check('B22 wrong kind for a row -> 404 (kind picks the array)', r.status === 404, `${r.status}`);

  r = await call('POST', V, { id: poll1, kind: 'poll' }, readerToken);
  check('B23 poll vote with no option -> 400 at the schema', r.status === 400, `${r.status}`);

  r = await call('POST', V, { id: poll1, kind: 'poll', option: 0 });
  check('B24 anonymous vote -> 401', r.status === 401, `${r.status}`);

  // ── the reader's own state, from the story read and the engagement read ──
  r = await call('GET', '/api/stories/' + book.id + '/engagement', undefined, readerToken);
  const eng = (r.json || {}).engagement || {};
  check('B25 GET /engagement nests shaped arrays and marks my rows voted',
    r.status === 200 && eng.polls.length === 3 && eng.debates.length === 1 &&
    eng.polls.find(p => p.id === poll1).myVote === 0 &&
    eng.polls.find(p => p.id === poll2).myVote === 2 &&
    eng.debates[0].myVote === 'against',
    `${r.status} polls=${(eng.polls || []).length} ${JSON.stringify((eng.polls || []).map(p => p.myVote))}`);
  check('B26 expired poll is flagged closed so the page stops offering it',
    !!eng.polls.find(p => p.id === deadPoll) && eng.polls.find(p => p.id === deadPoll).closed === true &&
    eng.polls.find(p => p.id === poll1).closed === false,
    JSON.stringify((eng.polls || []).map(p => [p.id === deadPoll, p.closed])));
  check('B27 every row ships the id + kind the vote body needs',
    eng.polls.every(p => p.id && p.kind === 'poll') && eng.debates.every(x => x.id && x.kind === 'debate'),
    JSON.stringify((eng.polls || []).map(p => [p.kind, !!p.id])));

  r = await call('GET', B, undefined, readerToken);
  check('B28 the story read carries the same myVote state (one call renders the page)',
    r.json.engagement.polls.find(p => p.id === poll1).myVote === 0,
    JSON.stringify((r.json.engagement.polls || []).map(p => p.myVote)));

  // ── retract must undo the row it names, not the first row it finds ──
  r = await call('DELETE', '/api/stories/' + book.id + '/engagement/poll/' + poll1, undefined, readerToken);
  const afterRetract = (r.json || {}).engagement || {};
  const p1 = afterRetract.polls.find(p => p.id === poll1);
  const p2 = afterRetract.polls.find(p => p.id === poll2);
  check('B29 retract poll #1 -> 200 and only that row drops',
    r.status === 200 && p1.totalVotes === 0 && p1.opts[0].v === 0 && p1.myVote === null && p2.opts[2].v === 1,
    `${r.status} p1=${p1 && p1.totalVotes} p2=${p2 && p2.totalVotes}`);
  r = await call('DELETE', '/api/stories/' + book.id + '/engagement/poll/' + poll1, undefined, readerToken);
  check('B30 retract poll #1 again with nothing left to undo -> 404 no_vote', r.status === 404, `${r.status}`);
  r = await call('POST', V, { id: poll1, kind: 'poll', option: 1 }, readerToken);
  check('B31 re-vote after retract -> 200 (the row is free again)', r.status === 200 && r.json.item.myVote === 1, `${r.status}`);
  r = await call('POST', V, { id: poll1, kind: 'poll', option: 1 }, readerToken);
  check('B32 voting straight after the re-vote -> 409 already_voted', r.status === 409, `${r.status}`);

  // ── voting by slug ──
  r = await call('POST', '/api/stories/' + book.slug + '/engagement/vote', { id: pred1, kind: 'prediction', option: 0 }, readerToken);
  check('B33 vote addressed by SLUG -> 200 (id-or-slug everywhere)', r.status === 200 && r.json.item.myVote === 0, `${r.status}`);

  // ── reactions: the grid and the topbar like are one surface ──
  r = await call('POST', B + '/reaction', { rid: 'love' }, readerToken);
  check('B34 react love -> 200, count 1, likes reconciles to 1',
    r.status === 200 && r.json.counts.love === 1 && r.json.likes === 1 && r.json.userRx === 'love',
    `${r.status} ${JSON.stringify(r.json && { love: r.json.counts.love, likes: r.json.likes })}`);
  r = await call('POST', B + '/reaction', { rid: 'love' }, readerToken);
  check('B35 same reaction twice -> still one (no double count)', r.json.counts.love === 1 && r.json.likes === 1, JSON.stringify(r.json));
  r = await call('POST', B + '/reaction', { rid: 'savage' }, readerToken);
  check('B36 swapping to savage moves the vote (love 0, savage 1, likes 1)',
    r.json.counts.love === 0 && r.json.counts.savage === 1 && r.json.likes === 1 && r.json.userRx === 'savage',
    JSON.stringify(r.json && r.json.counts && { l: r.json.counts.love, s: r.json.counts.savage, likes: r.json.likes }));
  r = await call('POST', B + '/reaction', { rid: 'lol' }, readerToken);
  check('B37 unknown reaction id -> 400', r.status === 400, `${r.status}`);
  r = await call('POST', B + '/reaction', { rid: 'love' });
  check('B38 anonymous reaction -> 401', r.status === 401, `${r.status}`);
  r = await call('GET', B, undefined, readerToken);
  check('B39 story read shows my reaction and Book.likes equals the grid sum',
    r.json.reactions.userRx === 'savage' && r.json.reactions.counts.savage === 1 && r.json.stats.likes === 1,
    JSON.stringify(r.json.reactions && { u: r.json.reactions.userRx, c: r.json.reactions.counts.savage, likes: r.json.stats.likes }));
  r = await call('DELETE', B + '/reaction', undefined, readerToken);
  check('B40 unreact -> counts and likes fall back to 0', r.status === 200 && r.json.userRx === null && r.json.likes === 0, JSON.stringify(r.json));

  // ── tips come from the ledger, author-scoped ──
  await LedgerEntry.create({
    entryId: 'e1', journalId: 'j1', debitAcct: 'wallet:' + readerId, creditAcct: 'wallet:author:' + authorId,
    amount: 300, coins: 100, authorId, kind: 'tip', idempotencyKey: 'tip:seed:1',
  });
  await LedgerEntry.create({
    entryId: 'e2', journalId: 'j2', debitAcct: 'wallet:' + readerId, creditAcct: 'pool:platform',
    amount: 100, coins: 40, authorId: 'someone_else', kind: 'tip', idempotencyKey: 'tip:seed:2',
  });
  r = await call('GET', B);
  check('B41 tipCount counts this author\'s ledger tips only', r.json.tipCount === 1, `${r.json.tipCount}`);

  // ── similar as its own action ──
  r = await call('GET', B + '/similar?limit=5');
  check('B42 GET /:id/similar -> live neighbours, self excluded',
    r.status === 200 && r.json.items.length === 1 && r.json.items[0].id === other.id,
    `${r.status} ${JSON.stringify(r.json && r.json.items && r.json.items.map(i => i.title))}`);

  // ── privacy: a muted author disappears from the reader's story read ──
  await Mute.create({ muterId: readerId, mutedId: authorId });
  r = await call('GET', B, undefined, readerToken);
  check('B43 muting the author hides the story (404, not an error page)', r.status === 404, `${r.status} ${JSON.stringify(r.json)}`);
  await Mute.deleteMany({ muterId: readerId, mutedId: authorId });

  // ── a draft never surfaces ──
  const draft = await Book.create({ title: 'Unpublished', authorId, status: 'draft', genre: 'Betrayal' });
  r = await call('GET', '/api/books/' + draft.id);
  check('B44 draft book -> 404 on the reader read', r.status === 404, `${r.status}`);

  // ── chapter-level votes share the EngagementVote index, so they are proved
  //    in the same run: the story page renders per-chapter polls too ──
  const ch1 = await Chapter.findOne({ bookId: book.id, n: 1 });
  ch1.poll = { q: 'Who should she call?', opts: [{ t: 'Her sister', v: 0 }, { t: 'The police', v: 0 }] };
  await ch1.save();
  const CV = '/api/stories/' + book.id + '/chapters/1';
  r = await call('POST', CV + '/poll/vote', { option: 0 }, readerToken);
  check('C1 reader votes a chapter poll -> 200 and the count moves',
    r.status === 200 && r.json.opts[0].v === 1, `${r.status} ${JSON.stringify(r.json && r.json.opts)}`);
  r = await call('POST', CV + '/poll/vote', { option: 1 }, readerToken);
  check('C2 a second vote on the same chapter poll -> 409 already_voted', r.status === 409, `${r.status}`);
  r = await call('GET', CV + '/engagement', undefined, readerToken);
  check('C3 chapter engagement read returns the reader option',
    r.status === 200 && r.json.myVotes.poll === 0,
    `${r.status} ${JSON.stringify(r.json)}`);
  r = await call('DELETE', CV + '/poll', undefined, readerToken);
  const chAfter = await Chapter.findOne({ bookId: book.id, n: 1 }).lean();
  check('C4 retract the chapter poll -> 200 and the stored count falls back',
    r.status === 200 && chAfter.poll.opts[0].v === 0, `${r.status} v=${chAfter.poll.opts[0].v}`);
  // Progress returns a live ReadingProgress doc, so it is the other shape
  // normalize() could recurse into — prove it serializes instead of 500ing.
  r = await call('POST', CV + '/progress', { secondsSpent: 120, pct: 40 }, readerToken);
  check('C5 chapter progress -> 200 with the running total (no live-doc recursion)',
    r.status === 200 && r.json.totalSecs === 120, `${r.status} ${JSON.stringify(r.json)}`);

  const failed = out.filter(x => !x.pass);
  console.log('\n' + (out.length - failed.length) + '/' + out.length + ' passed');
  failed.forEach(f => console.log('  - ' + f.name));
  await mongod.stop();
  process.exit(failed.length ? 1 : 0);
}
main().catch(e => { console.error('HARNESS ERROR', e && e.stack || e); process.exit(2); });
