'use strict';
// Status creation: multipart/form-data {file, quote?, caption?, isLive?, ttlHours?}
// (photo uploaded server-side → Cloudflare URL becomes the bg) OR JSON
// {bg: <uploaded media URL>, quote?, caption?, ttlHours?} for clients that
// already uploaded via POST /api/uploads/image. bg URLs must pass
// validateMediaUrl (Cloudflare Images delivery only) — no pasted hotlinks.
const multer = require('multer');
const { z } = require('zod');
const ctrl = require('../controllers/statuses.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { validate, audit, generalLimiter, writeLimiter } = require('../middleware/http');

function Router() { return require('express').Router(); }
const router = Router();

const id = z.string().min(1).max(120);
// NOTE: multipart text fields always arrive as strings — hence coercion.
const statusFormBody = z.object({
  bg: z.string().max(2800).optional(), // JSON path: pre-uploaded media URL
  quote: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  isLive: z.coerce.boolean().optional(),
  ttlHours: z.coerce.number().int().min(1).max(72).optional(),
}).strict();

const MIME_OK = { 'image/png': true, 'image/jpeg': true, 'image/webp': true, 'image/gif': true };
const upload = multer({
  storage: multer.memoryStorage(), // never touches disk
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (MIME_OK[file.mimetype]) return cb(null, true);
    const e = new Error('bad_image_type');
    e.status = 400;
    return cb(e);
  },
});
function multerMw(req, res, next) {
  return upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'image_too_large' });
      return res.status(err.status || 400).json({ error: err.message || 'bad_image' });
    }
    return next();
  });
}

router.get('/home', generalLimiter, optionalAuth, ctrl.home);
// Frontend contract: my active story slides (24h) for the story ring.
router.get('/me', requireAuth, ctrl.me);
// Cross-surface seen-state for a set of handles (rings on feed/profile/etc).
router.get('/state', generalLimiter, optionalAuth,
  validate(z.object({ query: z.object({ handles: z.string().max(2400).optional() }).strict() })),
  ctrl.state);
router.post('/', requireAuth, writeLimiter, audit('statuses.create'), multerMw,
  validate(z.object({ body: statusFormBody })), ctrl.create);
// Views are logged for signed-in users AND guests (stable anonId from the
// client). Owner-only "seen by" lives at /:id/viewers.
router.post('/:id/view', generalLimiter, optionalAuth,
  validate(z.object({
    params: z.object({ id }),
    body: z.object({ anonId: z.string().max(80).optional(), viewerId: z.string().max(80).optional() }).strict().optional(),
  })), ctrl.view);
router.get('/:id/viewers', generalLimiter, requireAuth,
  validate(z.object({ params: z.object({ id }) })), ctrl.viewers);
router.post('/:id/like', requireAuth, writeLimiter,
  validate(z.object({ params: z.object({ id }) })), ctrl.like);
router.delete('/:id', requireAuth, writeLimiter, audit('statuses.delete'),
  validate(z.object({ params: z.object({ id }) })), ctrl.remove);

module.exports = router;
