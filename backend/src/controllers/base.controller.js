'use strict';

// Deep-normalize Mongo output for the API: keep custom `id` (uuidv7),
// hide internal `_id` (ObjectId) + __v.
// (Mongoose .lean() skips toJSON transforms, so this runs on every response.)
function normalize(out) {
  if (Array.isArray(out)) return out.map(normalize);
  if (out && typeof out === 'object' && !(out instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(out, '_id')) {
      // Aggregation group keys use _id legitimately (e.g. { _id: '$type' }).
      // Only map to `id` for real documents (they have either id or other doc fields).
      const isAggKey = Object.keys(out).length <= 3 && !('id' in out) && !('createdAt' in out) && !('updatedAt' in out);
      if (!isAggKey) {
        if (!('id' in out) || !out.id) out.id = String(out._id);
        else out.id = String(out.id);
        delete out._id; // internal key never leaves the server
      }
    } else if ('id' in out && out.id != null) {
      out.id = String(out.id);
    }
    delete out.__v;
    for (const k of Object.keys(out)) {
      if (k === '_id') continue;
      out[k] = normalize(out[k]);
    }
  }
  return out;
}

async function wrap(res, fn) {
  try {
    return res.json(normalize(await fn()));
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'error' });
  }
}

function setRefreshCookie(res, token) {
  const env = require('../config/env');
  res.cookie('dro_refresh', token, {
    httpOnly: true, secure: env.isProd, sameSite: 'lax',
    domain: env.cookieDomain, maxAge: 30 * 86400000, path: '/api/auth',
  });
}
// Short-lived access cookie so credentials:include fetches work without an
// Authorization header (super-admin web UI). Same JWT as Bearer; httpOnly.
function ttlMs(ttl) {
  const m = /^(\d+)([smhd])$/.exec(String(ttl || ''));
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  return { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]] * n;
}
function setAccessCookie(res, token) {
  const env = require('../config/env');
  res.cookie('dro_access', token, {
    httpOnly: true, secure: env.isProd, sameSite: 'lax',
    domain: env.cookieDomain, maxAge: ttlMs(env.jwtAccessTtl), path: '/',
  });
}
function clearAccessCookie(res) {
  const env = require('../config/env');
  res.clearCookie('dro_access', { domain: env.cookieDomain, path: '/' });
}
function clearRefreshCookie(res) {
  const env = require('../config/env');
  res.clearCookie('dro_refresh', { domain: env.cookieDomain, path: '/api/auth' });
}

module.exports = { wrap, normalize, setRefreshCookie, clearRefreshCookie, setAccessCookie, clearAccessCookie };
