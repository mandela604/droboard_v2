// backend/src/services/templates.service.js
'use strict';
const { z } = require('zod');
const { Template } = require('../models/template.model');

const createSchema = () => z.object({
  name: z.string().min(1).max(64),
  category: z.string().min(1).max(64).optional(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  bodyText: z.string().min(1),
});

const updateSchema = () => z.object({
  subject: z.string().min(1).max(200).optional(),
  bodyHtml: z.string().min(1).optional(),
  bodyText: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

async function list({ category, limit }) {
  const filter = category ? { category } : {};
  const items = await Template.find(filter).sort({ updatedAt: -1 }).limit(limit || 50);
  return { items };
}

async function create(data) {
  const t = await Template.create({
    name: data.name,
    category: data.category || '',
    subject: data.subject,
    bodyHtml: data.bodyHtml || '', // auto-generated rich HTML
    bodyText: data.bodyText || '', // plain-text fallback
    active: true
  });
  return { ok: true, id: t._id };
}

async function update(id, data) {
  const updateData = {};
  if ('subject' in data) updateData.subject = data.subject;
  if ('bodyHtml' in data) updateData.bodyHtml = data.bodyHtml;
  if ('bodyText' in data) updateData.bodyText = data.bodyText;
  if (typeof data.active === 'boolean') updateData.active = data.active;

  await Template.updateOne({ _id: id }, { $set: updateData, updatedAt: new Date() });
  return { ok: true };
}

async function deleteTemplate(id) {
  await Template.deleteOne({ _id: id });
  return { ok: true };
}

async function getByName(name) {
  return await Template.findOne({ name, active: true }).lean();
}

async function getByCategory(category) {
  return await Template.find({ category }).sort({ updatedAt: -1 }).lean();
}

module.exports = {
  list,
  create,
  update,
  delete: deleteTemplate,
  getByName,
  getByCategory,
  createSchema,
  updateSchema
};
