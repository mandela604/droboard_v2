'use strict';
/* Throwaway: proves the audience catalogue's genre list is the Chief Editor's
   Genre collection, not a hardcoded array. Stubs every model the service
   touches; no Mongo, no network. */
process.env.MONGO_URI = 'mongodb://localhost/x';
process.env.JWT_ACCESS_SECRET = 'a'; process.env.JWT_REFRESH_SECRET = 'r'; process.env.MFA_SECRET_KEY = 'm';

const path = require('path');
const Module = require('module');
const SRC = path.join(__dirname, '..', 'src');

function chain(rows) {
  const c = {
    lean: () => Promise.resolve(rows),
    select: () => c, sort: () => c, limit: () => c, skip: () => c,
    then: (res, rej) => Promise.resolve(rows).then(res, rej),
  };
  return c;
}
function model(rowsByCall) {
  const m = {
    find: () => chain(rowsByCall.find || []),
    findOne: () => chain(rowsByCall.findOne || null),
    countDocuments: () => Promise.resolve(rowsByCall.count || 0),
    aggregate: () => Promise.resolve(rowsByCall.aggregate || []),
    updateOne: () => Promise.resolve({}),
    exists: () => Promise.resolve(null),
  };
  return m;
}

const DATA = {
  genre: [
    { name: 'Romance' }, { name: 'Afro Fantasy' }, { name: 'Mafia & Urban' }, { name: 'Campus & Revenge' },
  ],
  book: [
    { id: 'B1', genre: 'romance' },   // lower-case: must merge into "Romance"
    { id: 'B2', genre: 'Romance' },
    { id: 'B3', genre: 'Afro Fantasy' },
    { id: 'B4', genre: 'Gritty Noir' }, // not in the CE catalogue
  ],
  reading: [
    { _id: { u: 'u1', s: 'B1' } }, { _id: { u: 'u2', s: 'B2' } },
    { _id: { u: 'u1', s: 'B3' } }, { _id: { u: 'u3', s: 'B4' } },
  ],
};

const stubs = {
  '../models/user.model': { User: model({ find: [{ _id: 'u1' }, { _id: 'u2' }, { _id: 'u3' }], count: 3 }) },
  '../models/content.model': {
    Book: model({ find: DATA.book }),
    Category: model({ find: [] }),
    Genre: model({ find: DATA.genre }),
    Trope: model({ find: [] }),
  },
  '../models/social.model': {
    Comment: model({}), Follow: model({}), LibraryItem: model({}),
    ReadingProgress: model({ aggregate: DATA.reading }), Referral: model({}),
    Reaction: model({}), ShareEvent: model({}),
  },
  '../models/money.model': { LedgerEntry: model({}), CoinTransaction: model({}), Subscription: model({}) },
  '../models/platform.model': { AdClick: model({}) },
  '../models/marketing.model': { AudienceConfig: model({ findOne: null }) },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename && parent.filename.startsWith(SRC) && stubs[request]) {
    return stubs[request];
  }
  return origLoad.apply(this, arguments);
};

const svc = require(path.join(SRC, 'services', 'audience.service.js'));

let pass = 0, fail = 0;
function check(name, cond, got) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '  got=' + JSON.stringify(got)); }
}

(async () => {
  const cat = await svc.catalog();
  const g = {};
  cat.genres.forEach(x => { g[x.name] = x.count; });
  console.log('catalog.genres =', JSON.stringify(cat.genres));

  check('only CE-created genres', cat.genres.length === DATA.genre.length, cat.genres.length);
  check('genre with no readers still targets', g['Campus & Revenge'] === 0, g['Campus & Revenge']);
  check('book genre casing merges', g['Romance'] === 2, g['Romance']);
  check('genre the CE never created is absent', g['Gritty Noir'] === undefined, g['Gritty Noir']);
  check('Afro Fantasy counted', g['Afro Fantasy'] === 1, g['Afro Fantasy']);
  check('sorted by reach desc', cat.genres[0].count >= cat.genres[cat.genres.length - 1].count, cat.genres.map(x => x.count));
  check('totalReaders is real', cat.totalReaders === 3, cat.totalReaders);
  check('no hardcoded 13-name demo list', !cat.genres.some(x => x.name === 'Heartbreak & Elegy'), cat.genres.map(x => x.name));

  const est = await svc.estimate({ genres: ['Romance', 'Campus & Revenge'] });
  check('estimate reads catalogue counts', est && est.reach > 0 && est.reach <= cat.totalReaders, est);

  console.log('\npassed ' + pass + ' / failed ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(1); });
