'use strict';
// Real image uploads: multipart/form-data {file} -> {url}.
//
// Bytes live in Cloudflare Images ONLY — no disk, no MongoDB blobs, no
// fallbacks. Memory upload streams straight to Images; the returned
// delivery URL goes into cover/avatar. Unconfigured -> 503 (fail closed).
const multer = require('multer');
const { z } = require('zod');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { validate, writeLimiter, audit } = require('../middleware/http');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

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

const { uploadImageBuffer } = require('../services/media.service');

async function uploadToImages(buffer, mimetype, name) {
  try {
    return await uploadImageBuffer(buffer, mimetype, name);
  } catch (e) {
    if (e && e.status === 503) throw e;
    return null;
  }
}

function multerMw(req, res, next) {
  return upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'image_too_large' });
      return res.status(err.status || 400).json({ error: err.message || 'bad_image' });
    }
    return next();
  });
}

router.post('/image', requireAuth, writeLimiter, audit('uploads.image'), multerMw,
  async (req, res) => base.wrap(res, async () => {
    if (!req.file) { const e = new Error('no_file'); e.status = 400; throw e; }
    if (!env.cfAccountId || !env.cfImagesToken) {
      const e = new Error('images_not_configured');
      e.status = 503;
      throw e;
    }
    const url = await uploadToImages(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!url) { const e = new Error('images_upload_failed'); e.status = 502; throw e; }
    res.status(201);
    return { url };
  }));

// Stock import: fetch an allowlisted image URL server-side and store OUR
// permanent Images copy (hotlinks rot — stored covers never do).
// Not an open proxy: hostname allowlist + image content-type + 2mb cap.
const IMPORT_HOSTS = ['images.unsplash.com'];

router.post('/import', requireAuth, writeLimiter, audit('uploads.import'),
  validate(z.object({
    body: z.object({
      url: z.string().url().max(2000),
    }).strict(),
  })),
  async (req, res) => base.wrap(res, async () => {
    if (!env.cfAccountId || !env.cfImagesToken) {
      const e = new Error('images_not_configured');
      e.status = 503;
      throw e;
    }
    let u;
    try { u = new URL(req.valid.body.url); }
    catch (e) { const err = new Error('bad_url'); err.status = 400; throw err; }
    if (u.protocol !== 'https:' || !IMPORT_HOSTS.includes(u.hostname)) {
      const e = new Error('host_not_allowed');
      e.status = 400;
      throw e;
    }
    const fetched = await fetch(u.toString(), { redirect: 'follow' }).catch(() => null);
    if (!fetched || !fetched.ok) { const e = new Error('fetch_failed'); e.status = 502; throw e; }
    const ctype = (fetched.headers.get('content-type') || '').split(';')[0].trim();
    if (!MIME_OK[ctype]) { const e = new Error('bad_image_type'); e.status = 400; throw e; }
    const buf = Buffer.from(await fetched.arrayBuffer());
    if (!buf.length || buf.length > 2 * 1024 * 1024) { const e = new Error('image_too_large'); e.status = 400; throw e; }
    const url = await uploadToImages(buf, ctype, u.pathname.split('/').pop() || 'stock');
    if (!url) { const e = new Error('images_upload_failed'); e.status = 502; throw e; }
    res.status(201);
    return { url };
  }));

module.exports = router;
