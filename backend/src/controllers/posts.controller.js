'use strict';
const posts = require('../services/posts.service');
const base = require('./base.controller');

async function create(req, res) {
  return base.wrap(res, async () => {
    const out = await posts.createPost({ authorId: req.user.id, data: req.valid.body });
    res.status(201);
    return out;
  });
}

async function list(req, res) {
  return base.wrap(res, async () => posts.listPosts(Object.assign({}, req.valid.query, { viewerId: req.user && req.user.id })));
}

async function get(req, res) {
  return base.wrap(res, async () => posts.getPost(req.valid.params.id));
}

async function update(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    if (!posts.canWrite(post, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return posts.updatePost({ post, data: req.valid.body });
  });
}

async function remove(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    if (!posts.canWrite(post, req.user)) { const e = new Error('forbidden'); e.status = 403; throw e; }
    return posts.deletePost({ post });
  });
}

async function like(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.toggleLike({ post, userId: req.user.id });
  });
}

async function save(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.toggleSave({ post, userId: req.user.id });
  });
}

async function pollVote(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.votePoll({ post, idx: req.valid.body.option, userId: req.user.id });
  });
}

async function debateVote(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.voteDebate({ post, side: req.valid.body.side });
  });
}

async function react(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.reactToPost({ post, userId: req.user.id, rid: req.valid.body.rid });
  });
}

async function unreact(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.unreactPost({ post, userId: req.user.id });
  });
}

async function reactions(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.reactionState({ post, userId: req.user && req.user.id });
  });
}

async function share(req, res) {
  return base.wrap(res, async () => {
    const post = await posts.loadOr404(req.valid.params.id);
    return posts.sharePost({ post, channel: req.valid.body.channel, userId: req.user.id });
  });
}

module.exports = { create, list, get, update, remove, like, save, pollVote, debateVote, react, unreact, reactions, share };
