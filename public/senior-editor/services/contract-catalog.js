/**
 * contract-catalog.js — the contract offers a senior editor can send.
 * Source of truth is the chief editor's active contract templates; the demo
 * list below is only used when the backend has none to show.
 *
 * Item shape (both sources):
 *   { id, label, detail, type, term, rev }
 *   `id` is the chief editor's template id — the only thing an offer sends.
 *   Everything else is display: `type` is the chief editor's own category.
 */
(function(){
'use strict';
if(window.ContractCatalog) return;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor';
var DEMO = [
  { id:'standard',  label:'Standard Royalty Contract', detail:'60/40 author-platform split · non-exclusive', type:'Royalty Share', term:'12 months', rev:'60/40' },
  { id:'premium',   label:'Premium Exclusive Contract', detail:'70/30 author-platform split · exclusive',     type:'Exclusive',     term:'12 months', rev:'70/30' },
  { id:'flex',      label:'Flex Starter Contract',      detail:'50/50 split · month-to-month',                type:'Non-Exclusive', term:'1 month',   rev:'50/50' },
  { id:'revenue',   label:'Revenue Share Agreement',    detail:'65/35 split · shared revenue',                type:'Revenue Share', term:'12 months', rev:'65/35' },
  { id:'licensing', label:'Licensing Agreement',        detail:'55/45 split · licensed rights',               type:'License',       term:'9 months',  rev:'55/45' },
];
var live = false;
var cache = null;

function split(rate){
  if(rate == null || isNaN(rate)) return '—';
  var r = Math.max(0, Math.min(100, Math.round(rate)));
  return r + '/' + (100 - r);
}
function fromTemplate(t){
  var rev = split(t.royaltyRate);
  return {
    id: t.id,
    label: t.name,
    type: t.type || '',
    detail: t.desc ||
      ((rev === '—' ? 'Split set by chief editor' : rev + ' author-platform split') +
        (t.termLength ? ' · ' + t.termLength : '')),
    term: t.termLength || '—',
    rev: rev,
  };
}
function authHeaders(){
  var h = { 'Accept': 'application/json' };
  try{ var t = localStorage.getItem('dro_access_token'); if(t) h.Authorization = 'Bearer ' + t; }catch(e){}
  return h;
}
function getJson(url){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, 2500);
  return fetch(url, { credentials:'include', headers:authHeaders(), signal:ctrl.signal }).then(function(res){
    clearTimeout(timer);
    if(!res.ok) throw new Error(String(res.status));
    return res.json();
  }).catch(function(e){ clearTimeout(timer); throw e; });
}
async function fetchLive(){
  var items = [], page = 1, total = Infinity;
  while(items.length < total && page <= 4){
    var d = await getJson(API_BASE + '/contract-templates?limit=50&page=' + page);
    var rows = (d && d.items) || (Array.isArray(d) ? d : []);
    total = (d && typeof d.total === 'number') ? d.total : rows.length;
    items = items.concat(rows);
    if(!rows.length) break;
    page++;
  }
  return items.filter(function(t){ return t && t.status === 'active'; }).map(fromTemplate);
}
function load(){
  if(cache) return Promise.resolve(cache);
  return fetchLive().then(function(items){
    if(!items.length) throw new Error('no active templates');
    live = true;
    cache = { items: items, live: true };
    return cache;
  }).catch(function(){
    live = false;
    cache = { items: DEMO.map(function(d){ return Object.assign({}, d); }), live: false };
    return cache;
  });
}
window.ContractCatalog = {
  load: load,
  isLive: function(){ return live; },
  reset: function(){ cache = null; live = false; },
};
})();
