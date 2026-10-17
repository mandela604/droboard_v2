'use strict';
const svc = require('../services/messages.service');
const base = require('./base.controller');

async function conversations(req, res) {
  return base.wrap(res, async () => svc.listConversations({ userId: req.user.id }));
}

async function open(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.openOrCreate({ userId: req.user.id, peerId: req.valid.body.userId });
    res.status(201);
    return out;
  });
}

async function messages(req, res) {
  return base.wrap(res, async () => svc.listMessages({
    userId: req.user.id, convId: req.valid.params.id,
    page: req.valid.query.page, limit: req.valid.query.limit,
  }));
}

async function send(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.sendMessage({
      userId: req.user.id, convId: req.valid.params.id,
      text: req.valid.body.text, image: req.valid.body.image,
    });
    res.status(201);
    return out;
  });
}

async function read(req, res) {
  return base.wrap(res, async () => svc.markRead({ userId: req.user.id, convId: req.valid.params.id }));
}

async function update(req, res) {
  return base.wrap(res, async () => svc.editMessage({
    userId: req.user.id, msgId: req.valid.params.id, text: req.valid.body.text,
  }));
}

async function remove(req, res) {
  return base.wrap(res, async () => svc.deleteMessage({ userId: req.user.id, msgId: req.valid.params.id }));
}

module.exports = { conversations, open, messages, send, read, update, remove };
