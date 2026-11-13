'use strict';
// Image upload via Cloudinary. No disk writes, no Mongo blobs.
// Upload via POST /api/uploads/image → returns a secure delivery URL.
// Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in env.

const MAX_CHARS = 2800000;

// Cloudinary delivers over HTTPS with a stable URL — accept those.
// Also still accept imagedelivery.net for any existing Cloudflare URLs in the DB.
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\//;
const CF_URL = /^https:\/\/imagedelivery\.net\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function validateMediaUrl(v, field) {
  if (v === '' || v == null) return '';
  const s = String(v).trim();
  if (s.length > MAX_CHARS) { const e = new Error(field + '_too_large'); e.status = 400; throw e; }
  if (CLOUDINARY_URL.test(s) || CF_URL.test(s)) return s;
  const e = new Error(field + '_must_be_uploaded');
  e.status = 400;
  throw e;
}

// Upload raw bytes to Cloudinary. Returns the secure delivery URL.
async function uploadImageBuffer(buffer, mimetype, name) {
  const env = require('../config/env');
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    console.error('[upload] Cloudinary not configured — cloudName:', !!env.cloudinaryCloudName, 'apiKey:', !!env.cloudinaryApiKey, 'apiSecret:', !!env.cloudinaryApiSecret);
    const e = new Error('images_not_configured');
    e.status = 503;
    throw e;
  }
  console.log('[upload] Cloudinary configured — cloudName:', env.cloudinaryCloudName);

  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });

  // Convert buffer to base64 data URI for Cloudinary upload
  const base64 = buffer.toString('base64');
  const dataUri = `data:${mimetype};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'droboard',
    resource_type: 'image',
    public_id: (name || 'upload').replace(/\.[^.]+$/, '') + '_' + Date.now(),
    overwrite: false,
    // Auto-quality and format for best delivery
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  });

  if (!result || !result.secure_url) {
    const e = new Error('images_upload_failed');
    e.status = 502;
    throw e;
  }

  return result.secure_url;
}

module.exports = { validateMediaUrl, uploadImageBuffer, MAX_CHARS };
