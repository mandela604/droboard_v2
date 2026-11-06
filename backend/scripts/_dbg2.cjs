'use strict';
// Scratch: why does the authenticated story read fail, and do the engagement
// vote indexes actually exist? Delete after use.
process.env.NODE_ENV = 'test';
process.env.PORT = '4210';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 90000 } });
  process.env.MONGO_URI = mongod.getUri('dbg2');
  const { Book, Chapter, EngagementVote } = require('../src/models/content.model');
  const { User } = require('../src/models/user.model');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const u = await User.create({ id: 'u1', username: 'dbg1', email: 'd1@test.co', passwordHash: 'x' });
  const r = await User.create({ id: 'u2', username: 'dbg2', email: 'd2@test.co', passwordHash: 'x' });
  const b = await Book.create({ title: 'Dbg', authorId: 'u1', status: 'published', genre: 'Betrayal' });
  await Chapter.create({ bookId: b.id, n: 1, title: 'C1', words: 100, status: 'live' });
  b.polls = [{ id: 'p1', q: 'Q?', opts: [{ t: 'A', v: 0 }, { t: 'B', v: 0 }], expiresAt: null }];
  await b.save();
  await EngagementVote.create({ chapterId: '', bookId: b.id, itemId: 'p1', userId: 'u2', kind: 'poll', optionIdx: 0 });

  const idx = await EngagementVote.collection.indexes();
  console.log('VOTE INDEXES', JSON.stringify(idx));
  let dup = 'no';
  try {
    await EngagementVote.create({ chapterId: '', bookId: b.id, itemId: 'p1', userId: 'u2', kind: 'poll', optionIdx: 1 });
  } catch (e) { dup = e.code === 11000 ? 'BLOCKED by index' : 'threw ' + e.message; }
  console.log('duplicate vote same row ->', dup);

  const books = require('../src/services/books.service');
  try {
    const full = await books.getBookDetail(b.id, 'u2');
    console.log('READ OK keys=', Object.keys(full).join(','), 'engPolls=', full.engagement.polls.length,
      'myVote=', JSON.stringify(full.engagement.polls.map(p => p.myVote)), 'likes=', full.stats.likes);
  } catch (e) {
    console.log('READ THREW', e && e.stack);
  }
  await mongod.stop();
  process.exit(0);
})().catch(e => { console.error('ERR', e && e.stack || e); process.exit(2); });
