'use strict';
// BATCH 3: scheduled publisher. Flips due `scheduled` chapters to `live`
// every minute. No dependency — plain interval, unref'd so tests exit cleanly.
const { Chapter } = require('../models/content.model');

const INTERVAL_MS = 60 * 1000;
let _timer = null;

async function publishDue(now) {
  const at = now || new Date();
  const r = await Chapter.updateMany(
    { status: 'scheduled', scheduledAt: { $lte: at } },
    { $set: { status: 'live' } }
  ).catch(() => ({ modifiedCount: 0 }));
  return { published: r.modifiedCount || 0, at };
}

function start() {
  if (_timer) return _timer;
  _timer = setInterval(() => {
    publishDue().catch(() => {});
  }, INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  return _timer;
}

module.exports = { start, publishDue, INTERVAL_MS };
