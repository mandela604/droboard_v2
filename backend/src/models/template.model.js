'use strict';
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true, unique: true },
  category: { type: String, default: 'system' },
  subject: { type: String, required: true, maxlength: 200 },
  bodyHtml: { type: String, required: true },
  bodyText: { type: String, required: true },
  active: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: false, updatedAt: true } });


const Template = mongoose.models.Template || mongoose.model('Template', templateSchema);

module.exports = { Template };
