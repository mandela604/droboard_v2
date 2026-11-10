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
    // launchTimeout is the one this build honours — instance.startupTimeout
    // is ignored and the cold mongod then "fails" at its own 10s.
    instance: { launchTimeout: 60000, startupTimeout: 60000, storageEngine: 'wiredTiger' },
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
  const { Book, Chapter, Category, Genre, Trope, BookDailyStat, CategoryMembership } = require('../src/models/content.model');
  const { Post, Comment, Collection, CollectionFollow, Notification, Discussion, Status, LibraryItem, Follow, ReadingProgress, Reaction } = require('../src/models/social.model');
  const { FeaturedPlacement } = require('../src/models/editorial.model');
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
  // The marketing console (ad placements, campaigns) is a role of its own, so
  // the dev box needs an account that passes requireRole('admin','marketing').
  const mkt = await mk('marketing', 'Mira Marks');
  // Avatars are rendered fields on every post card, so they are seeded with
  // real, 200-checked image urls — an empty avatar paints a broken <img> and
  // makes the card test look like a frontend bug.
  const a1 = await mk('writer', 'Ada Writer', { avatar: 'https://i.pravatar.cc/100?img=32' });
  const a2 = await mk('writer', 'Ben Scribe', { avatar: 'https://i.pravatar.cc/100?img=12' });
  const reader = await mk('reader', 'Rae Read', { avatar: 'https://i.pravatar.cc/150?img=47' });

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
  // The board's own admin/moderator list is set by the platform admin, not by
  // the CE — a1 is the board admin here so the board gate is exercisable
  // without being staff.
  const cat = await Category.create({
    name: 'Romance', slug: 'romance', desc: 'Love, longing and the mess in between.',
    booksCount: 2, membersCount: 3,
    adminIds: [String(a1.id)], moderatorIds: [String(a2.id)],
  });
  await CategoryMembership.create({ userId: String(a1.id), categoryId: String(cat.id) });
  await CategoryMembership.create({ userId: String(a2.id), categoryId: String(cat.id) });
  await CategoryMembership.create({ userId: String(reader.id), categoryId: String(cat.id) });
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
      cover: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
    } } } },
    { updateOne: { filter: { _id: bkB._id }, update: { $set: {
      slug: 'quiet-harbor', genre: 'Dark Romance', categoryId: String(cat.id),
      synopsis: 'A lighthouse keeper and the woman the tide returned.',
      chapterCount: 1, reads: 310, likes: 12,
      cover: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg',
    } } } },
  ]);
  const chs = await Chapter.insertMany([
    { bookId: String(bkA.id), n: 1, title: 'The Other Side of the Wall', status: 'live', price: 0, words: 2100, views: 890, content: '<p>She smelled the cardamom before she saw the sign.</p>',
      poll: { q: 'Who opens the bakery?', opts: [{ t: 'Amara', v: 42 }, { t: 'Tunde', v: 17 }] },
      prediction: { q: 'What does the note say?', opts: [{ t: 'A confession', v: 9 }, { t: 'A bill', v: 31 }] },
      debate: { motion: 'Should Amara tell him the truth?', forText: 'Yes, she owes it to him.', againstText: 'No, some things stay unsaid.', forV: 12, agV: 8 },
      authorNote: 'This chapter took two rewrites to land.' },
    { bookId: String(bkA.id), n: 2, title: 'Flour on His Sleeve', status: 'live', price: 0, words: 1850, views: 410, content: '<p>He did not apologize for the sourdough.</p>' },
    { bookId: String(bkA.id), n: 3, title: 'The Last Tray', status: 'live', price: 60, words: 2400, views: 96, content: '<p>Paid readers only from here.</p>' },
    { bookId: String(bkB.id), n: 1, title: 'Signal', status: 'live', price: 0, words: 1600, views: 220, content: '<p>The lamp turned. So did she.</p>' },
  ]);
  const bkA_ch1 = chs[0];

  // Daily read counts per book. The profile insights read window/previous-window
  // deltas from these rows, so without them the Reads card is always 0.
  const dayKey = d => new Date(d).toISOString().slice(0, 10);
  const statRows = [];
  for (let i = 0; i < 14; i++) {
    const day = dayKey(Date.now() - i * 864e5);
    statRows.push({ bookId: String(bkA.id), day, reads: 40 + ((i * 17) % 55), finishes: i % 4 });
    statRows.push({ bookId: String(bkB.id), day, reads: 12 + ((i * 7) % 21), finishes: i % 3 });
  }
  await BookDailyStat.insertMany(statRows);

  await Wallet.create({ userId: String(reader.id), kind: 'reader', coinBalance: 5000, bonusBalance: 500 });
  await Wallet.create({ userId: String(a1.id), kind: 'author', coinBalance: 0, fiatAvail: 45000 });

  const post = await Post.create({
    authorId: String(reader.id), type: 'post', heading: 'Chapter 3 was worth every coin',
    text: 'No spoilers, but the bakery scene. Fine work.',
  });
  // Feed-page cards that exercise the three live columns (rank / repost
  // original / community badge+controversy) so the browser test renders them.
  const COVER_FX = 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg';
  await Post.create({
    authorId: String(a1.id), type: 'post', rank: '#1 This Week',
    text: 'Writing at 2am hits different — the quiet makes the grief louder.',
    image: COVER_FX, likesCount: 612, commentsCount: 89,
  });
  const rankPost = await Post.findOne({ type: 'post', rank: '#1 This Week' });
  await Post.create({
    authorId: String(a2.id), type: 'repost', note: 'Luna never disappoints.',
    likesCount: 98, commentsCount: 27,
    original: { name: 'Ada Writer', avatar: 'https://i.pravatar.cc/100?img=32', time: '2h ago', text: 'Chapter 21 is live.', cover: COVER_FX, title: 'Nine Lives, Twice' },
  });
  const firstDiscussion = await Discussion.create({ genreId: String(gen.id), authorId: String(a1.id), title: 'Best bakery rivals trope?', body: 'Rank the slow-burn ones you have read.', tag: 'discussion', badge: 'Top', badgeClass: 'author', controversy: 12, likes: 300, commentsCount: 51, score: 90, hot: true });
  await Discussion.create({ genreId: String(gen.id), authorId: String(a2.id), title: 'That chapter 3 cardamom line', body: 'Did you see it coming?', tag: 'controversial', badge: 'Top', controversy: 86, likes: 88, commentsCount: 9, score: 40 });

  const comment = await Comment.create({
    authorId: String(a2.id), scope: 'story', storyId: String(bkA.id),
    text: 'The cardamom line got me too.',
  });
  // Chapter-scoped row: the reader's comment thread is chapter-scoped, so the
  // story row above never shows there.
  await Comment.create({
    authorId: String(a1.id), scope: 'chapter', storyId: String(bkA.id), chapterId: String(bkA_ch1.id),
    text: 'Author here — the cardamom was the whole point of the chapter.',
  });
  // Engagement rows the insights cards read (followers / active readers /
  // comments). Without them those cards can only ever render 0 and the live
  // numbers are untestable.
  const postComment = await Comment.create({
    authorId: String(reader.id), scope: 'post', postId: String(rankPost.id),
    text: 'This line is the whole reason I keep coming back.',
  });
  await Comment.create({
    authorId: String(reader.id), scope: 'discussion', discussionId: String(firstDiscussion.id),
    text: 'Slow burn always wins for me.',
  });
  await Follow.create({ followerId: String(reader.id), followingId: String(a1.id) });
  await Follow.create({ followerId: String(reader.id), followingId: String(a2.id) });
  await Follow.create({ followerId: String(seA.id), followingId: String(a1.id) });
  await Follow.create({ followerId: String(chief.id), followingId: String(a1.id) });
  await ReadingProgress.create({
    userId: String(reader.id), storyId: String(bkA.id), chapterId: String(chs[0].id),
    pct: 82, wordsRead: 1700, secondsSpent: 640, lastReadAt: new Date(),
  });
  await ReadingProgress.create({
    userId: String(a2.id), storyId: String(bkA.id), chapterId: String(chs[1].id),
    pct: 40, wordsRead: 900, secondsSpent: 210, lastReadAt: new Date(),
  });
  await Reaction.create({
    userId: String(reader.id), targetType: 'post', targetId: String(rankPost.id), rid: 'like',
  });
  await Reaction.create({
    userId: String(reader.id), targetType: 'comment', targetId: String(postComment.id), rid: 'like',
  });
  await Reaction.create({
    userId: String(a2.id), targetType: 'comment', targetId: String(comment.id), rid: 'like',
  });
  const coll = await Collection.create({
    ownerId: String(reader.id), title: 'Slow-burn bakeries', sub: 'Fiction with flour',
    stories: [String(bkA.id)], storiesCount: 1, followers: 2, sharesCount: 5, visits: 148,
  });
  await CollectionFollow.create({ userId: String(a1.id), collectionId: String(coll.id) });
  await CollectionFollow.create({ userId: String(a2.id), collectionId: String(coll.id) });
  await Notification.create({
    recipientId: String(reader.id), actorId: String(a1.id), type: 'new_chapter',
    title: 'Ada Writer published "The Last Tray"', desc: 'Nine Lives, Twice, chapter 3',
    link: 'full-reader.html?story=' + encodeURIComponent(String(bkA.id)) + '&ch=3',
  });
  await Genre.create({ name: 'Thriller', slug: 'thriller', categoryId: String(cat.id), booksCount: 0 });

  // Awaited: the boot log prints the live port, and a caller that starts
  // hitting /discover the instant it appears must find the rows already there.
  await seedDiscover({ bkA, bkB, a1, a2, reader, chief, coll, cat });

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
    token_marketing: signAccess(mkt),
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
    ['marketing', mkt.email, 'token_marketing'],
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
/* Discover page rows. With USE_API flipped the page renders only what Mongo
   holds, so every surface the reader scrolls — hero carousel, editor's picks,
   continue-reading, the genre rows, collections, the writers rings and the ad
   strip — needs real rows or the live test proves nothing. Every cover/bg URL
   here was curl-checked for 200; a dead image is a broken card, not a seed. */
async function seedDiscover(ctx) {
  const { Book, Genre } = require('../src/models/content.model');
  const { Status, LibraryItem, Collection, Post } = require('../src/models/social.model');
  const { FeaturedPlacement } = require('../src/models/editorial.model');
  const { AdPlacement } = require('../src/models/platform.model');
  const ads = require('../src/services/ads.service');

  const COVER = {
    wife: 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
    wolf3: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg',
    c1: 'https://i.postimg.cc/YGCkSw-33/1.jpg',
    c2: 'https://i.postimg.cc/JDzmhWqj/2.jpg',
    c4: 'https://i.postimg.cc/DJwFzKgd/4.jpg',
    c5: 'https://i.postimg.cc/N9jY0w4m/5.jpg',
    c6: 'https://i.postimg.cc/WF1j4Pnh/6.jpg',
    c7: 'https://i.postimg.cc/0MyxNqfz/7.jpg',
    c8: 'https://i.postimg.cc/cgLZJNmC/8.jpg',
    wolf: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg',
    wife3: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
  };

  const { bkA, bkB, a1, a2, reader, chief, coll } = ctx;

  await Genre.create([
    { name: 'Fantasy', slug: 'fantasy', categoryId: String(ctx.cat.id), desc: 'Portals, pacts and price to pay.', booksCount: 0 },
    { name: 'Werewolf', slug: 'werewolf', categoryId: String(ctx.cat.id), desc: 'Moon-bound and mated whether they like it or not.', booksCount: 0 },
  ]);

  const extra = await Book.insertMany([
    { title: 'Salt in His Veins', authorId: String(a1.id), kind: 'long', genre: 'Werewolf', cover: COVER.wolf, status: 'ongoing', slug: 'salt-in-his-veins', synopsis: 'A rejected beta, a ship-wrecked doctor, and a pack that wants her as the cure.', chapterCount: 14, reads: 5120, likes: 341, rating: 4.6, ratingCount: 58 },
    { title: 'The Ledger of Small Lies', authorId: String(a2.id), kind: 'short', genre: 'Thriller', cover: COVER.c4, status: 'ongoing', slug: 'ledger-of-small-lies', synopsis: 'The accountant noticed the missing nine thousand before the husband did.', chapterCount: 9, reads: 2210, likes: 120, rating: 4.3, ratingCount: 31 },
    { title: 'Ash Cartography', authorId: String(a1.id), kind: 'long', genre: 'Fantasy', cover: COVER.c5, status: 'ongoing', slug: 'ash-cartography', synopsis: 'She maps burns. He starts them. The empire wants both.', chapterCount: 22, reads: 8890, likes: 702, rating: 4.7, ratingCount: 140 },
    { title: 'Hollow Court', authorId: String(a2.id), kind: 'long', genre: 'Fantasy', cover: COVER.c6, status: 'completed', slug: 'hollow-court', synopsis: 'A throne of porcelain and the girl sworn to keep it cracked.', chapterCount: 31, reads: 12040, likes: 980, rating: 4.5, ratingCount: 210 },
    { title: 'Twelve Nights of Ash', authorId: String(a1.id), kind: 'short', genre: 'Dark Romance', cover: COVER.c7, status: 'completed', slug: 'twelve-nights-of-ash', synopsis: 'He had twelve nights to make her want the deal.', chapterCount: 12, reads: 15320, likes: 1440, rating: 4.8, ratingCount: 320 },
    { title: 'The Quiet Wager', authorId: String(a2.id), kind: 'short', genre: 'Romance & Drama', cover: COVER.c8, status: 'ongoing', slug: 'quiet-wager', synopsis: 'Two neighbours, one broken lift, a wager neither admits to losing.', chapterCount: 7, reads: 640, likes: 41, rating: 4.1, ratingCount: 9 },
    { title: 'No Field Left to Burn', authorId: String(a1.id), kind: 'long', genre: 'Thriller', cover: COVER.c1, status: 'ongoing', slug: 'no-field-left-to-burn', synopsis: 'The fire brigade arrived for the third time and stopped asking how.', chapterCount: 18, reads: 3410, likes: 190, rating: 4.2, ratingCount: 44 },
    { title: 'Cinder, Repeating', authorId: String(a2.id), kind: 'short', genre: 'Werewolf', cover: COVER.c2, status: 'ongoing', slug: 'cinder-repeating', synopsis: 'Every full moon she wakes one year earlier.', chapterCount: 5, reads: 1120, likes: 66, rating: 4.0, ratingCount: 12 },
  ]);
  const [bkC, bkD, bkE, bkF, bkG, bkH, bkI, bkJ] = extra;

  // Sort keys the rows actually use: trending reads, "New Releases" updatedAt.
  // bulkWrite bypasses timestamps, so the spread is explicit.
  const HOUR = 3600 * 1000;
  await Book.bulkWrite([bkC, bkD, bkE, bkF, bkG, bkH, bkI, bkJ].map((b, i) => ({
    updateOne: { filter: { _id: b._id }, update: { $set: { updatedAt: new Date(Date.now() - i * 7 * HOUR) } } },
  })));

  await FeaturedPlacement.insertMany([
    { bookId: String(bkE.id), sectionKey: 'hero-banner', tag: 'Editor’s Choice', order: 1, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkA.id), sectionKey: 'hero-banner', tag: 'Trending now', order: 2, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkC.id), sectionKey: 'hero-banner', tag: 'New serial', order: 3, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkG.id), sectionKey: 'hero-banner', tag: 'Finished & free', order: 4, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    // One deliberately not yet live: the window filter must keep it out.
    { bookId: String(bkB.id), sectionKey: 'hero-banner', tag: 'Next week', order: 5, active: true, startAt: new Date(Date.now() + 48 * HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkB.id), sectionKey: 'editors-picks', tag: 'Slow burn', order: 1, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkD.id), sectionKey: 'editors-picks', tag: 'Cold open', order: 2, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkF.id), sectionKey: 'editors-picks', tag: 'Award shortlist', order: 3, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
    { bookId: String(bkI.id), sectionKey: 'editors-picks', tag: 'New voice', order: 4, active: true, startAt: new Date(Date.now() - HOUR), endAt: null, placedBy: String(chief.id) },
  ]);

  await LibraryItem.insertMany([
    { userId: String(reader.id), storyId: String(bkA.id), list: 'continue', status: 'progress', currentChN: 2, pct: 55 },
    { userId: String(reader.id), storyId: String(bkE.id), list: 'continue', status: 'progress', currentChN: 9, pct: 31 },
    { userId: String(reader.id), storyId: String(bkC.id), list: 'library', status: 'unread' },
    { userId: String(reader.id), storyId: String(bkF.id), list: 'library', status: 'finished', currentChN: 31, pct: 100 },
    { userId: String(reader.id), storyId: String(bkB.id), list: 'saved', status: 'saved' },
    { userId: String(reader.id), storyId: String(bkA.id), list: 'saved', status: 'saved' },
    { userId: String(a2.id), storyId: String(bkA.id), list: 'saved', status: 'saved' },
  ]);

  // The only thing that lights a Top Writers ring: real, unexpired Status docs.
  const ringBg = [COVER.wife3, COVER.c2, COVER.wolf, COVER.c5];
  await Status.insertMany([
    { userId: String(a1.id), bg: ringBg[0], quote: 'Chapter 22 is live.', caption: 'Ash Cartography', likes: 24, createdAt: new Date(Date.now() - 26 * 60000), expiresAt: new Date(Date.now() + 20 * HOUR) },
    { userId: String(a1.id), bg: ringBg[1], quote: 'Writing the burn scene at 3am.', caption: 'Behind the pages', likes: 9, createdAt: new Date(Date.now() - 3 * HOUR), expiresAt: new Date(Date.now() + 20 * HOUR) },
    { userId: String(a2.id), bg: ringBg[2], quote: 'Hollow Court is finished. Thank you.', caption: 'Milestone', likes: 41, createdAt: new Date(Date.now() - 90 * 60000), expiresAt: new Date(Date.now() + 20 * HOUR) },
    { userId: String(a2.id), bg: ringBg[3], quote: 'New serial starts Monday.', caption: 'Cinder, Repeating', likes: 6, createdAt: new Date(Date.now() - 8 * HOUR), expiresAt: new Date(Date.now() + 20 * HOUR) },
  ]);

  await Collection.insertMany([
    { ownerId: String(a1.id), title: 'Burn it down slowly', sub: 'Fire, grief and slow romance', stories: [String(bkE.id), String(bkG.id), String(bkA.id)], storiesCount: 3, followers: 84, visits: 1200, privacy: 'public' },
    { ownerId: String(reader.id), title: 'Moon-bound', sub: 'Werewolf picks', stories: [String(bkC.id), String(bkJ.id)], storiesCount: 2, followers: 12, visits: 300, privacy: 'public' },
  ]);
  await Collection.updateOne({ _id: coll._id }, { $set: { stories: [String(bkA.id), String(bkG.id)], storiesCount: 2 } });

  /* Discover's three mini banners (slots named in config/adSurfaces.js). The
     markers on the page pin data-ad-format="minibanner", so these must be that
     format or the slot renders nothing. Fields are exactly what
     ad-card.js renderMinibanner reads: img, brand, headline, sub, cta. */
  const MINI = [
    ['discover:banner-top', COVER.c6, 'Copperfield Tea', 'Read one more chapter', 'The 11pm habit, in a cup'],
    ['discover:inline-banner', COVER.wife3, 'Droboard Originals', 'Write it. Get paid.', 'Signing is open this week'],
    ['discover:banner-bottom', COVER.c7, 'Twelve Nights of Ash', 'Dark romance, new season', 'Chapter 12 is live'],
  ];
  for (const [slot, img, brand, headline, sub] of MINI) {
    await ads.createAd({
      format: 'minibanner', pages: ['discover'], slots: [slot], active: true,
      img, brand, headline, title: headline, sub, cta: 'Open',
    });
  }

  /* Board (genre hub) house ads. The strip is the in-layout card, so the book
     creative goes there — that is the one that renders with the golden border
     and background (only BOOK ads get gold; see ad-card.js). */
  await ads.createAd({
    format: 'book', pages: ['genreHub'], slots: ['genreHub:strip'], active: true,
    img: COVER.c7, genre: 'Dark Romance', title: 'Twelve Nights of Ash', preview: 'He had twelve nights to make her want the deal.',
    author: '@Ada Writer', rating: 4.8, chapters: 12, url: '/read/twelve-nights-of-ash/1',
  });
  await ads.createAd({
    format: 'platform', pages: ['genreHub'], slots: ['genreHub:strip'], active: true,
    img: COVER.wife3, sponsor: 'Droboard Originals', title: 'Write it. Get paid.', cta: 'Start writing',
  });

  /* Monetag network embeds — zone 11005189 (Vignette) and zone 10931793
     (In-Page Push), pasted verbatim from the console's "<> Get tag". Both are
     OVERLAYS: the network positions its own popup, so they serve into
     genreHub:popup (a zero-height host div) and never replace the strip card.
     `code` is the field the embed renderer injects as-is, so the script tag
     really executes and Monetag serves a paid impression. */
  const MONETAG_TAG = `<script>(function(s){s.dataset.zone='11005189',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>`;
  const vignette = await ads.createAd({
    format: 'embed', pages: ['genreHub'], slots: ['genreHub:popup'], active: true,
    brand: 'Monetag', title: 'Monetag Vignette 11005189', code: MONETAG_TAG,
  });
  const INPAGE_TAG = `<script>(function(s){s.dataset.zone='10931793',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>`;
  const inpage = await ads.createAd({
    format: 'embed', pages: ['genreHub'], slots: ['genreHub:popup'], active: true,
    brand: 'Monetag', title: 'Monetag In-Page Push 10931793', code: INPAGE_TAG,
  });
  /* The placement's slots Map is keyed by the FULL namespaced slot id — that's
     what the client sends and what slotCfg() looks up, so a bare 'strip' key
     silently disables the format pin, the kill switch and the cap.
     capScope 'target' = once per board the user visits (the hub passes its
     board id as the slot's data-ad-target). */
  const hub = await AdPlacement.findOne({ page: 'genreHub' }) || new AdPlacement({ page: 'genreHub' });
  hub.slots.set('genreHub:strip', { enabled: true });
  hub.slots.set('genreHub:popup', {
    enabled: true, formats: ['embed'], adIds: [String(inpage.id), String(vignette.id)],
    cap: 'session', capCount: 1, capScope: 'target',
  });
  await hub.save();
  const dis = await AdPlacement.findOne({ page: 'discover' }) || new AdPlacement({ page: 'discover' });
  ['discover:banner-top', 'discover:inline-banner', 'discover:banner-bottom'].forEach(s => dis.slots.set(s, { enabled: true }));
  await dis.save();

  /* Library page → Saved tab. This panel holds everything saved that is NOT a
     story, and every one of those (chapter drop, repost, poll, debate, quote,
     AMA, review, recommendation, announcement, shoutout, plain post) is a Post
     doc with the saver in `savedBy` — one collection, one read model. Saved
     newest-first, so the array below is also the order the page must paint.
     `createdAt` is stamped at insert because mongoose never rewrites it on
     update, and the tab's whole contract is recency order + a relative label. */
  const SAVED = [
    {
      authorId: String(a1.id), type: 'chapter-drop', savedBy: [String(reader.id)],
      text: 'Chapter 22 landed tonight. The map finally burns.',
      likesCount: 145, commentsCount: 33,
      chapterRef: { id: String(bkE.id), title: 'Ash Cartography', author: 'Ada Writer', cover: COVER.c5, ch: 'Ch. 22', cat: 'Fantasy' },
    },
    {
      authorId: String(a2.id), type: 'repost', savedBy: [String(reader.id)],
      note: 'This is the whole argument in one line.', likesCount: 98, commentsCount: 27,
      original: { name: 'Ada Writer', avatar: 'https://i.pravatar.cc/100?img=32', time: '6h ago', text: 'Hollow Court is finished. Thank you for reading her.', cover: COVER.c6, title: 'Hollow Court' },
    },
    {
      authorId: String(a1.id), type: 'poll', savedBy: [String(reader.id)],
      text: 'Which ending do you want for Ash Cartography?', likesCount: 44, commentsCount: 61,
      poll: { q: 'Which ending do you want?', opts: [{ t: 'She burns the map', v: 812 }, { t: 'He keeps it', v: 507 }, { t: 'Both, split', v: 299 }], total: 1618, votes: [] },
    },
    {
      authorId: String(a2.id), type: 'debate', savedBy: [String(reader.id)],
      text: 'Second-chance romance is overrated. Fight me.', likesCount: 210, commentsCount: 188,
      debateData: { motion: 'Second chance beats new start', prompt: 'Convince me.', forText: 'History earns the ending', againstText: 'Same person, same end', forV: 640, agV: 712, votes: [] },
    },
    {
      authorId: String(a1.id), type: 'quote', savedBy: [String(reader.id)],
      quote: 'She maps burns. He starts them.', caption: 'Ten chapters in and this line still sits with me.',
      // quoteBg is the card's theme hint ('dark' flips the palette), not an
      // image url — post-card.js tests post.quoteBg === 'dark'.
      quoteBg: 'dark', likesCount: 133, commentsCount: 12,
    },
    {
      authorId: String(a2.id), type: 'ama', savedBy: [String(reader.id)],
      text: 'Ask me anything about plotting a serial.',
      amaData: { isLive: false, viewers: 2140, title: 'AMA: Hollow Court, start to finish', meta: 'Ben Scribe · 412 answers' },
      likesCount: 76, commentsCount: 412,
    },
    {
      authorId: String(reader.id), type: 'review', savedBy: [String(reader.id)],
      text: 'Read it in one sitting.', score: 5,
      reviewText: 'Twelve Nights of Ash earns every one of its twelve chapters. The last line rewired the first.',
      storyRef: { id: String(bkG.id), title: 'Twelve Nights of Ash', cat: 'Dark Romance', writer: 'Ada Writer', cover: COVER.c7 },
      likesCount: 51, commentsCount: 8,
    },
    {
      authorId: String(a1.id), type: 'recommendation', savedBy: [String(reader.id)],
      text: 'If you only read one slow burn this month.',
      storyRef: { id: String(bkF.id), title: 'Hollow Court', cat: 'Fantasy', writer: 'Ben Scribe', cover: COVER.c6 },
      likesCount: 39, commentsCount: 5,
    },
    {
      authorId: String(a2.id), type: 'announcement', savedBy: [String(reader.id)],
      heading: 'New serial starts Monday', title: 'Cinder, Repeating',
      text: 'Five chapters are already written. The moon keeps moving her backwards, not forwards.',
      image: COVER.c2, likesCount: 288, commentsCount: 40,
    },
    {
      authorId: String(a1.id), type: 'shoutout', savedBy: [String(reader.id)],
      text: 'Reader of the month — she finished four serials in six weeks.',
      shoutout: { name: 'Rae Read', handle: 'reread', avatar: 'https://i.pravatar.cc/100?img=47', tagline: 'Finished Hollow Court twice', role: 'reader', readingHours: 61, chaptersRead: 214, streak: 12 },
      likesCount: 64, commentsCount: 9,
    },
    {
      authorId: String(a2.id), type: 'post', savedBy: [String(reader.id)],
      heading: 'The quiet wager opening', text: 'Two neighbours, one broken lift. I wrote the last line first.',
      likesCount: 22, commentsCount: 3,
    },
    // Deliberately NOT saved by the reader: the Saved tab must answer with her
    // list only, so a neighbour's save is the negative case.
    { authorId: String(a1.id), type: 'post', text: 'Drafting note: nothing to see here.', savedBy: [String(a2.id)], likesCount: 4, commentsCount: 1 },
  ].map((p, i) => Object.assign(p, {
    createdAt: new Date(Date.now() - i * HOUR),
    updatedAt: new Date(Date.now() - i * HOUR),
  }));

  await Post.insertMany(SAVED, { timestamps: false });
}

main().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });
