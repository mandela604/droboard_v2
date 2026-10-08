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

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Cloudflare
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(require('./middleware/http').generalLimiter);

  app.get('/health', (req, res) => res.json({ ok: true }));

  const { requireAuth } = require('./middleware/auth');
  app.use('/api/auth', require('./routes/auth.routes'));

  // domain routers (one per slice; HTML never changes when these grow)
  app.use('/api/books', require('./routes/books.routes'));
  app.use('/api/genres', require('./routes/genres.routes'));
  app.use('/api/categories', require('./routes/categories.routes'));
  app.use('/api/collections', require('./routes/collections.routes'));
  app.use('/api/posts', require('./routes/posts.routes'));
  app.use('/api/comments', require('./routes/comments.routes'));
  app.use('/api/wallet', require('./routes/wallet.routes'));
  app.use('/api/store', require('./routes/store.routes'));
  app.use('/api/payments', require('./routes/payments.routes'));
  app.use('/api/author/finance', require('./routes/finance.routes'));
  app.use('/api/author', require('./routes/author.routes'));
  app.use('/api/senior-editor', require('./routes/senior.routes'));
  app.use('/api/editor', require('./routes/editor.routes'));
  app.use('/api/chief', require('./routes/chief-reports.routes'));
  app.use('/api/chief', require('./routes/chief-overview.routes'));
  app.use('/api/chief', require('./routes/chief-moderation.routes'));
  app.use('/api/chief', require('./routes/chief-growth.routes'));
  app.use('/api/chief', require('./routes/chief-content.routes'));
  app.use('/api/chief', require('./routes/chief-contracts.routes'));
  app.use('/api/chief', require('./routes/chief-editors.routes'));
  app.use('/api/super-admin', require('./routes/admin.routes'));
  app.use('/api', require('./routes/compat.routes'));
  app.use('/api', require('./routes/feed.routes'));
  app.use('/api/ads', require('./routes/ads.routes'));
  app.use('/api/users', require('./routes/users.routes'));
  app.use('/api/statuses', require('./routes/statuses.routes'));
  app.use('/api/saves', require('./routes/saves.routes'));
  app.use('/api/referrals', require('./routes/referrals.routes'));
  app.use('/api/notifications', require('./routes/notifications.routes'));
  app.use('/api/search', require('./routes/search.routes'));
  app.use('/api/stories', require('./routes/engagement.routes'));
  app.use('/api/awards', require('./routes/awards.routes'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).json({ error: 'error' }));

  const server = http.createServer(app);
  require('./socket').init(server);
  server.listen(env.port, () => console.log('droboard api on :' + env.port));
}

main().catch((e) => { console.error(e); process.exit(1); });
