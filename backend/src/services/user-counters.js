'use strict';
/**
 * services/user-counters.js — the denormalized activity counters stored on User.
 *
 * A page of profiles used to aggregate Follow/Post/Comment once per render to
 * fill in the follower/post/comment numbers; at console table sizes that is four
 * collection passes per page. Each counter is instead $inc'd by the write that
 * actually created or destroyed the row it counts, so reads cost nothing.
 *
 * Callers must only pass rows the write confirmed it touched (a created doc or a
 * deletedCount), otherwise a retry or a no-op unfollow moves the number twice.
 */
const { User } = require('../models/user.model');

const FIELDS = ['followerCount', 'followingCount', 'postCount', 'commentCount'];

function accumulate(d, uid, field, n) {
  if (uid === undefined || uid === null || uid === '') return;
  const k = String(uid);
  if (!d[k]) d[k] = {};
  d[k][field] = (d[k][field] || 0) + n;
}

async function apply(deltas) {
  const ops = [];
  Object.keys(deltas || {}).forEach((uid) => {
    const inc = {};
    FIELDS.forEach((f) => {
      const v = Math.trunc(Number(deltas[uid][f]) || 0);
      if (v) inc[f] = v;
    });
    if (Object.keys(inc).length) {
      ops.push({ updateOne: { filter: { id: String(uid) }, update: { $inc: inc } } });
    }
  });
  if (!ops.length) return 0;
  const r = await User.bulkWrite(ops);
  return r.modifiedCount || 0;
}

// One user, one field.
function bump(userId, field, delta) {
  const d = {};
  accumulate(d, userId, field, delta);
  return apply(d);
}

// Rows that each carry an author: fold into a single $inc per author.
function bumpByAuthor(rows, field, delta) {
  const d = {};
  (rows || []).forEach((r) => {
    if (r) accumulate(d, r.authorId != null ? r.authorId : r.userId, field, delta);
  });
  return apply(d);
}

// A follow edge is one follower on the target and one following on the source.
function followDeltas(edges, sign) {
  const d = {};
  (edges || []).forEach((e) => {
    if (!e) return;
    accumulate(d, e.followingId, 'followerCount', sign);
    accumulate(d, e.followerId, 'followingCount', sign);
  });
  return apply(d);
}

module.exports = {
  FIELDS,
  bump,
  bumpByAuthor,
  hookFollows: (edges) => followDeltas(edges, 1),
  unhookFollows: (edges) => followDeltas(edges, -1),
};
