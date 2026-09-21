/**
 * categories-genres-service.js — Data layer for Categories & Genres page
 * Reads from window.EditorDemo.CATEGORIES / GENRES / POPULAR_GENRES
 */
(function(){
'use strict';
if(window.__catGenreService) return;
window.__catGenreService = true;

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

function pickIcon(){ return ICON_OPTIONS[Math.floor(Math.random()*ICON_OPTIONS.length)]; }

window.CategoriesGenresService = {

  getCategories: function(){
    return getDemo().categories;
  },

  getGenres: function(){
    return getDemo().genres;
  },

  getPopularGenres: function(){
    return getDemo().popularGenres;
  },

  getIconOptions: function(){ return ICON_OPTIONS.slice(); },

  addCategory: function(payload, categories){
    var ico = pickIcon();
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, genres:0, books:'0'}, payload);
    categories.unshift(item);
    return item;
  },

  updateCategory: function(idx, payload, categories){
    if(idx < 0 || idx >= categories.length) return null;
    Object.assign(categories[idx], payload);
    return categories[idx];
  },

  deleteCategory: function(idx, categories){
    if(idx < 0 || idx >= categories.length) return;
    categories.splice(idx, 1);
  },

  addGenre: function(payload, genres){
    var ico = pickIcon();
    var item = Object.assign({icon:ico.icon, bg:ico.bg, color:ico.color, books:'0'}, payload);
    genres.unshift(item);
    return item;
  },

  updateGenre: function(idx, payload, genres){
    if(idx < 0 || idx >= genres.length) return null;
    Object.assign(genres[idx], payload);
    return genres[idx];
  },

  deleteGenre: function(idx, genres){
    if(idx < 0 || idx >= genres.length) return;
    genres.splice(idx, 1);
  }
};
})();
