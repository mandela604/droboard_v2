/**
 * plotting-service.js — Data + UI layer for plotting.html.
 * Uses /api/author/books/:id/plot for live data.
 */
(function () {
  'use strict';
  if (window.PlottingService && window.PlottingService.init) return;
  var Svc = window.PlottingService || {};
  var CFG = window.AuthorApiConfig || { USE_API: true, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Backend-ready API */
  Svc.getPlot = Svc.getPlot || async function (bookId) {
    var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot', { credentials: 'include' });
    if (!r.ok) throw new Error('Plot API failed: ' + r.status);
    return await r.json();
  };
  Svc.savePlot = Svc.savePlot || async function (bookId, plot) {
    var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot) });
    if (!r.ok) throw new Error('Save plot failed: ' + r.status);
    return await r.json();
  };

  var ACTS = [];
  var ROADMAP = [];
  var TURNING_POINTS = [];
  var CHARACTERS = [];

  function renderActs(){
    if (ACTS.length === 0) {
      document.getElementById('actList').innerHTML = '<div class="empty">No plot act data loaded.</div>';
      return;
    }
    document.getElementById('actList').innerHTML = ACTS.map(function(a){
      return '<div class="act-card fade">'
        +'<div class="act-top"><span class="act-name">'+a.name+'</span><span class="act-range">'+a.range+'</span></div>'
        +'<div class="act-summary">'+a.summary+'</div>'
        +'<div class="beat-list">'
        +a.beats.map(function(b){ return '<div class="beat"><i class="fas fa-circle"></i><span>'+b+'</span></div>'; }).join('')
        +'</div></div>';
    }).join('');
  }

  function renderRoadmap(){
    if (ROADMAP.length === 0) {
      document.getElementById('roadmapList').innerHTML = '<div class="empty">No roadmap data loaded.</div>';
      return;
    }
    document.getElementById('roadmapList').innerHTML = ROADMAP.map(function(r){
      return '<div class="roadmap-row fade">'
        +'<div class="roadmap-range"><div class="roadmap-range-num">'+r.range+'</div><div class="roadmap-range-lbl">'+r.label+'</div></div>'
        +'<div class="roadmap-body"><div class="roadmap-title">'+r.title+'</div><div class="roadmap-desc">'+r.desc+'</div></div>'
        +'<span class="roadmap-status '+r.status+'">'+(r.status === 'written' ? 'Written' : 'Planned')+'</span></div>';
    }).join('');
  }

  function renderTimeline(){
    if (TURNING_POINTS.length === 0) {
      document.getElementById('timelineList').innerHTML = '<div class="empty">No turning points data loaded.</div>';
      return;
    }
    document.getElementById('timelineList').innerHTML = TURNING_POINTS.map(function(tp){
      return '<div class="tp-item"><div class="tp-dot"></div><div class="tp-ch">'+tp.ch+'</div><div class="tp-title">'+tp.title+'</div><div class="tp-desc">'+tp.desc+'</div></div>';
    }).join('');
  }

  function renderCharacters(){
    if (CHARACTERS.length === 0) {
      document.getElementById('charList').innerHTML = '<div class="empty">No character data loaded.</div>';
      return;
    }
    document.getElementById('charList').innerHTML = CHARACTERS.map(function(c){
      return '<div class="char-card fade"><div class="char-avatar"><img src="'+c.img+'" alt="'+c.name+'"/></div>'
        +'<div class="char-body"><div class="char-name-row"><span class="char-name">'+c.name+'</span><span class="char-role">'+c.role+'</span></div>'
        +'<div class="char-arc">'+c.arc+'</div></div></div>';
    }).join('');
  }

  function init(){
    renderActs();
    renderRoadmap();
    renderTimeline();
    renderCharacters();
    if (window.AuthorDrawer) {
      try { window.AuthorDrawer.render('plotting.html'); } catch (e) {}
      try { window.AuthorDrawer.bind(); } catch (e) {}
    }
    if (window.DroboardWorkspaceTabs) DroboardWorkspaceTabs.configure({ active: 'plotting' });
    if (window.DroboardNav) DroboardNav.configure({ active: 'profile' });
  }

  Svc.init = init;
  Svc.renderActs = renderActs;
  Svc.renderRoadmap = renderRoadmap;
  Svc.renderTimeline = renderTimeline;
  Svc.renderCharacters = renderCharacters;
  window.PlottingService = Svc;
})();
