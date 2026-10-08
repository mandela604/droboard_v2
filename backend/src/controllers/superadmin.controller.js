'use strict';
/* Thin wrappers: validation lives in routes (zod), logic in services. */
const base = require('./base.controller');
const sa = require('../services/superadmin.service');
const revenue = require('../services/revenue.service');

const wrap = (fn) => async (req, res) => base.wrap(res, () => fn(req));
const created = (fn) => async (req, res) => {
  try { return res.status(201).json(await fn(req)); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message || 'error' }); }
};

module.exports = {
  dashboardSummary: wrap(async () => sa.dashboardSummary()),

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

  postsList: wrap(async (req) => sa.postsAdmin(req.valid.query)),
  postGet: wrap(async (req) => sa.getPost(req.valid.params.id)),
  postSetStatus: wrap(async (req) => sa.setPostStatus(req.valid.params.id, req.valid.body.status)),
  postDelete: wrap(async (req) => sa.deletePost(req.valid.params.id)),

  analyticsSummary: wrap(async () => sa.analyticsSummary()),
  analyticsRevenue: wrap(async (req) => sa.analyticsRevenue(req.valid.query)),
  analyticsAcquisition: wrap(async () => sa.analyticsAcquisition()),
  analyticsTopReaders: wrap(async (req) => sa.analyticsTopReaders(req.valid.query.limit)),

  settingsGet: wrap(async () => sa.getSettings()),
  settingsPut: wrap(async (req) => sa.putSettings(req.valid.body.settings || req.valid.body, req.user.id)),
  senderFieldsGet: wrap(async () => sa.getSenderFields()),
  senderFieldsPut: wrap(async (req) => sa.putSenderFields(req.valid.body.fields, req.user.id)),
  emailTemplatesList: wrap(async () => sa.listEmailTemplates()),
  emailTemplateGet: wrap(async (req) => sa.getEmailTemplate(req.valid.params.id)),
  emailTemplateCreate: created(async (req) => sa.createEmailTemplate(req.valid.body)),
  emailTemplateUpdate: wrap(async (req) => sa.updateEmailTemplate(req.valid.params.id, req.valid.body)),
  emailTemplateDelete: wrap(async (req) => sa.deleteEmailTemplate(req.valid.params.id)),

  pagesList: wrap(async () => sa.listSystemPages()),
  pageCreate: created(async (req) => sa.createSystemPage(req.valid.body, req.user.id)),
  pageGet: wrap(async (req) => sa.getSystemPage(req.valid.params.id)),
  pagePreview: wrap(async (req) => sa.previewSystemPage(req.valid.params.id)),

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
        splits: { google: b.google, marketing: b.marketing, editors: b.editors, writerShare: b.writerShare, giftWriterPct: b.giftWriterPct, subPlatformPct: b.subPlatformPct, subWritersPct: b.subWritersPct },
        note: b.note, by: req.user.id,
      });
    }
    return revenue.saveConfig({
      scope: b.scope || 'global', authorId: b.authorId,
      splits: {
        storeFeePct: b.storeFeePct, marketingPct: b.marketingPct, editorsPct: b.editorsPct,
        writerShareOfNetPct: b.writerShareOfNetPct, giftWriterPct: b.giftWriterPct,
        subscriptionCoinRateNGN: b.subscriptionCoinRateNGN,
      },
      note: b.note, by: req.user.id,
    });
  }),
  revenuePools: wrap(async () => revenue.poolsShape()),
  revenueHistory: wrap(async () => revenue.configHistory()),
  revenueOverrides: wrap(async () => revenue.authorOverrides()),
  revenueAuthorSearch: wrap(async (req) => revenue.authorDirectory(req.valid.query.q)),
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
};
