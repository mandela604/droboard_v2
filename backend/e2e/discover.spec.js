'use strict';
/* Discover page, front-to-back.
   Drives the real reader page in Chromium while the app's own static server
   (Live Server, :5502) proxies /api to the seeded in-memory backend
   (npm run dev:memory with PORT=4000). Nothing is mocked: every assertion
   compares what the page painted against what GET /api/discover returned
   in the same breath, so a row that quietly falls back to demo data fails.

     npx playwright test e2e/discover.spec.js

   Requirements (it says so plainly if they are missing):
     - backend on :4000 (PORT=4000 npm run dev:memory)
     - static server on :5502 serving the repo root
     - the discover module's USE_API gate flipped on
*/
const { test, expect } = require('@playwright/test');

const STATIC = 'http://127.0.0.1:5502';
const API = `${STATIC}/api`;
const PAGE = `${STATIC}/public/Pages/discover.html`;
const LOGIN = `${STATIC}/public/Pages/login.html`;

// Seeded by backend/scripts/dev-inmemory.cjs
const READER = { email: 'reader.rae.read@dev.local', password: 'Memory1234!' };

// Endpoints the page calls while signed out and that answer 401 by design.
const KNOWN_AUTH_GATED = [
  '/api/marketing/audience-segments',
  '/api/wallet/entitlements',
  '/api/marketing/ads/inventory',
];

function textOf(locator) {
  return locator.evaluate(el => Array.from(el.children).map(c => c.textContent.replace(/\s+/g, ' ').trim()));
}

/* Fail loudly about the environment instead of reporting a fake UI failure. */
async function requireBackend(request) {
  const r = await request.get('http://127.0.0.1:4000/health').catch(() => null);
  expect(r, 'backend not reachable on :4000 — run: PORT=4000 npm run dev:memory').toBeTruthy();
  expect(r.ok(), 'backend on :4000 answered ' + r.status()).toBeTruthy();
  const viaProxy = await request.get(`${API}/discover`);
  expect(viaProxy.status(), `static server on :5502 is not proxying /api to :4000 (got ${viaProxy.status()})`).toBe(200);
  return r;
}

async function openDiscover(page) {
  const errors = [];
  const bad = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('response', res => {
    const url = res.url();
    const status = res.status();
    if (status >= 500) bad.push(`${status} ${url}`);
    else if (status === 404 && url.includes('/api/')) bad.push(`${status} ${url}`);
    else if (status === 401 && url.includes('/api/') && !KNOWN_AUTH_GATED.some(p => url.includes(p))) {
      bad.push(`${status} ${url}`);
    }
  });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#trendingRow > *', { timeout: 20000 });
  return { errors, bad };
}

test('live gate: the page really asks the backend', async ({ page, request }) => {
  await requireBackend(request);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/api/')) calls.push(r.url()); });
  const { bad, errors } = await openDiscover(page);
  const hit = p => calls.some(u => u.includes(p));
  expect(hit('/discover'), 'no GET /api/discover — the page is still demo (USE_API off)').toBe(true);
  expect(hit('/discover/ads'), 'no GET /api/discover/ads').toBe(true);
  expect(hit('/discover/stories'), 'no GET /api/discover/stories').toBe(true);
  expect(hit('/collections'), 'no GET /api/collections').toBe(true);
  expect(bad, 'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});

test('every rendered row is the server payload, not the demo grid', async ({ page, request }) => {
  await requireBackend(request);
  const api = await (await request.get(`${API}/discover`)).json();
  const { bad, errors } = await openDiscover(page);

  const titles = arr => arr.map(x => x.title);
  for (const [row, key] of [['trendingRow', 'trending'], ['editorRow', 'editorsPicks'], ['newRow', 'newReleases'], ['updatedRow', 'recentlyUpdated'], ['completeRow', 'complete'], ['recRow', 'recommended'], ['romanceRow', 'topRomance']]) {
    const dom = await textOf(page.locator('#' + row));
    const want = titles(api[key]);
    expect(api[key].length, `backend returned no rows for ${key} — seed dev-inmemory.cjs`).toBeGreaterThan(0);
    const painted = dom.map(t => t.split(' @')[0].split('★')[0].trim());
    want.forEach(title => {
      expect(painted.some(t => t.startsWith(title)), `${row} is missing live "${title}" (demo fallback?)`).toBe(true);
    });
    expect(painted.length, `${row} count != ${key} count`).toBe(want.length);
  }

  // Collections use the separate /api/collections contract the page fetches.
  const colls = await (await request.get(`${API}/collections?limit=12&sort=popular`)).json();
  const collDom = await textOf(page.locator('#collRow'));
  expect(colls.length).toBeGreaterThan(0);
  expect(collDom.length, 'collRow count != /api/collections count').toBe(colls.length);
  colls.forEach(c => expect(collDom.join(' |'), `collRow missing "${c.name}"`).toContain(c.name));

  // Nothing invented: the demo handles must not appear once the gate is on.
  const body = await page.locator('body').innerText();
  ['@Kemi_A', '@Ada_Writes', '@Chiamaka_N', '@Zara_M', '@Ifeanyi_Story', '@CampusQueen', '@Dami_Cole', '@Efe_O'].forEach(h => {
    expect(body, `demo handle ${h} painted on a live page`).not.toContain(h);
  });

  expect(bad, 'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'page errors: ' + errors.join(' | ')).toEqual([]);
});

test('hero carousel and editor picks come from the Chief placements', async ({ page, request }) => {
  await requireBackend(request);
  const api = await (await request.get(`${API}/discover`)).json();
  await openDiscover(page);
  expect(api.heroes.length, 'no hero-banner FeaturedPlacement rows seeded').toBeGreaterThan(0);
  await expect(page.locator('#heroDots .dot')).toHaveCount(api.heroes.length);
  const title = (await page.locator('#heroTitle').innerText()).trim();
  expect(api.heroes.map(h => h.title), 'hero shows a title the backend never sent').toContain(title);
  const art = await page.locator('#heroImg2, #heroImg').first().evaluate(el => getComputedStyle(el).backgroundImage);
  const cover = api.heroes.find(h => h.title === title).img;
  expect(art, 'hero art is not the seeded cover').toContain(cover);
});

test('Top Writers row and rings are real accounts with live stories', async ({ page, request }) => {
  await requireBackend(request);
  const api = await (await request.get(`${API}/discover`)).json();
  expect(api.topWriters.length, 'no topWriters in the payload').toBeGreaterThan(0);
  await openDiscover(page);

  const names = await page.locator('.dwr-writer .dwr-name').allInnerTexts();
  api.topWriters.slice(0, names.length).forEach((w, i) => {
    expect(names[i], 'writers row order must be the backend ranking').toBe(w.name);
  });

  const handles = api.topWriters.map(w => w.handle).join(',');
  const slides = await (await request.get(`${API}/statuses/writers?handles=${handles}`)).json();
  const withStory = slides.filter(s => s.statuses.length);
  expect(withStory.length, 'no seeded Status docs, so no ring can light').toBeGreaterThan(0);

  // The row paints dim first: a writer's ring is only knowable once
  // GET /api/statuses/writers answers, and the shared row re-decorates itself
  // when that batch lands. Wait for the repaint rather than assert on frame 1.
  await expect
    .poll(async () => page.locator('.dwr-writer .dring.ring-has, .dwr-writer .dring.ring-viewed').count(),
      { message: 'rings never lit up after /api/statuses/writers answered', timeout: 15000 })
    .toBe(withStory.length);
  await expect(page.locator('.dwr-writer .dring.ring-none')).toHaveCount(api.topWriters.slice(0, 6).length - withStory.length);
});

test('clicking a lit ring opens that writer’s real story', async ({ page, request }) => {
  await requireBackend(request);
  const api = await (await request.get(`${API}/discover`)).json();
  const handles = api.topWriters.map(w => w.handle).join(',');
  const slides = await (await request.get(`${API}/statuses/writers?handles=${handles}`)).json();
  const live = slides.find(s => s.statuses.length);
  expect(live, 'no writer has a live story to click').toBeTruthy();
  await openDiscover(page);

  const idx = api.topWriters.findIndex(w => w.handle === live.handle);
  const writer = page.locator('.dwr-writer').nth(idx);
  // A ring only becomes clickable once the repaint attaches its slide group;
  // before that the click is documented to fall through to the profile page.
  await expect(writer.locator('.dring[data-writer-status]')).toBeVisible({ timeout: 15000 });
  await writer.locator('.dring').click();
  await page.waitForSelector('#dsv2Ov.open', { timeout: 8000 });
  const caption = await page.locator('#dsv2Ov').innerText();
  const quote = (live.statuses[0].quote || live.statuses[0].caption || '').slice(0, 24);
  expect(quote.length, 'seeded story has no quote/caption to match').toBeGreaterThan(0);
  expect(caption, 'viewer did not open on the seeded story').toContain(quote);
});

test('ad strip serves a creative from the inventory, not a hardcoded card', async ({ page, request }) => {
  await requireBackend(request);
  const pools = await (await request.get(`${API}/discover/ads`)).json();
  const served = [...(pools.platformAds || []), ...(pools.bookAds || [])];
  expect(served.length, 'no discover creatives seeded').toBeGreaterThan(0);
  await openDiscover(page);
  const adIds = await page.locator('[data-ad]').evaluateAll(els => els.map(e => e.dataset.adid));
  expect(adIds.length, 'no ad rendered in the list').toBeGreaterThan(0);
  const known = served.map(a => String(a.id));
  adIds.forEach(id => expect(known, `ad ${id} is not in the backend pool`).toContain(id));
});

test('Continue Reading appears only after the reader signs in', async ({ page, request }) => {
  await requireBackend(request);
  await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
  await page.fill('#emailInput', READER.email);
  await page.fill('#passInput', READER.password);
  await page.click('#loginBtn');
  // The session cookie is httpOnly and set by the auth response, so wait for it
  // rather than for a redirect the page may or may not make.
  await page.waitForFunction(() => document.cookie.indexOf('dro_access') !== -1, null, { timeout: 15000 })
    .catch(() => {});
  const cookies = await page.context().cookies();
  expect(cookies.some(c => c.name === 'dro_access'), 'login did not set the dro_access cookie').toBe(true);

  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#continueRow > *', { timeout: 20000 });
  const cont = await page.locator('#continueRow').innerText();
  expect(cont, 'library "continue" rows are not reaching the page').toContain('Nine Lives, Twice');
  expect(cont).toContain('Ch. 2');

  const card = page.locator('.dc-scard', { hasText: 'Nine Lives, Twice' }).first();
  await expect(card.locator('.dc-cont-ch')).toHaveText('Ch. 2');
  const pct = await card.locator('.dc-prog-fill').evaluate(el => el.style.width);
  expect(pct, 'progress bar must come from the library item (55%)').toBe('55%');
});

test('More stories paginates against the API', async ({ page, request }) => {
  await requireBackend(request);
  await openDiscover(page);
  const before = await page.locator('#moreList').evaluate(el => el.children.length);
  const pages = [];
  page.on('request', r => {
    const m = /discover\/stories\?page=(\d+)/.exec(r.url());
    if (m) pages.push(m[1]);
  });
  for (let i = 0; i < 6; i++) {
    await page.locator('#scrollSentinel').scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
  }
  expect(pages, 'no page-2 request — pagination is not hitting the API').toContain('2');
  const after = await page.locator('#moreList').evaluate(el => el.children.length);
  expect(after, 'the list did not grow after page 2').toBeGreaterThan(before);
});

test('Tune your feed changes what the server returns', async ({ page, request }) => {
  await requireBackend(request);
  await openDiscover(page);
  const apiGenres = await (await request.get(`${API}/genres`)).json();
  const catalogue = (Array.isArray(apiGenres) ? apiGenres : (apiGenres.items || [])).map(g => String(g.name));
  expect(catalogue.length, 'no Genre catalogue seeded to validate taste against').toBeGreaterThan(0);

  await page.click('#recTuneBtn');
  await page.waitForSelector('#tpGenreGrid .tp-pill', { timeout: 8000 });
  const chips = page.locator('#tpGenreGrid .tp-pill');
  const labels = (await chips.allInnerTexts()).map(t => t.trim());
  // The sheet asks for three picks and the backend ranks against the Chief's
  // Genre catalogue, so only catalogue names are worth clicking.
  const wanted = labels.filter(l => catalogue.includes(l)).slice(0, 3);
  expect(wanted.length, `picker offers fewer than 3 genres the backend knows (${catalogue.join('/')})`).toBe(3);
  for (const l of wanted) await chips.filter({ hasText: l }).first().click();
  await page.click('#tpNext');            // step 1 -> tropes
  await page.click('#tpNext');            // "Show my feed" -> save + onDone

  const tastes = await page.evaluate(() => JSON.parse(localStorage.getItem('dro_tastes') || '{}'));
  // The sheet stores the chip's lowercase id; the backend validates names.
  const savedLower = (tastes.genres || []).map(g => String(g).toLowerCase());
  wanted.forEach(g => expect(savedLower, `picker did not keep the selection "${g}"`).toContain(String(g).toLowerCase()));

  const urls = [];
  page.on('request', r => { if (r.url().includes('/discover')) urls.push(r.url()); });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#recRow > *', { timeout: 20000 });
  const sent = urls.find(u => u.includes('taste='));
  expect(sent, 'the tuned visit never sent ?taste= to the backend').toBeTruthy();

  const tuned = await textOf(page.locator('#recRow'));
  const live = await (await request.get(sent)).json();
  expect(live.recommended.length, 'taste filter returned nothing to rank').toBeGreaterThan(0);
  expect(tuned.length, 'rec row count != filtered payload count').toBe(live.recommended.length);
  live.recommended.forEach(b => expect(tuned.join(' |'), `tuned row is missing "${b.title}"`).toContain(b.title));
});
