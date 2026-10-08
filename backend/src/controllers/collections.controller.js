'use strict';
const cols = require('../services/collections.service');
const base = require('./base.controller');

function viewerId(req) { return (req.user && req.user.id) || null; }
function isAdmin(req) { return !!((req.user && req.user.roles) || []).includes('admin'); }

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await cols.createCollection({ ownerId: req.user.id, data: req.valid.body, isAdmin: isAdmin(req) });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => cols.listCollections(Object.assign({}, req.valid.query, { viewerId: viewerId(req) })));
}

async function get(req, res) {
  return base.wrap(res, async () => cols.getCollection(req.valid.params.id, viewerId(req)));
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const col = await cols.loadOr404(req.valid.params.id);
    if (!cols.canWrite(col, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return cols.updateCollection({ col, data: req.valid.body, userId: req.user.id, isAdmin: isAdmin(req) });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const col = await cols.loadOr404(req.valid.params.id);
    if (!cols.canWrite(col, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return cols.deleteCollection({ col });
  });
}

async function stories(req, res) {
  return base.wrap(res, async () => cols.getStories(req.valid.params.id, viewerId(req)));
}

async function addStory(req, res) {
  return base.wrap(res, async () => {
    const col = await cols.loadOr404(req.valid.params.id);
    if (!cols.canWrite(col, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return cols.addStory({ col, storyId: req.valid.body.storyId, userId: req.user.id, isAdmin: isAdmin(req) });
  });
}

async function removeStory(req, res) {
  return base.wrap(res, async () => {
    const col = await cols.loadOr404(req.valid.params.id);
    if (!cols.canWrite(col, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return cols.removeStory({ col, storyId: req.valid.params.storyId });
  });
}

async function follow(req, res) {
  return base.wrap(res, async () => cols.followCollection({ userId: req.user.id, id: req.valid.params.id }));
}

async function unfollow(req, res) {
  return base.wrap(res, async () => cols.unfollowCollection({ userId: req.user.id, id: req.valid.params.id }));
}

async function share(req, res) {
  return base.wrap(res, async () => cols.shareCollection({
    userId: req.user.id, id: req.valid.params.id,
    channel: req.valid.body && req.valid.body.channel,
  }));
}

async function eligible(req, res) {
  return base.wrap(res, async () => cols.eligibleStories({ userId: req.user.id }));
}

module.exports = { create, list, get, update, remove, stories, addStory, removeStory, follow, unfollow, share, eligible };
