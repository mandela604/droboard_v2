'use strict';
/* Ad-surface parity smoke — no Mongo, no running server.
   Stubs the platform models + console middleware and drives the REAL
   ads.service and the REAL zod schemas registered on marketing.routes, so it
   proves the three things the marketing console depends on when it goes live:

     1. the bulk placement PUT accepts the whole ad-manager patch (spotlight
        schedule + paidUnlockAds) instead of 400ing the entire save;
     2. an unknown page/slot id is refused loudly (it can never render);
     3. per-format creative fields survive the write and read back intact.

   Run: node scripts/smoke-ad-surfaces.cjs */
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/droboard_smoke';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'smoke-access';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'smoke-refresh';
process.env.MFA_SECRET_KEY = process.env.MFA_SECRET_KEY || 'smoke-mfa';

/* ---------- in-memory stand-ins for the mongoose models ---------- */
const store = { ads: [], placements: [], campaigns: [] };

function dotSet(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const AdPlacement = {
  findOne(q) {
    const row = store.placements.find(r => r.page === (q && q.page));
    return { lean: () => Promise.resolve(row ? JSON.parse(JSON.stringify(row)) : null) };
  },
  find() {
    return { lean: () => Promise.resolve(JSON.parse(JSON.stringify(store.placements))) };
  },
  findOneAndUpdate(q, update) {
    let row = store.placements.find(r => r.page === q.page);
    if (!row) {
      row = Object.assign({ enabled: true, slots: {}, cfg: {}, cycle: [], format: 'auto' }, update.$setOnInsert || {});
      store.placements.push(row);
    }
    Object.keys(update.$set || {}).forEach(k => dotSet(row, k, update.$set[k]));
    return { lean: () => Promise.resolve(JSON.parse(JSON.stringify(row))) };
  },
};

const AdInventory = {
  async create(doc) {
    const row = Object.assign({ id: 'ad_smoke_1', toJSON: () => row }, doc);
    store.ads.push(row);
    return row;
  },
  findOne(q) {
    const row = store.ads.find(r => r.id === q.id);
    if (!row) return null;
    return Object.assign(row, {
      save: async () => row,
      deleteOne: async () => {},
    });
  },
  find() {
    const chain = {
      lean: () => Promise.resolve(store.ads.map(r => JSON.parse(JSON.stringify({ ...r, toJSON: undefined })))),
      sort: () => chain,
      limit: () => chain,
    };
    return chain;
  },
};

const AdStat = {
  findOneAndUpdate: async () => ({}),
  find: () => ({ lean: () => Promise.resolve([]) }),
};

const Campaign = {
  findOne(q) {
    const row = store.campaigns.find(r => r.id === q.id);
    return { lean: () => Promise.resolve(row || null) };
  },
};

function stub(id, exports) {
  const p = require.resolve(id);
  require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
}

stub('../src/models/platform.model', { AdInventory, AdPlacement, AdStat, User: {}, Story: {} });
stub('../src/models/marketing.model', { Campaign, LeagueConfig: {}, LeagueActivity: {} });
stub('../src/middleware/auth', { requireAuth: (q, r, n) => n(), optionalAuth: (q, r, n) => n() });
stub('../src/middleware/guards', { requireRole: () => (q, r, n) => n() });
stub('../src/services/audience.service', { catalog: async () => ({}) });
stub('../src/services/marketing-surfaces.service', {});
stub('../src/controllers/base.controller', {
  wrap: (res, fn) => fn()
    .then(d => res.json({ ok: true, data: d }))
    .catch(e => res.status(e.status || 500).json({ ok: false, error: e.message })),
});

const httpReal = require('../src/middleware/http');
stub('../src/middleware/http', Object.assign({}, httpReal, { audit: () => (q, r, n) => n() }));

/* ---------- assertions ---------- */
const ads = require('../src/services/ads.service');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  <- ' + detail : '')); }
}
async function throws400(name, fn, msgPart) {
  try {
    await fn();
    ok(name, false, 'did not throw');
  } catch (e) {
    ok(name, e.status === 400 && (!msgPart || String(e.message).includes(msgPart)), e.status + ' ' + e.message);
  }
}

async function main() {
  console.log('\n== placement write (the bulk ad-manager PUT) ==');
  const patch = {
    fullReader: { enabled: true, wordsPerSlot: 300, paidUnlockAds: false, slots: {
      'fullReader:top': { enabled: true, formats: ['book'], adIds: [] },
      'fullReader:per-300-words': { enabled: true, formats: ['book'], adIds: [] },
      'fullReader:bottom': { enabled: false, formats: ['book'], adIds: [] },
    } },
    spotlight: { enabled: true, seconds: 5, everyN: 3, allowSkip: true, adId: 'spot_1', delaySeconds: 20, cooldownHours: 6, startHour: 6, endHour: 24, days: [1, 2, 3], audienceMode: 'all', match: 100, segments: [] },
    discover: { enabled: true, slots: { 'discover:spotlight': false } },
  };
  for (const page of Object.keys(patch)) {
    const out = await ads.savePlacement({ page, patch: patch[page] });
    ok('save ' + page, out && out.page === page, JSON.stringify(out).slice(0, 120));
  }
  const map = await ads.placements();
  ok('paidUnlockAds round-trips', map.fullReader.paidUnlockAds === false, String(map.fullReader.paidUnlockAds));
  ok('wordsPerSlot round-trips', map.fullReader.wordsPerSlot === 300, String(map.fullReader.wordsPerSlot));
  ok('slot kill switch read as object', map.fullReader.slots['fullReader:bottom'].enabled === false, JSON.stringify(map.fullReader.slots));
  ok('spotlight schedule persisted in cfg', map.spotlight.seconds === 5 && map.spotlight.allowSkip === true, JSON.stringify(map.spotlight));
  ok('cfg cannot shadow the kill switch', map.spotlight.enabled === true && map.discover.enabled === true);

  console.log('\n== unknown ids are refused ==');
  await throws400('placement page typo', () => ads.savePlacement({ page: 'genreHubb', patch: { enabled: true } }), 'unknown_page');
  await throws400('placement slot typo', () => ads.savePlacement({ page: 'genreHub', patch: { slots: { 'genreHub:strp': true } } }), 'unknown_slot');
  await throws400('ad page typo', () => ads.createAd({ format: 'banner', pages: ['genre-stories'] }), 'unknown_page');
  await throws400('ad slot typo', () => ads.createAd({ format: 'banner', slots: ['genreHub:top'] }), 'unknown_slot');
  await throws400('slot from another page', () => ads.createAd({ format: 'native', slots: ['feed:banner'] }), 'unknown_slot');

  console.log('\n== bookReader is a real surface (ad-manager has a card for it) ==');
  const br = await ads.savePlacement({ page: 'bookReader', patch: { enabled: true, slots: { 'bookReader:top': { enabled: true } } } });
  ok('save bookReader', br.enabled === true, JSON.stringify(br));

  console.log('\n== creative fields survive the write ==');
  const created = await ads.createAd({
    format: 'spotlight', kind: 'story', brand: 'NovaPay', heading: 'Sponsored',
    pages: ['discover'], slots: ['discover:spotlight'],
    img: 'https://cdn/x.jpg', cover: 'https://cdn/c.jpg', author: 'A. Writer', authorAvatar: 'https://cdn/a.jpg',
    rating: '4.6', chapters: '32', reads: '12k', preview: 'A line', isBook: true, reads2: 12000,
  });
  ['img', 'cover', 'author', 'authorAvatar', 'rating', 'chapters', 'reads', 'preview'].forEach(k =>
    ok('persist ' + k, created[k] !== undefined && created[k] !== '', JSON.stringify(created[k])));
  ok('persist isBook (boolean)', created.isBook === true, String(created.isBook));
  ok('persist number', created.reads2 === 12000, String(created.reads2));
  ok('targeting kept', created.pages[0] === 'discover' && created.slots[0] === 'discover:spotlight');

  const updated = await ads.updateAd({ id: 'ad_smoke_1', data: { headline: 'New headline', active: true } });
  ok('update keeps creative + adds field', updated.headline === 'New headline' && updated.img === 'https://cdn/x.jpg',
    'headline=' + JSON.stringify(updated.headline) + ' img=' + JSON.stringify(updated.img));

  console.log('\n== serving honours the checkboxes ==');
  const count = res => Object.keys(res.pools).reduce((n, k) => n + res.pools[k].length, 0);
  store.ads.length = 0;
  await ads.createAd({ format: 'banner', brand: 'On', pages: ['genreHub'], slots: ['genreHub:strip'], active: true });
  await ads.savePlacement({ page: 'genreHub', patch: { enabled: true, slots: { 'genreHub:strip': { enabled: true } } } });
  const onAds = await ads.inventory('genreHub', 'genreHub:strip');
  ok('serves when slot enabled', count(onAds) === 1, JSON.stringify(onAds.pools).slice(0, 160));
  await ads.savePlacement({ page: 'genreHub', patch: { slots: { 'genreHub:strip': false } } });
  const offAds = await ads.inventory('genreHub', 'genreHub:strip');
  ok('empty when slot killed', count(offAds) === 0, JSON.stringify(offAds.pools).slice(0, 160));
  await ads.savePlacement({ page: 'genreHub', patch: { slots: { 'genreHub:strip': true } } });
  await ads.savePlacement({ page: 'genreHub', patch: { enabled: false } });
  const killed = await ads.inventory('genreHub', 'genreHub:strip');
  ok('empty when page killed', count(killed) === 0, JSON.stringify(killed.pools).slice(0, 160));
  await ads.savePlacement({ page: 'genreHub', patch: { enabled: true } });
  await ads.savePlacement({ page: 'genreHub', patch: { slots: { 'genreHub:strip': { enabled: true, formats: ['native'] } } } });
  const wrongFormat = await ads.inventory('genreHub', 'genreHub:strip');
  ok('empty when slot restricted to another format', count(wrongFormat) === 0, JSON.stringify(wrongFormat.pools).slice(0, 160));

  console.log('\n== the campaign constrains the creative ==');
  store.campaigns.push({ id: 'CMP_DRAFT', name: 'Wolf King Push', status: 'draft', budget: 40000, spent: 0,
    placements: ['genreHub'], slots: ['genreHub:strip'], startDate: '2026-11-01', endDate: '2026-11-30' });
  store.campaigns.push({ id: 'CMP_LIVE', name: 'Nova Pay', status: 'live',
    placements: ['blog'], slots: ['blog:top'], startDate: '2026-10-01', endDate: '2026-12-31' });

  const draftAd = await ads.createAd({ format: 'banner', brand: 'X', campaign: 'CMP_DRAFT',
    pages: ['genreHub'], slots: ['genreHub:strip'], active: true, startDate: '2026-11-05', endDate: '2026-11-20' });
  ok('ad on a draft campaign saves paused', draftAd.active === false && draftAd.autoPaused === true,
    'active=' + draftAd.active + ' autoPaused=' + draftAd.autoPaused);

  const liveAd = await ads.createAd({ format: 'minibanner', brand: 'Y', campaign: 'CMP_LIVE',
    pages: ['blog'], slots: ['blog:top'], active: true, startDate: '2026-10-20', endDate: '2026-11-30' });
  ok('ad on a live campaign stays live', liveAd.active === true, String(liveAd.active));

  await throws400('slot the campaign did not buy', () => ads.createAd({
    format: 'banner', campaign: 'CMP_LIVE', pages: ['blog'], slots: ['blog:bottom'], active: true,
  }), 'slot_not_in_campaign');
  await throws400('leg after the campaign window', () => ads.createAd({
    format: 'banner', campaign: 'CMP_DRAFT', pages: ['genreHub'], slots: ['genreHub:strip'], endDate: '2026-12-31',
  }), 'after_campaign_window');
  await throws400('leg before the campaign window', () => ads.createAd({
    format: 'banner', campaign: 'CMP_DRAFT', pages: ['genreHub'], slots: ['genreHub:strip'], startDate: '2026-09-01',
  }), 'before_campaign_window');
  await throws400('unknown campaign id', () => ads.createAd({
    format: 'banner', campaign: 'CMP_NOPE', pages: ['blog'], active: true,
  }), 'unknown_campaign');

  const house = await ads.createAd({ format: 'banner', brand: 'House', pages: ['blog'], slots: ['blog:top'], active: true });
  ok('no campaign = house ad, serves', house.active === true && !house.autoPaused, JSON.stringify({ a: house.active, p: house.autoPaused }));

  console.log('\n== HTTP layer: the console PUT ==');
  const express = require('express');
  const marketing = require('../src/routes/marketing.routes');
  const adsRoutes = require('../src/routes/ads.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/marketing', marketing);
  app.use('/api/ads', adsRoutes);
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base2 = 'http://127.0.0.1:' + server.address().port;
  const body = {
    blog: { enabled: true, slots: { 'blog:top': { enabled: true, formats: ['minibanner'], adIds: [] }, 'blog:bottom': false } },
    spotlight: { enabled: true, seconds: 8 },
  };
  const putRes = await fetch(base2 + '/api/marketing/ads/placements', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const putJson = await putRes.json();
  ok('PUT /api/marketing/ads/placements -> 200', putRes.status === 200, putRes.status + ' ' + JSON.stringify(putJson).slice(0, 200));
  ok('response carries blog + spotlight', !!(putJson.data || putJson).blog && !!(putJson.data || putJson).spotlight, JSON.stringify(putJson).slice(0, 200));

  const badRes = await fetch(base2 + '/api/marketing/ads/placements', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bogus: { enabled: true } }),
  });
  const badBody = await badRes.json().catch(() => ({}));
  ok('unknown page over HTTP -> 400', badRes.status === 400, badRes.status + ' ' + JSON.stringify(badBody).slice(0, 160));

  const adRes = await fetch(base2 + '/api/marketing/ads', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format: 'minibanner', brand: 'X', img: 'u', sponsor: 'Y', tagline: 'Z', pages: ['blog'], slots: ['blog:top'] }),
  });
  const adJson = await adRes.json();
  ok('POST /api/marketing/ads -> 201 with creative', adRes.status === 201 && (adJson.data || adJson).img === 'u', adRes.status + ' ' + JSON.stringify(adJson).slice(0, 200));

  const sRes = await fetch(base2 + '/api/ads/surfaces');
  const sJson = await sRes.json();
  const surf = sJson.data || sJson;
  ok('GET /api/ads/surfaces -> 200 with pages + slots', sRes.status === 200 && surf.pages.length > 20 && !!surf.pageSlots.blog,
    sRes.status + ' pages=' + (surf.pages || []).length);

  server.close();

  console.log('\npassed ' + pass + ' / failed ' + fail + '\n');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('smoke crashed:', e); process.exit(1); });
