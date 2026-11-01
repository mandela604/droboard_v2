'use strict'
// Interactive dev server with a REAL Mongo behind it and no hosted DB.
//
//   npm run dev:memory
//
// Boots the actual Express app against an ephemeral in-memory MongoDB, seeds a
// chief / two senior editors / finance / two writers plus a book, contract,
// payment methods and payouts, then writes backend/postman/dev.env.json with the
// live port, Bearer tokens and seeded ids. Import the collection + env file into
// Postman (or just curl) and every request runs against real handlers for real.
//
// The database dies with the process — Ctrl+C wipes everything, which is the
// point: you can delete rows, double-flag, over-assign and break it freely.
//
// REQUIRES the Microsoft VC++ 2015-2022 x64 runtime, or mongod.exe aborts with
// 0xC0000135 (DLL not found).
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '4177';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
// Long enough that a browse-and-click session doesn't die mid-page. Production
// stays at 15m; this only applies to this throwaway server.
process.env.JWT_ACCESS_TTL = '8h';
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';

const PW = 'Memory1234!';

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({
    instance: { startupTimeout: 60000, storageEngine: 'wiredTiger' },
  });
  process.env.MONGO_URI = mongod.getUri('droboard_dev');

  // The console fires 100+ calls in one burst; the shipped limits (120/min
  // general, 30/min money) would answer 429 halfway down the page. This is a
  // throwaway local server, so swap the limiters for pass-throughs before the
  // routers capture them.
  const httpMw = require('../src/middleware/http');
  const nolimit = (req, res, next) => next();
  ['generalLimiter', 'authLimiter', 'moneyLimiter', 'writeLimiter'].forEach(k => { httpMw[k] = nolimit; });

  require('../src/server');                 // real app: routers, guards, validators
  await new Promise(r => setTimeout(r, 1500));

  const argon2 = require('argon2');
  const { User } = require('../src/models/user.model');
  const { Book, Chapter, Category, Genre, Trope } = require('../src/models/content.model');
  const { Post, Comment, Collection, Notification } = require('../src/models/social.model');
  const { Contract } = require('../src/models/contract.model');
  const { Withdrawal, PaymentMethod, Wallet, CoinPack, CoinBundle, SubscriptionPlan, EarnReward } = require('../src/models/money.model');
  const { EditorPayout } = require('../src/models/editor-earnings.model');
  const { EditorAssignment } = require('../src/models/chief.model');
  const { signAccess } = require('../src/middleware/auth');

  // Cheap KDF params: this is a throwaway server and argon2 at production cost
  // is the slowest thing in the boot path.
  const hash = await argon2.hash(PW, { memoryCost: 4096, timeCost: 2, parallelism: 1 });
  async function mk(role, name, extra) {
    return User.create(Object.assign({
      fullName: name, email: `${role}.${name.toLowerCase().replace(/\W+/g, '.')}@dev.local`,
      username: name.toLowerCase().replace(/\W+/g, ''), passwordHash: hash,
      status: 'active', roles: [role],
    }, extra || {}));
  }

  const chief = await mk('chief_editor', 'Cleo Chief');
  const seA = await mk('senior_editor', 'Sam Ade');
  const seB = await mk('senior_editor', 'Bo Okafor');
  const fin = await mk('finance', 'Femi Cash');
  const a1 = await mk('writer', 'Ada Writer');
  const a2 = await mk('writer', 'Ben Scribe');
  const reader = await mk('reader', 'Rae Read');

  await EditorAssignment.create({ editorId: String(seA.id), authorIds: [String(a1.id)] });
  await EditorAssignment.create({ editorId: String(seB.id), authorIds: [String(a2.id)] });

  const bkA = await Book.create({ title: 'Nine Lives, Twice', authorId: String(a1.id), status: 'published' });
  const bkB = await Book.create({ title: 'Quiet Harbor', authorId: String(a2.id), status: 'published' });

  await Contract.create({ authorId: String(a1.id), type: 'standard', editorId: String(seA.id), status: 'sent' });
  await Contract.create({ authorId: String(a2.id), type: 'exclusive', editorId: String(seB.id), status: 'approved' });

  const pmA = await PaymentMethod.create({
    authorId: String(a1.id), type: 'bank', accountName: 'Ada Writer', bankName: 'GTBank',
    accountNumber: '0123456789', isDefault: true, verified: true,
  });
  await PaymentMethod.create({
    authorId: String(seA.id), type: 'bank', accountName: 'Sam Ade', bankName: 'Zenith',
    accountNumber: '9988776655', isDefault: true,
  });
  const wd = await Withdrawal.create({
    authorId: String(a1.id), amount: 45000, method: 'Bank Transfer',
    account: '•••• 6789', status: 'requested',
  });
  const ep = await EditorPayout.create({
    editorId: String(seA.id), amount: 120000, method: 'Bank Transfer',
    account: '•••• 4321', status: 'requested',
  });

  // ---- reader / author surface: the catalog and rows the app actually browses ----
  const cat = await Category.create({
    name: 'Romance', slug: 'romance', desc: 'Love, longing and the mess in between.',
    booksCount: 2, membersCount: 1,
  });
  const gen = await Genre.create({
    name: 'Dark Romance', slug: 'dark-romance', categoryId: String(cat.id),
    desc: 'Morally grey leads, high stakes.', booksCount: 2,
  });
  await Trope.create({ name: 'Enemies to Lovers', slug: 'enemies-to-lovers', genre: 'Dark Romance' });
  await Trope.create({ name: 'Forced Proximity', slug: 'forced-proximity', genre: 'Dark Romance' });

  await Book.bulkWrite([
    { updateOne: { filter: { _id: bkA._id }, update: { $set: {
      slug: 'nine-lives-twice', genre: 'Dark Romance', categoryId: String(cat.id),
      synopsis: 'A rival baker moves in next door. The ovens are shared.',
      tags: ['rivals', 'small-town'], tropes: ['Enemies to Lovers'],
      kind: 'short', chapterCount: 3, reads: 1240, likes: 87, rating: 4.4, ratingCount: 23,
      cover: 'https://images.unsplash.com/photo-1559339352-11d0e6a6a40b?w=400&h=600&fit=crop',
    } } } },
    { updateOne: { filter: { _id: bkB._id }, update: { $set: {
      slug: 'quiet-harbor', genre: 'Dark Romance', categoryId: String(cat.id),
      synopsis: 'A lighthouse keeper and the woman the tide returned.',
      chapterCount: 1, reads: 310, likes: 12,
      cover: 'https://images.unsplash.com/photo-1495091653883-edf2ddcad40?w=400&h=600&fit=crop',
    } } } },
  ]);
  const chs = await Chapter.insertMany([
    { bookId: String(bkA.id), n: 1, title: 'The Other Side of the Wall', status: 'live', price: 0, words: 2100, views: 890, content: '<p>She smelled the cardamom before she saw the sign.</p>' },
    { bookId: String(bkA.id), n: 2, title: 'Flour on His Sleeve', status: 'live', price: 0, words: 1850, views: 410, content: '<p>He did not apologize for the sourdough.</p>' },
    { bookId: String(bkA.id), n: 3, title: 'The Last Tray', status: 'live', price: 60, words: 2400, views: 96, content: '<p>Paid readers only from here.</p>' },
    { bookId: String(bkB.id), n: 1, title: 'Signal', status: 'live', price: 0, words: 1600, views: 220, content: '<p>The lamp turned. So did she.</p>' },
  ]);

  await Wallet.create({ userId: String(reader.id), kind: 'reader', coinBalance: 5000, bonusBalance: 500 });
  await Wallet.create({ userId: String(a1.id), kind: 'author', coinBalance: 0, fiatAvail: 45000 });

  const post = await Post.create({
    authorId: String(reader.id), type: 'post', heading: 'Chapter 3 was worth every coin',
    text: 'No spoilers, but the bakery scene. Fine work.',
  });
  const comment = await Comment.create({
    authorId: String(a2.id), scope: 'story', storyId: String(bkA.id),
    text: 'The cardamom line got me too.',
  });
  const coll = await Collection.create({
    ownerId: String(reader.id), title: 'Slow-burn bakeries', sub: 'Fiction with flour',
    stories: [String(bkA.id)], storiesCount: 1,
  });
  await Notification.create({
    recipientId: String(reader.id), actorId: String(a1.id), type: 'chapter',
    title: 'Ada Writer published "The Last Tray"', desc: 'Nine Lives, Twice, chapter 3',
    link: '/read/nine-lives-twice/3',
  });
  await Genre.create({ name: 'Thriller', slug: 'thriller', categoryId: String(cat.id), booksCount: 0 });

  await CoinPack.insertMany([
    { code: 'pack-100', coins: 100, bonusPct: 0, basePriceNGN: 1500, prices: { NGN: '₦1,500' } },
    { code: 'pack-700', coins: 700, bonusPct: 12, basePriceNGN: 9000, prices: { NGN: '₦9,000' } },
  ]);
  await CoinBundle.create({
    code: 'starter', name: 'Starter bundle', coins: 250, bonus: 50,
    basePriceNGN: 4000, prices: { NGN: '₦4,000' }, icon: 'gift', color: '#7c5cff',
  });
  await SubscriptionPlan.create({
    code: 'sub-weekly', name: 'Weekly unlimited', period: 'week', durationDays: 7,
    basePriceNGN: 1200, prices: { NGN: '₦1,200' }, features: ['All VIP chapters', 'No ads'],
  });
  await EarnReward.create({
    code: 'earn-daily', action: 'Open the app daily',
    type: require('../src/services/earn-rules').TYPES[0], coins: 5, cooldown: '1d',
  });

  // Flat mirror for the browser console at http://127.0.0.1:<port>/dev/ — it reads
  // /dev/env.json and substitutes these keys into {{token_*}} / ids. Live JWTs, so
  // both files are gitignored.
  const fs = require('fs');
  const path = require('path');
  const flat = {
    base: 'http://127.0.0.1:' + process.env.PORT,
    token_chief: signAccess(chief),
    token_se: signAccess(seA),
    token_se2: signAccess(seB),
    token_finance: signAccess(fin),
    token_writer: signAccess(a1),
    token_writer2: signAccess(a2),
    token_reader: signAccess(reader),
    password: PW,
    seId: String(seA.id),
    seId2: String(seB.id),
    authorId: String(a1.id),
    authorId2: String(a2.id),
    bookId: String(bkA.id),
    bookId2: String(bkB.id),
    withdrawalId: String(wd.id),
    epayoutId: 'ep:' + String(ep.id),
    readerId: String(reader.id),
    readerHandle: reader.username,
    authorHandle: a1.username,
    seHandle: seA.username,
    catSlug: cat.slug,
    genreSlug: gen.slug,
    bookSlug: 'nine-lives-twice',
    chapterN: String(chs[0].n),
    paidChapterN: String(chs[2].n),
    chapterId: String(chs[0].id),
    paidChapterId: String(chs[2].id),
    postId: String(post.id),
    commentId: String(comment.id),
    collectionId: String(coll.id),
    packCode: 'pack-100',
    methodId: String(pmA.id),
  };
  const consoleEnvPath = path.join(__dirname, '..', 'dev-console', 'env.json');
  fs.writeFileSync(consoleEnvPath, JSON.stringify(Object.assign({
    note: 'Regenerated by npm run dev:memory. Contains live Bearer tokens. Do not commit.',
  }, flat), null, 2));
  const envPath = path.join(__dirname, '..', 'postman', 'dev.env.json');
  fs.writeFileSync(envPath, JSON.stringify({
    name: 'Droboard in-memory dev',
    values: Object.keys(flat).map(k => ({ key: k, value: flat[k], enabled: true })),
  }, null, 2));

  const rows = [
    ['chief_editor', chief.email, 'token_chief'],
    ['senior_editor (owner)', seA.email, 'token_se'],
    ['senior_editor (other)', seB.email, 'token_se2'],
    ['finance', fin.email, 'token_finance'],
    ['writer (owns '+bkA.title+')', a1.email, 'token_writer'],
    ['reader', reader.email, 'token_reader'],
  ];
  console.log('\n================ droboard dev api (in-memory Mongo) ================');
  console.log('  >>> OPEN THIS IN YOUR BROWSER  ' + 'http://127.0.0.1:' + process.env.PORT + '/dev/');
  console.log('  base   ' + 'http://127.0.0.1:' + process.env.PORT + '/api');
  console.log('  health http://127.0.0.1:' + process.env.PORT + '/health');
  console.log('  seed   ' + envPath);
  console.log('  password for every seeded account: ' + PW + '  (flag/unflag re-confirm needs it)');
  console.log('  tokens last 8h — restart this script for a fresh database.');
  console.log('  Ctrl+C stops the server AND destroys the database.');
  console.log('  ----------------------------------------------------------------------');
  rows.forEach(r => console.log('  ' + r[0].padEnd(24) + r[1].padEnd(38) + '{{' + r[2] + '}}'));
  console.log('====================================================================\n');

  const bye = () => {
    require('mongoose').connection.close().catch(() => {});
    mongod.stop().catch(() => {}).then(() => process.exit(0));
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}
main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
