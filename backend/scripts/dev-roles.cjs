'use strict';
/* Boots the app on an in-memory Mongo with one account that holds three
   platform roles, so the profile drawer's "My Dashboard" list can be checked
   in a real browser:
     admin + chief_editor + senior_editor

   Usage: node backend/scripts/dev-roles.cjs
   Then sign in at http://127.0.0.1:4188/Pages/login.html with:
     email    : multi.role@droboard.test
     password : MultiRole!2026
*/
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '4188';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.JWT_ACCESS_TTL = '8h';
process.env.CORS_ORIGINS = 'http://127.0.0.1:4188';

const PW = 'MultiRole!2026';

(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 120000, startupTimeout: 120000 },
  });
  process.env.MONGO_URI = mongod.getUri('dro_roles_dev');

  const httpMw = require('../src/middleware/http');
  const nolimit = (req, res, next) => next();
  ['generalLimiter', 'authLimiter', 'moneyLimiter', 'writeLimiter'].forEach(k => { httpMw[k] = nolimit; });

  require('../src/server');
  await new Promise(r => setTimeout(r, 1500));

  const argon2 = require('argon2');
  const { User } = require('../src/models/user.model');
  const hash = await argon2.hash(PW, { type: argon2.argon2id });

  const user = await User.create({
    fullName: 'Multi Role Admin',
    username: 'multi_role_admin',
    email: 'multi.role@droboard.test',
    passwordHash: hash,
    status: 'active',
    roles: ['admin', 'chief_editor', 'senior_editor', 'reader'],
    primaryRole: 'admin',
    platformRoles: ['admin', 'chief_editor', 'senior_editor', 'reader'],
  });
  console.log('seeded multi-role account:', user.id, user.email, '->', PW);

  const bye = () => {
    require('mongoose').connection.close().catch(() => {});
    mongod.stop().catch(() => {}).then(() => process.exit(0));
  };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
})().catch(e => { console.error('FATAL', e && e.stack || e); process.exit(1); });