'use strict';
const svc = require('../services/discussions.service');
const base = require('./base.controller');

async function list(req, res) {
  return base.wrap(res, async () => svc.listThreads({
    genre: req.valid.query.genre, tag: req.valid.query.tag, sort: req.valid.query.sort,
    page: req.valid.query.page, limit: req.valid.query.limit,
    viewerId: req.user && req.user.id,
  }));
}

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createThread({
      userId: req.user.id, genre: req.valid.body.genre, title: req.valid.body.title,
      body: req.valid.body.body, tag: req.valid.body.tag, media: req.valid.body.media,
      trope: req.valid.body.trope, story: req.valid.body.story,
    });
    res.status(201);
    return out;
  });
}

async function get(req, res) {
  return base.wrap(res, async () => svc.getThread({
    id: req.valid.params.id, viewerId: req.user && req.user.id,
  }));
}

async function update(req, res) {
  return base.wrap(res, async () => svc.updateThread({
    id: req.valid.params.id, userId: req.user.id,
    isAdmin: (req.user.roles || []).includes('admin'),
    title: req.valid.body.title, body: req.valid.body.body,
    tag: req.valid.body.tag, media: req.valid.body.media,
    trope: req.valid.body.trope, story: req.valid.body.story,
  }));
}

async function remove(req, res) {
  return base.wrap(res, async () => svc.deleteThread({
    id: req.valid.params.id, userId: req.user.id,
    isAdmin: (req.user.roles || []).includes('admin'),
  }));
}

async function like(req, res) {
  return base.wrap(res, async () => svc.toggleLike({ id: req.valid.params.id, userId: req.user.id }));
}

module.exports = { list, create, get, update, remove, like };
