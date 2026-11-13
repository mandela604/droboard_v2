'use strict';
/* Thin wrappers: validation lives in routes (zod), logic in services. */
const base = require('./base.controller');
const sa = require('../services/superadmin.service');
const chief = require('../services/chief-content.service');
const revenue = require('../services/revenue.service');
const track = require('../services/tracking.service');
const adRev = require('../services/ad-revenue.service');
const boards = require('../services/admin-boards.service');
const { verifyPassword } = require('../middleware/auth');

const wrap = (fn) => async (req, res) => base.wrap(res, () => fn(req));
const created = (fn) => async (req, res) => {
  try { return res.status(201).json(await fn(req)); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message || 'error' }); }
};

module.exports = {
  dashboardSummary: wrap(async () => sa.dashboardSummary()),
  dashboardKpis: wrap(async () => sa.dashboardKpis()),
  dashboardRevenue: wrap(async () => sa.dashboardRevenue()),
  dashboardTopStories: wrap(async () => sa.dashboardTopStories()),
  dashboardActivity: wrap(async () => sa.dashboardActivity()),
  listAdmins: wrap(async () => sa.listAdmins()),
  createAdmin: created(async (req) => sa.createAdmin(req.valid.body)),
  updateAdmin: wrap(async (req) => sa.updateAdmin(req.valid.params.id, req.valid.body)),
  removeAdmin: wrap(async (req) => sa.removeAdmin(req.valid.params.id, req.user && req.user.id)),

  // coin rate (unlock/tip face value lives in the single CoinRate doc)
  coinRateGet: wrap(async () => revenue.coinRateGet()),
  coinRateSave: wrap(async (req) => revenue.coinRateSave(req.valid.body)),

  listUsers: wrap(async (req) => sa.listUsers(req.valid.query)),
  getUser: wrap(async (req) => sa.getUser(req.valid.params.id)),
  createUser: created(async (req) => sa.createUser(req.valid.body)),
  updateUser: wrap(async (req) => sa.updateUser(req.valid.params.id, req.valid.body)),
  removeUser: wrap(async (req) => sa.removeUser(req.valid.params.id)),

  listRoles: wrap(async () => sa.listRoles()),
  getRole: wrap(async (req) => sa.getRole(req.valid.params.id)),
  createRole: created(async (req) => sa.createRole(req.valid.body)),
  updateRole: wrap(async (req) => sa.updateRole(req.valid.params.id, req.valid.body)),
  deleteRole: wrap(async (req) => sa.deleteRole(req.valid.params.id)),

  editorialTeam: wrap(async (req) => sa.editorialTeam(req.valid.query)),

  insightsOverview: wrap(async () => sa.insightsOverview()),
  insightsLeaderboard: wrap(async (req) => sa.insightsLeaderboard(req.valid.query)),

  authorsList: wrap(async (req) => sa.authorsAdmin(req.valid.query)),
  authorUpdate: wrap(async (req) => sa.updateWriter(req.valid.params.id, req.valid.body)),
  authorRemove: wrap(async (req) => sa.removeWriter(req.valid.params.id)),

  booksList: wrap(async (req) => sa.booksAdmin(req.valid.query)),
  bookSetStatus: wrap(async (req) => sa.setBookStatus(req.valid.params.id, req.valid.body.status)),
  bookDelete: wrap(async (req) => sa.deleteBook(req.valid.params.id)),
  bulkBooks: async (req, res) => base.wrap(res, () => sa.bulkBooks(req)),
  bulkCollections: async (req, res) => base.wrap(res, () => sa.bulkCollections(req)),

  collectionsList: wrap(async (req) => sa.collectionsAdmin(req.valid.query)),
  collectionDelete: wrap(async (req) => sa.collectionDelete(req.valid.params.id)),

  postsList: wrap(async (req) => sa.postsAdmin(req.valid.query)),
  postGet: wrap(async (req) => sa.getPost(req.valid.params.id)),
  postSetStatus: wrap(async (req) => sa.setPostStatus(req.valid.params.id, req.valid.body.status)),
  postDelete: wrap(async (req) => sa.deletePost(req.valid.params.id)),

  analyticsSummary: wrap(async () => sa.analyticsSummary()),
  analyticsRevenue: wrap(async (req) => sa.analyticsRevenue(req.valid.query)),
  analyticsAcquisition: wrap(async () => sa.analyticsAcquisition()),
  analyticsTopReaders: wrap(async (req) => sa.analyticsTopReaders(req.valid.query.limit)),
  auditList: wrap(async (req) => sa.auditLogs(req.valid.query)),
  trendingSearches: wrap(async (req) => track.trendingSearches({ limit: req.valid.query.limit })),

  settingsGet: wrap(async () => sa.getSettings()),
  settingsPut: wrap(async (req) => sa.putSettings(req.valid.body.settings || req.valid.body, req.user.id)),
  senderFieldsGet: wrap(async () => sa.getSenderFields()),
  senderFieldsPut: wrap(async (req) => sa.putSenderFields(req.valid.body.fields, req.user.id)),
  emailTemplatesList: wrap(async () => sa.listEmailTemplates()),
  emailTemplateGet: wrap(async (req) => sa.getEmailTemplate(req.valid.params.id)),
  emailTemplateCreate: created(async (req) => sa.createEmailTemplate(req.valid.body)),
  emailTemplateUpdate: wrap(async (req) => sa.updateEmailTemplate(req.valid.params.id, req.valid.body)),
  emailTemplateDelete: wrap(async (req) => sa.deleteEmailTemplate(req.valid.params.id)),

  notificationBroadcast: async (req, res) => {
    try {
      const emitter = require('../services/notification-emitter');
      const { TYPES } = require('../services/notification-types');
      const ids = req.valid.body.recipientIds || [];
      if (!Array.isArray(ids) || ids.length === 0) throw new Error('recipientIds required');
      const type = req.valid.body.type || 'announcement';
      if (!TYPES[type]) { const e = new Error('unknown_notification_type'); e.status = 400; throw e; }
      const result = await emitter.broadcast(ids, {
        actorId: String(req.user?.id || 'system'),
        type,
        title: req.valid.body.title,
        desc: req.valid.body.desc || '',
        link: req.valid.body.link || '',
      });
      return res.status(201).json(result);
    } catch (e) {
      console.error('notificationBroadcast error:', e);
      return res.status(e.status || 500).json({ error: e.message || 'broadcast_failed' });
    }
  },

  pagesList: wrap(async () => sa.listSystemPages()),
  pageCreate: created(async (req) => sa.createSystemPage(req.valid.body, req.user.id)),
  pageGet: wrap(async (req) => sa.getSystemPage(req.valid.params.id)),
  pagePreview: wrap(async (req) => sa.previewSystemPage(req.valid.params.id)),

  // system-pages console alias (system-pages-service.js posts '{}' on create,
  // so title/url default here instead of failing validation).
  systemPagesCreate: created(async (req) => {
    const b = req.valid.body || {};
    const title = b.title || 'Untitled Page';
    const slug = String(b.url || title).toLowerCase()
      .replace(/^https?:\/\/[^/]+/, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
    return sa.createSystemPage(Object.assign({}, b, {
      title, url: b.url || ('/' + slug),
    }), req.user.id);
  }),
  systemPagesUpdate: wrap(async (req) => sa.updateSystemPage(req.valid.params.id, req.valid.body, req.user.id)),
  systemPagesDelete: wrap(async (req) => sa.deleteSystemPage(req.valid.params.id)),

  // ad earnings console (services/ad-revenue-service.js)
  adRevenueLedger: wrap(async (req) => adRev.ledger(req.valid.query)),
  adRevenueSummary: wrap(async (req) => adRev.summary(req.valid.query)),
  adRevenuePay: wrap(async (req) => adRev.pay({ authorId: req.valid.body.authorId, by: req.user.id })),
  adRevenueNetworkImport: wrap(async (req) => adRev.recordNetwork(Object.assign({}, req.valid.body, { by: req.user.id }))),
  adRevenueNetworkList: wrap(async (req) => adRev.networkImports(req.valid.query)),

  // revenue (legacy + flat console shapes; single home)
  revenueConfigGet: wrap(async (req) => {
    const r = await revenue.activeConfig(req.valid.query.authorId);
    return r;
  }),
  revenueActiveFlat: wrap(async () => revenue.toFlat(await revenue.activeConfig())),
  revenueConfigSave: created(async (req) => {
    const b = req.valid.body;
    if (b.google !== undefined || b.marketing !== undefined || b.editors !== undefined || b.writerShare !== undefined) {
      return revenue.saveFlatConfig({
        scope: b.scope || 'global', authorId: b.authorId,
        splits: { google: b.google, marketing: b.marketing, editors: b.editors, writerShare: b.writerShare, giftWriterPct: b.giftWriterPct, subPlatformPct: b.subPlatformPct, subWritersPct: b.subWritersPct, channelFeePct: b.channelFeePct },
        note: b.note, by: req.user.id,
      });
    }
    return revenue.saveConfig({
      scope: b.scope || 'global', authorId: b.authorId,
      splits: {
        storeFeePct: b.storeFeePct, marketingPct: b.marketingPct, editorsPct: b.editorsPct,
        writerShareOfNetPct: b.writerShareOfNetPct, giftWriterPct: b.giftWriterPct,
        subscriptionCoinRateNGN: b.subscriptionCoinRateNGN, channelFeePct: b.channelFeePct,
      },
      note: b.note, by: req.user.id,
    });
  }),
  revenuePools: wrap(async () => revenue.poolsShape()),
  revenueHistory: wrap(async () => revenue.configHistory()),
  revenueOverrides: wrap(async () => revenue.authorOverrides()),
  revenueAuthorSearch: wrap(async (req) => revenue.authorDirectory(req.valid.query.q)),
  // NEW: handlers for /revenue/config/author/:authorId endpoints
  revenueAuthorSave: created(async (req) => {
    const b = req.valid.body;
    return revenue.saveFlatConfig({
      scope: 'author', authorId: req.valid.params.authorId,
      splits: { google: b.google, marketing: b.marketing, editors: b.editors, writerShare: b.writerShare, giftWriterPct: b.giftWriterPct, subPlatformPct: b.subPlatformPct, subWritersPct: b.subWritersPct },
      note: b.note, by: req.user.id,
    });
  }),
  revenueAuthorDelete: wrap(async (req) => revenue.deleteAuthorOverride(req.valid.params.authorId)),
  revenueSubscriptions: wrap(async (req) => revenue.distributeSubscriptions(req.valid.query.period)),

  // Genres for Authors & Content page filter (Chief Editor owns genre catalog)
  genresList: wrap(async () => chief.listGenres({ status: 'active', limit: 200 })),

  // Admin Earnings Console — uses superadmin.service.adminEarnings()
  adminEarnings: wrap(async (req) => sa.adminEarnings(req.valid ? req.valid.query : req.query)),

  // Boards page — a board is the category the CE creates. Crew and flag live
  // here; the CE console only names the board.
  boardsList: wrap(async (req) => boards.listBoards(req.valid.query)),
  boardsCrew: wrap(async (req) => boards.setCrew(req.valid.params.id, req.valid.body)),
  boardsFlag: wrap(async (req) => boards.flagBoard(
    req.valid.params.id, { reason: req.valid.body.reason, note: req.valid.body.note },
    await verifyPassword(req.user.id, req.valid.body.password)
  )),
  boardsUnflag: wrap(async (req) => boards.unflagBoard(
    req.valid.params.id, await verifyPassword(req.user.id, req.valid.body.password)
  )),
};
