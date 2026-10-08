'use strict';
/**
 * services/awards.service.js — awards catalog + grants for the super-admin
 * awards console (documented contract: GET/POST/PUT/DELETE /api/awards,
 * user grants, run-auto-grant). Reads evaluate real platform aggregates.
 */
const { Award, UserAward } = require('../models/admin.model');
const { User } = require('../models/user.model');
const { Book } = require('../models/content.model');
const { Follow, ReadingProgress } = require('../models/social.model');

function err(status, message) { return Object.assign(new Error(message), { status }); }
function pageOf(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
function toAward(a) {
  const o = a.toJSON ? a.toJSON() : a;
  return {
    id: o.id, name: o.name, icon: o.icon, color: o.color, desc: o.desc,
    status: o.status,
    criteria: { metric: o.criteria.metric, op: o.criteria.op, value: o.criteria.value, genre: o.criteria.genre || '', period: o.criteria.period || null },
  };
}

async function list(query) {
  const { page, limit, skip } = pageOf(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.q) filter.name = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [total, rows] = await Promise.all([
    Award.countDocuments(filter),
    Award.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);
  return { items: rows.map(toAward), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
async function get(id) {
  const a = await Award.findOne({ id }).lean();
  if (!a) throw err(404, 'award_not_found');
  return toAward(a);
}
async function create(data, by) {
  const doc = await Award.create({
    name: data.name, icon: data.icon || 'fa-award', color: data.color || 'gold',
    desc: data.desc || '', status: data.status || 'draft',
    criteria: {
      metric: (data.criteria && data.criteria.metric) || 'manual',
      op: (data.criteria && data.criteria.op) || 'admin',
      value: (data.criteria && data.criteria.value) || 0,
      genre: (data.criteria && data.criteria.genre) || '',
      period: (data.criteria && data.criteria.period) || null,
    },
  });
  void by;
  return toAward(doc);
}
async function update(id, patch) {
  const a = await Award.findOne({ id });
  if (!a) throw err(404, 'award_not_found');
  ['name', 'icon', 'color', 'desc', 'status'].forEach(k => { if (patch[k] !== undefined) a[k] = patch[k]; });
  if (patch.criteria) {
    ['metric', 'op', 'value', 'genre', 'period'].forEach(k => { if (patch.criteria[k] !== undefined) a.criteria[k] = patch.criteria[k]; });
  }
  await a.save();
  return toAward(a);
}
async function remove(id) {
  const a = await Award.findOne({ id });
  if (!a) throw err(404, 'award_not_found');
  await Award.deleteOne({ id });
  await UserAward.deleteMany({ awardId: id });
  return { id, deleted: true };
}
async function holders(awardId) {
  const rows = await UserAward.find({ awardId }).sort({ grantedAt: -1 }).lean();
  return rows.map(r => ({ handle: r.handle, userId: r.userId, awardId: r.awardId, grantedAt: r.grantedAt }));
}
async function grantsForHandle(handle) {
  const rows = await UserAward.find({ handle }).sort({ grantedAt: -1 }).lean();
  const awards = await Award.find({ id: { $in: rows.map(r => r.awardId) } }).lean();
  return rows.map(r => {
    const a = awards.find(x => String(x.id) === String(r.awardId));
    return { id: r.id, handle: r.handle, awardId: r.awardId, grantedAt: r.grantedAt, award: a ? toAward(a) : null };
  });
}
async function grant(awardId, handle, by) {
  const a = await Award.findOne({ id: awardId }).lean();
  if (!a) throw err(404, 'award_not_found');
  const user = await User.findOne({ $or: [{ username: String(handle).toLowerCase() }, { id: handle }] }).lean();
  const dupe = await UserAward.findOne({ awardId, handle });
  if (dupe) return { handle, awardId, grantedAt: dupe.grantedAt, duplicate: true };
  const doc = await UserAward.create({
    awardId, handle, userId: user ? String(user.id) : null, grantedBy: by || null,
  });
  return { handle, awardId, grantedAt: doc.grantedAt, userId: doc.userId };
}
async function revoke(awardId, handle) {
  const r = await UserAward.findOneAndDelete({ awardId, handle });
  if (!r) throw err(404, 'grant_not_found');
  return { handle, awardId, revoked: true };
}

/* metric evaluation over live aggregates */
async function userStats(handle) {
  const user = await User.findOne({ $or: [{ username: String(handle).toLowerCase() }, { id: handle }] }).lean();
  if (!user) return null;
  const keys = [String(user.id), String(user._id)];
  const [books, followers, readsAgg] = await Promise.all([
    Book.find({ authorId: { $in: keys } }).select('reads rating genre').lean(),
    Follow.countDocuments({ followingId: { $in: keys } }),
    Book.aggregate([{ $match: { authorId: { $in: keys } } }, { $group: { _id: null, reads: { $sum: '$reads' }, rating: { $avg: '$rating' } } }]),
  ]);
  return {
    user, books: books.length,
    reads: (readsAgg[0] && readsAgg[0].reads) || 0,
    rating: (readsAgg[0] && readsAgg[0].rating) || 0,
    followers, genres: [...new Set(books.map(b => b.genre).filter(Boolean))],
  };
}
async function genreRank(handle, genre, period) {
  void period;
  const st = await userStats(handle);
  if (!st) return null;
  const board = await Book.aggregate([
    { $match: { genre } },
    { $group: { _id: '$authorId', reads: { $sum: '$reads' } } },
    { $sort: { reads: -1 } },
  ]);
  const keys = [String(st.user.id), String(st.user._id)];
  const rank = board.findIndex(r => keys.indexOf(String(r._id)) !== -1) + 1;
  return { rank: rank || null, of: board.length, reads: st.reads };
}
async function evaluate(awardId, handle) {
  const a = await Award.findOne({ id: awardId }).lean();
  if (!a) throw err(404, 'award_not_found');
  const c = a.criteria || {};
  if (c.metric === 'manual' || c.op === 'admin') return { awardId, handle, eligible: true, reason: 'manual' };
  const st = await userStats(handle);
  if (!st) return { awardId, handle, eligible: false, reason: 'unknown_handle' };
  if (c.metric === 'reads') return { awardId, handle, eligible: st.reads >= c.value, actual: st.reads, required: c.value };
  if (c.metric === 'books') return { awardId, handle, eligible: st.books >= c.value, actual: st.books, required: c.value };
  if (c.metric === 'followers') return { awardId, handle, eligible: st.followers >= c.value, actual: st.followers, required: c.value };
  if (c.metric === 'rating') return { awardId, handle, eligible: st.rating >= c.value, actual: +st.rating.toFixed(2), required: c.value };
  if (c.metric === 'genre_rank') {
    const r = await genreRank(handle, c.genre, c.period);
    if (!r || !r.rank) return { awardId, handle, eligible: false, reason: 'unranked' };
    if (c.op === 'top') return { awardId, handle, eligible: r.rank <= c.value, actual: r.rank, required: 'top ' + c.value };
    return { awardId, handle, eligible: r.reads >= c.value, actual: r.reads, required: c.value };
  }
  return { awardId, handle, eligible: false, reason: 'unsupported_metric' };
}
async function runAutoGrant(by) {
  const awards = await Award.find({ status: 'active' }).lean();
  const users = await User.find({ deletedAt: null, roles: 'writer' }).select('id username').lean();
  let granted = 0;
  const details = [];
  for (const a of awards) {
    const c = a.criteria || {};
    if (!c.metric || c.metric === 'manual' || c.op === 'admin') continue;
    for (const u of users) {
      const res = await evaluate(String(a.id), u.username);
      if (res.eligible) {
        const dupe = await UserAward.findOne({ awardId: String(a.id), handle: u.username });
        if (!dupe) {
          await UserAward.create({ awardId: String(a.id), handle: u.username, userId: String(u.id), grantedBy: by || null });
          granted++;
          details.push({ awardId: String(a.id), handle: u.username });
        }
      }
    }
  }
  return { granted, details };
}

module.exports = {
  list, get, create, update, remove, holders, grantsForHandle,
  grant, revoke, evaluate, runAutoGrant,
};
