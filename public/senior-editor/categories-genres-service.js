/**
 * categories-genres-service.js — Data layer for Categories & Genres page
 * Reads from window.EditorDemo.CATEGORIES / GENRES / POPULAR_GENRES
 */
(function(){
'use strict';
if(window.__catGenreService) return;
window.__catGenreService = true;

var API_BASE = window.DROBOARD_API_BASE || '/api/senior-editor/categories-genres';
var TIMEOUT_MS = 2500;
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms || 200 + Math.random()*200); }); }
function timeoutFetch(url, opts){
  var c = new AbortController();
  var t = setTimeout(function(){ c.abort(); }, TIMEOUT_MS);
  return fetch(url, Object.assign({signal:c.signal}, opts||{})).then(function(r){ clearTimeout(t); if(!r.ok) throw new Error(r.status); return r.json(); }).catch(function(e){ clearTimeout(t); throw e; });
}

function getDemo(){
  var D = window.EditorDemo || {};
  return {
    categories: JSON.parse(JSON.stringify(D.CATEGORIES || [])),
    genres: JSON.parse(JSON.stringify(D.GENRES || [])),
    popularGenres: JSON.parse(JSON.stringify(D.POPULAR_GENRES || []))
  };
}

var ICON_OPTIONS = [
  {icon:'fa-heart',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-crown',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-paw',bg:'#eef0f2',color:'#5b6470'},
  {icon:'fa-droplet',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-wand-magic-sparkles',bg:'#ece3fd',color:'#7c5cfc'},
  {icon:'fa-gun',bg:'#e7e7ea',color:'#26262b'},
  {icon:'fa-building',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-ring',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-fire',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-rotate-left',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-briefcase',bg:'#e3ecfd',color:'#2f7de1'},
  {icon:'fa-shield',bg:'#fef3d8',color:'#d97706'},
  {icon:'fa-heart-crack',bg:'#fde3e3',color:'#e0384d'},
  {icon:'fa-ban',bg:'#ffe1eb',color:'#ff0050'},
  {icon:'fa-book',bg:'#e2f8ea',color:'#16a34a'},
  {icon:'fa-film',bg:'#fef3d8',color:'#d97706'}
];

window.CategoriesGenresService = {

  async getCategories(){
    try { return await timeoutFetch(API_BASE + '/categories'); }
    catch(e){ await delay(); return getDemo().categories; }
  },

  async getGenres(){
    try { return await timeoutFetch(API_BASE + '/genres'); }
    catch(e){ await delay(); return getDemo().genres; }
  },

  async getPopularGenres(){
    try { return await timeoutFetch(API_BASE + '/popular-genres'); }
    catch(e){ await delay(); return getDemo().popularGenres; }
  },

  getIconOptions: function(){ return ICON_OPTIONS.slice(); },

  async addCategory(payload, categories){
    try { await timeoutFetch(API_BASE + '/categories', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
    catch(e){ await delay(100); }
    var ico = ICON_OPTIONS[Math.floor(Math.random()*ICON_OPTIONS.length)];
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, genres:0, books:'0', status:'active'}, payload);
    categories.unshift(item);
    return item;
  },

  async updateCategory(idx, payload, categories){
    try { await timeoutFetch(API_BASE + '/categories/' + idx, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
    catch(e){ await delay(100); }
    Object.assign(categories[idx], payload);
    return categories[idx];
  },

  async deleteCategory(idx, categories){
    try { await timeoutFetch(API_BASE + '/categories/' + idx, {method:'DELETE'}); }
    catch(e){ await delay(100); }
    categories.splice(idx, 1);
  },

  async addGenre(payload, genres){
    try { await timeoutFetch(API_BASE + '/genres', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
    catch(e){ await delay(100); }
    var ico = ICON_OPTIONS[Math.floor(Math.random()*ICON_OPTIONS.length)];
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, books:'0', status:'active'}, payload);
    genres.unshift(item);
    return item;
  },

  async updateGenre(idx, payload, genres){
    try { await timeoutFetch(API_BASE + '/genres/' + idx, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); }
    catch(e){ await delay(100); }
    Object.assign(genres[idx], payload);
    return genres[idx];
  },

  async deleteGenre(idx, genres){
    try { await timeoutFetch(API_BASE + '/genres/' + idx, {method:'DELETE'}); }
    catch(e){ await delay(100); }
    genres.splice(idx, 1);
  }
};
})();
