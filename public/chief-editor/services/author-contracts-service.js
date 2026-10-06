/**
 * author-contracts-service.js — Call-and-render service for Author Contracts page
 * Migrated from author-contracts.html inline script. Backend-ready.
 */
(function(){
'use strict';
if(window.__authorContractsService) return;
window.__authorContractsService = true;

/* ── Backend-ready header ── */
var USE_API = false;
var API_BASE = window.DROBOARD_API_BASE || '/api/chief-editor';
var TIMEOUT_MS = 2500;
async function callBackend(path, opts){
  if(!USE_API) return null;
  return timeoutFetch(API_BASE + path, opts);
}
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }

var _acInitDone = false;
async function init(){
  if(_acInitDone) return;
  _acInitDone = true;

  const shell = ChiefEditorSidebar.attach('#contractsRoot',{activeItem:'author-contracts',title:'Author Contracts',subtitle:'Manage contracts & offers',user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:6});
  var d = null;
  try{ d = await callBackend('/author-contracts'); }catch(e){ d = null; }
  if(!d){
    d = await ChiefEditorData.getAuthorContracts();
  }
  document.getElementById('templatesTable').querySelector('tbody').innerHTML = d.templates.map(t => `
    <tr><td><strong>${t.name}</strong></td><td><span class="status-pill ${t.type}">${t.type}</span></td><td>${t.royalty}%</td><td>${t.defaultChapterPrice} coins</td><td>${t.term}</td><td>${t.used}</td><td><span class="status-pill ${t.status}">${t.status}</span></td></tr>`).join('');
  document.getElementById('activeContracts').innerHTML = d.activeContracts.map(c => `
    <div class="contract-card"><div class="cc-name">${c.author} <span class="status-pill ${c.status}">${c.status}</span></div><div class="cc-meta"><span>📄 ${c.template}</span><span>💰 ${c.value}</span><span>📅 ${c.start} — ${c.end}</span></div></div>`).join('');
  document.getElementById('pendingOffers').innerHTML = d.pendingOffers.map(o => `
    <div class="contract-card"><div class="cc-name">${o.author} <span class="status-pill ${o.status}">${o.status}</span></div><div class="cc-meta"><span>📄 ${o.template}</span><span>💰 ${o.value}</span><span>📅 Sent: ${o.sent}</span></div></div>`).join('');
}

window.AuthorContractsService = { init: init };
})();
