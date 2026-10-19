'use strict';
const { Book, Genre } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Collection } = require('../models/social.model');

const HEX24 = /^[0-9a-fA-F]{24}$/;

// Author lookup keyed by Book.authorId (custom string id, hex _id tolerated).
async function loadAuthors(authorIds) {
  const uniq = [...new Set((authorIds || []).map(v => String(v)).filter(Boolean))];
  if (!uniq.length) return {};
  const hex = uniq.filter(v => HEX24.test(v));
  const or = [{ id: { $in: uniq } }];
  if (hex.length) or.push({ _id: { $in: hex } });
  const users = await User.find({ $or: or }).select('id fullName username avatar').lean();
  const out = {};
  users.forEach(u => {
    const rec = { name: u.fullName || u.username || '', photo: u.avatar || '' };
    if (u.id) out[String(u.id)] = rec;
    if (u._id) out[String(u._id)] = rec;
  });
  return out;
}

// search-service contract: GET /api/search/index
async function index({ q, type, limit }) {
  const query = String(q || '').trim().slice(0, 80);
  const lim = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));
  if (!query) return { books: [], users: [], collections: [], tags: [] };
  const rx = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const out = { books: [], users: [], collections: [], tags: [] };
  if (!type || type === 'books') {
    const rows = await Book.find({ $or: [{ title: rx }, { genre: rx }] })
      .select('id title genre cover reads rating synopsis authorId').limit(lim).lean();
    const authors = await loadAuthors(rows.map(r => r.authorId));
    out.books = rows.map(b => {
      const a = authors[String(b.authorId)] || {};
      const hook = String(b.synopsis || '').split(/\n+/).map(s => s.trim()).filter(Boolean)[0] || '';
      return {
        id: b.id, title: b.title, genre: b.genre || '', cover: b.cover || '',
        reads: b.reads || 0, rating: b.rating || 0,
        author: a.name || '', authorPhoto: a.photo || '', hook: hook.slice(0, 240),
      };
    });
  }
  if (!type || type === 'users') {
    const rows = await User.find({ $or: [{ username: rx }, { fullName: rx }] })
      .select('id username fullName avatar roles').limit(lim).lean();
    out.users = rows.map(u => ({
      id: u.id, username: u.username, fullName: u.fullName, avatar: u.avatar, roles: u.roles,
      // convenience shape for flyer/author pickers
      name: u.fullName || u.username || '', handle: u.username ? '@' + u.username : '', photo: u.avatar || '',
    }));
  }
  if (!type || type === 'collections') {
    out.collections = await Collection.find({ title: rx, privacy: 'public' })
      .select('id title cover storiesCount').limit(lim).lean();
  }
  if (!type || type === 'tags') {
    out.tags = await Genre.find({ name: rx }).select('name').limit(lim).lean();
  }
  return out;
}

module.exports = { index };
