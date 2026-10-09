'use strict';
// Shared cover/avatar validation. Upload-only rule: ONLY Cloudflare Images
// delivery URLs (https://imagedelivery.net/<hash>/<id>/<variant>).
// No pasted hotlinks (they rot), no data blobs (they fill Mongo), no local
// paths. Upload files via POST /api/uploads/image, stock via
// POST /api/uploads/import — store the returned URL.
const MAX_CHARS = 2800000;

const IMAGES_URL = /^https:\/\/imagedelivery\.net\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function validateMediaUrl(v, field) {
  if (v === '' || v == null) return '';
  const s = String(v).trim();
  if (s.length > MAX_CHARS) { const e = new Error(field + '_too_large'); e.status = 400; throw e; }
  if (IMAGES_URL.test(s)) return s;
  const e = new Error(field + '_must_be_uploaded');
  e.status = 400;
  throw e;
}

module.exports = { validateMediaUrl, MAX_CHARS };
