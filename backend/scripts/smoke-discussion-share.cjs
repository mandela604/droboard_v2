'use strict';
// Hub rows are Discussion docs. Sharing them must record a real share instead
// of 404-ing because the backend looked for a Post with the same id.
process.env.NODE_ENV = 'test';
process.env.PORT = '4209';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
process.env.CORS_ORIGINS = 'http://127.0.0.1:5500';
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BASE = 'http://127.0.0.1:4209';
const out = [];
function check(name, pass, detail) {
  out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ::  ' + JSON.stringify(detail).slice(0, 220) : ''}`);
  console.log(out[out.length - 1]);
}
async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  process.env.MONGO_URI = mongod.getUri('dro_discussion_share');
  require('../src/server');
  for (let i = 0; i < 160; i++) { try { const r = await fetch(BASE + '/health'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }

  const { User } = require('../src/models/user.model');
  const { Discussion, ShareEvent } = require('../src/models/social.model');
  const { signAccess } = require('../src/middleware/auth');
  const user = await User.create({ fullName: 'Reader', email: 'r@t.co', username: 'r' + Date.now(), passwordHash: 'x', roles: ['reader'], status: 'active' });
  const disc = await Discussion.create({ genreId: 'g1', authorId: String(user.id), title: 'Trending thread', body: 'hello' });
  const tok = signAccess({ id: user.id, roles: ['reader'] });
  const hdr = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const send = (contentType, channel) => fetch(BASE + '/api/share', {
    method: 'POST', headers: hdr,
    body: JSON.stringify({ contentId: String(disc.id), contentType, channel: channel || 'whatsapp' }),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  let r = await send('discussions');
  check('discussion share returns 200 (not 404)', r.status === 200, r);
  check('discussion share count persisted', r.body.sharesCount === 1, r.body);
  check('share event stored with discussion target', !!(await ShareEvent.findOne({ targetType: 'discussion', targetId: String(disc.id) }).lean()));

  r = await send('posts', 'copy'); // legacy call sites, different channel
  check('legacy "posts" label also resolves the discussion', r.status === 200 && r.body.contentType === 'discussions', r);

  const fresh = await Discussion.findOne({ id: String(disc.id) }).lean();
  check('both shares incremented the stored counter', fresh.sharesCount === 2, { sharesCount: fresh.sharesCount });

  fs.writeFileSync(__dirname + '/smoke-discussion-share.results.txt', out.join('\n') + '\n');
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
main().catch(e => { console.error(e); fs.writeFileSync(__dirname + '/smoke-discussion-share.results.txt', 'FATAL ' + (e.stack || e)); process.exit(1); });
