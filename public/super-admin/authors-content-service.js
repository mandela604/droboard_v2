/**
 * authors-content-service.js — Data layer for Authors & Content page
 * Reads from window.AdminDemo.AUTHORS_*
 * Falls back to empty arrays if demo data is missing.
 */
(function(){
'use strict';
if(window.__authorsContentService) return;
window.__authorsContentService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/super-admin/authors-content';
var TIMEOUT_MS = 2500;
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

var _authors = [];
var _genreColors = {};
var _genres = [];

function loadFromDemo(){
  var D = window.AdminDemo || {};
  _authors = JSON.parse(JSON.stringify(D.AUTHORS_AUTHORS || []));
  _genreColors = D.AUTHORS_GENRE_COLORS || {};
  _genres = D.AUTHORS_GENRES || [];
}
loadFromDemo();

function authors(){ return _authors; }
function genreColors(){ return _genreColors; }
function genres(){ return _genres; }

function byId(id){ return _authors.find(function(a){ return a.id === id; }); }

function stats(){
  var total = _authors.length;
  var active = _authors.filter(function(a){ return a.status==='active'; }).length;
  var pending = _authors.filter(function(a){ return a.status==='pending'; }).length;
  var suspended = _authors.filter(function(a){ return a.status==='suspended'; }).length;
  var totalBooks = _authors.reduce(function(s,a){ return s+a.books; },0);
  var totalRevenue = _authors.reduce(function(s,a){ return s+a.revenue; },0);
  return { total:total, active:active, pending:pending, suspended:suspended, totalBooks:totalBooks, totalRevenue:totalRevenue };
}

function search(query, status, sort){
  var q = (query||'').toLowerCase();
  var list = _authors.filter(function(a){
    var matchQ = !q || a.name.toLowerCase().indexOf(q)!==-1 || a.id.indexOf(q)!==-1;
    var matchS = !status || a.status === status;
    return matchQ && matchS;
  });
  if(sort==='reads') list.sort(function(a,b){ return b.reads-a.reads; });
  else if(sort==='revenue') list.sort(function(a,b){ return b.revenue-a.revenue; });
  else if(sort==='books') list.sort(function(a,b){ return b.books-a.books; });
  else if(sort==='recent') list.sort(function(a,b){ return a.joinedDaysAgo-b.joinedDaysAgo; });
  else if(sort==='name') list.sort(function(a,b){ return a.name.localeCompare(b.name); });
  return list;
}

function updateAuthor(id, changes){
  var a = byId(id);
  if(!a) return null;
  if(changes.status) a.status = changes.status;
  if(changes.verified !== undefined) a.verified = changes.verified;
  if(changes.genre) a.genre = changes.genre;
  return a;
}

function deleteAuthor(id){
  var idx = _authors.findIndex(function(a){ return a.id === id; });
  if(idx === -1) return null;
  return _authors.splice(idx, 1)[0];
}

function genreBreakdown(){
  var counts = {};
  _genres.forEach(function(g){ counts[g]=0; });
  _authors.forEach(function(a){ if(counts[a.genre] !== undefined) counts[a.genre]++; });
  return counts;
}

window.__authorsContentAPI = {
  authors: authors,
  genreColors: genreColors,
  genres: genres,
  byId: byId,
  stats: stats,
  search: search,
  updateAuthor: updateAuthor,
  deleteAuthor: deleteAuthor,
  genreBreakdown: genreBreakdown
};

})();
