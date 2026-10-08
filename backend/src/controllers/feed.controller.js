'use strict';
const feed = require('../services/feed.service');
const base = require('./base.controller');

async function home(req, res) {
  return base.wrap(res, async () => {
    const d = await feed.home();
    if (req.user) {
      const { Notification } = require('../models/social.model');
      d.notifCount = await Notification.countDocuments({ recipientId: req.user.id, unread: true });
    }
    return d;
  });
}

async function discover(req, res) {
  return base.wrap(res, async () => feed.discoverData());
}

async function discoverStories(req, res) {
  return base.wrap(res, async () => feed.discoverStories(req.valid.query));
}

async function libraryStats(req, res) {
  return base.wrap(res, async () => feed.libraryStats(req.user.id));
}

function libraryList(which) {
  return async function (req, res) {
    return base.wrap(res, async () => feed.libraryList(req.user.id, which));
  };
}

async function storyDetail(req, res) {
  return base.wrap(res, async () => feed.storyDetail(req.valid.params.id));
}

async function libraryAdd(req, res) {
  return base.wrap(res, async () => {
    const out = await feed.libraryAdd({ userId: req.user.id, storyId: req.valid.body.storyId, list: req.valid.body.list });
    res.status(201);
    return out;
  });
}

async function libraryRemove(req, res) {
  return base.wrap(res, async () => feed.libraryRemove({
    userId: req.user.id, storyId: req.valid.params.storyId, list: req.valid.query.list,
  }));
}

async function libraryMove(req, res) {
  return base.wrap(res, async () => feed.libraryMove({
    userId: req.user.id, storyId: req.valid.params.storyId,
    from: req.valid.body.from, to: req.valid.body.to,
  }));
}

module.exports = { home, discover, discoverStories, libraryStats, libraryList, storyDetail, libraryAdd, libraryRemove, libraryMove };
