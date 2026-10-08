'use strict';
const { Book, Genre } = require('../models/content.model');
const { User } = require('../models/user.model');
const { Collection } = require('../models/social.model');

// search-service contract: GET /api/search/index
async function index({ q, type, limit }) {
  const query = String(q || '').trim().slice(0, 80);
  const lim = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));
  if (!query) return { books: [], users: [], collections: [], tags: [] };
  const rx = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const out = { books: [], users: [], collections: [], tags: [] };
  if (!type || type === 'books') {
    out.books = await Book.find({ $or: [{ title: rx }, { genre: rx }] })
      .select('title genre cover reads rating').limit(lim).lean();
  }
  if (!type || type === 'users') {
    out.users = await User.find({ $or: [{ username: rx }, { fullName: rx }] })
      .select('username fullName avatar roles').limit(lim).lean();
  }
  if (!type || type === 'collections') {
    out.collections = await Collection.find({ title: rx, privacy: 'public' })
      .select('title cover storiesCount').limit(lim).lean();
  }
  if (!type || type === 'tags') {
    out.tags = await Genre.find({ name: rx }).select('name').limit(lim).lean();
  }
  return out;
}

module.exports = { index };
