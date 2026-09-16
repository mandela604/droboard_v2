/**
 * editors-picks-service.js — Data layer for Editor's Picks page
 * Reads from window.EditorDemo.EDITORS_PICKS / window.EditorDemo.EDITORS_PICKS_LOG
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__editorsPicksService) return;
window.__editorsPicksService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/editors-picks';
var TIMEOUT_MS = 2500;
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

var _picks = [];
var _log = [];

function loadFromDemo(){
  var D = window.EditorDemo || {};
  _picks = JSON.parse(JSON.stringify(D.EDITORS_PICKS || []));
  _log = JSON.parse(JSON.stringify(D.EDITORS_PICKS_LOG || []));
}
loadFromDemo();

function picks(){ return _picks; }
function log(){ return _log; }

function activePicks(){ return _picks.filter(function(p){ return p.active; }); }
function archivedPicks(){ return _picks.filter(function(p){ return !p.active; }); }

function byId(id){ return _picks.find(function(p){ return p.id === id; }); }

function categories(){
  var cats = {};
  _picks.forEach(function(p){
    if(!cats[p.category]) cats[p.category] = 0;
    cats[p.category]++;
  });
  return cats;
}

function stats(){
  var active = activePicks().length;
  var archived = archivedPicks().length;
  var cats = categories();
  var catCount = Object.keys(cats).length;
  var avgRating = 0;
  if(_picks.length){
    var total = _picks.reduce(function(s,p){ return s + p.rating; }, 0);
    avgRating = (total / _picks.length).toFixed(1);
  }
  return { active: active, archived: archived, categories: catCount, avgRating: avgRating };
}

function addPick(id, category, reason){
  var existing = _picks.find(function(p){ return p.id === id; });
  if(existing){
    existing.active = true;
    existing.category = category;
    existing.reason = reason;
    existing.pickedDate = new Date().toISOString().slice(0,10);
    return existing;
  }
  return null;
}

function removePick(id){
  var p = _picks.find(function(x){ return x.id === id; });
  if(p){
    p.active = false;
    _log.unshift({ action:'removed', story:p.title, by:p.pickedBy, date:new Date().toISOString().slice(0,10), note:'Removed from picks' });
  }
  return p;
}

function togglePick(id){
  var p = _picks.find(function(x){ return x.id === id; });
  if(p) p.active = !p.active;
  return p;
}

function searchPicks(query){
  var q = (query||'').toLowerCase();
  return _picks.filter(function(p){
    return !q || p.title.toLowerCase().indexOf(q)!==-1 || p.author.toLowerCase().indexOf(q)!==-1 || p.category.toLowerCase().indexOf(q)!==-1;
  });
}

function filterByCategory(cat){
  if(!cat || cat==='all') return _picks;
  return _picks.filter(function(p){ return p.category === cat; });
}

window.__editorsPicksAPI = {
  picks: picks,
  log: log,
  activePicks: activePicks,
  archivedPicks: archivedPicks,
  byId: byId,
  categories: categories,
  stats: stats,
  addPick: addPick,
  removePick: removePick,
  togglePick: togglePick,
  searchPicks: searchPicks,
  filterByCategory: filterByCategory
};

})();
