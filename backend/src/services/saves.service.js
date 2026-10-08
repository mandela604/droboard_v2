'use strict';
/**
 * services/saves.service.js — implements the DroboardSaveAPI contract the
 * save-modal component expects: getSaveState / toggleQuickSave /
 * toggleCollection / createCollection, plus library add/remove/move used by
 * the library page. Quick-saves ride on LibraryItem lists:
 * library->library, fav->saved, later->later.
 */
const { LibraryItem, Collection } = require('../models/social.model');
const { Book } = require('../models/content.model');
const { assertStoryEligible } = require('./collections.service');

function err(status, message) { return Object.assign(new Error(message), { status }); }

const QUICK_KEY_TO_LIST = { library: 'library', fav: 'saved', later: 'later' };

async function quickState(userId, storyId) {
  const rows = await LibraryItem.find({ userId: String(userId), storyId: String(storyId) }).lean();
  const lists = new Set(rows.map(r => r.list));
  return { library: lists.has('library'), fav: lists.has('saved'), later: lists.has('later') };
}

async function userCollections(userId, storyId) {
  const cols = await Collection.find({ ownerId: String(userId) }).sort({ updatedAt: -1 }).lean();
  return cols.map(c => ({
    id: c.id || c._id, name: c.title, icon: c.icon || '',
    count: c.storiesCount || (c.stories || []).length,
    saved: storyId ? (c.stories || []).map(String).includes(String(storyId)) : false,
  }));
}

async function getSaveState({ userId, storyId }) {
  if (!storyId) throw err(400, 'story_required');
  const [state, collections] = await Promise.all([
    quickState(userId, storyId),
    userCollections(userId, storyId),
  ]);
  return { ok: true, state, collections };
}

async function setQuickSave({ userId, storyId, key, value }) {
  const list = QUICK_KEY_TO_LIST[key];
  if (!list) throw err(400, 'bad_key');
  if (!storyId) throw err(400, 'story_required');
  const want = value === undefined ? null : !!value;
  const existing = await LibraryItem.findOne({ userId: String(userId), storyId: String(storyId), list });
  const next = want === null ? !existing : want;
  if (next && !existing) await LibraryItem.create({ userId: String(userId), storyId: String(storyId), list });
  if (!next && existing) await existing.deleteOne();
  return { ok: true, state: await quickState(userId, storyId) };
}

async function loadCollectionOr404(userId, collId) {
  const col = await Collection.findOne({ id: collId });
  if (!col) throw err(404, 'not_found');
  if (String(col.ownerId) !== String(userId)) throw err(403, 'forbidden');
  return col;
}

async function toggleCollection({ userId, collId, storyId, value, isAdmin }) {
  if (!storyId) throw err(400, 'story_required');
  const col = await loadCollectionOr404(userId, collId);
  await assertStoryEligible({ userId, storyId, isAdmin });
  const has = (col.stories || []).map(String).includes(String(storyId));
  const next = value === undefined ? !has : !!value;
  if (next && !has) {
    col.stories = (col.stories || []).concat([String(storyId)]);
  } else if (!next && has) {
    col.stories = (col.stories || []).filter(s => String(s) !== String(storyId));
  }
  col.storiesCount = (col.stories || []).length;
  await col.save();
  return { ok: true, count: col.storiesCount, saved: next };
}

async function createCollection({ userId, name, icon, storyId, isAdmin }) {
  if (!name || !String(name).trim()) throw err(400, 'name_required');
  const stories = [];
  if (storyId !== undefined && storyId !== null && String(storyId) !== '') {
    await assertStoryEligible({ userId, storyId: String(storyId), isAdmin });
    stories.push(String(storyId));
  }
  const col = await Collection.create({
    ownerId: String(userId), title: String(name).trim().slice(0, 120),
    icon: icon || '', stories, storiesCount: stories.length,
  });
  const plain = col.toJSON();
  return { ok: true, collection: { id: plain.id, name: plain.title, icon: plain.icon || '', count: stories.length, saved: stories.length > 0 } };
}

/* library page writes (same LibraryItem store as quick-saves) */
async function addLibraryItem({ userId, storyId, list }) {
  if (!['library', 'saved', 'history', 'continue', 'later'].includes(list)) throw err(400, 'bad_list');
  const book = await Book.findOne({ id: storyId }).lean();
  if (!book) throw err(404, 'story_not_found');
  const existing = await LibraryItem.findOne({ userId: String(userId), storyId: String(storyId), list });
  if (existing) return existing.toJSON();
  const doc = await LibraryItem.create({ userId: String(userId), storyId: String(storyId), list });
  return doc.toJSON();
}
async function removeLibraryItem({ userId, storyId, list }) {
  const filter = { userId: String(userId), storyId: String(storyId) };
  if (list) filter.list = list;
  const r = await LibraryItem.deleteMany(filter);
  return { ok: true, removed: r.deletedCount || 0 };
}
async function moveLibraryItem({ userId, storyId, from, to }) {
  const valid = ['library', 'saved', 'history', 'continue', 'later'];
  if (!valid.includes(from) || !valid.includes(to)) throw err(400, 'bad_list');
  await LibraryItem.deleteMany({ userId: String(userId), storyId: String(storyId), list: from });
  const doc = await LibraryItem.findOneAndUpdate(
    { userId: String(userId), storyId: String(storyId), list: to },
    { $setOnInsert: { userId: String(userId), storyId: String(storyId), list: to } },
    { upsert: true, new: true }
  );
  return doc.toJSON();
}

module.exports = {
  getSaveState, setQuickSave, toggleCollection, createCollection,
  addLibraryItem, removeLibraryItem, moveLibraryItem, QUICK_KEY_TO_LIST,
};
