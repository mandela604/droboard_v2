'use strict';
const { Contract, ContractTemplate } = require('../models/contract.model');
const { User } = require('../models/user.model');

function err(msg, status) { const e = new Error(msg); e.status = status; throw e; }

function paging(query) {
  const pg = Math.max(1, parseInt(query.page, 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { pg, lim };
}

// Contract.authorId is a plain String ref, so attach the author name manually.
async function withAuthors(items) {
  const ids = Array.from(new Set(items.map(c => String(c.authorId)).filter(Boolean)));
  const users = await User.find({ id: { $in: ids } }).select('id fullName username').lean().catch(() => []);
  const byId = {};
  users.forEach(u => { byId[String(u.id)] = u.fullName || u.username || ''; });
  return items.map(c => Object.assign({}, c, { author: { id: c.authorId, name: byId[String(c.authorId)] || '' } }));
}

async function pagedContracts(filter, pg, lim) {
  const [items, total] = await Promise.all([
    Contract.find(filter).sort({ updatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Contract.countDocuments(filter),
  ]);
  return { items: await withAuthors(items), total, page: pg, limit: lim };
}

// ---- Templates (status enum: active|draft|paused|archived) ----
// Frontend pause/activate mapping: pause -> paused (a distinct console state,
// still hidden from the offer picker which lists active only), activate ->
// active. `draft` is the pre-publish state, `archived` is soft-delete-by-admin.
async function listTemplates({ page, limit }) {
  const { pg, lim } = paging({ page, limit });
  const [items, total] = await Promise.all([
    ContractTemplate.find({}).sort({ updatedAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    ContractTemplate.countDocuments({}),
  ]);
  return { items, total, page: pg, limit: lim };
}

async function createTemplate(data, userId) {
  const doc = await ContractTemplate.create(Object.assign({}, data, { updatedBy: userId }));
  return doc.toJSON();
}

async function getTemplate(id) {
  const doc = await ContractTemplate.findOne({id: id}).lean();
  if (!doc) err('not_found', 404);
  return doc;
}

async function updateTemplate(id, data, userId) {
  const doc = await ContractTemplate.findOne({id: id});
  if (!doc) err('not_found', 404);
  ['name', 'desc', 'type', 'status', 'clauses', 'clauseText', 'body', 'preview',
    'royaltyRate', 'termLength', 'signupBonusMin', 'signupBonusMax',
    'completionTarget', 'completionWindowMonths', 'profitShareThreshold', 'profitShareBonus',
    'autoRenew', 'usageCount', 'defaultChapterPrice', 'cfHidden', 'cfLabels'].forEach(k => {
    if (data[k] !== undefined) doc[k] = data[k];
  });
  doc.updatedBy = userId;
  await doc.save();
  return doc.toJSON();
}

async function deleteTemplate(id) {
  const doc = await ContractTemplate.findOne({id: id});
  if (!doc) err('not_found', 404);
  await doc.deleteOne();
  return { ok: true };
}

async function pauseTemplate(id, userId) {
  const doc = await ContractTemplate.findOne({id: id});
  if (!doc) err('not_found', 404);
  doc.status = 'paused'; // pause mapping: see header comment
  doc.updatedBy = userId;
  await doc.save();
  return doc.toJSON();
}

async function activateTemplate(id, userId) {
  const doc = await ContractTemplate.findOne({id: id});
  if (!doc) err('not_found', 404);
  doc.status = 'active';
  doc.updatedBy = userId;
  await doc.save();
  return doc.toJSON();
}

// ---- Author contracts ----
async function listContracts({ page, limit }) {
  const { pg, lim } = paging({ page, limit });
  return pagedContracts({}, pg, lim);
}

async function activeContracts({ page, limit }) {
  const { pg, lim } = paging({ page, limit });
  return pagedContracts({ status: 'active' }, pg, lim);
}

async function pendingOffers({ page, limit }) {
  const { pg, lim } = paging({ page, limit });
  return pagedContracts({ status: { $in: ['pending', 'sent'] } }, pg, lim);
}

// Contract schema has no template FK: the template is validated (must exist)
// and its terms are copied onto the offer; the source is noted in replies.
async function createOffer({ authorId, templateId, value, type, bookId, editorId }) {
  const tpl = await ContractTemplate.findOne({id: templateId}).lean();
  if (!tpl) err('template_not_found', 404);
  const doc = await Contract.create({
    authorId,
    bookId: bookId || undefined,
    type: type || 'Exclusive_Publishing',
    status: 'pending',
    advance: value !== undefined ? value : 0,
    editorId,
    replies: [{ from: String(editorId || 'chief'), message: 'offer from template: ' + tpl.name }],
  });
  return doc.toJSON();
}

async function loadContractOr404(id) {
  const doc = await Contract.findOne({id: id});
  if (!doc) err('not_found', 404);
  return doc;
}

// Legal guards: approve only from sent; sign only from approved (platform
// countersign). Step-up MFA (requireFreshMfa) is a follow-up, not enforced here.
async function approveContract(id) {
  const doc = await loadContractOr404(id);
  if (doc.status !== 'sent') err('only_sent_can_be_approved', 409);
  doc.status = 'approved';
  await doc.save();
  return doc.toJSON();
}

async function signContract(id, userId) {
  const doc = await loadContractOr404(id);
  if (doc.status !== 'approved') err('only_approved_can_be_signed', 409);
  doc.status = 'signed';
  doc.signedAt = new Date();
  doc.signatures.push({ by: String(userId), role: 'editor', at: new Date() });
  await doc.save();
  return doc.toJSON();
}

async function rejectContract(id, reason) {
  const doc = await loadContractOr404(id);
  if (!['pending', 'sent', 'approved'].includes(doc.status)) err('cannot_reject_in_current_state', 409);
  doc.status = 'rejected';
  if (reason) doc.replies.push({ from: 'chief', message: reason });
  await doc.save();
  return doc.toJSON();
}

module.exports = {
  listTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate, pauseTemplate, activateTemplate,
  listContracts, activeContracts, pendingOffers, createOffer, approveContract, signContract, rejectContract,
};
