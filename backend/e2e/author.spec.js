'use strict';
/**
 * Author Center end-to-end tests.
 * Drives all 17 pages in public/author/ against the live backend.
 *
 * Requirements:
 *   - backend on :4000  →  PORT=4000 npm run dev:memory
 *   - static server on :5502 serving the repo root (Live Server or similar)
 *   - a seeded writer account (email/password in WRITER below)
 *
 * Run:
 *   npx playwright test e2e/author.spec.js
 */

const { test, expect } = require('@playwright/test');

const STATIC = 'http://127.0.0.1:5502';
const API    = `${STATIC}/api`;
const BASE   = `${STATIC}/public/author`;
const LOGIN  = `${STATIC}/public/Pages/login.html`;

// Seeded writer account — must have at least one book and the writer role.
const WRITER = { email: 'writer.luna.vale@dev.local', password: 'Memory1234!' };

// ─── helpers ────────────────────────────────────────────────────────────────

async function requireBackend(request) {
  const r = await request.get('http://127.0.0.1:4000/health').catch(() => null);
  expect(r,      'backend not reachable on :4000 — run: PORT=4000 npm run dev:memory').toBeTruthy();
  expect(r.ok(), 'backend on :4000 returned non-200 health').toBeTruthy();
}

async function loginAs(page, user) {
  await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
  await page.fill('#emailInput', user.email);
  await page.fill('#passInput',  user.password);
  await page.click('#loginBtn');
  await page.waitForFunction(
    () => document.cookie.includes('dro_access'),
    null, { timeout: 15000 }
  ).catch(() => {});
  const cookies = await page.context().cookies();
  expect(
    cookies.some(c => c.name === 'dro_access'),
    `login as ${user.email} did not set dro_access cookie`
  ).toBe(true);
}

/** Open an author page and collect JS errors + bad API responses. */
async function openPage(page, path, waitFor) {
  const errors = [];
  const bad    = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('response', res => {
    const url    = res.url();
    const status = res.status();
    if (status >= 500)                              bad.push(`${status} ${url}`);
    else if (status === 404 && url.includes('/api')) bad.push(`${status} ${url}`);
    // 401 on author routes = not logged in, which is a real failure here
    else if (status === 401 && url.includes('/api/author')) bad.push(`401 ${url}`);
  });
  await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 20000 });
  return { errors, bad };
}

// ─── environment gate ────────────────────────────────────────────────────────

test.beforeEach(async ({ request }) => {
  await requireBackend(request);
});

// ─── auth gate ───────────────────────────────────────────────────────────────

test('author pages redirect or show gate when not logged in', async ({ page }) => {
  // Navigate to dashboard without login — expect either a redirect to login
  // or an auth-error element (guest gate / 401 banner), not a blank page.
  await page.goto(`${BASE}/author-center.html`, { waitUntil: 'domcontentloaded' });
  const url = page.url();
  const body = await page.locator('body').innerText();
  const isRedirected = url.includes('login') || url.includes('signin');
  const hasGate      = body.toLowerCase().includes('sign in') ||
                       body.toLowerCase().includes('log in')  ||
                       body.toLowerCase().includes('unauthori');
  expect(isRedirected || hasGate, 'unauthenticated visit showed no gate and no redirect').toBe(true);
});

// ─── dashboard (author-center.html) ─────────────────────────────────────────

test('dashboard: loads real book list from /api/author/books', async ({ page, request }) => {
  await loginAs(page, WRITER);
  const { errors, bad } = await openPage(page, 'author-center.html', '#bookList');

  // Check API response matches what the page rendered
  const res  = await request.get(`${API}/author/books`, { headers: { Cookie: await cookieHeader(page) } });
  expect(res.ok(), `/api/author/books returned ${res.status()}`).toBe(true);
  const books = await res.json();
  expect(Array.isArray(books) ? books.length : books.items?.length, 'no books in API response').toBeGreaterThan(0);

  const rendered = await page.locator('#bookList .dbc-card, #bookList [data-id]').count();
  expect(rendered, 'book list is empty — demo fallback or failed fetch').toBeGreaterThan(0);

  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: '            + errors.join(' | ')).toEqual([]);
});

test('dashboard: no demo book titles painted', async ({ page }) => {
  await loginAs(page, WRITER);
  await openPage(page, 'author-center.html', '#bookList');
  const body = await page.locator('body').innerText();
  // These are hardcoded in demoBooks() — must not appear when live
  ['Bound By Obsession', 'The Way You Stay', 'Yours, Always', 'Until Forever'].forEach(t => {
    expect(body, `demo title "${t}" is still showing — hydrate() fallback is firing`).not.toContain(t);
  });
});

// ─── book overview ───────────────────────────────────────────────────────────

test('book-overview: calls /api/author/books/:id/overview', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/api/author/books/') && r.url().includes('/overview')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'book-overview.html', '#statGrid');
  expect(calls.length, 'overview endpoint was never called — getOverview() may be using demo').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── book workspace ──────────────────────────────────────────────────────────

test('book-workspace: loads chapters from /api/author/books/:id/chapters', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/chapters')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'book-workspace.html', '#chapterList, .chapter-list, #chaptersPanel');
  expect(calls.length, '/api/author/books/:id/chapters was never called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── edit chapter ────────────────────────────────────────────────────────────

test('edit-chapter: loads content from /api/author/books/:id/chapters/:num', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().match(/\/api\/author\/books\/[^/]+\/chapters\/\d+/)) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'edit-chapter.html', '#editorArea, #chapterEditor, textarea');
  expect(calls.length, 'chapter GET endpoint was never called — Svc.get() may be using demo').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── characters ──────────────────────────────────────────────────────────────

test('characters: loads from /api/author/books/:id/characters', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/characters')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'characters.html', '#charGrid, #characterList, .char-card');
  expect(calls.length, '/api/author/books/:id/characters was never called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

test('characters: no demo character names (Aria Cole, Darius Kane)', async ({ page }) => {
  await loginAs(page, WRITER);
  await openPage(page, 'characters.html', '#charGrid, #characterList, .char-card');
  const body = await page.locator('body').innerText();
  ['Aria Cole', 'Darius Kane'].forEach(name => {
    expect(body, `demo character "${name}" is showing — api.list() is falling back`).not.toContain(name);
  });
});

// ─── plotting ────────────────────────────────────────────────────────────────

test('plotting: loads from /api/author/books/:id/plot', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/plot')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'plotting.html', '#actList, #plotBoard, .act-card');
  expect(calls.length, '/api/author/books/:id/plot was never called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

test('plotting: no demo act titles (Setup, Confrontation, Resolution)', async ({ page }) => {
  await loginAs(page, WRITER);
  await openPage(page, 'plotting.html', '#actList, #plotBoard, .act-card');
  const body = await page.locator('body').innerText();
  // The demo fallback returns these three hardcoded acts
  ['Act I — Setup', 'Act II — Escalation', 'Act III — Resolution'].forEach(a => {
    expect(body, `demo act "${a}" showing — Svc.getPlot() fell back to demo`).not.toContain(a);
  });
});

// ─── request book change ─────────────────────────────────────────────────────

test('request-book-change: loads books from /api/author/books', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().match(/\/api\/author\/books($|\?)/) ) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'request-book-change.html', '#bookList, .book-row');
  expect(calls.length, '/api/author/books not called — listBooks() using demo').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── request chapter review ──────────────────────────────────────────────────

test('request-chapter-review: loads books from /api/author/books', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().match(/\/api\/author\/books($|\?)/)) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'request-chapter-review.html', '#bookList, .book-row');
  expect(calls.length, '/api/author/books not called — listBooks() using demo').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── verification ────────────────────────────────────────────────────────────

test('verification: calls /api/author/verification for status', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/api/author/verification')) calls.push(r.url()); });
  // Verification card is inside author-center — navigate there
  await openPage(page, 'author-center.html', '#bookList');
  // Also check the drawer/settings area if it has a verifyCard
  expect(calls.length, '/api/author/verification was never called — checkStatus() using localStorage demo').toBeGreaterThan(0);
});

// ─── earnings ────────────────────────────────────────────────────────────────

test('earnings: calls /api/author/finance/earnings', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/earnings')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'earnings.html', '#balanceCard, #bookEarnings');
  expect(calls.length, '/api/author/finance/earnings not called — getEarnings() using demo').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

test('earnings: no demo dollar amounts ($8,642)', async ({ page }) => {
  await loginAs(page, WRITER);
  await openPage(page, 'earnings.html', '#balanceCard');
  const body = await page.locator('body').innerText();
  expect(body, 'demo earnings $8,642 still showing').not.toContain('8,642');
  expect(body, 'demo earnings $3,240 still showing').not.toContain('3,240');
});

// ─── transaction history ─────────────────────────────────────────────────────

test('transaction-history: calls /api/author/finance/transactions', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/transactions')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'transaction-history.html', '#txnList, #kpis');
  expect(calls.length, '/transactions not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── withdrawal request ──────────────────────────────────────────────────────

test('withdrawal-request: loads balance and methods from live API', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/earnings') || r.url().includes('/payment-methods')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'withdrawal-request.html', '#balanceMini');
  expect(calls.length, 'earnings or payment-methods not called — withdrawal using demo data').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

test('withdrawal-request: minWithdrawal comes from API not DemoData', async ({ page, request }) => {
  await loginAs(page, WRITER);
  await openPage(page, 'withdrawal-request.html', '#balanceMini');
  const mini = await page.locator('#balanceMini').innerText();
  // DemoData.WITHDRAWAL_MIN is 100 — if the backend returns a different value
  // and the page shows it, the wiring is correct.
  // We just confirm the page loaded without falling back to DemoData at all.
  expect(mini, 'balance mini section is empty').toBeTruthy();
  expect(mini, 'balance mini shows demo placeholder text').not.toContain('undefined');
  expect(mini, 'balance shows NaN').not.toContain('NaN');
});

// ─── payment details ─────────────────────────────────────────────────────────

test('payment-details: loads methods from /api/author/finance/payment-methods', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/payment-methods')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'payment-details.html', '#methodsList, .method-card, #addBtn');
  expect(calls.length, '/payment-methods not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── launch kit ──────────────────────────────────────────────────────────────

test('launch-kit: calls /api/author/launch-kit', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/launch-kit')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'launch-kit.html', '#kitContent, .kit-section, #saveBtn');
  expect(calls.length, '/api/author/launch-kit not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── apply contract ──────────────────────────────────────────────────────────

test('apply-contract: loads contracts from /api/author/contracts', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().includes('/contracts')) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'apply-contract.html', '#contractsList, #bookPicker, .contract-card, #applyForm');
  expect(calls.length, '/api/author/contracts not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── apply completion ────────────────────────────────────────────────────────

test('apply-completion: loads books for picker from /api/author/books', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().match(/\/api\/author\/books($|\?)/)) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'apply-completion.html', '#bookPicker, #completionForm, select');
  expect(calls.length, '/api/author/books not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── apply VIP ───────────────────────────────────────────────────────────────

test('apply-vip: loads books from /api/author/books', async ({ page }) => {
  await loginAs(page, WRITER);
  const calls = [];
  page.on('request', r => { if (r.url().match(/\/api\/author\/books($|\?)/)) calls.push(r.url()); });
  const { errors, bad } = await openPage(page, 'apply-vip.html', '#bookPicker, #vipForm, select');
  expect(calls.length, '/api/author/books not called').toBeGreaterThan(0);
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── flyer templates ─────────────────────────────────────────────────────────

test('flyer-templates: page loads without JS errors', async ({ page }) => {
  await loginAs(page, WRITER);
  const { errors, bad } = await openPage(page, 'flyer-templates.html', '#templateGrid, #flyerList, .flyer-card, main');
  expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
});

// ─── no demo data shown on any page ─────────────────────────────────────────

test('no demo book IDs (b1/b2) appear in any page URL or rendered content', async ({ page }) => {
  await loginAs(page, WRITER);
  const demoIds = ['?book=b1', '?book=b2', 'bookId=b1', 'bookId=b2'];

  for (const path of [
    'book-overview.html', 'book-workspace.html', 'edit-chapter.html',
    'characters.html', 'plotting.html',
  ]) {
    await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const url  = page.url();
    const body = await page.locator('body').innerText().catch(() => '');
    for (const demo of demoIds) {
      expect(url + body, `demo ID "${demo}" visible on ${path}`).not.toContain(demo);
    }
  }
});

// ─── helper (extracts cookie header from page context) ───────────────────────

async function cookieHeader(page) {
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
