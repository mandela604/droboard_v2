/**
 * system-pages-service.js — System Pages page logic (pure call-and-render).
 * Only Terms, Privacy and FAQ cards remain; all three edit through PageContentService
 * and view through the rendered pages under public/Pages/.
 */
(function () {
'use strict';
if (window.SystemPagesService && window.SystemPagesService.__ready) return;

var USE_API = false;
var API_BASE = '/api/super-admin/system-pages';
function timeoutFetch(url, opts){
  return fetch(url, opts||{}).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); });
}
async function callBackend(path, options){
  if(!USE_API) return null;
  return timeoutFetch(API_BASE + path, options);
}

var PAGES=[
  {id:'terms',           title:'Terms of Service',           url:'terms-of-service.html', icon:'fa-file-lines',      tone:'purple', status:'active', statusLabel:'Published', updated:'Nov 1, 2026', svcId:'terms-of-service'},
  {id:'privacy',         title:'Privacy Policy',             url:'privacy-policy.html',   icon:'fa-shield-halved',   tone:'green',  status:'active', statusLabel:'Published', updated:'Nov 1, 2026', svcId:'privacy-policy'},
  {id:'faq',             title:'Frequently Asked Questions', url:'faq.html',              icon:'fa-circle-question', tone:'pink',   status:'active', statusLabel:'Published', updated:'Nov 1, 2026', svcId:'faq'}
];

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function loadData(){
  try {
    var backend = await callBackend('');
    if(backend && Array.isArray(backend.pages)) PAGES = backend.pages;
  } catch(e){}
}

function render(){
  var el = document.getElementById('pagesGrid');
  if(!el) return;
  if(!PAGES.length){ el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);padding:28px">No pages yet.</div>'; return; }
  el.innerHTML = PAGES.map(function(p){
    return '<div class="page-card" data-page-id="'+esc(p.id)+'"><div class="page-top"><div class="page-icon '+esc(p.tone)+'"><i class="fas '+esc(p.icon)+'"></i></div><div><div class="page-title">'+esc(p.title)+'</div><div class="page-url">Pages/'+esc(p.url)+'</div></div></div><div class="page-status"><span class="status-dot '+esc(p.status)+'"></span> '+esc(p.statusLabel)+' · Last updated: '+esc(p.updated)+'</div><div class="page-desc">'+esc(p.description||describe(p))+'</div><div class="page-actions"><button class="btn-view" data-view="'+esc(p.id)+'" title="Open rendered page"><i class="fas fa-eye"></i> View</button> <button class="btn-edit" data-edit="'+esc(p.id)+'" title="Edit content"><i class="fas fa-pen"></i> Edit</button></div></div>';
  }).join('');
  el.querySelectorAll('[data-view]').forEach(function(b){
    b.addEventListener('click', function(){ viewPage(this.dataset.view); });
  });
  el.querySelectorAll('[data-edit]').forEach(function(b){
    b.addEventListener('click', function(){ openPageEditor(this.dataset.edit); });
  });
}

function describe(p){
  if(p.svcId==='faq'){
    var n = window.PageContentService ? window.PageContentService.get('faq').qa.length : 0;
    return n+' question'+(n===1?'':'s')+' readers can search and expand.';
  }
  if(p.svcId==='terms-of-service'){
    var t = window.PageContentService ? window.PageContentService.get('terms-of-service').sections.length : 0;
    return t+' sections covering eligibility, content rights, payments, moderation and liability.';
  }
  if(p.svcId==='privacy-policy'){
    var s = window.PageContentService ? window.PageContentService.get('privacy-policy').sections.length : 0;
    return s+' sections on data collected, sharing, retention, and user rights.';
  }
  return '';
}

function viewPage(pageId){
  var p = PAGES.find(function(x){ return x.id === pageId; });
  if(!p) return;
  window.location.href = '../Pages/' + p.url;
}

function openPageEditor(pageId){
  var p = PAGES.find(function(x){ return x.id === pageId; });
  if(!p || !p.svcId) { toast('This page is not editable yet.'); return; }
  if(!window.PageContentService || !window.PageContentService.isEditable(p.svcId)){ toast('Content service not loaded.'); return; }
  window.PageContentService.openEditor(p.svcId, function(){
    p.updated = 'Just now';
    render();
    toast(p.title + ' saved — changes are live on the page.');
  });
}

function toast(m){
  var t = document.createElement('div');
  t.textContent = m;
  t.style.cssText='position:fixed;top:20px;right:20px;background:var(--green);color:#fff;padding:12px 20px;border-radius:8px;font-size:12px;font-weight:700;box-shadow:var(--shadow);z-index:9999;animation:fadeIn 0.3s';
  document.body.appendChild(t);
  setTimeout(function(){ document.body.removeChild(t); }, 2500);
}

var _initDone = false;
function init(){
  if(_initDone) return;
  _initDone = true;
  SuperAdminSidebar.attach('#dashboardRoot',{activeItem:'system-pages',title:'System Pages',subtitle:'Editable Terms, Privacy and FAQ pages',user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'},notifCount:9,hideSearch:true});
  loadData().then(render);
}

window.SystemPagesService = { init:init, __ready:true };
})();
