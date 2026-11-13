'use strict';
const comments = require('../services/comments.service');
const boards = require('../services/genres.service');
const { Discussion } = require('../models/social.model');
const base = require('./base.controller');

// A comment that lives inside a board thread inherits the board's write rule:
// only members (and board staff) may react in it.
async function assertBoardWrite(user, comment) {
  if (!comment || comment.scope !== 'discussion' || !comment.discussionId) return;
  const disc = await Discussion.findOne({ id: comment.discussionId }).select('genreId').lean();
  if (disc) await boards.assertBoardMember(user, { genreId: disc.genreId });
}

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await comments.createComment({ authorId: req.user.id, user: req.user, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => comments.listComments(Object.assign({}, req.valid.query, {
    viewerId: req.user && req.user.id,
  })));
}

async function replies(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    return comments.getReplies({ comment, viewerId: req.user && req.user.id });
  });
}

async function like(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    await assertBoardWrite(req.user, comment);
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
    return comments.updateComment({ comment, text: req.valid.body.text, viewerId: req.user.id });
  });
}

async function react(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    await assertBoardWrite(req.user, comment);
    return comments.reactToComment({ comment, userId: req.user.id, rid: req.valid.body.rid });
  });
}

async function unreact(req, res) {
  return base.wrap(res, async () => {
    const comment = await comments.loadOr404(req.valid.params.id);
    await assertBoardWrite(req.user, comment);
    return comments.unreactComment({ comment, userId: req.user.id });
  });
}

async function recount(req, res) {
  return base.wrap(res, async () => {
    if (!req.user || !(req.user.roles || []).includes('admin')) {
      const e = new Error('forbidden'); e.status = 403; throw e;
    }
    return comments.recountPostComments();
  });
}

module.exports = { create, list, replies, like, remove, update, react, unreact, recount };
