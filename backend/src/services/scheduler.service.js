'use strict';
// BATCH 3: scheduled publisher. Flips due `scheduled` chapters to `live`
// every minute. No dependency — plain interval, unref'd so tests exit cleanly.
const { Chapter, Book } = require('../models/content.model');

const INTERVAL_MS = 60 * 1000;
const BILL_INTERVAL_MS = 60 * 60 * 1000;
const FX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LEAGUE_INTERVAL_MS = 60 * 60 * 1000;
let _timer = null;
let _lastBillRun = 0;
let _lastFxRun = 0;
let _lastLeagueRun = 0;

// A scheduled chapter only goes live with its book: scheduling must never be
// a way around review, so a manuscript still in draft/under_review stays put.
async function publishDue(now) {
  const at = now || new Date();
  const due = await Chapter.find({ status: 'scheduled', scheduledAt: { $lte: at } })
    .select('bookId').lean().catch(() => []);
  if (!due.length) return { published: 0, at };
  const ids = [...new Set(due.map(c => String(c.bookId)))];
  const live = await Book.find({ id: { $in: ids }, status: { $in: ['ongoing', 'published', 'completed'] } })
    .select('id').lean().catch(() => []);
  if (!live.length) return { published: 0, at };
  const r = await Chapter.updateMany(
    { status: 'scheduled', scheduledAt: { $lte: at }, bookId: { $in: live.map(b => b.id) } },
    { $set: { status: 'live' } }
  ).catch(() => ({ modifiedCount: 0 }));
  return { published: r.modifiedCount || 0, at };
}

// Fixed-monthly editor pay: mints one bill per editor per period once the
// configured payout day is reached. Idempotent (unique editor+period row), so
// an hourly retry is safe and a restart cannot double-pay.
async function editorFixedBills() {
  return require('./editor-earnings.service').runMonthlyIfDue().catch(() => null);
}

// Live FX for non-NGN purchases. Refreshes only when the stored map is
// missing or older than the feed's interval; a failed fetch is not fatal —
// the previous map stays and wallet falls back to the pack's naira leg.
async function refreshFx({ force } = {}) {
  const svc = require('./fx.service');
  if (!force) {
    const cur = await svc.rates().catch(() => null);
    const at = cur && cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
    if (at && Date.now() - at < svc.REFRESH_MS) return null;
  }
  return svc.refresh().catch(() => null);
}

// Reader league prizes settle once the week is over. Hourly rather than a
// Monday-only cron: the write is one badge per reader per season with
// $setOnInsert, so a retry after downtime costs nothing and cannot double-award.
async function leagueRollover() {
  return require('./marketing-surfaces.service').awardLeagueBadges().catch(() => null);
}

function start() {
  if (_timer) return _timer;
  refreshFx().catch(() => {}); // seed on boot when stale/missing
  leagueRollover().catch(() => {}); // settle the week that just ended
  _timer = setInterval(() => {
    publishDue().catch(() => {});
    const now = Date.now();
    if (now - _lastBillRun >= BILL_INTERVAL_MS) {
      _lastBillRun = now;
      editorFixedBills().catch(() => {});
    }
    if (now - _lastFxRun >= FX_INTERVAL_MS) {
      _lastFxRun = now;
      refreshFx().catch(() => {});
    }
    if (now - _lastLeagueRun >= LEAGUE_INTERVAL_MS) {
      _lastLeagueRun = now;
      leagueRollover().catch(() => {});
    }
  }, INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  return _timer;
}

module.exports = { start, publishDue, editorFixedBills, refreshFx, leagueRollover, INTERVAL_MS, FX_INTERVAL_MS, LEAGUE_INTERVAL_MS };
