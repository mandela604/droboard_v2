/**
 * disputes-appeals-service.js — Call-and-render service for Disputes & Appeals page
 * Migrated from disputes-appeals.html inline script. Backend-ready.
 */
(function(){
'use strict';
if(window.__disputesAppealsService) return;
window.__disputesAppealsService = true;

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

var _daInitDone = false;
async function init(){
  if(_daInitDone) return;
  _daInitDone = true;

  const shell = ChiefEditorSidebar.attach('#disputesRoot',{activeItem:'disputes-appeals',title:'Disputes & Appeals',subtitle:'Resolve conflicts & appeals',user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:6});
  var d = null;
  try{ d = await callBackend('/disputes-appeals'); }catch(e){ d = null; }
  if(!d){
    d = await ChiefEditorData.getDisputesAppeals();
  }
  document.getElementById('appealsList').innerHTML = d.authorAppeals.map(a => `
    <div class="case-card"><div class="cc-title">${a.author} — ${a.type} <span class="prio-pill ${a.priority}">${a.priority}</span><span class="status-pill ${a.status}">${a.status}</span></div><div class="cc-detail">${a.detail}</div><div class="cc-meta"><span>📅 ${a.filed}</span><span>🆔 ${a.id}</span></div></div>`).join('');
  document.getElementById('copyrightList').innerHTML = d.copyrightDisputes.map(c => `
    <div class="case-card"><div class="cc-title">${c.title} <span class="status-pill ${c.status}">${c.status}</span></div><div class="cc-meta"><span>👤 ${c.claimant} vs ${c.respondent}</span><span>📅 ${c.filed}</span>${c.resolution?`<span>✅ ${c.resolution}</span>`:''}</div></div>`).join('');
  document.getElementById('plagiarismList').innerHTML = d.plagiarismCases.map(p => `
    <div class="case-card"><div class="cc-title">"${p.story}" <span class="status-pill ${p.status}">${p.status}</span></div><div class="cc-meta"><span>👤 ${p.accused}</span><span>📅 ${p.filed}</span><span>🔍 ${p.confidence}% confidence</span></div></div>`).join('');
  document.getElementById('reportsList').innerHTML = d.escalatedReports.map(r => `
    <div class="case-card"><div class="cc-title">${r.type} <span class="prio-pill ${r.priority}">${r.priority}</span><span class="status-pill ${r.status}">${r.status}</span></div><div class="cc-meta"><span>📅 ${r.filed}</span><span>👤 ${r.reporter} → ${r.against}</span></div></div>`).join('');
  document.getElementById('historyList').innerHTML = d.resolutionHistory.map(h => `
    <div class="case-card" style="margin-bottom:6px;padding:10px"><div style="font-size:12px">${h.action}</div><div class="cc-meta"><span>📅 ${h.date}</span><span>✍️ ${h.by}</span></div></div>`).join('');
}

window.DisputesAppealsService = { init: init };
})();
