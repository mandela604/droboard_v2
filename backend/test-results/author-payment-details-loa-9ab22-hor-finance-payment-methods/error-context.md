# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: author.spec.js >> payment-details: loads methods from /api/author/finance/payment-methods
- Location: e2e\author.spec.js:290:1

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://127.0.0.1:5502/public/Pages/login.html", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | 'use strict';
  2   | /**
  3   |  * Author Center end-to-end tests.
  4   |  * Drives all 17 pages in public/author/ against the live backend.
  5   |  *
  6   |  * Requirements:
  7   |  *   - backend on :4000  →  PORT=4000 npm run dev:memory
  8   |  *   - static server on :5502 serving the repo root (Live Server or similar)
  9   |  *   - a seeded writer account (email/password in WRITER below)
  10  |  *
  11  |  * Run:
  12  |  *   npx playwright test e2e/author.spec.js
  13  |  */
  14  | 
  15  | const { test, expect } = require('@playwright/test');
  16  | 
  17  | const STATIC = 'http://127.0.0.1:5502';
  18  | const API    = `${STATIC}/api`;
  19  | const BASE   = `${STATIC}/public/author`;
  20  | const LOGIN  = `${STATIC}/public/Pages/login.html`;
  21  | 
  22  | // Seeded writer account — must have at least one book and the writer role.
  23  | const WRITER = { email: 'writer.luna.vale@dev.local', password: 'Memory1234!' };
  24  | 
  25  | // ─── helpers ────────────────────────────────────────────────────────────────
  26  | 
  27  | async function requireBackend(request) {
  28  |   const r = await request.get('http://127.0.0.1:4000/health').catch(() => null);
  29  |   expect(r,      'backend not reachable on :4000 — run: PORT=4000 npm run dev:memory').toBeTruthy();
  30  |   expect(r.ok(), 'backend on :4000 returned non-200 health').toBeTruthy();
  31  | }
  32  | 
  33  | async function loginAs(page, user) {
> 34  |   await page.goto(LOGIN, { waitUntil: 'domcontentloaded' });
      |              ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  35  |   await page.fill('#emailInput', user.email);
  36  |   await page.fill('#passInput',  user.password);
  37  |   await page.click('#loginBtn');
  38  |   await page.waitForFunction(
  39  |     () => document.cookie.includes('dro_access'),
  40  |     null, { timeout: 15000 }
  41  |   ).catch(() => {});
  42  |   const cookies = await page.context().cookies();
  43  |   expect(
  44  |     cookies.some(c => c.name === 'dro_access'),
  45  |     `login as ${user.email} did not set dro_access cookie`
  46  |   ).toBe(true);
  47  | }
  48  | 
  49  | /** Open an author page and collect JS errors + bad API responses. */
  50  | async function openPage(page, path, waitFor) {
  51  |   const errors = [];
  52  |   const bad    = [];
  53  |   page.on('pageerror', e => errors.push(String(e && e.message || e)));
  54  |   page.on('response', res => {
  55  |     const url    = res.url();
  56  |     const status = res.status();
  57  |     if (status >= 500)                              bad.push(`${status} ${url}`);
  58  |     else if (status === 404 && url.includes('/api')) bad.push(`${status} ${url}`);
  59  |     // 401 on author routes = not logged in, which is a real failure here
  60  |     else if (status === 401 && url.includes('/api/author')) bad.push(`401 ${url}`);
  61  |   });
  62  |   await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });
  63  |   if (waitFor) await page.waitForSelector(waitFor, { timeout: 20000 });
  64  |   return { errors, bad };
  65  | }
  66  | 
  67  | // ─── environment gate ────────────────────────────────────────────────────────
  68  | 
  69  | test.beforeEach(async ({ request }) => {
  70  |   await requireBackend(request);
  71  | });
  72  | 
  73  | // ─── auth gate ───────────────────────────────────────────────────────────────
  74  | 
  75  | test('author pages redirect or show gate when not logged in', async ({ page }) => {
  76  |   // Navigate to dashboard without login — expect either a redirect to login
  77  |   // or an auth-error element (guest gate / 401 banner), not a blank page.
  78  |   await page.goto(`${BASE}/author-center.html`, { waitUntil: 'domcontentloaded' });
  79  |   const url = page.url();
  80  |   const body = await page.locator('body').innerText();
  81  |   const isRedirected = url.includes('login') || url.includes('signin');
  82  |   const hasGate      = body.toLowerCase().includes('sign in') ||
  83  |                        body.toLowerCase().includes('log in')  ||
  84  |                        body.toLowerCase().includes('unauthori');
  85  |   expect(isRedirected || hasGate, 'unauthenticated visit showed no gate and no redirect').toBe(true);
  86  | });
  87  | 
  88  | // ─── dashboard (author-center.html) ─────────────────────────────────────────
  89  | 
  90  | test('dashboard: loads real book list from /api/author/books', async ({ page, request }) => {
  91  |   await loginAs(page, WRITER);
  92  |   const { errors, bad } = await openPage(page, 'author-center.html', '#bookList');
  93  | 
  94  |   // Check API response matches what the page rendered
  95  |   const res  = await request.get(`${API}/author/books`, { headers: { Cookie: await cookieHeader(page) } });
  96  |   expect(res.ok(), `/api/author/books returned ${res.status()}`).toBe(true);
  97  |   const books = await res.json();
  98  |   expect(Array.isArray(books) ? books.length : books.items?.length, 'no books in API response').toBeGreaterThan(0);
  99  | 
  100 |   const rendered = await page.locator('#bookList .dbc-card, #bookList [data-id]').count();
  101 |   expect(rendered, 'book list is empty — demo fallback or failed fetch').toBeGreaterThan(0);
  102 | 
  103 |   expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  104 |   expect(errors, 'JS errors: '            + errors.join(' | ')).toEqual([]);
  105 | });
  106 | 
  107 | test('dashboard: no demo book titles painted', async ({ page }) => {
  108 |   await loginAs(page, WRITER);
  109 |   await openPage(page, 'author-center.html', '#bookList');
  110 |   const body = await page.locator('body').innerText();
  111 |   // These are hardcoded in demoBooks() — must not appear when live
  112 |   ['Bound By Obsession', 'The Way You Stay', 'Yours, Always', 'Until Forever'].forEach(t => {
  113 |     expect(body, `demo title "${t}" is still showing — hydrate() fallback is firing`).not.toContain(t);
  114 |   });
  115 | });
  116 | 
  117 | // ─── book overview ───────────────────────────────────────────────────────────
  118 | 
  119 | test('book-overview: calls /api/author/books/:id/overview', async ({ page }) => {
  120 |   await loginAs(page, WRITER);
  121 |   const calls = [];
  122 |   page.on('request', r => { if (r.url().includes('/api/author/books/') && r.url().includes('/overview')) calls.push(r.url()); });
  123 |   const { errors, bad } = await openPage(page, 'book-overview.html', '#statGrid');
  124 |   expect(calls.length, 'overview endpoint was never called — getOverview() may be using demo').toBeGreaterThan(0);
  125 |   expect(bad,    'failed API responses: ' + bad.join(', ')).toEqual([]);
  126 |   expect(errors, 'JS errors: ' + errors.join(' | ')).toEqual([]);
  127 | });
  128 | 
  129 | // ─── book workspace ──────────────────────────────────────────────────────────
  130 | 
  131 | test('book-workspace: loads chapters from /api/author/books/:id/chapters', async ({ page }) => {
  132 |   await loginAs(page, WRITER);
  133 |   const calls = [];
  134 |   page.on('request', r => { if (r.url().includes('/chapters')) calls.push(r.url()); });
```