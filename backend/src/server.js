'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const env = require('./config/env');
const db = require('./config/db');
const { generalLimiter } = require('./middleware/http');

async function main() {
  if (!env.corsOrigins.length && env.isProd) throw new Error('CORS_ORIGINS required in production');
  await db.connect();
  // Idempotent boot seed — creates the six canonical AdminRole docs (admin,
  // chief_editor, senior_editor, finance, marketing, support) if missing so
  // requirePerm() and the console Roles page have data on a fresh database.
  try {
    const sa = require('./services/superadmin.service');
    const seeded = await sa.ensureSystemRoles();
    if (seeded.created) console.log('seeded system roles:', seeded.slugs.join(', '));
  } catch (e) { console.error('role seed failed:', e && e.message); }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Cloudflare
  /* helmet()'s default CSP is `script-src 'self'`, which blocks every inline
     <script> in our own pages AND every ad-network tag: Monetag/Adsterra hand
     over a bare inline snippet that appends a remote script, so an embed
     creative can never run under a no-inline policy. Ads are a product
     feature, so script-src is opened to inline + https while the rest of
     helmet stays on. Trade-off: any stored XSS in an embed field executes with
     page privileges — the console already says "only paste networks you trust".
     script-src-attr has to be opened too: helmet's default is 'none', which
     blocks every onclick="…" in the UI (period chips, icon buttons, list
     rows) while the inline <script> blocks right next to them keep working.
     Leaving it closed makes the served pages look dead. */
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", 'https:'],
        'script-src-attr': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https:', 'wss:'],
        'frame-src': ["'self'", 'https:'],
        'object-src': ["'none'"],
      },
    },
  }));
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true }));
  // Provider webhooks need EXACT raw bytes for HMAC — parse before json().
  app.use('/api/payments/webhook', require('express').raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  // Rate limit only API routes — never static files (JS/CSS/HTML).
  // The old global placement was hitting static file loads and causing 429s on page load.
  app.use('/api', require('./middleware/http').generalLimiter);

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Dev-only request console (npm run dev:memory) — a page that fires these very
  // endpoints from the browser. Never mounted in production.
  console.log("MY STATIC PATH IS:", require('path').join(__dirname, '..', '..', 'public'));

  //if (!env.isProd) {
    app.use('/dev', require('express').static(require('path').join(__dirname, '..', 'dev-console')));
  //}

  const { requireAuth } = require('./middleware/auth');
  app.use('/api/auth', require('./routes/auth.routes'));

  // domain routers (one per slice; HTML never changes when these grow)
  app.use('/api/books', require('./routes/books.routes'));
  app.use('/api/genres', require('./routes/genres.routes'));
  app.use('/api/categories', require('./routes/categories.routes'));
  app.use('/api/collections', require('./routes/collections.routes'));
  app.use('/api/posts', require('./routes/posts.routes'));
  app.use('/api/comments', require('./routes/comments.routes'));
  app.use('/api', require('./routes/debate-args.routes'));
  app.use('/api/wallet', require('./routes/wallet.routes'));
  app.use('/api/store', require('./routes/store.routes'));
  app.use('/api/payments', require('./routes/payments.routes'));
  app.use('/api/author/finance', require('./routes/finance.routes'));
  app.use('/api/finance', require('./routes/finance.routes')); // finance console base (finance-data.js)
  app.use('/api/author', require('./routes/author.routes'));
  // story-wide engagement under /api/author/books/:bookId/engagement — merged with author/* via mergeParams
  app.use('/api/author/books/:bookId', require('./routes/author-engagement.routes'));
  app.use('/api/senior-editor', require('./routes/senior.routes'));
  app.use('/api/chief', require('./routes/chief-reports.routes'));
  app.use('/api/chief', require('./routes/chief-overview.routes'));
  app.use('/api/chief', require('./routes/chief-moderation.routes'));
  app.use('/api/chief', require('./routes/chief-growth.routes'));
  app.use('/api/chief', require('./routes/chief-content.routes'));
  app.use('/api/chief', require('./routes/chief-contracts.routes'));
  app.use('/api/chief', require('./routes/chief-editors.routes'));
  app.use('/api/chief', require('./routes/chief-earnings.routes'));
  app.use('/api/super-admin', require('./routes/admin.routes'));
  app.use('/api', require('./routes/compat.routes'));
  app.use('/api', require('./routes/feed.routes'));
  // Same router, second prefix: the reader feed calls /api/feed/home,
  // /api/feed/discover/stories and /api/feed/discover/ads, while the library and
  // story-detail reads are reached as /api/library/* and /api/stories/:id. One
  // set of handlers serves both spellings so neither side drifts.
  app.use('/api/feed', require('./routes/feed.routes'));
  app.use('/api', require('./routes/pricing.routes'));
  app.use('/api/ads', require('./routes/ads.routes'));
  app.use('/api/users', require('./routes/users.routes'));
  app.use('/api/uploads', require('./routes/uploads.routes'));
  app.use('/api/statuses', require('./routes/statuses.routes'));
  app.use('/api/discussions', require('./routes/discussions.routes'));
  app.use('/api/messages', require('./routes/messages.routes'));
  app.use('/api/author/messages', require('./routes/author-messages.routes'));
  app.use('/api/track', require('./routes/tracking.routes'));
  app.use('/api/insights', require('./routes/insights.routes'));
  app.use('/api/saves', require('./routes/saves.routes'));
  app.use('/api/referrals', require('./routes/referrals.routes'));
  app.use('/api/notifications', require('./routes/notifications.routes'));
  app.use('/api/templates', require('./routes/templates.routes'));
  app.use('/api/reports', require('./routes/reports.routes'));
  app.use('/api/search', require('./routes/search.routes'));
  app.use('/api/marketing', require('./routes/marketing.routes'));
  app.use('/api/acquisition', require('./routes/acquisition.routes'));
  app.use('/api/league', require('./routes/league.routes'));
  app.use('/api/tropes', require('./routes/tropes.routes'));
  app.use('/api/stories', require('./routes/engagement.routes'));
  app.use('/api/awards', require('./routes/awards.routes'));


    console.log("MY STATIC PATH IS:", require('path').join(__dirname, '..', '..', 'public'));
    app.use(require('express').static(require('path').join(__dirname, '..', '..', 'public')));
  

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[server error]', req.method, req.path, err && err.message, err && err.stack);
    const status = (err && err.status) || 500;
    const message = (err && err.message) || 'error';
    res.status(status).json({ error: message });
  });

  const server = http.createServer(app);
  require('./socket').init(server);
  require('./services/scheduler.service').start(); // scheduled → live publisher
  // Every domain router is required by now, so mongoose knows every model.
  const ids = require('./models/ids');
  await ids.ensureIdIndexes();
  // Votes key on the engagement row now, not just the kind. Without the sync the
  // old (chapterId, userId, kind) unique index stays behind and silently blocks
  // a reader's second poll on the same book.
  await require('./models/content.model').EngagementVote.syncIndexes();
  // Unique-visit rows are deduped by their (surface, target, visitor) index;
  // without it two concurrent first hits would both insert and the same reader
  // would count twice forever.
  await require('./models/social.model').InsightVisitor.syncIndexes();
  // One earned badge per reader per week; the unique index is what makes a
  // rollover retry safe.
  await require('./models/marketing.model').LeagueBadge.syncIndexes();
  server.listen(env.port, () => console.log('droboard api on :' + env.port));
}

main().catch((e) => { console.error(e); process.exit(1); });
