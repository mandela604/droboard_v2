'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/superadmin.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole, requirePerm } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/revenue/config', requireAuth, requireRole('admin'),
  validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.revenueConfigGet);

router.post('/revenue/config', requireAuth, requireRole('admin'), requirePerm('edit_rates'), audit('revenue.config.save'),
  validate(z.object({ body: z.object({
    scope: z.enum(['global', 'author']).default('global'),
    authorId: z.string().max(40).optional(),
    storeFeePct: z.number().min(0).max(100).optional(),
    marketingPct: z.number().min(0).max(100).optional(),
    editorsPct: z.number().min(0).max(100).optional(),
    writerShareOfNetPct: z.number().min(0).max(100).optional(),
    giftWriterPct: z.number().min(0).max(100).optional(),
    subscriptionCoinRateNGN: z.number().min(0).optional(),
    // per-channel commission actually withheld at purchase (play/appstore
    // have no per-order fee from the API; web uses the provider's own figure)
    channelFeePct: z.record(z.string().max(20), z.number().min(0).max(100)).optional(),
    // flat revenue-splits console shape (google fixed at 30, rest sums to 70)
    google: z.number().min(0).max(100).optional(),
    marketing: z.number().min(0).max(100).optional(),
    editors: z.number().min(0).max(100).optional(),
    writerShare: z.number().min(0).max(100).optional(),
    note: z.string().max(300).optional(),
  }).strict() })), ctrl.revenueConfigSave);

router.get('/revenue/pools', requireAuth, requireRole('admin', 'finance'), ctrl.revenuePools);

// coin rate — single 'live' CoinRate doc (unlock/tip face value + minimums).
// Frontend finance console reads this; PUT updates without code changes.
router.get('/revenue/coin-rate', requireAuth, requireRole('admin'), ctrl.coinRateGet);
router.put('/revenue/coin-rate', requireAuth, requireRole('admin'), requirePerm('edit_rates'),
  require('../middleware/http').writeLimiter, audit('admin.revenue.coin-rate.save'),
  validate(z.object({ body: z.object({
    coinFaceNGN: z.number().min(0.01).max(10000).optional(),
    minChapterCoins: z.number().int().min(0).max(10000).optional(),
    minWithdrawal: z.number().int().min(0).max(1000000).optional(),
    bonusExpiryDays: z.number().int().min(1).max(3650).optional(),
    dormancyBreakageMonths: z.number().int().min(1).max(120).optional(),
    // currency -> naira per unit; converts foreign receipts and prices the
    // international premium that platform keeps
    fx: z.record(z.string().max(8), z.number().min(0)).optional(),
  }).strict().refine(v => Object.keys(v).length > 0, { message: 'nothing_to_save' }) })), ctrl.coinRateSave);

/* ── Super Admin console (frontend service-level contracts) ── */
const sa = require('../controllers/superadmin.controller');
const A = [requireAuth, requireRole('admin')];
const ID = z.string().min(1).max(120);
const PG = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

// dashboard
router.get('/dashboard/summary', ...A, sa.dashboardSummary);
// The dashboard page asks for these five shapes individually; each is a view
// over the same aggregate, so the panels cannot drift apart.
router.get('/dashboard/kpis', ...A, sa.dashboardKpis);
router.get('/dashboard/revenue', ...A, sa.dashboardRevenue);
router.get('/dashboard/top-stories', ...A, sa.dashboardTopStories);
router.get('/dashboard/activity', ...A, sa.dashboardActivity);

// admin team (dashboard panel CRUD — creates/edits a real admin account)
router.get('/admins', ...A, sa.listAdmins);
router.post('/admins', ...A, require('../middleware/http').writeLimiter, audit('admin.admins.create'),
  validate(z.object({ body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(120),
    username: z.string().max(40).optional(),
    password: z.string().min(8).max(128),
    role: z.string().max(40).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }).strict() })), sa.createAdmin);
router.put('/admins/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.admins.update'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().max(120).optional(),
    role: z.string().max(40).optional(),
    status: z.enum(['active', 'suspended']).optional(),
  }).strict().refine(v => Object.keys(v).length > 0, { message: 'nothing_to_save' }) })), sa.updateAdmin);
router.delete('/admins/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.admins.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.removeAdmin);

// users
router.get('/users', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), role: z.string().max(30).optional(),
  status: z.string().max(20).optional(), sort: z.string().max(20).optional(),
}).strict() })), sa.listUsers);
router.get('/users/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.getUser);
router.post('/users', ...A, require('../middleware/http').writeLimiter, audit('admin.users.create'),
  validate(z.object({ body: z.object({
    name: z.string().min(1).max(120), username: z.string().min(1).max(40),
    email: z.string().email().max(120), password: z.string().min(8).max(128).optional(),
    passwordHash: z.string().max(200).optional(),
    avatar: z.string().max(500).optional(), phone: z.string().max(30).optional(),
    roles: z.array(z.string().max(30)).max(10).optional(), role: z.string().max(30).optional(),
    platformRoles: z.array(z.string().max(30)).max(10).optional(),
    status: z.string().max(20).optional(), notes: z.string().max(1000).optional(),
  }).strict() })), sa.createUser);
router.patch('/users/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.users.update'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    name: z.string().min(1).max(120).optional(), username: z.string().min(1).max(40).optional(),
    email: z.string().email().max(120).optional(), avatar: z.string().max(500).optional(),
    phone: z.string().max(30).optional(), roles: z.array(z.string().max(30)).max(10).optional(),
    role: z.string().max(30).optional(), status: z.string().max(20).optional(),
    platformRoles: z.array(z.string().max(30)).max(10).optional(),
    verified: z.boolean().optional(), notes: z.string().max(1000).optional(),
  }).strict() })), sa.updateUser);
router.delete('/users/:id', ...A, requirePerm('ban_users'), require('../middleware/http').writeLimiter, audit('admin.users.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.removeUser);

// roles
const roleBody = z.object({
  name: z.string().min(1).max(80), desc: z.string().max(500).optional(),
  // slug is the User.roles token this role grants (system roles use the
  // canonical snake_case names). Once set it's frozen — user rows already
  // reference it. Custom roles may set one on create or leave it ''.
  slug: z.string().max(40).regex(/^[a-z0-9_]*$/).optional(),
  icon: z.string().max(40).optional(), color: z.string().max(20).optional(),
  memberIds: z.array(z.string().max(120)).max(500).optional(),
  perms: z.record(z.boolean()).optional(),
}).strict();
router.get('/roles', ...A, sa.listRoles);
router.get('/roles/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.getRole);
router.post('/roles', ...A, requirePerm('manage_roles'), require('../middleware/http').writeLimiter, audit('admin.roles.create'),
  validate(z.object({ body: roleBody })), sa.createRole);
router.put('/roles/:id', ...A, requirePerm('manage_roles'), require('../middleware/http').writeLimiter, audit('admin.roles.update'),
  validate(z.object({ params: z.object({ id: ID }), body: roleBody.partial() })), sa.updateRole);
router.delete('/roles/:id', ...A, requirePerm('manage_roles'), require('../middleware/http').writeLimiter, audit('admin.roles.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.deleteRole);

// editorial team
router.get('/editorial-team', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), status: z.string().max(20).optional(),
}).strict() })), sa.editorialTeam);

// insights
router.get('/insights/overview', ...A, sa.insightsOverview);
router.get('/insights/leaderboard', ...A, validate(z.object({ query: z.object({
  type: z.enum(['tips', 'readtime', 'referrals', 'streaks']).optional(),
  role: z.string().max(30).optional(), limit: z.string().max(6).optional(),
}).strict() })), sa.insightsLeaderboard);

// authors content
router.get('/authors', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), status: z.string().max(20).optional(),
  sort: z.string().max(20).optional(),
}).strict() })), sa.authorsList);
router.patch('/authors/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.authors.update'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    status: z.string().max(20).optional(), verified: z.boolean().optional(), genre: z.string().max(40).optional(),
  }).strict() })), sa.authorUpdate);
router.delete('/authors/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.authors.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.authorRemove);

// books moderation
router.get('/books', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), genre: z.string().max(40).optional(),
  status: z.string().max(20).optional(), sort: z.string().max(20).optional(),
}).strict() })), sa.booksList);
router.patch('/books/:id/status', ...A, require('../middleware/http').writeLimiter, audit('admin.books.status'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({ status: z.string().min(1).max(20) }).strict() })), sa.bookSetStatus);
router.delete('/books/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.books.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.bookDelete);
// bulk update — POST /api/super-admin/books/bulk { bookIds: [...], status: 'published'|'flagged'|... }
router.post('/books/bulk', ...A, require('../middleware/http').writeLimiter, audit('admin.books.bulk'),
  validate(z.object({ body: z.object({
    bookIds: z.array(ID).min(1),
    status: z.string().min(1).max(20),
  }).strict() })), ctrl.bulkBooks);

// collections moderation
router.get('/collections', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), privacy: z.string().max(20).optional(),
  sort: z.string().max(20).optional(), reported: z.string().max(5).optional(),
}).strict() })), sa.collectionsList);
router.delete('/collections/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.collections.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.collectionDelete);
// bulk update — POST /api/super-admin/collections/bulk { collectionIds: [...], status: 'public'|'private'|... }
router.post('/collections/bulk', ...A, require('../middleware/http').writeLimiter, audit('admin.collections.bulk'),
  validate(z.object({ body: z.object({
    collectionIds: z.array(ID).min(1),
    status: z.string().min(1).max(20),
  }).strict() })), ctrl.bulkCollections);


// posts moderation
router.get('/posts', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), type: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
}).strict() })), sa.postsList);
router.get('/posts/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.postGet);
router.patch('/posts/:id/status', ...A, require('../middleware/http').writeLimiter, audit('admin.posts.status'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({ status: z.string().min(1).max(20) }).strict() })), sa.postSetStatus);
router.delete('/posts/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.posts.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.postDelete);

// boards — a board is the category the CE creates. This console assigns its one
// admin + moderator team and flags the board itself.
router.get('/boards', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), status: z.string().max(20).optional(),
  sort: z.string().max(20).optional(),
}).strict() })), sa.boardsList);
router.put('/boards/:id/crew', ...A, requirePerm('manage_settings'),
  require('../middleware/http').writeLimiter, audit('admin.boards.crew'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    admins: z.array(z.string().max(120)).max(20).optional(),
    moderators: z.array(z.string().max(120)).max(20).optional(),
  }).strict().refine(v => v.admins !== undefined || v.moderators !== undefined, { message: 'nothing_to_save' }) })), sa.boardsCrew);
router.post('/boards/:id/flag', ...A, requirePerm('manage_settings'),
  require('../middleware/http').writeLimiter, audit('admin.boards.flag'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    reason: z.string().min(1).max(200), note: z.string().max(2000).optional(),
    password: z.string().min(1).max(200),
  }).strict() })), sa.boardsFlag);
router.post('/boards/:id/unflag', ...A, requirePerm('manage_settings'),
  require('../middleware/http').writeLimiter, audit('admin.boards.unflag'),
  validate(z.object({ params: z.object({ id: ID }), body: z.object({
    password: z.string().min(1).max(200),
  }).strict() })), sa.boardsUnflag);

// analytics
router.get('/analytics/summary', ...A, sa.analyticsSummary);
router.get('/analytics/revenue', ...A, validate(z.object({ query: z.object({
  view: z.enum(['monthly', 'quarterly', 'bySource']).optional(),
}).strict() })), sa.analyticsRevenue);
router.get('/analytics/acquisition', ...A, sa.analyticsAcquisition);
router.get('/analytics/top-readers', ...A, validate(z.object({ query: z.object({
  limit: z.string().max(6).optional(),
}).strict() })), sa.analyticsTopReaders);
// what readers searched (7d) + which terms found nothing (content gaps)
router.get('/analytics/trending-searches', ...A, validate(z.object({ query: z.object({
  limit: z.string().max(6).optional(),
}).strict() })), sa.trendingSearches);

// admin earnings console — stub placeholder
router.get('/earnings', ...A, sa.adminEarnings);

// audit trail — staff-scope by default (readers' like/save noise excluded);
// scope=all returns the raw log. Filters: actorId, role, action, entity.
router.get('/audit', ...A, validate(z.object({ query: z.object({
  ...PG, scope: z.enum(['staff', 'all']).optional(),
  actorId: z.string().max(120).optional(), role: z.string().max(30).optional(),
  action: z.string().max(80).optional(), entity: z.string().max(120).optional(),
}).strict() })), sa.auditList);

// platform settings + sender fields + email templates
router.get('/settings', ...A, sa.settingsGet);
router.put('/settings', ...A, require('../middleware/http').writeLimiter, audit('admin.settings.update'),
  validate(z.object({ body: z.record(z.any()) })), sa.settingsPut);
router.get('/settings/sender-fields', ...A, sa.senderFieldsGet);
router.put('/settings/sender-fields', ...A, require('../middleware/http').writeLimiter, audit('admin.settings.senders'),
  validate(z.object({ body: z.object({ fields: z.array(z.any()).max(50) }).strict() })), sa.senderFieldsPut);
const emailBody = z.object({
  key: z.string().min(1).max(80), sender: z.string().max(160).optional(),
  smtpHost: z.string().max(200).optional(), subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000), enabled: z.boolean().optional(),
}).strict();
router.get('/email-templates', ...A, sa.emailTemplatesList);
router.get('/email-templates/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.emailTemplateGet);
router.post('/email-templates', ...A, require('../middleware/http').writeLimiter, audit('admin.email.create'),
  validate(z.object({ body: emailBody })), sa.emailTemplateCreate);
router.put('/email-templates/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.email.update'),
  validate(z.object({ params: z.object({ id: ID }), body: emailBody.partial() })), sa.emailTemplateUpdate);
router.delete('/email-templates/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.email.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.emailTemplateDelete);

// platform notifications broadcast — Admin sends announcement/push to users
router.post('/notifications/broadcast', ...A, require('../middleware/http').writeLimiter, audit('admin.notifications.broadcast'),
  validate(z.object({ body: z.object({
    recipientIds: z.array(z.string().min(1).max(120)).min(1),
    type: z.string().max(40).optional().default('announcement'),
    title: z.string().min(1).max(200),
    desc: z.string().max(5000).optional(),
    link: z.string().max(500).optional(),
  }).strict() })), ctrl.notificationBroadcast);

// system pages
const pageBody = z.object({
  title: z.string().min(1).max(120), url: z.string().min(1).max(200),
  icon: z.string().max(40).optional(), tone: z.string().max(20).optional(),
  status: z.enum(['active', 'draft', 'hidden']).optional(),
}).strict();
router.get('/pages', ...A, sa.pagesList);
router.post('/pages', ...A, require('../middleware/http').writeLimiter, audit('admin.pages.create'),
  validate(z.object({ body: pageBody })), sa.pageCreate);
router.get('/pages/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.pageGet);
router.get('/pages/:id/preview', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.pagePreview);

// system-pages console alias — FE: super-admin/system-pages-service.js
// (API_BASE '/api/super-admin/system-pages', same rows as /pages above).
const spBody = z.object({
  title: z.string().min(1).max(120).optional(),
  url: z.string().min(1).max(200).optional(),
  icon: z.string().max(40).optional(),
  tone: z.string().max(20).optional(),
  status: z.enum(['active', 'draft', 'hidden']).optional(),
  content: z.string().max(50000).optional(),
  questions: z.array(z.object({ q: z.string().max(500), a: z.string().max(5000) }).strict()).max(100).optional(),
}).strict();
router.get('/system-pages', ...A, sa.pagesList);
router.post('/system-pages', ...A, require('../middleware/http').writeLimiter, audit('admin.pages.create'),
  validate(z.object({ body: spBody })), sa.systemPagesCreate);
router.get('/system-pages/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.pageGet);
router.put('/system-pages/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.pages.update'),
  validate(z.object({ params: z.object({ id: ID }), body: spBody })), sa.systemPagesUpdate);
router.delete('/system-pages/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.pages.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.systemPagesDelete);
router.get('/system-pages/:id/preview', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.pagePreview);

// ad earnings console — FE: services/ad-revenue-service.js (loaded by
// super-admin/ad-earnings.html + marketing/marketing-analytics.html):
//   GET  /ad-revenue/ledger?days=N|from&to  -> {rows,total}
//   GET  /ad-revenue/summary?days=N         -> {totals,bySurface,byStory,byAuthor,days}
//   POST /ad-revenue/pay {authorId}         -> {ok,modified}
router.get('/ad-revenue/ledger', ...A, validate(z.object({ query: z.object({
  days: z.string().max(6).optional(), from: z.string().max(10).optional(),
  to: z.string().max(10).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict() })), sa.adRevenueLedger);
router.get('/ad-revenue/summary', ...A, validate(z.object({ query: z.object({
  days: z.string().max(6).optional(),
}).strict() })), sa.adRevenueSummary);
router.post('/ad-revenue/pay', ...A, require('../middleware/http').writeLimiter, audit('admin.ad-revenue.pay'),
  validate(z.object({ body: z.object({ authorId: ID }).strict() })), sa.adRevenuePay);

// network earnings (AdSense/Adsterra/Monetag): the period total from the
// network's own report, spread over the impressions we counted for that ad.
//   GET  /ad-revenue/network          -> {rows,total}
//   POST /ad-revenue/network          {adId?, network?, from, to, amount,
//                                      currency?, fxRate?, note?} -> import row
const networkBody = z.object({
  adId: z.string().max(120).optional(),
  network: z.string().max(80).optional(),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(1e9),
  currency: z.enum(['USD', 'NGN', 'GBP']).optional(),
  fxRate: z.number().positive().max(1e6).optional(),
  note: z.string().max(500).optional(),
}).strict();
router.get('/ad-revenue/network', ...A, validate(z.object({ query: z.object({
  limit: z.string().max(6).optional(),
}).strict() })), sa.adRevenueNetworkList);
router.post('/ad-revenue/network', ...A, require('../middleware/http').writeLimiter, audit('admin.ad-revenue.network'),
  validate(z.object({ body: networkBody })), sa.adRevenueNetworkImport);

// revenue-splits console (flat shape; legacy /revenue/config* above untouched)
const flatCuts = {
  google: z.number().min(0).max(100), marketing: z.number().min(0).max(100),
  editors: z.number().min(0).max(100), writerShare: z.number().min(0).max(100),
  giftWriterPct: z.number().min(0).max(100).optional(),
  subPlatformPct: z.number().min(0).max(100).optional(),
  subWritersPct: z.number().min(0).max(100).optional(),
  note: z.string().max(300).optional(),
};
router.get('/revenue/config/active', ...A, sa.revenueActiveFlat);
router.get('/revenue/config/history', ...A, sa.revenueHistory);
router.get('/revenue/config/author', ...A, sa.revenueOverrides);
// revenue-splits console saves the global row here (flat shape; controller
// routes to saveFlatConfig when google/writerShare are present).
// NOTE: DO NOT add another POST /revenue/config — first match wins in Express routing.
router.get('/revenue/authors', ...A, validate(z.object({ query: z.object({
  q: z.string().max(80).optional(),
}).strict() })), sa.revenueAuthorSearch);
router.post('/revenue/config/author/:authorId', ...A, require('../middleware/http').writeLimiter, audit('admin.revenue.author.save'),
  validate(z.object({ params: z.object({ authorId: ID }), body: z.object(flatCuts).strict() })), sa.revenueAuthorSave);
router.delete('/revenue/config/author/:authorId', ...A, require('../middleware/http').writeLimiter, audit('admin.revenue.author.delete'),
  validate(z.object({ params: z.object({ authorId: ID }) })), sa.revenueAuthorDelete);
router.get('/revenue/subscriptions', ...A, validate(z.object({ query: z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
}).strict() })), sa.revenueSubscriptions);

module.exports = router;
