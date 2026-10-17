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

// Single Cloudflare Images implementation for the whole backend.
// Callers pass raw bytes; they get back a delivery URL (or a throw).
// No disk, no fallbacks — unconfigured credentials fail closed (503).
async function uploadImageBuffer(buffer, mimetype, name) {
  const env = require('../config/env');
  if (!env.cfAccountId || !env.cfImagesToken) {
    const e = new Error('images_not_configured');
    e.status = 503;
    throw e;
  }
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), name || 'upload');
  const res = await fetch(
    'https://api.cloudflare.com/client/v4/accounts/' + env.cfAccountId + '/images/v1',
    { method: 'POST', headers: { Authorization: 'Bearer ' + env.cfImagesToken }, body: form }
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.success) {
    const e = new Error((data && data.errors && data.errors[0] && data.errors[0].message) || 'images_upload_failed');
    e.status = res.status === 401 || res.status === 403 ? 503 : 502;
    throw e;
  }
  const variants = (data.result && data.result.variants) || [];
  if (!variants[0]) { const e = new Error('images_upload_failed'); e.status = 502; throw e; }
  return variants[0];
}

module.exports = { validateMediaUrl, uploadImageBuffer, MAX_CHARS };
