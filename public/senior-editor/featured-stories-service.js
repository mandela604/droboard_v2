/**
 * featured-stories-service.js — Data layer for Featured Stories page
 * Reads from window.EditorDemo.FEATURED_* demo data.
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__featuredStoriesService) return;
window.__featuredStoriesService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/featured-stories';
var TIMEOUT_MS = 2500;
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

function getTags(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_TAGS || {})); }
function getSections(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_SECTIONS || [])); }
function getLibrary(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_LIBRARY || [])); }
function getPlacements(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_PLACEMENTS || [])); }
function getHistory(){ return JSON.parse(JSON.stringify((window.EditorDemo||{}).FEATURED_HISTORY || [])); }

/* ── State stored in closure ── */
var _tags, _sections, _library, _placements, _history;
function loadFromDemo(){
  _tags = getTags();
  _sections = getSections();
  _library = getLibrary();
  _placements = getPlacements();
  _history = getHistory();
  _placements.forEach(function(f){
    if(typeof f.start === 'string') f.start = new Date(f.start);
    if(typeof f.end === 'string') f.end = new Date(f.end);
  });
}

/* ── Public API ── */
function loadAll(){
  return Promise.resolve().then(function(){
    return timeoutFetch(API_BASE);
  }).then(function(data){
    _tags = data.tags || {};
    _sections = data.sections || [];
    _library = data.library || [];
    _placements = data.placements || [];
    _history = data.history || [];
  }).catch(function(){
    loadFromDemo();
  });
}

function tags(){ return _tags; }
function sections(){ return _sections; }
function library(){ return _library; }
function placements(){ return _placements; }
function history(){ return _history; }

function byId(id){ return _library.find(function(s){ return s.id === id; }); }
function isFeatured(id){ return _placements.some(function(f){ return f.id === id; }); }

function placementOf(sectionId){ return _sections.find(function(s){ return s.id === sectionId; }) || {}; }

function featuredList(tag){
  if(!tag || tag === 'all') return _placements;
  return _placements.filter(function(f){ return f.tags.indexOf(tag) !== -1; });
}

function libraryList(query, genre){
  var q = (query||'').toLowerCase();
  var g = (genre||'');
  return _library.filter(function(s){
    var matchQ = !q || s.title.toLowerCase().indexOf(q) !== -1 || s.author.toLowerCase().indexOf(q) !== -1;
    var matchG = !g || s.genre === g;
    return matchQ && matchG;
  });
}

function historyList(query){
  var q = (query||'').toLowerCase();
  return _history.filter(function(h){
    return !q || h.title.toLowerCase().indexOf(q) !== -1 || h.author.toLowerCase().indexOf(q) !== -1;
  }).map(function(h){ return { h: h, i: _history.indexOf(h) }; });
}

function tabsPresent(){
  var tags = [];
  _placements.forEach(function(f){
    f.tags.forEach(function(t){
      if(t !== 'featured' && tags.indexOf(t) === -1) tags.push(t);
    });
  });
  return tags;
}

function stats(){
  var active = _placements.length;
  var heroes = _placements.filter(function(f){ return f.placement.section === 'hero-banner'; }).length;
  var genres = new Set();
  _placements.forEach(function(f){
    var s = byId(f.id);
    if(s) genres.add(s.genre);
  });
  var avgDays = 0;
  if(active){
    var total = _placements.reduce(function(sum,f){
      var start = new Date(f.start); var end = new Date(f.end);
      return sum + Math.ceil((end - start) / 86400000);
    }, 0);
    avgDays = Math.round(total / active);
  }
  return { active: active, heroes: heroes, genres: genres.size, avgDays: avgDays };
}

function addFeature(storyId, section, sub, start, end, tagsArr, note){
  if(!byId(storyId)) throw new Error('Story not found');
  var s = typeof start === 'string' ? new Date(start) : start;
  var e = typeof end === 'string' ? new Date(end) : end;
  var entry = { id: storyId, placement: { section: section, sub: sub }, tags: tagsArr, start: s, end: e, note: note||'' };
  _placements.push(entry);
  return entry;
}

function removeFeature(storyId){
  var idx = _placements.findIndex(function(f){ return f.id === storyId; });
  if(idx === -1) return null;
  var removed = _placements.splice(idx, 1)[0];
  var s = byId(storyId);
  if(s){
    _history.unshift({
      title: s.title, author: s.author, cover: s.cover, genre: s.genre, rating: s.rating,
      placement: removed.placement,
      tags: removed.tags.filter(function(t){ return t !== 'featured'; }),
      period: fmtDate(new Date(removed.start)) + ' – ' + fmtDate(new Date())
    });
  }
  return removed;
}

function updatePlacement(storyId, changes){
  var f = _placements.find(function(x){ return x.id === storyId; });
  if(!f) return null;
  if(changes.tags) f.tags = changes.tags;
  if(changes.section) f.placement.section = changes.section;
  if(changes.sub !== undefined) f.placement.sub = changes.sub;
  if(changes.start) f.start = changes.start;
  if(changes.end) f.end = changes.end;
  if(changes.note !== undefined) f.note = changes.note;
  return f;
}

function fmtDate(d){
  if(typeof d === 'string') d = new Date(d);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

loadFromDemo();

window.__featuredStoriesAPI = {
  loadAll: loadAll,
  tags: tags,
  sections: sections,
  library: library,
  placements: placements,
  history: history,
  byId: byId,
  isFeatured: isFeatured,
  placementOf: placementOf,
  featuredList: featuredList,
  libraryList: libraryList,
  historyList: historyList,
  tabsPresent: tabsPresent,
  stats: stats,
  addFeature: addFeature,
  removeFeature: removeFeature,
  updatePlacement: updatePlacement,
  fmtDate: fmtDate
};

})();
