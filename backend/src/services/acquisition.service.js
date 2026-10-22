'use strict';
/* services/acquisition.service.js — paid-acquisition attribution + campaign P&L
 * for public/services/acquisition-service.js (loaded by marketing/acquisition.html
 * and every reader landing page; USE_API=false today, so demo cohorts stay put).
 *
 * Math is a port of the frontend getSummary() so live and demo dashboards agree:
 *   contribution = coinRevenue × (1 − writerShare 0.40) × (1 − paymentFee 0.014)
 *                  + impressions × adECPM 0.005 − spend
 *   d7Retention  = D7-returned / cohort eligible for D7 (firstDate ≤ today − 7d)
 * Cohorts come from AcquisitionEvent rows (one per visitor touch); spend from
 * AcquisitionSpend rows; campaign labels/story come from the marketing campaign
 * library so server-side rows are never blank ids. */
const { AcquisitionEvent, AcquisitionSpend } = require('../models/acquisition.model');
const { Campaign } = require('../models/marketing.model');

const CONFIG = { writerShare: 0.40, paymentFee: 0.014, adECPM: 0.005 };

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
function dayStr(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ── POST /api/acquisition/events ── */
async function captureEvent(body) {
  const visitorId = String(body.visitorId || '').trim() || 'anon';
  const campaignId = String(body.campaignId || 'direct').trim() || 'direct';
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
  const doc = {
    visitorId, campaignId,
    type: body.type || 'landing',
    storyId: String(body.storyId || meta.storyId || ''),
    amount: num(body.amount),
    coins: num(body.coins),
    pages: num(body.pages),
    impressions: num(body.impressions),
    ts: body.ts ? new Date(body.ts) : new Date(),
    date: body.date || dayStr(Date.now()),
    meta,
  };
  if (!AcquisitionEvent.schema.path('type').enumValues.includes(doc.type)) doc.type = 'landing';
  await AcquisitionEvent.create(doc);
  return { ok: true };
}

/* ── GET/POST /api/acquisition/spend ── */
async function spendList({ days } = {}) {
  const q = {};
  if (days) {
    const n = Math.min(Math.max(num(days) || 30, 1), 730);
    q.date = { $gte: dayStr(Date.now() - (n - 1) * 864e5) };
  }
  const rows = await AcquisitionSpend.find(q).sort({ date: -1, createdAt: -1 }).limit(1000).lean().catch(() => []);
  return rows.map((r) => ({
    id: r.id || String(r._id), date: r.date, campaignId: r.campaignId,
    amount: round2(r.amount), note: r.note || '',
  }));
}
async function spendAdd(body) {
  if (!body.campaignId) { const e = new Error('campaign_required'); e.status = 400; throw e; }
  const row = await AcquisitionSpend.create({
    date: body.date || dayStr(Date.now()),
    campaignId: String(body.campaignId),
    amount: round2(body.amount),
    note: String(body.note || ''),
  });
  return { ok: true, id: row.id || String(row._id) };
}

/* ── GET /api/acquisition/summary?days=N ── */
async function summary({ days } = {}) {
  const n = Math.min(Math.max(num(days) || 30, 1), 730);
  const cut = dayStr(Date.now() - (n - 1) * 864e5);
  const d7Cut = dayStr(Date.now() - 7 * 864e5);

  const [events, spends, camps] = await Promise.all([
    AcquisitionEvent.find({ date: { $gte: cut } }).sort({ ts: 1 }).lean().catch(() => []),
    AcquisitionSpend.find({ date: { $gte: cut } }).lean().catch(() => []),
    Campaign.find({}).sort({ updatedAt: -1 }).limit(300).lean().catch(() => []),
  ]);

  // cohorts: one per (visitor, campaign), exactly the console's fields
  const cmap = new Map();
  events.forEach((e) => {
    const key = String(e.visitorId) + '|' + String(e.campaignId);
    const ts = (e.ts instanceof Date ? e.ts.getTime() : Date.parse(e.ts)) || Date.now();
    let c = cmap.get(key);
    if (!c) {
      c = {
        campaignId: String(e.campaignId),
        firstDate: e.date || dayStr(ts), firstTs: ts,
        registered: false, firstRead: false, meaningfulRead: false,
        pages: 0, impressions: 0, purchase: 0, d7: false,
      };
      cmap.set(key, c);
    }
    if (e.date && (!c.firstDate || e.date < c.firstDate)) { c.firstDate = e.date; c.firstTs = ts; }
    if (e.type === 'sign_up') c.registered = true;
    if (e.type === 'story_open' || e.type === 'chapter_read') c.firstRead = true;
    if (e.type === 'chapter_read') c.meaningfulRead = true;
    c.pages += num(e.pages);
    c.impressions += num(e.impressions);
    c.purchase = round2(c.purchase + num(e.amount));
    if (ts - c.firstTs >= 7 * 864e5) c.d7 = true;
  });
  const cohorts = Array.from(cmap.values());

  const byId = (id) => spends.filter((s) => String(s.campaignId) === id);
  const campById = new Map(camps.map((c) => [String(c.id), c]));
  const ids = new Set();
  cohorts.forEach((c) => ids.add(c.campaignId));
  spends.forEach((s) => ids.add(String(s.campaignId)));
  camps.forEach((c) => ids.add(String(c.id)));

  const out = { days: n, campaigns: [], totals: null };
  const t = {
    spend: 0, visitors: 0, registrations: 0, firstReaders: 0, meaningful: 0,
    pages: 0, impressions: 0, coinRevenue: 0, adEarnings: 0,
    d7Returned: 0, d7Cohort: 0, contribution: 0,
  };

  ids.forEach((id) => {
    const vs = cohorts.filter((c) => c.campaignId === id);
    const camp = campById.get(id);
    const spend = round2(byId(id).reduce((a, s) => a + num(s.amount), 0) || (camp ? num(camp.spent) : 0));
    const regs = vs.filter((c) => c.registered).length;
    const reads = vs.filter((c) => c.firstRead).length;
    const means = vs.filter((c) => c.meaningfulRead).length;
    const pages = vs.reduce((a, c) => a + c.pages, 0);
    const imps = vs.reduce((a, c) => a + c.impressions, 0) || (camp ? num(camp.impressions) : 0);
    const coins = round2(vs.reduce((a, c) => a + c.purchase, 0));
    const adEst = round2(imps * CONFIG.adECPM);
    const netCoins = round2(coins * (1 - CONFIG.writerShare) * (1 - CONFIG.paymentFee));
    const contribution = round2(netCoins + adEst - spend);
    const d7Pool = vs.filter((c) => c.firstDate && c.firstDate <= d7Cut);
    const d7Ret = d7Pool.filter((c) => c.d7).length;

    out.campaigns.push({
      campaignId: id,
      label: (camp && camp.name) || id,
      destination: camp ? (camp.storyId ? 'story' : 'home') : 'other',
      storyId: (camp && camp.storyId) || (vs[0] && vs[0].storyId) || '',
      spend,
      visitors: vs.length,
      registrations: regs,
      firstReaders: reads,
      meaningfulReaders: means,
      costPerRegistration: regs ? round2(spend / regs) : null,
      costPerReader: reads ? round2(spend / reads) : null,
      avgPages: vs.length ? Math.round((pages / vs.length) * 10) / 10 : 0,
      impressions: imps,
      adEarnings: adEst,
      coinRevenue: coins,
      coinNet: netCoins,
      d7Retention: d7Pool.length ? pct(d7Ret, d7Pool.length) : null,
      contribution,
      winner: contribution > 0,
    });

    t.spend += spend; t.visitors += vs.length; t.registrations += regs;
    t.firstReaders += reads; t.meaningful += means; t.pages += pages;
    t.impressions += imps; t.coinRevenue += coins; t.adEarnings += adEst;
    t.d7Returned += d7Ret; t.d7Cohort += d7Pool.length; t.contribution += contribution;
  });

  out.campaigns.sort((a, b) => b.contribution - a.contribution);
  t.spend = round2(t.spend); t.coinRevenue = round2(t.coinRevenue);
  t.adEarnings = round2(t.adEarnings); t.contribution = round2(t.contribution);
  t.costPerReader = t.firstReaders ? round2(t.spend / t.firstReaders) : null;
  t.costPerRegistration = t.registrations ? round2(t.spend / t.registrations) : null;
  t.d7Retention = t.d7Cohort ? pct(t.d7Returned, t.d7Cohort) : null;
  t.avgPages = t.visitors ? Math.round((t.pages / t.visitors) * 10) / 10 : 0;
  out.totals = t;
  return out;
}

module.exports = { captureEvent, spendList, spendAdd, summary };
