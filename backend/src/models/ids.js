/**
 * models/ids.js — custom public ID.
 * Mongo `_id` stays as the internal ObjectId (untouched).
 * Every document also carries our own `id` (stored string, uuidv7),
 * and ALL CRUD uses `id` — never `_id`.
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function nanoid(n) {
  const bytes = crypto.randomBytes(n || 12);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

// UUIDv7 (time-ordered): 48-bit millis + version/variant + 74 random bits.
function uuidv7() {
  const ms = Date.now();
  const b = crypto.randomBytes(10);
  const hi = Math.floor(ms / 4294967296);
  const lo = ms >>> 0;
  const bytes = Buffer.alloc(16);
  bytes.writeUInt32BE(hi, 0);
  bytes.writeUInt32BE(lo, 4);
  b.copy(bytes, 6);
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const h = bytes.toString('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

function plugin(schema) {
  // Do NOT touch _id — it stays ObjectId.
  // Stored custom id: every doc gets id = uuidv7().
  //
  // No `unique`/`index` HERE. This plugin is registered globally
  // (config/db.js), and global plugins also run on nested subdocument schemas,
  // so `unique: true` here used to mint indexes like `poll.opts.id_1` on the
  // chapters collection. Every parent doc without that array then indexed
  // `null` and the second one died with E11000 — a chapter with no poll could
  // not be saved. The unique index on `id` is created per model instead, in
  // ensureIdIndexes() below, which only ever sees real collections.
  schema.add({ id: { type: String, default: uuidv7 } });
  // Insert-time only. A document loaded with a projection that excludes `id`
  // has this.id undefined, and minting a replacement on save() then rewrote the
  // user's public id — silently orphaning every stored reference (authorId,
  // wallet userId, follow rows) and invalidating live token subjects.
  schema.pre('validate', function (next) {
    if (!this.id && this.isNew) this.id = uuidv7();
    next();
  });
  // Upserts apply no schema defaults, and `id` is unique — so a bare
  // updateOne(..., { upsert: true }) inserts its first row and kills the second
  // distinct one with E11000 dup key { id: null }. Because tracking writes swallow
  // errors, that looked like a tracker that simply stopped recording. Minting the
  // id here covers every upsert in the app instead of one call site at a time.
  function mintUpsertId() {
    const opts = this.options || (this.getOptions && this.getOptions()) || {};
    if (!opts.upsert) return;
    const update = this.getUpdate();
    if (!update || typeof update !== 'object' || Array.isArray(update)) return;
    const hasId = update.id
      || (update.$set && update.$set.id)
      || (update.$setOnInsert && update.$setOnInsert.id);
    if (hasId) return;
    update.$setOnInsert = Object.assign({}, update.$setOnInsert, { id: uuidv7() });
  }
  ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach(hook => schema.pre(hook, mintUpsertId));

  const prev = (schema.options.toJSON && schema.options.toJSON.transform) || null;
  schema.set('toJSON', {
    virtuals: false,
    transform: function (doc, ret) {
      // Keep custom id, hide internals. Legacy docs without id fall back to _id string.
      if (!ret.id && ret._id) ret.id = String(ret._id);
      if (ret.id) ret.id = String(ret.id);
      delete ret._id;
      delete ret.__v;
      if (prev) prev(doc, ret);
      return ret;
    },
  });
}

// CRUD helpers — always query by custom `id`, never `_id`.
function byId(Model, id, ...rest) {
  return Model.findOne({ id: String(id) }, ...rest);
}
function byIdLean(Model, id, ...rest) {
  return Model.findOne({ id: String(id) }, ...rest).lean();
}

// The global plugin cannot tell a model schema from a subdocument schema, so
// the unique index on `id` is created here instead — after every model is
// registered, against real collections only. Idempotent; never drops the other
// indexes a schema declared.
async function ensureIdIndexes() {
  const mongoose = require('mongoose');
  const names = mongoose.modelNames().filter(n => {
    const s = mongoose.model(n).schema;
    return s.path('id') && !s.path('id').options.unique;
  });
  await Promise.all(names.map(n =>
    mongoose.model(n).collection.createIndex({ id: 1 }, { unique: true, background: true })));
  return names;
}

module.exports = { plugin, nanoid, uuidv7, byId, byIdLean, ensureIdIndexes };
