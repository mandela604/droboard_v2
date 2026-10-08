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
  schema.add({ id: { type: String, default: uuidv7, unique: true, index: true } });
  schema.pre('validate', function (next) {
    if (!this.id) this.id = uuidv7();
    next();
  });
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

module.exports = { plugin, nanoid, uuidv7, byId, byIdLean };
