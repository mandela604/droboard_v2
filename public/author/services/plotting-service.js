/**
 * plotting-service.js — Data + UI layer for plotting.html.
 * TODO backend: GET/PUT /api/author/books/:id/plot
 */
(function () {
  'use strict';
  if (window.PlottingService && window.PlottingService.init) return;
  var Svc = window.PlottingService || {};
  var CFG = window.AuthorApiConfig || { USE_API: false, API_BASE: '/api/author', TIMEOUT_MS: 3000 };
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms || 150); }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* Backend-ready API (preserved) */
  Svc.getPlot = Svc.getPlot || async function (bookId) {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot'); if (r.ok) return await r.json(); } catch (e) {} }
    await delay();
    return clone({ acts: [{ n: 1, title: 'Setup' }, { n: 2, title: 'Confrontation' }, { n: 3, title: 'Resolution' }], roadmap: [], turningPoints: [] });
  };
  Svc.savePlot = Svc.savePlot || async function (bookId, plot) {
    if (CFG.USE_API) { try { var r = await fetch(CFG.API_BASE + '/books/' + bookId + '/plot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plot) }); if (r.ok) return await r.json(); } catch (e) {} }
    await delay(200); return { ok: true };
  };

  /* ── Demo data (moved from inline) ── */
  var ACTS = [
    { name:'Act I — Setup', range:'Ch 1–14', summary:'The forced engagement is struck under threat of both families\' ruin; distrust hardens into a fragile truce.', beats:[
        'Ch 1–3: Rival heirs meet again after the scandal that broke both families.',
        'Ch 6–8: The marriage of convenience is proposed as the only way to save both companies.',
        'Ch 12–14: First real crack in the hostility — a moment neither can explain away.',
      ]},
    { name:'Act II — Escalation', range:'Ch 15–42', summary:'The lie they\'re living becomes harder to maintain as real feeling grows against a backdrop of sabotage and betrayal.', beats:[
        'Ch 18–20: Evidence surfaces suggesting the original scandal was staged.',
        'Ch 27–29: Midpoint — they choose each other over their families for the first time.',
        'Ch 34–36: A planted rumor nearly destroys the fragile trust they\'ve built.',
        'Ch 40–42: All-is-lost low point — the engagement is publicly called off.',
      ]},
    { name:'Act III — Resolution', range:'Ch 43–56', summary:'The truth comes out, the real villain is exposed, and the marriage of convenience becomes a marriage of choice.', beats:[
        'Ch 46–48: The frame-up is traced back to a family member, not a rival.',
        'Ch 50–52: Public confrontation and clearing of the father\'s name.',
        'Ch 54–56: Resolution, reconciliation, and the wedding that closes the loop.',
      ]},
  ];

  var ROADMAP = [
    { range:'Ch 1–5', label:'Written', title:'The forced engagement', desc:'Opening scandal, the ultimatum, and the first tense meeting between the two leads.', status:'written' },
    { range:'Ch 6–14', label:'Planned', title:'Truce under threat', desc:'Public engagement announced; both sides maneuver for leverage while distrust simmers.', status:'planned' },
    { range:'Ch 15–27', label:'Planned', title:'Cracks in the lie', desc:'Shared vulnerability starts eroding the performance; first evidence of the frame-up appears.', status:'planned' },
    { range:'Ch 28–42', label:'Planned', title:'Sabotage and fallout', desc:'Midpoint choice, a planted rumor, and the public unraveling of the engagement.', status:'planned' },
    { range:'Ch 43–53', label:'Planned', title:'Unmasking the truth', desc:'The real culprit is traced and confronted; families forced to reckon with the truth.', status:'planned' },
    { range:'Ch 54–56', label:'Planned', title:'Resolution & wedding', desc:'Public vindication, reconciliation, and the ending that reframes the opening premise.', status:'planned' },
  ];

  var TURNING_POINTS = [
    { ch:'Chapter 8', title:'The ultimatum', desc:'Both families force the engagement as the only way to avoid financial ruin.' },
    { ch:'Chapter 20', title:'First doubt planted', desc:'A discovered document hints the original scandal wasn\'t what either family believes.' },
    { ch:'Chapter 28', title:'Midpoint reversal', desc:'They choose each other over their families for the first time — the fake becomes real.' },
    { ch:'Chapter 41', title:'Public collapse', desc:'The engagement is called off in front of both families; lowest point of the story.' },
    { ch:'Chapter 51', title:'Truth exposed', desc:'The real saboteur is unmasked publicly, clearing both fathers\' names.' },
    { ch:'Chapter 56', title:'Full-circle ending', desc:'The marriage of convenience becomes the wedding that closes the story\'s opening wound.' },
  ];

  var CHARACTERS = [
    { name:'Adrian Cole', role:'Lead', img:'https://i.pravatar.cc/100?img=12', arc:'Starts as cold and vengeance-driven; arc ends with him choosing trust and vulnerability over control.' },
    { name:'Elena Marsh', role:'Lead', img:'https://i.pravatar.cc/100?img=32', arc:'Enters guarded and self-protective after a past betrayal; learns to let someone in without losing herself.' },
    { name:'Victor Cole', role:'Antagonist', img:'https://i.pravatar.cc/100?img=53', arc:'Revealed as the true architect of the original scandal; drives the Act III unmasking.' },
    { name:'Josephine Marsh', role:'Support', img:'https://i.pravatar.cc/100?img=45', arc:'Elena\'s sister; provides the outside perspective that pushes both leads toward honesty.' },
  ];

  function renderActs(){
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
    document.getElementById('roadmapList').innerHTML = ROADMAP.map(function(r){
      return '<div class="roadmap-row fade">'
        +'<div class="roadmap-range"><div class="roadmap-range-num">'+r.range+'</div><div class="roadmap-range-lbl">'+r.label+'</div></div>'
        +'<div class="roadmap-body"><div class="roadmap-title">'+r.title+'</div><div class="roadmap-desc">'+r.desc+'</div></div>'
        +'<span class="roadmap-status '+r.status+'">'+(r.status === 'written' ? 'Written' : 'Planned')+'</span></div>';
    }).join('');
  }

  function renderTimeline(){
    document.getElementById('timelineList').innerHTML = TURNING_POINTS.map(function(tp){
      return '<div class="tp-item"><div class="tp-dot"></div><div class="tp-ch">'+tp.ch+'</div><div class="tp-title">'+tp.title+'</div><div class="tp-desc">'+tp.desc+'</div></div>';
    }).join('');
  }

  function renderCharacters(){
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
