/**
 * contracts-service.js — Shared data layer for the Contracts module
 * ──────────────────────────────────────────────────────────────
 * Every function tries the real backend first and falls back to
 * demo data from ContractsDemo.
 */
(function(){
'use strict';
if(window.__contractsService) return;
window.__contractsService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/contracts';
var TIMEOUT_MS = 2500;

function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }

function getDemo(){
  if(window.ContractsDemo) return JSON.parse(JSON.stringify(window.ContractsDemo));
  return { contracts:[], templates:[], signedContracts:[] };
}

function findIn(arr, id){
  var item = arr.find(function(x){ return x.id === id || x.id === Number(id); });
  if(!item) throw new Error('Not found: ' + id);
  return item;
}

window.ContractsService = {

  /* ── Contracts ── */
  async getContracts(){
    try {
      var res = await fetch(API_BASE + '/contracts', {signal:AbortSignal.timeout(TIMEOUT_MS)});
      if(!res.ok) throw new Error(res.status);
      return await res.json();
    } catch(e){
      await delay();
      return getDemo().contracts;
    }
  },

  async getContract(id){
    await delay(100);
    var demo = getDemo();
    return findIn(demo.contracts, id);
  },

  async sendContract(payload){
    await delay(200);
    var demo = getDemo();
    var newContract = Object.assign({
      id: 'CNTR-2026-' + String(demo.contracts.length + 1).padStart(3,'0'),
      authorAv: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random()*50+1),
      status: 'awaiting',
      dateSent: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      signedDate: '—',
      replies: []
    }, payload);
    demo.contracts.unshift(newContract);
    return newContract;
  },

  async approveContract(id){
    await delay(150);
    var demo = getDemo();
    var c = findIn(demo.contracts, id);
    c.status = 'signed';
    c.signedDate = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    return c;
  },

  async rejectContract(id, note){
    await delay(150);
    var demo = getDemo();
    var c = findIn(demo.contracts, id);
    c.status = 'rejected';
    c.notes = note || c.notes;
    return c;
  },

  async replyToContract(id, message){
    await delay(150);
    var demo = getDemo();
    var c = findIn(demo.contracts, id);
    return c;
  },

  /* ── Templates ── */
  async getTemplates(){
    await delay();
    return getDemo().templates;
  },

  async getTemplate(id){
    await delay(100);
    var demo = getDemo();
    return findIn(demo.templates, id);
  },

  async createTemplate(payload){
    await delay(200);
    var demo = getDemo();
    var newTpl = Object.assign({
      id: demo.templates.length + 1,
      status: 'draft',
      updated: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
      by: 'Reina Morgan',
      clauses: 6
    }, payload);
    demo.templates.unshift(newTpl);
    return newTpl;
  },

  async updateTemplate(id, payload){
    await delay(150);
    var demo = getDemo();
    var t = findIn(demo.templates, id);
    Object.assign(t, payload);
    t.updated = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    return t;
  },

  /* ── Signed Contracts ── */
  async getSignedContracts(){
    await delay();
    return getDemo().signedContracts;
  },

  async getSignedContract(id){
    await delay(100);
    var demo = getDemo();
    return findIn(demo.signedContracts, id);
  }
};
})();
