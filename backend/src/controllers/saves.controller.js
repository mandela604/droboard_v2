'use strict';
/* Implements the DroboardSaveAPI contract used by save-modal (all callers). */
const saves = require('../services/saves.service');
const base = require('./base.controller');

async function state(req, res) {
  return base.wrap(res, async () => saves.getSaveState({ userId: req.user.id, storyId: req.valid.query.storyId }));
}

async function quick(req, res) {
  return base.wrap(res, async () => saves.setQuickSave({
    userId: req.user.id, storyId: req.valid.body.storyId,
    key: req.valid.body.key, value: req.valid.body.value,
  }));
}

async function toggleCollection(req, res) {
  return base.wrap(res, async () => saves.toggleCollection({
    userId: req.user.id, collId: req.valid.params.id,
    storyId: req.valid.body.storyId, value: req.valid.body.value,
    isAdmin: (req.user.roles || []).includes('admin'),
  }));
}

async function createCollection(req, res) {
  return base.wrap(res, async () => {
    const out = await saves.createCollection({
      userId: req.user.id, name: req.valid.body.name, icon: req.valid.body.icon,
      storyId: req.valid.body.storyId,
      isAdmin: (req.user.roles || []).includes('admin'),
    });
    res.status(201);
    return out;
  });
}

module.exports = { state, quick, toggleCollection, createCollection };
