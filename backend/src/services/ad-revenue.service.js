'use strict';
/* services/ad-revenue.service.js — ad revenue ledger for the super-admin
   ad-earnings console (public/super-admin/ad-earnings.html →
   services/ad-revenue-service.js) and marketing analytics.
   Write path: POST /api/ads/track (ads.service.track) upserts one row per
     (date, storyId, adId, slot, page).
   Read path:  GET /api/super-admin/ad-revenue/{ledger,summary}, POST /pay,
               POST /network (import a network report).
   Money is booked only for campaign-bought creatives; story-owned slots
   (fullReader, scrollReader, story, comments) then split 70% platform /
   30% author, every other surface is 100% platform. House ads and network
   embeds count impressions/clicks but book $0 here — a network pays on its
   own report, which recordNetwork() spreads over the counted impressions. */
const { AdRevenueLedger, NetworkEarning } = require('../models/revenue.model');
const { Book } = require('../models/content.model');
const { User } = require('../models/user.model');
const { AdInventory } = require('../models/platform.model');
const { Campaign } = require('../models/marketing.model');
const pricing = require('./ad-pricing.service');

/* Rates now live in the AdRateCard singleton (Ad Manager → Ad pricing), so
   the console can price each currency without a deploy. The constants below
   are only the seed defaults, kept for the header note and the demo fallback. */
const DEFAULT_RATES = { impression: 0.005, click: 0.35 };
const PLATFORM_PCT = 0.70;
const AUTHOR_PCT = 0.30;
const STORY_SLOT_RE = /^(fullReader|scrollReader|story|comments)[:.]/;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
function dayStr(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* story → {storyTitle, authorId, authorName} (tiny TTL cache; the track
   endpoint is hot and every event would otherwise cost two lookups). */
const storyCache = new Map();
const STORY_CACHE_MS = 60000;
async function resolveStory(storyId) {
  const hit = storyCache.get(storyId);
  if (hit && hit.at > Date.now() - STORY_CACHE_MS) return hit.val;
  let book = null;
  try {
    const q = mongooseValid(storyId) ? [{ id: storyId }, { _id: storyId }] : [{ id: storyId }];
    book = await Book.findOne({ $or: q }).select('title authorId').lean();
  } catch (e) { book = null; }
  const val = book
    ? { storyTitle: book.title || '', authorId: book.authorId || '', authorName: '' }
    : { storyTitle: '', authorId: '', authorName: '' };
  if (val.authorId) {
    try {
      const u = await User.findOne({ $or: [{ id: val.authorId }, { _id: val.authorId }] })
        .select('fullName username penName').lean();
      if (u) val.authorName = u.fullName || u.penName || u.username || '';
    } catch (e) { /* author label stays blank */ }
  }
  storyCache.set(storyId, { at: Date.now(), val });
  if (storyCache.size > 500) storyCache.clear();
  return val;
}
function mongooseValid(id) {
  try { return require('mongoose').Types.ObjectId.isValid(id) && String(id).length === 24; }
  catch (e) { return false; }
}

/* ── write path (called from ads.service.track) ── */
async function record({ id, event, page, slot, storyId, ts, country }) {
  if (!id) return null;
  const card = await pricing.get();
  const owner = await adOwner(id);
  // Money only moves when a campaign bought the slot. House ads and network
  // tags still count impressions/clicks (surface traffic + pro-rata import),
  // but book $0 here: a network payout arrives later as a report import.
  const billed = !!owner.campaign;
  const network = owner.format === 'embed';
  const usd = card.prices.USD;
  const rev = billed && !network ? (event === 'click' ? usd.click : usd.impression) : 0;
  const sl = String(slot || '');
  const sid = String(storyId || '');
  const owned = !!sid && STORY_SLOT_RE.test(sl);
  const meta = owned ? await resolveStory(sid) : null;
  const date = dayStr(ts);
  const $inc = { revenue: rev };
  if (rev && owned) {
    $inc.platformShare = rev * PLATFORM_PCT;
    $inc.authorShare = rev * AUTHOR_PCT;   // author earns only from a bought slot
  } else if (rev) {
    $inc.platformShare = rev;
  }
  if (event === 'click') $inc.clicks = 1;
  else $inc.impressions = 1;
  const $set = { date, storyId: owned ? sid : '', adId: String(id), slot: sl, page: String(page || ''), network, billed };
  const ctry = /^[A-Za-z]{2}$/.test(String(country || '')) ? String(country).toUpperCase() : '';
  $set.country = ctry;
  if (meta) {
    $set.storyTitle = meta.storyTitle;
    $set.authorId = meta.authorId;
    $set.authorName = meta.authorName;
  }
  await AdRevenueLedger.updateOne(
    { date, storyId: $set.storyId, adId: $set.adId, slot: sl, page: $set.page, country: ctry },
    { $inc, $set },
    { upsert: true }
  );
  if (billed && !network) await billCampaign(id, event, card);
  return true;
}

/* Spend is accumulated on the campaign as events land — the same moment the
   ledger row is written, so the counter can never lag the report. The amount
   is the campaign's *own* currency leg, which is also the currency its budget
   is written in; comparison then needs no exchange rate. */
const adCache = new Map();
const AD_CACHE_MS = 60000;
async function adOwner(adId) {
  const hit = adCache.get(adId);
  if (hit && Date.now() - hit.at < AD_CACHE_MS) return hit.val;
  let val = { campaign: '', currency: '', format: '' };
  try {
    const a = await AdInventory.findOne({ id: String(adId) }).select('campaign format').lean();
    if (a) {
      val.format = String(a.format || '');
      if (a.campaign) {
        const c = await Campaign.findOne({ id: String(a.campaign) }).select('currency').lean();
        val = { campaign: String(a.campaign), currency: (c && c.currency) || '', format: val.format };
      }
    }
  } catch (e) { val = { campaign: '', currency: '', format: '' }; }
  adCache.set(adId, { at: Date.now(), val });
  if (adCache.size > 1000) adCache.clear();
  return val;
}
async function billCampaign(adId, event, card) {
  const owner = await adOwner(adId);
  if (!owner.campaign) return;                     // house ad: nothing is billed
  const cur = owner.currency || card.active;
  const row = card.prices[cur] || card.prices.USD;
  const amount = event === 'click' ? row.click : row.impression;
  if (!amount) return;
  try {
    await Campaign.updateOne({ id: owner.campaign }, { $inc: { spent: amount } });
  } catch (e) { /* a failed counter must not fail the impression */ }
}

/* ── network earnings (AdSense / Adsterra / Monetag) ──
   A network pays on its own report, never per impression, so there is no rate
   to look up at track time. Staff enter the period total here and it is spread
   across the impressions we *did* count for that ad in the window — story
   slots then pay their author the same 30% as a bought slot. Re-entering the
   same window replaces the earlier allocation instead of stacking on it.
   A blank country is the "Others" bucket: it spreads over every tracked
   country a per-country import did not already claim. */
const NETWORK_EVENT_SLOT = 'network:report';

function splitCents(totalUsd, weights) {
  const cents = Math.round(totalUsd * 100);
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  let left = cents;
  const out = weights.map((w, i) => {
    const c = i === weights.length - 1 ? left : Math.round(cents * (w / sum));
    left -= c;
    return c / 100;
  });
  return out;
}

/* Spread one import over the rows it owns; returns how many rows it paid. */
async function applyNetwork(doc) {
  const adId = String(doc.adId || '');
  const from = String(doc.from);
  const to = String(doc.to);
  const ctry = String(doc.country || '');
  const importId = String(doc.id);
  const totalUsd = num(doc.amountUsd, 0);

  await AdRevenueLedger.updateMany(
    { networkEarningId: importId },
    { $set: { revenue: 0, platformShare: 0, authorShare: 0, networkEarningId: '' } }
  );

  const q = { network: true, date: { $gte: from, $lte: to } };
  if (adId) q.adId = adId;
  let rows = await AdRevenueLedger.find(q).lean();

  if (ctry) {
    rows = rows.filter((r) => (r.country || '') === ctry);
  } else {
    const covered = new Set(
      (await NetworkEarning.find({ adId, from, to }).lean())
        .filter((n) => n.country)
        .map((n) => n.country)
    );
    rows = rows.filter((r) => !covered.has(r.country || ''));
  }

  if (!rows.length) {
    // Nothing tracked left in the window (network tag on a page we don't count,
    // or the window predates tracking). Book the report whole to the platform
    // so gross revenue stays truthful, and label the row as unallocated.
    await AdRevenueLedger.updateOne(
      { date: to, storyId: '', adId: adId || 'network', slot: NETWORK_EVENT_SLOT, page: '', country: ctry },
      {
        $inc: { revenue: totalUsd, platformShare: totalUsd },
        $set: { network: true, networkEarningId: importId },
      },
      { upsert: true }
    );
    return 0;
  }

  const weights = rows.map((r) => Math.max(num(r.impressions, 0), 0));
  if (!weights.some((w) => w > 0)) weights.forEach((w, i) => { weights[i] = 1; });
  const parts = splitCents(totalUsd, weights);
  await AdRevenueLedger.bulkWrite(rows.map((r, i) => {
    const cut = parts[i];
    const owned = !!r.storyId && STORY_SLOT_RE.test(String(r.slot || ''));
    const author = owned ? round2(cut * AUTHOR_PCT) : 0;
    return {
      updateOne: {
        filter: { _id: r._id },
        update: {
          $set: {
            revenue: cut,
            platformShare: round2(cut - author),
            authorShare: author,
            networkEarningId: importId,
          },
        },
      },
    };
  }));
  return rows.length;
}

async function recordNetwork({ adId, network, country, from, to, amount, currency, fxRate, note, by }) {
  const total = Number(amount);
  if (!(total > 0)) { const e = new Error('amount_required'); e.status = 400; throw e; }
  if (!from || !to || String(from) > String(to)) { const e = new Error('bad_window'); e.status = 400; throw e; }
  const cur = String(currency || 'USD').toUpperCase();
  const rate = cur === 'USD' ? 1 : Number(fxRate);
  if (!(rate > 0)) { const e = new Error('fx_rate_required'); e.status = 400; throw e; }
  const totalUsd = round2(total * rate);
  const id = String(adId || '');
  const ctry = /^[A-Za-z]{2}$/.test(String(country || '')) ? String(country).toUpperCase() : '';
  const scope = { adId: id, from: String(from), to: String(to), country: ctry };

  const prev = await NetworkEarning.findOne(scope).lean();
  const importId = prev && prev.id ? String(prev.id) : 'nw_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const doc = {
    id: importId, adId: id, network: String(network || ''), country: ctry,
    from: String(from), to: String(to),
    amount: total, currency: cur, fxRate: rate, amountUsd: totalUsd,
    allocated: 0, note: String(note || ''), enteredBy: String(by || ''),
  };
  if (prev) await NetworkEarning.updateOne(scope, { $set: doc });
  else await NetworkEarning.create(doc);

  doc.allocated = await applyNetwork(doc);
  await NetworkEarning.updateOne({ id: importId }, { $set: { allocated: doc.allocated } });

  if (ctry) {
    // The country import shrinks the Others pool, so re-spread Others over the
    // rows still unclaimed instead of leaving its money on a row it no longer owns.
    const rest = await NetworkEarning.findOne({ adId: id, from: doc.from, to: doc.to, country: '' }).lean();
    if (rest) {
      const n = await applyNetwork(rest);
      await NetworkEarning.updateOne({ id: rest.id }, { $set: { allocated: n } });
    }
  }
  return doc;
}

async function networkImports({ limit } = {}) {
  const lim = Math.min(Math.max(num(limit, 50) || 50, 1), 200);
  const rows = await NetworkEarning.find({}).sort({ to: -1 }).limit(lim).lean();
  return { rows, total: await NetworkEarning.countDocuments({}) };
}

/* window filter: ?days=N (last N days incl. today) or explicit from/to */
function window(days, from, to) {
  const q = {};
  if (from || to) {
    if (from) q.date = Object.assign(q.date || {}, { $gte: String(from) });
    if (to) q.date = Object.assign(q.date || {}, { $lte: String(to) });
    return q;
  }
  const n = Math.min(Math.max(num(days, 30) || 30, 1), 730);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  return { date: { $gte: dayStr(d.getTime()) } };
}

function toRow(r) {
  const o = r.toJSON ? r.toJSON() : r;
  return {
    id: o.id || o._id, date: o.date,
    storyId: o.storyId || '', storyTitle: o.storyTitle || '',
    authorId: o.authorId || '', authorName: o.authorName || '',
    adId: o.adId || '', slot: o.slot || '', page: o.page || '', country: o.country || '',
    impressions: num(o.impressions, 0), clicks: num(o.clicks, 0),
    revenue: num(o.revenue, 0), platformShare: num(o.platformShare, 0),
    authorShare: num(o.authorShare, 0),
    network: !!o.network, billed: !!o.billed,
    paidAt: o.paidAt || null, paid: !!o.paidAt,
  };
}

/* GET /ad-revenue/ledger → {rows, total} (FE reads r.rows) */
async function ledger({ days, from, to, page, limit }) {
  const q = window(days, from, to);
  const lim = Math.min(Math.max(num(limit, 500) || 500, 1), 2000);
  const pg = Math.max(num(page, 1) || 1, 1);
  const [rows, total] = await Promise.all([
    AdRevenueLedger.find(q).sort({ date: -1, revenue: -1 })
      .skip((pg - 1) * lim).limit(lim).lean(),
    AdRevenueLedger.countDocuments(q),
  ]);
  return { rows: rows.map(toRow), total, page: pg, limit: lim };
}

/* group rows exactly like the frontend groupBy (label, metrics, story/author) */
function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (!k) return;
    let g = map.get(k);
    if (!g) {
      g = {
        key: k, label: k, impressions: 0, clicks: 0, revenue: 0,
        platformShare: 0, authorShare: 0,
        paidRevenue: 0, networkRevenue: 0, paidImpressions: 0, networkImpressions: 0,
        storyId: '', storyTitle: '', authorId: '', authorName: '',
      };
      map.set(k, g);
    }
    g.impressions += r.impressions;
    g.clicks += r.clicks;
    g.revenue = round2(g.revenue + r.revenue);
    g.platformShare = round2(g.platformShare + r.platformShare);
    g.authorShare = round2(g.authorShare + r.authorShare);
    if (r.network) {
      g.networkRevenue = round2(g.networkRevenue + r.revenue);
      g.networkImpressions += r.impressions;
    } else if (r.billed || r.revenue > 0) {
      // legacy rows predate the billed flag; rate-card revenue was paid inventory
      g.paidRevenue = round2(g.paidRevenue + r.revenue);
      g.paidImpressions += r.impressions;
    }
    if (r.storyId) { g.storyId = r.storyId; g.storyTitle = r.storyTitle; }
    if (r.authorId) { g.authorId = r.authorId; g.authorName = r.authorName; }
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

/* GET /ad-revenue/summary → {totals, bySurface, byStory, byAuthor, days} */
async function summary({ days }) {
  const n = Math.min(Math.max(num(days, 30) || 30, 1), 730);
  const rows = (await AdRevenueLedger.find(window(n)).lean()).map(toRow);
  const totals = {
    impressions: 0, clicks: 0, revenue: 0, platformShare: 0,
    authorShare: 0, authorShareUnpaid: 0,
  };
  rows.forEach((r) => {
    totals.impressions += r.impressions;
    totals.clicks += r.clicks;
    totals.revenue = round2(totals.revenue + r.revenue);
    totals.platformShare = round2(totals.platformShare + r.platformShare);
    totals.authorShare = round2(totals.authorShare + r.authorShare);
    if (!r.paid) totals.authorShareUnpaid = round2(totals.authorShareUnpaid + r.authorShare);
  });
  const byStory = groupBy(rows, (r) => r.storyId || '').filter((g) => !!g.storyId);
  const bySurface = groupBy(rows, (r) => (r.storyId ? 'story:' + ((r.slot.split(':')[0]) || r.slot) : (r.page || r.slot || 'other')));
  const byCountry = groupBy(rows, (r) => r.country || 'unknown')
    .sort((a, b) => b.revenue - a.revenue);
  const byAuthor = groupBy(rows, (r) => r.authorId || '')
    .filter((g) => !!g.authorId)
    .map((g) => {
      const mine = rows.filter((r) => r.authorId === g.authorId);
      g.paid = mine.every((r) => r.paid);
      g.unpaid = g.paid ? 0 : g.authorShare;
      return g;
    });
  const byStoryCountry = {};
  byStory.forEach((g) => {
    byStoryCountry[g.storyId] = groupBy(
      rows.filter((r) => r.storyId === g.storyId),
      (r) => r.country || 'unknown'
    );
  });
  return { totals, bySurface, byStory, byAuthor, byCountry, byStoryCountry, days: n };
}

/* POST /ad-revenue/pay {authorId} → {ok, modified} */
async function pay({ authorId, by }) {
  if (!authorId) { const e = new Error('author_required'); e.status = 400; throw e; }
  const r = await AdRevenueLedger.updateMany(
    { authorId: String(authorId), paidAt: null },
    { $set: { paidAt: new Date() } }
  );
  return { ok: true, modified: r.modifiedCount || 0, by: by || null };
}

module.exports = { record, ledger, summary, pay, recordNetwork, networkImports, RATES: DEFAULT_RATES, STORY_SLOT_RE };
