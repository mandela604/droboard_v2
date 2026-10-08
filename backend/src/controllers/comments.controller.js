'use strict';
const comments = require('../services/comments.service');
const base = require('./base.controller');

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await comments.createComment({ authorId: req.user.id, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => comments.listComments(req.valid.query));
}

async function replies(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    return comments.getReplies({ comment });
  });
}

async function like(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    return comments.toggleLike({ comment, userId: req.user.id });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    if (!comments.canWrite(comment, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return comments.deleteComment({ comment });
  });
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    if (!comments.canWrite(comment, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return comments.updateComment({ comment, text: req.valid.body.text });
  });
}

async function react(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    return comments.reactToComment({ comment, userId: req.user.id, rid: req.valid.body.rid });
  });
}

async function unreact(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    return comments.unreactComment({ comment, userId: req.user.id });
  });
}

module.exports = { create, list, replies, like, remove, update, react, unreact };
