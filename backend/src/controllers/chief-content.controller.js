'use strict';
const svc = require('../services/chief-content.service');
const base = require('./base.controller');

async function listBooks(req, res) {
  return base.wrap(res, async () => svc.listBooks(req.valid.query));
}

async function getBook(req, res) {
  return base.wrap(res, async () => svc.getBook(req.valid.params.id));
}

async function flagBook(req, res) {
  return base.wrap(res, async () => svc.flagBook(req.valid.params.id));
}

async function unflagBook(req, res) {
  return base.wrap(res, async () => svc.unflagBook(req.valid.params.id));
}

async function genres(req, res) {
  return base.wrap(res, async () => svc.genres());
}

async function tags(req, res) {
  return base.wrap(res, async () => svc.tags());
}

async function sections(req, res) {
  return base.wrap(res, async () => svc.sections());
}

async function library(req, res) {
  return base.wrap(res, async () => svc.library(req.valid.query));
}

async function placements(req, res) {
  return base.wrap(res, async () => svc.placements(req.valid.query));
}

async function addPlacement(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.addPlacement(Object.assign({}, req.valid.body, { placedBy: req.user.id }));
    res.status(201);
    return out;
  });
}

async function updatePlacement(req, res) {
  return base.wrap(res, async () => svc.updatePlacement(req.valid.params.storyId, req.valid.body));
}

async function removePlacement(req, res) {
  return base.wrap(res, async () => svc.removePlacement(req.valid.params.storyId, req.user.id));
}

async function history(req, res) {
  return base.wrap(res, async () => svc.history(req.valid.query));
}

async function refeature(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.refeature(req.valid.params.index, req.user.id);
    res.status(201);
    return out;
  });
}

async function listCategories(req, res) {
  return base.wrap(res, async () => svc.listCategories(req.valid.query));
}

async function createCategory(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createCategory(req.valid.body);
    res.status(201);
    return out;
  });
}

async function updateCategory(req, res) {
  return base.wrap(res, async () => svc.updateCategory(req.valid.params.id, req.valid.body));
}

async function deleteCategory(req, res) {
  return base.wrap(res, async () => svc.deleteCategory(req.valid.params.id));
}

async function toggleCategoryStatus(req, res) {
  return base.wrap(res, async () => svc.toggleCategoryStatus(req.valid.params.id));
}

async function listGenres(req, res) {
  return base.wrap(res, async () => svc.listGenres(req.valid.query));
}

async function createGenre(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createGenre(req.valid.body);
    res.status(201);
    return out;
  });
}

async function updateGenre(req, res) {
  return base.wrap(res, async () => svc.updateGenre(req.valid.params.id, req.valid.body));
}

async function deleteGenre(req, res) {
  return base.wrap(res, async () => svc.deleteGenre(req.valid.params.id));
}

async function toggleGenreStatus(req, res) {
  return base.wrap(res, async () => svc.toggleGenreStatus(req.valid.params.id));
}

async function popularGenres(req, res) {
  return base.wrap(res, async () => svc.popularGenres());
}

module.exports = {
  listBooks, getBook, flagBook, unflagBook, genres,
  tags, sections, library, placements, addPlacement, updatePlacement, removePlacement, history, refeature,
  listCategories, createCategory, updateCategory, deleteCategory, toggleCategoryStatus,
  listGenres, createGenre, updateGenre, deleteGenre, toggleGenreStatus, popularGenres,
};
