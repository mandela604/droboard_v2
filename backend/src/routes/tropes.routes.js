'use strict';
/* Public trope catalog for hub pills + book forms.
   Managed in the CE module (chief tropes CRUD); this is the read side. */
const { z } = require('zod');
const { validate, generalLimiter } = require('../middleware/http');
const { Trope } = require('../models/content.model');
const { Book } = require('../models/content.model');
const base = require('../controllers/base.controller');

function Router() { return require('express').Router(); }
const router = Router();

router.get('/', generalLimiter,
  validate(z.object({
    query: z.object({
      genre: z.string().max(40).optional(), q: z.string().max(80).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      page: z.string().max(6).optional(), limit: z.string().max(6).optional(),
    }).strict(),
  })), async (req, res) => base.wrap(res, async () => {
    const q = req.valid.query;
    const filter = { status: q.status || 'active' };
    if (q.genre) filter.genre = q.genre;
    if (q.q) filter.name = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const pg = Math.max(1, parseInt(q.page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 50));
    const [items, total] = await Promise.all([
      Trope.find(filter).sort({ name: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
      Trope.countDocuments(filter),
    ]);
    const names = items.map(t => t.name);
    const counts = names.length ? await Book.aggregate([
      { $match: { tropes: { $in: names } } },
      { $unwind: '$tropes' },
      { $match: { tropes: { $in: names } } },
      { $group: { _id: '$tropes', n: { $sum: 1 } } },
    ]) : [];
    const cmap = {};
    counts.forEach(c => { cmap[c._id] = c.n; });
    return {
      items: items.map(t => ({ id: t.id, name: t.name, slug: t.slug, genre: t.genre, status: t.status, booksCount: cmap[t.name] || 0 })),
      total, page: pg, limit: lim,
    };
  }));

module.exports = router;
