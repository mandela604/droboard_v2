'use strict';
// Report hydration: the reports console (reports-table.js) renders
// storyTitle / cover / author / chapter / seName / reporter / date, none of
// which live on the Report document — join them here so both the chief and
// senior dashboards get fully-renderable rows.
const { Book, Chapter } = require('../models/content.model');
const { User } = require('../models/user.model');

const HEX24 = /^[0-9a-fA-F]{24}$/;

// { id: { name, avatar } } for a list of User custom-ids.
async function peopleById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await User.find({ id: { $in: uniq } })
    .select('id username fullName name avatar').lean();
  const out = {};
  for (const u of rows) {
    out[String(u.id)] = u.fullName || u.name || u.username || '';
  }
  return out;
}

// { id: Book } for Book custom-ids (uuidv7 strings).
async function booksById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await Book.find({ id: { $in: uniq } })
    .select('id title authorId cover genre').lean();
  const out = {};
  for (const b of rows) out[String(b.id)] = b;
  return out;
}

// Chapter has NO custom id field — chapterId refs are the Mongo _id hex.
async function chaptersById(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const hex = uniq.filter(v => HEX24.test(v));
  const rows = hex.length
    ? await Chapter.find({ _id: { $in: hex } }).select('bookId n title').lean()
    : [];
  const out = {};
  for (const c of rows) out[String(c._id)] = c;
  return out;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// rows: lean() Report docs → plain objects with the fields the console renders.
async function hydrateReports(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows || [];

  const bookMap = await booksById(rows.map(r => r.storyId));
  const chMap = await chaptersById(rows.map(r => r.chapterId));
  const people = await peopleById(rows.reduce((acc, r) => {
    acc.push(r.seId, r.resolvedBy);
    const b = bookMap[String(r.storyId)];
    if (b) acc.push(b.authorId);
    return acc;
  }, []));

  return rows.map(r => {
    const book = bookMap[String(r.storyId)] || null;
    const ch = chMap[String(r.chapterId)] || null;
    const seName = r.seId ? (people[String(r.seId)] || '') : '';
    const resolved = r.resolvedBy ? (people[String(r.resolvedBy)] || String(r.resolvedBy)) : '';
    return Object.assign({}, r, {
      storyTitle: (book && book.title) || r.title || '',
      cover: (book && book.cover) || '',
      authorId: (book && book.authorId) || '',
      author: book && people[String(book.authorId)] ? people[String(book.authorId)] : '',
      chapter: ch ? 'Chapter ' + ch.n : (book ? 'Entire story' : ''),
      chN: ch ? ch.n : 1,
      seName,
      reporter: r.reporterLabel || '',
      resolvedBy: resolved,
      date: fmtDate(r.filedAt),
    });
  });
}

module.exports = { hydrateReports };
