'use strict';
// Author namespace — mirrors services/author/*-service.js USE_API contracts.
const multer = require('multer');
const { z } = require('zod');
const ctrl = require('../controllers/author.controller');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/guards');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();
const id = z.string().min(1).max(120);

// Contract applications arrive as multipart (ID photos + JSON `data` field)
// or plain JSON. Photos stream to Cloudflare Images; nothing hits disk.
const ID_MIME = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'image/heic': 1, 'image/heif': 1 };
const idUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 4 },
  fileFilter: (req, file, cb) => {
    if (ID_MIME[file.mimetype]) return cb(null, true);
    const e = new Error('bad_id_type');
    e.status = 400;
    return cb(e);
  },
}).fields([{ name: 'idFront', maxCount: 1 }, { name: 'idBack', maxCount: 1 }]);

function idUploadMw(req, res, next) {
  return idUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'id_photo_too_large' });
      return res.status(err.status || 400).json({ error: err.message || 'bad_id_photo' });
    }
    return next();
  });
}

// multer leaves multipart text fields as strings; the client packs the
// application itself into `data`. Plain JSON requests pass through untouched.
function jsonDataMw(req, res, next) {
  if (typeof req.body.data === 'string') {
    try { req.body = JSON.parse(req.body.data); }
    catch (e) { return res.status(400).json({ error: 'invalid_input', details: { formErrors: ['data_must_be_json'] } }); }
  }
  return next();
}

const kyc = z.object({
  type: z.enum(['self', 'guardian', 'pending']),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  age: z.number().int().min(0).max(130).optional(),
  nin: z.string().max(24).optional(),
  altId: z.object({ type: z.string().min(1).max(60), no: z.string().min(5).max(40) }).optional(),
  guardian: z.object({
    name: z.string().min(1).max(120),
    relationship: z.string().min(1).max(60),
    idNo: z.string().min(6).max(40),
  }).optional(),
  idPhotos: z.object({ front: z.string().max(260), back: z.string().max(260) }).optional(),
}).strict().superRefine((k, ctx) => {
  if (k.type === 'self' && !/^\d{11}$/.test(k.nin || '')) {
    ctx.addIssue({ code: 'custom', path: ['nin'], message: 'nin_must_be_11_digits' });
  }
  if (k.type === 'guardian' && !k.guardian) {
    ctx.addIssue({ code: 'custom', path: ['guardian'], message: 'guardian_required' });
  }
  if (k.type === 'pending' && !k.altId) {
    ctx.addIssue({ code: 'custom', path: ['altId'], message: 'alt_id_required' });
  }
});

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
router.post('/contracts', writeLimiter, audit('author.contracts.apply'), idUploadMw, jsonDataMw,
  validate(z.object({ body: z.object({
    bookId: z.string().min(1).max(40),
    title: z.string().max(200).optional(),
    // Assigned by the editor at review — authors may omit it entirely.
    type: z.enum(['Exclusive_Publishing', 'Revenue_Share', 'License_Agreement']).optional(),
    // Omitted when the writer already has an approved identity on file.
    kyc: kyc.optional(),
  }).strict() })), ctrl.applyContract);

// Author side of an offer: sign it or decline it. Both need the deal to be
// open (Contract 'sent') and signing needs an approved identity.
router.post('/contracts/:contractId/sign', writeLimiter, audit('author.contracts.sign'),
  validate(z.object({ params: z.object({ contractId: id }) })), ctrl.signContract);
router.post('/contracts/:contractId/decline', writeLimiter, audit('author.contracts.decline'),
  validate(z.object({
    params: z.object({ contractId: id }),
    body: z.object({ reason: z.string().max(500).optional() }).strict(),
  })), ctrl.declineContract);

// Writer badge: same identity form, usable before any contract exists.
router.get('/verification', generalLimiter, ctrl.verification);
router.post('/verification', requireRole('writer'), writeLimiter, audit('author.verification.submit'),
  idUploadMw, jsonDataMw,
  validate(z.object({ body: z.object({ kyc }).strict() })), ctrl.submitVerification);

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
