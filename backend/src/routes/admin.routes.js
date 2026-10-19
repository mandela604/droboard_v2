'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/superadmin.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/revenue/config', requireAuth, requireRole('admin'),
  validate(z.object({ query: z.object({ authorId: z.string().max(40).optional() }).strict() })), ctrl.revenueConfigGet);

router.post('/revenue/config', requireAuth, requireRole('admin'), audit('revenue.config.save'),
  validate(z.object({ body: z.object({
    scope: z.enum(['global', 'author']).default('global'),
    authorId: z.string().max(40).optional(),
    storeFeePct: z.number().min(0).max(100).optional(),
    marketingPct: z.number().min(0).max(100).optional(),
    editorsPct: z.number().min(0).max(100).optional(),
    writerShareOfNetPct: z.number().min(0).max(100).optional(),
    giftWriterPct: z.number().min(0).max(100).optional(),
    subscriptionCoinRateNGN: z.number().min(0).optional(),
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
router.put('/revenue/coin-rate', requireAuth, requireRole('admin'),
  require('../middleware/http').writeLimiter, audit('admin.revenue.coin-rate.save'),
  validate(z.object({ body: z.object({
    coinFaceNGN: z.number().min(0.01).max(10000).optional(),
    minChapterCoins: z.number().int().min(0).max(10000).optional(),
    minWithdrawal: z.number().int().min(0).max(1000000).optional(),
    bonusExpiryDays: z.number().int().min(1).max(3650).optional(),
    dormancyBreakageMonths: z.number().int().min(1).max(120).optional(),
  }).strict().refine(v => Object.keys(v).length > 0, { message: 'nothing_to_save' }) })), ctrl.coinRateSave);

/* ── Super Admin console (frontend service-level contracts) ── */
const sa = require('../controllers/superadmin.controller');
const A = [requireAuth, requireRole('admin')];
const ID = z.string().min(1).max(120);
const PG = { page: z.string().max(6).optional(), limit: z.string().max(6).optional() };

// dashboard
router.get('/dashboard/summary', ...A, sa.dashboardSummary);

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
router.delete('/users/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.users.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.removeUser);

// roles
const roleBody = z.object({
  name: z.string().min(1).max(80), desc: z.string().max(500).optional(),
  icon: z.string().max(40).optional(), color: z.string().max(20).optional(),
  memberIds: z.array(z.string().max(120)).max(500).optional(),
  perms: z.record(z.boolean()).optional(),
}).strict();
router.get('/roles', ...A, sa.listRoles);
router.get('/roles/:id', ...A, validate(z.object({ params: z.object({ id: ID }) })), sa.getRole);
router.post('/roles', ...A, require('../middleware/http').writeLimiter, audit('admin.roles.create'),
  validate(z.object({ body: roleBody })), sa.createRole);
router.put('/roles/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.roles.update'),
  validate(z.object({ params: z.object({ id: ID }), body: roleBody.partial() })), sa.updateRole);
router.delete('/roles/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.roles.delete'),
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

// collections moderation
router.get('/collections', ...A, validate(z.object({ query: z.object({
  ...PG, q: z.string().max(80).optional(), privacy: z.string().max(20).optional(),
  sort: z.string().max(20).optional(), reported: z.string().max(5).optional(),
}).strict() })), sa.collectionsList);
router.delete('/collections/:id', ...A, require('../middleware/http').writeLimiter, audit('admin.collections.delete'),
  validate(z.object({ params: z.object({ id: ID }) })), sa.collectionDelete);

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
