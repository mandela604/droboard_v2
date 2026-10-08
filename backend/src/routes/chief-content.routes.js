'use strict';
const { z } = require('zod');
const ctrl = require('../controllers/chief-content.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const guard = [requireAuth, requireRole('chief_editor', 'admin')];
const id = z.string().min(1).max(120);
const pageQuery = z.object({
  q: z.string().max(80).optional(), page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
}).strict();

// ---- Books ----
router.get('/books', ...guard,
  validate(z.object({ query: pageQuery.extend({
    genre: z.string().max(40).optional(), status: z.string().max(20).optional(),
    sort: z.enum(['recent', 'views', 'likes', 'comments']).optional(),
  }).strict() })), ctrl.listBooks);

router.get('/books/genres', ...guard,
  validate(z.object({ query: z.object({}).strict() }).partial()), ctrl.genres);

router.get('/books/:id', ...guard,
  validate(z.object({ params: z.object({ id }) })), ctrl.getBook);

router.post('/books/:id/flag', ...guard, audit('chief.books.flag'),
  validate(z.object({ params: z.object({ id }) })), ctrl.flagBook);

router.post('/books/:id/unflag', ...guard, audit('chief.books.unflag'),
  validate(z.object({ params: z.object({ id }) })), ctrl.unflagBook);

// ---- Featured ----
router.get('/featured/tags', ...guard,
  validate(z.object({ query: z.object({}).strict() }).partial()), ctrl.tags);

router.get('/featured/sections', ...guard,
  validate(z.object({ query: z.object({}).strict() }).partial()), ctrl.sections);

router.get('/featured/library', ...guard,
  validate(z.object({ query: pageQuery.extend({ genre: z.string().max(40).optional() }).strict() })), ctrl.library);

router.get('/featured/placements', ...guard,
  validate(z.object({ query: pageQuery.extend({
    tag: z.string().max(40).optional(), section: z.string().max(40).optional(),
  }).strict() })), ctrl.placements);

router.post('/featured/placements', ...guard, audit('chief.featured.placement.add'),
  validate(z.object({ body: z.object({
    storyId: z.string().min(1).max(120), section: z.string().max(40).optional(),
    sub: z.string().max(40).optional(), tags: z.array(z.string().max(30)).max(10).optional(),
    start: z.string().max(40).optional(), end: z.string().max(40).optional(),
    note: z.string().max(300).optional(),
  }).strict() })), ctrl.addPlacement);

router.patch('/featured/placements/:storyId', ...guard, audit('chief.featured.placement.update'),
  validate(z.object({
    params: z.object({ storyId: id }),
    body: z.object({
      section: z.string().max(40).optional(), sub: z.string().max(40).optional(),
      tags: z.array(z.string().max(30)).max(10).optional(), note: z.string().max(300).optional(),
      start: z.string().max(40).optional(), end: z.string().max(40).nullable().optional(),
      order: z.number().int().min(0).max(1000).optional(), active: z.boolean().optional(),
    }).strict(),
  })), ctrl.updatePlacement);

router.delete('/featured/placements/:storyId', ...guard, audit('chief.featured.placement.remove'),
  validate(z.object({ params: z.object({ storyId: id }) })), ctrl.removePlacement);

router.get('/featured/history', ...guard,
  validate(z.object({ query: pageQuery })), ctrl.history);

router.post('/featured/history/:index/refeature', ...guard, audit('chief.featured.refeature'),
  validate(z.object({ params: z.object({ index: z.string().min(1).max(120) }) })), ctrl.refeature);

// ---- Categories ----
const categoryBody = z.object({
  name: z.string().min(1).max(80), slug: z.string().max(80).optional(),
  icon: z.string().max(200).optional(), bg: z.string().max(20).optional(),
  color: z.string().max(20).optional(), desc: z.string().max(2000).optional(),
  tagline: z.string().max(200).optional(), cover: z.string().max(2000).optional(),
  adminIds: z.array(z.string().max(120)).max(20).optional(),
}).strict();

router.get('/categories', ...guard,
  validate(z.object({ query: pageQuery.extend({
    status: z.string().max(20).optional(),
  }).strict() })), ctrl.listCategories);

router.post('/categories', ...guard, audit('chief.categories.create'),
  validate(z.object({ body: categoryBody })), ctrl.createCategory);

router.patch('/categories/:id', ...guard, audit('chief.categories.update'),
  validate(z.object({ params: z.object({ id }), body: categoryBody.partial() })), ctrl.updateCategory);

router.delete('/categories/:id', ...guard, audit('chief.categories.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteCategory);

router.post('/categories/:id/toggle-status', ...guard, audit('chief.categories.toggle-status'),
  validate(z.object({ params: z.object({ id }) })), ctrl.toggleCategoryStatus);

// ---- Genres ----
const genreBody = z.object({
  name: z.string().min(1).max(80), categoryId: z.string().min(1).max(120),
  slug: z.string().max(80).optional(),
  desc: z.string().max(2000).optional(), tagline: z.string().max(200).optional(),
  about: z.any().optional(),
  icon: z.string().max(200).optional(), cover: z.string().max(2000).optional(),
  bg: z.string().max(20).optional(), color: z.string().max(20).optional(),
  adminIds: z.array(z.string().max(120)).max(20).optional(),
  moderatorIds: z.array(z.string().max(120)).max(20).optional(),
}).strict();

router.get('/genres/popular', ...guard,
  validate(z.object({ query: z.object({}).strict() }).partial()), ctrl.popularGenres);

router.get('/genres', ...guard,
  validate(z.object({ query: pageQuery.extend({
    status: z.string().max(20).optional(), categoryId: z.string().max(120).optional(),
  }).strict() })), ctrl.listGenres);

router.post('/genres', ...guard, audit('chief.genres.create'),
  validate(z.object({ body: genreBody })), ctrl.createGenre);

router.patch('/genres/:id', ...guard, audit('chief.genres.update'),
  validate(z.object({ params: z.object({ id }), body: genreBody.partial() })), ctrl.updateGenre);

router.delete('/genres/:id', ...guard, audit('chief.genres.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.deleteGenre);

router.post('/genres/:id/toggle-status', ...guard, audit('chief.genres.toggle-status'),
  validate(z.object({ params: z.object({ id }) })), ctrl.toggleGenreStatus);

module.exports = router;
