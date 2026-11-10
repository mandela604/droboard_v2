/**
 * characters-service.js — owns data + render + bindings for characters.html.
 * Uses /api/author/books/:id/characters for live data.
 */
(function () {
  'use strict';
  if (window.CharactersService && window.CharactersService.init) return;
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var ROLES = [
    { id: 'all', label: 'All', count: 6 },
    { id: 'lead', label: 'Lead', count: 2 },
    { id: 'antagonist', label: 'Antagonist', count: 1 },
    { id: 'support', label: 'Support', count: 2 },
    { id: 'minor', label: 'Minor', count: 1 }
  ];

  var CHARACTERS = [];
  var RELATIONSHIPS = [];

  var activeRole = 'all';
  var selectedRole = 'lead';
  var charTags = [];
  var searchQuery = '';

  function renderRoleFilter() {
    document.getElementById('roleFilter').innerHTML = ROLES.map(function (r) {
      return '<button class="role-chip ' + (r.id === activeRole ? 'active' : '') + '" data-role="' + r.id + '">' + r.label + ' <span class="ct">' + r.count + '</span></button>';
    }).join('');
    document.querySelectorAll('.role-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        activeRole = chip.dataset.role;
        renderRoleFilter();
        renderCharacters();
      });
    });
  }

  function renderCharacters() {
    if (CHARACTERS.length === 0) {
      document.getElementById('characterList').innerHTML = '<div class="empty">No characters loaded.</div>';
      document.getElementById('emptyState').classList.add('show');
      return;
    }
    var filtered = activeRole === 'all' ? CHARACTERS : CHARACTERS.filter(function (c) { return c.role === activeRole; });
    if (searchQuery) {
      filtered = filtered.filter(function (c) {
        var hay = (c.name + ' ' + (c.roleLabel || '')).toLowerCase();
        return hay.indexOf(searchQuery) !== -1;
      });
    }
    if (filtered.length === 0) {
      document.getElementById('characterList').innerHTML = '<div class="empty">No characters found.</div>';
      document.getElementById('emptyState').classList.add('show');
      return;
    }
    document.getElementById('emptyState').classList.remove('show');
    document.getElementById('characterList').innerHTML = filtered.map(function (c, i) {
      return '<div class="character-card fade" style="animation-delay:' + (i * 0.03) + 's" onclick="location.href=\'character-profile.html\'">'
        + '<div class="cc-avatar"><img src="' + c.img + '" alt="' + c.name + '"/></div>'
        + '<div class="cc-body"><div class="cc-top-row"><span class="cc-name">' + c.name + '</span><span class="cc-role ' + c.role + '">' + c.roleLabel + '</span></div>'
        + '<div class="cc-meta">' + c.meta + '</div><div class="cc-arc">' + c.arc + '</div>'
        + '<div class="cc-tags">' + c.tags.map(function (t) { return '<span class="cc-tag">' + t + '</span>'; }).join('') + '</div>'
        + '<div class="cc-stats"><span class="cc-stat"><i class="fas fa-book-open"></i> ' + c.chapters + '</span>'
        + '<span class="cc-stat"><i class="fas fa-quote-right"></i> ' + c.mentions + ' mentions</span></div></div>'
        + '<i class="fas fa-chevron-right cc-chev"></i></div>';
    }).join('');
  }