'use strict';
// Board management must be gated to the crew set on the parent Category.
process.env.NODE_ENV = 'test';
process.env.PORT = '4211';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4211';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + JSON.stringify(detail).slice(0, 220) : ''}`);
  console.log(out[out.length - 1]);
}
async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000, startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('dro_board_gating');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }

  const { User } = require('../src/models/user.model');
  const { Category, Genre } = require('../src/models/content.model');
  const { Discussion } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const mk = async (n) => User.create({ fullName: n, email: n + '@t.co', username: n + Date.now(), passwordHash: 'x', roles: ['reader'], status: 'active' });
  const member = await mk('member');
  const mod = await mk('mod');
  const cat = await Category.create({ name: 'Romance', slug: 'romance', status: 'active', moderatorIds: [String(mod.id)], adminIds: [] });
  const genre = await Genre.create({ name: 'Dark Romance', slug: 'dark-romance', categoryId: String(cat.id), status: 'active' });
  const disc = await Discussion.create({ genreId: String(genre.id), authorId: String(member.id), title: 'Thread', body: 'hi' });
  const h = (u) => ({ Authorization: 'Bearer ' + signAccess({ id: u.id, roles: u.roles }) });
  const hub = async (u) => (await (await fetch(BASE + '/api/genres/' + cat.slug, { headers: h(u) })).json());
  const pin = async (u, method) => fetch(BASE + '/api/discussions/' + disc.id + '/pin', { method, headers: h(u) });

  const memberHub = await hub(member);
  const modHub = await hub(mod);
  check('plain member is not a board manager', memberHub.canManage === false, memberHub.canManage);
  check('assigned moderator is a board manager', modHub.canManage === true, modHub.canManage);

  let r = await pin(member, 'POST');
  check('member cannot pin', r.status === 403, r.status);
  r = await pin(mod, 'POST');
  check('board moderator can pin', r.status === 200, r.status);
  const fresh = await Discussion.findOne({ id: String(disc.id) }).lean();
  check('pin persisted', fresh.pinned === true, { pinned: fresh.pinned });
  r = await pin(member, 'DELETE');
  check('member cannot unpin', r.status === 403, r.status);

  fs.writeFileSync(__dirname + '/smoke-board-gating.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-board-gating.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
