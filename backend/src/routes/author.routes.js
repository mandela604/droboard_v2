'use strict';
// Author namespace — mirrors services/author/*-service.js USE_API contracts.
const { z } = require('zod');
const ctrl = require('../controllers/author.controller');
const { requireAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const id = z.string().min(1).max(120);

router.use(requireAuth);

router.get('/dashboard', generalLimiter, ctrl.dashboard);
router.get('/books', generalLimiter, ctrl.books);
router.get('/books/:id', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.book);
router.get('/books/:id/chapters', generalLimiter,
  validate(z.object({
    params: z.object({ id }),
    query: z.object({ page: z.string().max(6).optional(), limit: z.string().max(6).optional() }).strict(),
  })), ctrl.bookChaptersList);
router.put('/books/:id/chapters/:num', writeLimiter, audit('author.chapters.save'),
  validate(z.object({
    params: z.object({ id, num: z.string().min(1).max(10) }),
    body: z.object({}).catchall(z.unknown()),
  })), ctrl.saveBookChapter);
router.post('/books/:id/change-requests', writeLimiter, audit('author.changeRequests.submit'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      changes: z.array(z.string().max(80)).max(12).optional(),
      details: z.string().max(2000).optional(),
      order: z.array(z.string().max(120)).max(500).optional(),
    }).strict().refine(b => (b.changes && b.changes.length) || (b.order && b.order.length), { message: 'empty_request' }),
  })), ctrl.requestBookChange);
router.get('/books/:id/overview', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.overview);

router.get('/books/:id/characters', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.characters);
router.post('/books/:id/characters', writeLimiter, audit('author.characters.create'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({
      name: z.string().min(1).max(80), role: z.enum(['lead', 'support', 'antagonist', 'minor']).optional(),
      avatar: z.string().max(2000).optional(), meta: z.string().max(120).optional(),
      bio: z.string().max(2000).optional(), arc: z.string().max(2000).optional(),
      traits: z.array(z.string().max(30)).max(12).optional(),
    }).strict(),
  })), ctrl.saveCharacter);
router.put('/books/:id/characters/:charId', writeLimiter, audit('author.characters.update'),
  validate(z.object({ params: z.object({ id, charId: z.string().min(1).max(40) }), body: z.object({}).catchall(z.unknown()) })), ctrl.saveCharacter);
router.delete('/books/:id/characters/:charId', writeLimiter, audit('author.characters.delete'),
  validate(z.object({ params: z.object({ id, charId: z.string().min(1).max(40) }) })), ctrl.deleteCharacter);

router.get('/books/:id/plot', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.plot);
router.put('/books/:id/plot', writeLimiter, audit('author.plot.save'),
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ acts: z.array(z.unknown()).optional(), roadmap: z.array(z.unknown()).optional() }).strict(),
  })), ctrl.savePlot);

// edit-chapter-service contract (single chapter by number)
router.get('/books/:id/chapters/:num', generalLimiter,
  validate(z.object({ params: z.object({ id, num: z.string().min(1).max(10) }) })), ctrl.bookChapters);

// my edit proposals (approve/reject happens on the editor side)
router.get('/books/:id/chapter-edits', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.chapterEdits);
router.get('/books/:id/book-edits', generalLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.bookEdits);

router.get('/contracts', generalLimiter, ctrl.contracts);
router.post('/contracts', writeLimiter, audit('author.contracts.apply'),
  validate(z.object({ body: z.object({
    bookId: z.string().min(1).max(40),
    type: z.enum(['Exclusive_Publishing', 'Revenue_Share', 'License_Agreement']).optional(),
  }).strict().catchall(z.unknown()) })), ctrl.applyContract);

router.post('/completion', writeLimiter, audit('author.completion.apply'),
  validate(z.object({ body: z.object({ bookId: z.string().min(1).max(40) }).strict().catchall(z.unknown()) })), ctrl.applyCompletion);

router.post('/vip', writeLimiter, audit('author.vip.apply'),
  validate(z.object({ body: z.object({ bookId: z.string().min(1).max(40) }).strict().catchall(z.unknown()) })), ctrl.applyVip);

router.post('/chapter-reviews', writeLimiter, audit('author.chapterReviews.submit'),
  validate(z.object({ body: z.object({ bookId: z.string().min(1).max(40) }).strict().catchall(z.unknown()) })), ctrl.chapterReviews);

router.get('/launch-kit', generalLimiter, ctrl.launchKit);
router.post('/launch-kit', writeLimiter, audit('author.launchKit.save'),
  validate(z.object({ body: z.object({}).catchall(z.unknown()) })), ctrl.saveLaunchKit);
router.put('/launch-kit/:id', writeLimiter, audit('author.launchKit.save'),
  validate(z.object({ params: z.object({ id }), body: z.object({}).catchall(z.unknown()) })), ctrl.saveLaunchKit);

module.exports = router;
