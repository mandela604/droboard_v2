'use strict';
// Live check for the marketing/finance fixes (2026-11-02):
//   1. GET /api/author/finance/earnings returns monthlyHistory[], lastMonth, byBook[], real pending
//   2. GET /api/author/finance/withdrawals collapses to 3-state, keys renamed
//   3. POST /api/marketing/campaigns persists channel/advertiserName/advertiserEmail
//   4. GET /api/league/board resolves the real fullName/username (no more 'Reader')
process.env.NODE_ENV = 'test';
const PORT = process.env.SMOKE_PORT || '4188';
process.env.PORT = PORT;
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const { MongoMemoryServer } = require('mongodb-memory-server');
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'XX  '} ${name}${detail !== undefined ? '  :: ' + String(detail).slice(0, 220) : ''}`);
}

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_mf_fixes');
  require('../src/server');
  for (let i = 0; i < 160; i++) {
    try { const p = await fetch('http://127.0.0.1:' + PORT + '/health'); if (p.ok) break; } catch (e) { /* boot */ }
    await new Promise(r => setTimeout(r, 250));
  }

  const { User } = require('../src/models/user.model');
  const { Book } = require('../src/models/content.model');
  const { AuthorTransaction, Withdrawal, Wallet, PaymentMethod } = require('../src/models/money.model');
  const { LeagueActivity } = require('../src/models/marketing.model');
  const { signAccess } = require('../src/middleware/auth');

  // 1 author with earnings across 3 months + a book, 2 pending withdrawals.
  const author = await User.create({
    fullName: 'Test Author', username: 'test_author', email: 'ta@example.com',
    status: 'active', roles: ['writer'], passwordHash: 'x',
  });
  const book = await Book.create({ title: 'Midnight Ink', authorId: String(author.id), status: 'published' });

  const now = Date.now();
  await AuthorTransaction.create([
    { authorId: String(author.id), type: 'earned', desc: 'Ch 1 unlock', amount: 5000, bookId: String(book.id), status: 'completed' },
    { authorId: String(author.id), type: 'earned', desc: 'Ch 2 unlock', amount: 3000, bookId: String(book.id), status: 'completed' },
    { authorId: String(author.id), type: 'bonus', desc: 'July bonus', amount: 800, status: 'completed' },
    { authorId: String(author.id), type: 'earned', desc: 'Last month', amount: 2200, bookId: String(book.id), status: 'completed' },
  ]);
  // Force the 4th row back to last month via the raw driver so Mongoose
  // timestamps do not silently reject the createdAt override.
  const lmDate = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 15);
  await AuthorTransaction.collection.updateOne({ desc: 'Last month' }, { $set: { createdAt: lmDate } });
  await Wallet.create({ userId: String(author.id), kind: 'author', coinBalance: 40, fiatAvail: 11000 });
  await Withdrawal.create([
    { authorId: String(author.id), amount: 1000, method: 'Bank Transfer', account: '•••• 0001', status: 'requested' },
    { authorId: String(author.id), amount: 2000, method: 'PayPal', account: 'a@b.com', status: 'approved' },
    { authorId: String(author.id), amount: 500, method: 'Bank Transfer', account: '•••• 0002', status: 'declined' },
  ]);

  // League rows for a real reader account.
  const reader = await User.create({
    fullName: 'Ada Reader', username: 'ada_r', email: 'ar@example.com',
    status: 'active', roles: ['reader'], passwordHash: 'x',
  });
  const { seasonId } = require('../src/services/marketing-surfaces.service');
  await LeagueActivity.create([
    { userId: String(reader.id), season: seasonId(), action: 'chapter', n: 3, points: 30 },
  ]);

  const tok = signAccess(author);
  const rtok = signAccess(reader);
  const hdr = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };

  // 1. Earnings shape.
  let r = await fetch('http://127.0.0.1:' + PORT + '/api/author/finance/earnings', { headers: hdr, credentials: 'include' });
  const e = await r.json();
  check('earnings 200', r.status === 200, 'status=' + r.status);
  check('earnings has monthlyHistory[12]', Array.isArray(e.monthlyHistory) && e.monthlyHistory.length === 12, JSON.stringify(e.monthlyHistory));
  check('earnings has lastMonth number', typeof e.lastMonth === 'number' && e.lastMonth === 2200, 'lastMonth=' + e.lastMonth);
  check('earnings thisMonth sums current rows', Math.round(e.thisMonth) === 8800, 'thisMonth=' + e.thisMonth);
  check('earnings lifetime sums 12mo + last-month', e.lifetime === 11000, 'lifetime=' + e.lifetime);
  check('earnings pending = open withdrawals (1000 + 2000)', e.pending === 3000, 'pending=' + e.pending);
  check('earnings balance uses fiatAvail', e.balance === 11000, 'balance=' + e.balance);
  check('earnings byBook rolls up per book', Array.isArray(e.byBook) && e.byBook.length === 1 && e.byBook[0].earnings === 10200 && e.byBook[0].title === 'Midnight Ink', JSON.stringify(e.byBook));

  // 2. Withdrawals collapsed.
  r = await fetch('http://127.0.0.1:' + PORT + '/api/author/finance/withdrawals', { headers: hdr, credentials: 'include' });
  const wd = await r.json();
  check('withdrawals returns array', Array.isArray(wd), 'kind=' + typeof wd);
  check('withdrawals collapses to 3-state',
    wd.length === 3 && wd.every(w => ['pending', 'approved', 'declined'].includes(w.status)),
    JSON.stringify(wd.map(x => x.status)));
  check('withdrawals renames requestedAt -> requested', wd.every(w => typeof w.requested === 'string' && w.requested.length > 0));

  // 3. Campaign create persists advertiser fields.
  const staff = await User.create({
    fullName: 'Tari Marketer', username: 'tari', email: 'tm@example.com',
    status: 'active', roles: ['marketing'], passwordHash: 'x',
  });
  const sth = { Authorization: 'Bearer ' + signAccess(staff), 'Content-Type': 'application/json' };
  r = await fetch('http://127.0.0.1:' + PORT + '/api/marketing/campaigns', {
    method: 'POST', headers: sth, credentials: 'include',
    body: JSON.stringify({
      name: 'PiggyVest Reader Drive', status: 'draft', type: 'business',
      advertiserName: 'PiggyVest', advertiserEmail: 'ads@piggyvest.com', channel: 'newsletter',
      placements: ['feed'],
    }),
  });
  const camp = await r.json();
  check('campaign create 200/201', r.status === 200 || r.status === 201, 'status=' + r.status + ' body=' + JSON.stringify(camp).slice(0, 200));
  check('campaign persisted advertiserName', camp.advertiserName === 'PiggyVest', 'advertiserName=' + camp.advertiserName);
  check('campaign persisted advertiserEmail', camp.advertiserEmail === 'ads@piggyvest.com');
  check('campaign persisted channel', camp.channel === 'newsletter', 'channel=' + camp.channel);

  // 4. League board resolves real handle/name.
  r = await fetch('http://127.0.0.1:' + PORT + '/api/league/board', { headers: { Authorization: 'Bearer ' + rtok }, credentials: 'include' });
  const board = await r.json();
  const row = (board.entries || []).find(x => String(x.userId) === String(reader.id));
  check('league board resolves the real reader', row && row.handle === 'ada_r' && row.name === 'Ada Reader',
    JSON.stringify(row && { handle: row.handle, name: row.name }));

  const passed = results.filter(x => x.pass).length;
  console.log(`\n===== ${passed}/${results.length} fix assertions passed =====`);
  await require('mongoose').disconnect();
  await mongod.stop();
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
