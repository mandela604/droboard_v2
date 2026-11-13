'use strict';
/**
 * routes/build.routes.js — page bundles.
 *
 *   GET /build/<page>.bundle.js
 *
 * A page (feed.html, discussion.html, …) declares its scripts as a JSON list
 * inside a <script type="application/json" id="dro-bundle-sources"> block and
 * then loads ONE tag:
 *
 *   <script src="/build/feed.bundle.js" defer></script>
 *
 * This route reads that list out of the page HTML and concatenates the files
 * in exactly the order the page listed them, so the bundle executes in the same
 * order the individual tags used to.
 *
 * Why it is built per request instead of at deploy time:
 *   • a bundle can never be stale — edit a source file and the next request
 *     already serves the new code, with no build step and no cache purge;
 *   • the list lives in the page HTML itself, so the bundle and the page can
 *     never drift apart.
 *
 * The concatenation is cached in memory and keyed by the size + mtime of every
 * source file, so a warm request is 44 stat() calls and nothing else.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const express = require('express');

const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'public');
const PAGES_DIR = path.join(PUBLIC_DIR, 'Pages');

// The JSON block the page carries its script list in.
const SOURCES_RE = /<script[^>]*id=["']dro-bundle-sources["'][^>]*>([\s\S]*?)<\/script>/i;

// page -> { stampKey, etag, body, gz }
const cache = new Map();

function safePageName(page) {
  const p = String(page || '');
  return /^[a-z0-9][a-z0-9-]*$/i.test(p) ? p : null;
}

// Resolve a page-relative path (../component/x.js) and refuse anything that
// escapes the public directory.
function resolveSource(rel) {
  const clean = String(rel || '').split('?')[0].split('#')[0];
  if (!clean) return null;
  const full = path.resolve(PAGES_DIR, clean);
  const root = path.resolve(PUBLIC_DIR) + path.sep;
  if (!full.startsWith(root)) return null;
  return full;
}

function readSources(html) {
  const m = html.match(SOURCES_RE);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(s => typeof s === 'string' && s.trim());
  } catch (e) {
    return null;
  }
}

function buildBundle(page) {
  const name = safePageName(page);
  if (!name) return null;
  const htmlPath = path.join(PAGES_DIR, name + '.html');
  let html;
  try {
    html = fs.readFileSync(htmlPath, 'utf8');
  } catch (e) {
    return null;
  }
  const sources = readSources(html);
  if (!sources || !sources.length) return null;

  const files = [];
  for (const rel of sources) {
    const full = resolveSource(rel);
    if (!full) continue;
    try {
      if (!fs.statSync(full).isFile()) continue;
    } catch (e) {
      continue;
    }
    files.push(full);
  }
  if (!files.length) return null;

  // Fingerprint every source. If any file changed on disk, the bundle is
  // rebuilt; otherwise the cached copy is reused as-is.
  const stamps = files.map(f => {
    const s = fs.statSync(f);
    return f + '|' + s.size + '|' + Math.floor(s.mtimeMs);
  });
  const stampKey = stamps.join('\n');
  const hit = cache.get(name);
  if (hit && hit.stampKey === stampKey) return hit;

  const parts = files.map(f => {
    const rel = path.relative(PUBLIC_DIR, f).replace(/\\/g, '/');
    return '/* ── ' + rel + ' ── */\n' + fs.readFileSync(f, 'utf8');
  });
  // '\n;\n' between files: the ';' closes any statement the previous file
  // left open, and the newlines end any trailing line comment.
  const body = parts.join('\n;\n');
  const etag = '"' + crypto.createHash('sha1').update(stampKey).digest('hex').slice(0, 20) + '"';
  const entry = {
    stampKey,
    etag,
    body,
    gz: zlib.gzipSync(Buffer.from(body, 'utf8'), { level: zlib.constants.Z_BEST_COMPRESSION }),
  };
  cache.set(name, entry);
  return entry;
}

function Router() { return express.Router(); }
const router = Router();

// A regex route, because ':page.bundle.js' is not a reliable param pattern.
router.get(/^\/([a-z0-9][a-z0-9-]*)\.bundle\.js$/i, (req, res) => {
  const page = req.params[0];
  const entry = buildBundle(page);
  if (!entry) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).type('text/plain').send('bundle not found: ' + page);
  }
  res.setHeader('ETag', entry.etag);
  res.setHeader('Vary', 'Accept-Encoding');
  // Revalidate every time: the ETag changes the moment any source file does,
  // so this is always correct AND cheap (a 304 carries no body).
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  if (req.headers['if-none-match'] === entry.etag) return res.status(304).end();

  const accept = String(req.headers['accept-encoding'] || '');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (/\bgzip\b/.test(accept)) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.end(entry.gz);
  }
  return res.end(entry.body);
});

module.exports = router;
module.exports.buildBundle = buildBundle;
