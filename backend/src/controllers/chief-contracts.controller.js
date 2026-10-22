'use strict';
const svc = require('../services/chief-contracts.service');
const surfaces = require('../services/chief-surfaces.service');
const base = require('./base.controller');

async function listTemplates(req, res) {
  return base.wrap(res, async () => svc.listTemplates(req.valid.query));
}

// Console read contract: bare array (contracts-payments-service.js:23-25).
// `/author-contracts/templates` keeps the canonical {items,total,page,limit}.
async function consoleTemplates(req, res) {
  return base.wrap(res, async () => surfaces.contractTemplates(req.valid.query));
}

async function createTemplate(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createTemplate(req.valid.body, req.user.id);
    res.status(201);
    return out;
  });
}

async function getTemplate(req, res) {
  return base.wrap(res, async () => svc.getTemplate(req.valid.params.id));
}

async function updateTemplate(req, res) {
  return base.wrap(res, async () => svc.updateTemplate(req.valid.params.id, req.valid.body, req.user.id));
}

async function deleteTemplate(req, res) {
  return base.wrap(res, async () => svc.deleteTemplate(req.valid.params.id));
}

async function pauseTemplate(req, res) {
  return base.wrap(res, async () => svc.pauseTemplate(req.valid.params.id, req.user.id));
}

async function activateTemplate(req, res) {
  return base.wrap(res, async () => svc.activateTemplate(req.valid.params.id, req.user.id));
}

// Console read contract: {templates, activeContracts, pendingOffers}
// (author-contracts-service.js:36,38,40). The canonical paged list stays
// available via GET /author-contracts/{templates,active,pending-offers}.
async function listContracts(req, res) {
  return base.wrap(res, async () => surfaces.authorContractsComposite(req.valid.query));
}

async function activeContracts(req, res) {
  return base.wrap(res, async () => svc.activeContracts(req.valid.query));
}

async function pendingOffers(req, res) {
  return base.wrap(res, async () => svc.pendingOffers(req.valid.query));
}

async function createOffer(req, res) {
  return base.wrap(res, async () => {
    const out = await svc.createOffer(Object.assign({}, req.valid.body, { editorId: req.user.id }));
    res.status(201);
    return out;
  });
}

async function signContract(req, res) {
  return base.wrap(res, async () => svc.signContract(req.valid.params.id, req.user.id));
}

async function approveContract(req, res) {
  return base.wrap(res, async () => svc.approveContract(req.valid.params.id));
}

async function rejectContract(req, res) {
  return base.wrap(res, async () => svc.rejectContract(req.valid.params.id, req.valid.body && req.valid.body.reason));
}

module.exports = {
  listTemplates, consoleTemplates, createTemplate, getTemplate, updateTemplate, deleteTemplate, pauseTemplate, activateTemplate,
  listContracts, activeContracts, pendingOffers, createOffer, signContract, approveContract, rejectContract,
};
