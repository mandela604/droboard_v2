'use strict';
/**
 * earn-rules.js — the one definition list for the "Earn coins" tasks the
 * finance console can create, used on BOTH sides of the money path:
 *
 *   validate(doc)  → rejects a reward before it is saved, and
 *   shaped(doc)    → the store serves ONLY rewards that still pass, so a
 *                    half-configured task can never pay out.
 *   targetFor(doc) → the destination is built here, so the client never
 *                    invents a URL for a task it gets paid for.
 *
 * Every destination the reader is sent to must be https (or, for tasks that
 * stay inside the app, a plain relative path). javascript:/data:/http:// and
 * protocol-relative links are refused.
 */

// kind: url = absolute https, path = relative-or-https in-app link,
//       channel = YouTube channel URL or bare handle, video = YouTube id/url,
//       int = number, slug = plain short text token
const REGISTRY = {
  checkin: {
    label: 'Daily Check-in', icon: 'fa-calendar-check', fields: [],
    proof: false, timed: false,
  },
  share: {
    label: 'Share', icon: 'fa-share-nodes',
    fields: [{ key: 'shareUrl', label: 'Share link', kind: 'url', optional: true }],
    proof: false, timed: false,
  },
  rate: {
    label: 'Rate a Story', icon: 'fa-star',
    fields: [{ key: 'storyUrl', label: 'Story link', kind: 'path', optional: true }],
    proof: false, timed: false,
  },
  blog_read: {
    label: 'Blog Read', icon: 'fa-newspaper',
    fields: [
      { key: 'blogUrl', label: 'Blog URL', kind: 'path', def: 'Pages/blog.html?cat=tech' },
      { key: 'blogCategory', label: 'Blog category', kind: 'slug', def: 'tech' },
      { key: 'pagesRequired', label: 'Pages to read', kind: 'int', min: 1, max: 50, def: 3, atRoot: true },
    ],
    // Time on site is the only server-checkable proof a read happened, so the
    // task is timed like an ad rather than paid the instant it is opened.
    proof: true, timed: true, watchDef: 45,
  },
  watch_ad: {
    // This one leaves the app, so a relative path can never satisfy it.
    label: 'Watch Ad', icon: 'fa-film',
    fields: [{ key: 'adUrl', label: 'Ad / offer URL', kind: 'url' }],
    proof: true, timed: true, watchDef: 20,
  },
  youtube_sub: {
    label: 'YouTube Subscribe', icon: 'fa-youtube',
    fields: [{ key: 'channelId', label: 'Channel URL or handle', kind: 'channel' }],
    proof: true, timed: false,
  },
  youtube_watch: {
    label: 'YouTube Watch', icon: 'fa-play',
    fields: [
      { key: 'videoId', label: 'Video ID or URL', kind: 'video' },
      { key: 'minWatchSec', label: 'Seconds to watch', kind: 'int', min: 15, max: 600, def: 60 },
    ],
    proof: true, timed: true, watchDef: 60,
  },
};

const TYPES = Object.keys(REGISTRY);
const WATCH_MIN = 15;
const WATCH_MAX = 600;
const COOLDOWN_UNITS = { s: 1e3, sec: 1e3, second: 1e3, seconds: 1e3, m: 6e4, min: 6e4, mins: 6e4, minute: 6e4, minutes: 6e4, h: 36e5, hr: 36e5, hrs: 36e5, hour: 36e5, hours: 36e5, d: 864e5, day: 864e5, days: 864e5 };
const COOLDOWN_MAX_MS = 365 * 864e5;

function cooldownMs(str) {
  const m = /(\d+(?:\.\d+)?)\s*([a-z]+)/i.exec(String(str || ''));
  if (!m) return 0;
  const unit = COOLDOWN_UNITS[m[2].toLowerCase()];
  return unit ? Math.round(Number(m[1]) * unit) : 0;
}

function httpsUrl(s) {
  const raw = String(s || '').trim();
  if (!raw || /\s/.test(raw)) return null;
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  return u.protocol === 'https:' ? raw : null;
}
// In-app destination: a relative path, or an absolute https URL.
function appPath(s) {
  const raw = String(s || '').trim();
  if (!raw || /\s/.test(raw)) return null;
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null; // javascript:, data:, http:, ftp:…
  if (raw.startsWith('//')) return null;             // protocol-relative
  return /^[A-Za-z0-9._~!$&'()*+,;=@/?#%:-]+$/.test(raw) ? raw : null;
}
function youTubeVideo(s) {
  const raw = String(s || '').trim();
  const m = /(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/.exec(raw);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : null;
}
const YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
function youTubeChannel(s) {
  const raw = String(s || '').trim();
  if (!raw) return null;
  const abs = httpsUrl(raw);
  if (abs) {
    let u; try { u = new URL(abs); } catch (e) { return null; }
    return YT_HOSTS.indexOf(u.hostname.toLowerCase()) >= 0 ? abs : null;
  }
  // Bare handle / channel id, pasted into the subscribe URL by targetFor().
  if (/^@?[A-Za-z0-9._-]{3,80}$/.test(raw)) return raw;
  return null;
}
function faIcon(s, fallback) {
  const raw = String(s || '').trim();
  if (!raw) return fallback;
  return /^(?:[a-z]+ )?fa-[a-z0-9-]+$/i.test(raw) ? raw : null;
}

// Some fields are schema columns, the rest ride in the doc's meta blob.
function fieldOf(doc, f) {
  if (f.atRoot) return doc[f.key];
  if (doc.meta && typeof doc.meta === 'object' && doc.meta[f.key] !== undefined) return doc.meta[f.key];
  return doc[f.key];
}
function isBlank(v) { return v === undefined || v === null || String(v).trim() === ''; }

/* type / coins / cooldown apply to every reward; the per-type fields decide
   whether the task can actually be performed and paid for. */
function validate(doc) {
  const errs = [];
  const type = String(doc.type || '');
  const rule = REGISTRY[type];
  if (!rule) { errs.push('Unknown reward type "' + type + '" (allowed: ' + TYPES.join(', ') + ')'); return errs; }

  const coins = Math.round(Number(doc.coins));
  if (!isFinite(coins) || coins < 1) errs.push('Coins must be a whole number of at least 1');
  else if (coins > 100000) errs.push('Coins above 100,000 per task are not allowed');

  const cd = String(doc.cooldown || '').trim();
  if (!cd || /no cooldown|^\u2014$/i.test(cd)) {
    errs.push('A reward that can be claimed again needs a cooldown (e.g. "5 min", "1 day")');
  } else {
    const ms = cooldownMs(cd);
    if (!ms) errs.push('Cooldown "' + cd + '" is not a time we understand (e.g. "5 min", "1 day")');
    else if (ms > COOLDOWN_MAX_MS) errs.push('Cooldown cannot be longer than 1 year');
  }

  const st = String(doc.status || 'active');
  if (st !== 'active' && st !== 'inactive') errs.push('Status must be active or inactive');
  if (!faIcon(doc.meta && doc.meta.icon, rule.icon)) errs.push('Icon must be a Font Awesome class (e.g. fa-film) or left blank');

  rule.fields.forEach(f => {
    const raw = fieldOf(doc, f);
    if (isBlank(raw)) {
      // `def` fills the gap for an in-app path; a task that leaves the app or
      // needs an id has no safe default, so it stays an error.
      if (f.optional || f.def !== undefined) return;
      errs.push(f.label + ' is required for ' + rule.label);
      return;
    }
    if (f.kind === 'url' && !httpsUrl(raw)) errs.push(f.label + ' must be a full https:// URL — it opens outside the app');
    else if (f.kind === 'path' && !appPath(raw)) errs.push(f.label + ' must be an in-app path or a https:// URL (no javascript:/http:)');
    else if (f.kind === 'channel' && !youTubeChannel(raw)) errs.push(f.label + ' must be a youtube.com channel link or handle');
    else if (f.kind === 'video' && !youTubeVideo(raw)) errs.push(f.label + ' must be an 11-character YouTube id or video URL');
    else if (f.kind === 'int') {
      const n = Math.round(Number(raw));
      if (!isFinite(n) || n < f.min || n > f.max) errs.push(f.label + ' must be between ' + f.min + ' and ' + f.max);
    } else if (f.kind === 'slug' && !/^[A-Za-z0-9._-]{1,40}$/.test(String(raw).trim())) {
      errs.push(f.label + ' must be a short word (letters, digits, - _ .)');
    }
  });

  // Only when the type has no declared minWatchSec field of its own (watch_ad),
  // otherwise the loop above already reported it.
  if (rule.timed && !rule.fields.some(f => f.key === 'minWatchSec') && !isBlank(fieldOf(doc, { key: 'minWatchSec' }))) {
    const n = Math.round(Number(fieldOf(doc, { key: 'minWatchSec' })));
    if (!isFinite(n) || n < WATCH_MIN || n > WATCH_MAX) errs.push('Watch time must be between ' + WATCH_MIN + ' and ' + WATCH_MAX + ' seconds');
  }
  return errs;
}

function watchSec(doc) {
  const rule = REGISTRY[String(doc.type || '')] || {};
  const v = fieldOf(doc, { key: 'minWatchSec' });
  const n = Math.round(Number(v));
  if (isFinite(n) && n >= WATCH_MIN && n <= WATCH_MAX) return n;
  return rule.watchDef || WATCH_MIN;
}

/* One reward, as the store needs it to draw and run the task. Returns null for
   anything that does not validate — an unusable task is invisible, not free. */
function shaped(doc) {
  if (validate(doc).length) return null;
  const rule = REGISTRY[String(doc.type)];
  const meta = (doc.meta && typeof doc.meta === 'object') ? doc.meta : {};
  const icon = faIcon(meta.icon, rule.icon) || rule.icon;
  const out = {
    id: String(doc.code), code: String(doc.code), action: String(doc.action || rule.label),
    type: doc.type, label: rule.label, icon, faIcon: icon,
    coins: Math.round(Number(doc.coins) || 0),
    cooldown: String(doc.cooldown || '').trim(),
    cooldownSec: Math.round(cooldownMs(doc.cooldown) / 1000),
    available: (doc.status || 'active') === 'active' && meta.available !== false,
    needsProof: !!rule.proof, needsWatch: !!rule.timed,
    target: targetFor(doc),
  };
  if (rule.timed) out.minWatchSec = watchSec(doc);
  rule.fields.forEach(f => {
    let v = fieldOf(doc, f);
    if (isBlank(v)) v = f.def;
    if (isBlank(v)) return;
    if (f.kind === 'video') v = youTubeVideo(v);
    else if (f.kind === 'url' || f.kind === 'path') v = String(v).trim();
    else if (f.kind === 'int') v = Math.round(Number(v));
    else v = String(v).trim();
    out[f.key] = v;
  });
  return out;
}

/* Where the reader goes to perform the task, resolved from the reward row. */
function targetFor(doc) {
  const type = String(doc.type || '');
  const f = key => fieldOf(doc, { key });
  if (type === 'watch_ad') return httpsUrl(f('adUrl'));
  if (type === 'share') return httpsUrl(f('shareUrl'));
  if (type === 'rate') return appPath(f('storyUrl'));
  if (type === 'blog_read') return appPath(f('blogUrl')) || 'Pages/blog.html?cat=' + encodeURIComponent(String(f('blogCategory') || 'tech'));
  if (type === 'youtube_sub') {
    const ch = String(f('channelId') || f('channelUrl') || '').trim();
    if (/^https:\/\//i.test(ch)) return ch + (ch.indexOf('?') >= 0 ? '&' : '?') + 'sub_confirmation=1';
    return ch ? 'https://www.youtube.com/@' + encodeURIComponent(ch.replace(/^@/, '')) + '?sub_confirmation=1' : null;
  }
  if (type === 'youtube_watch') {
    const vid = youTubeVideo(f('videoId'));
    if (!vid) return null;
    // The watch page claims THIS code, so the coins stay the catalog's amount.
    return 'youtube-earn.html?vid=' + encodeURIComponent(vid) + '&sec=' + watchSec(doc) + '&earn=' + encodeURIComponent(String(doc.code || ''));
  }
  return null; // checkin: performed right here
}

module.exports = {
  REGISTRY, TYPES, WATCH_MIN, WATCH_MAX, validate, shaped, targetFor, watchSec, cooldownMs,
  httpsUrl, appPath, youTubeVideo, youTubeChannel, faIcon, fieldOf,
};
