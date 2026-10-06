/**
 * system-pages-service.js — System Pages page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';
if (window.SystemPagesService && window.SystemPagesService.__ready) return;

const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend ' + res.status);
  return res.json();
}

var PAGES=[
  {id:'home',title:'Home Page',url:'/home',icon:'fa-house',tone:'pink',status:'active',statusLabel:'Published',updated:'Jun 15, 2026'},
  {id:'about',title:'About Us',url:'/about',icon:'fa-circle-info',tone:'blue',status:'active',statusLabel:'Published',updated:'Jun 10, 2026'},
  {id:'contact',title:'Contact Us',url:'/contact',icon:'fa-envelope',tone:'amber',status:'active',statusLabel:'Published',updated:'Jun 8, 2026'},
  {id:'terms',title:'Terms of Service',url:'/terms',icon:'fa-file-lines',tone:'purple',status:'active',statusLabel:'Published',updated:'Jun 5, 2026'},
  {id:'privacy',title:'Privacy Policy',url:'/privacy',icon:'fa-shield',tone:'green',status:'active',statusLabel:'Published',updated:'Jun 3, 2026'},
  {id:'faq',title:'FAQ',url:'/faq',icon:'fa-question-circle',tone:'pink',status:'draft',statusLabel:'Draft',updated:'May 28, 2026'},
  {id:'help',title:'Help Center',url:'/help',icon:'fa-bullhorn',tone:'blue',status:'draft',statusLabel:'Draft',updated:'May 25, 2026'},
  {id:'guidelines',title:'Community Guidelines',url:'/guidelines',icon:'fa-gavel',tone:'amber',status:'hidden',statusLabel:'Hidden',updated:'May 20, 2026'}
];

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(m){ if(typeof window.toast==='function' && window.toast!==toast){ try{ window.toast(m); return; }catch(e){} } }

async function loadData(){
  var backend = await callBackend('/system-pages');
  if(backend && Array.isArray(backend.pages)) PAGES = backend.pages;
}

function render(){
  var el = document.getElementById('pagesGrid');
  if(!el) return;
  if(!PAGES.length){ el.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-faint);padding:28px">No pages yet.</div>'; return; }
  el.innerHTML = PAGES.map(function(p){
    return '<div class="page-card"><div class="page-top"><div class="page-icon '+esc(p.tone)+'"><i class="fas '+esc(p.icon)+'"></i></div><div><div class="page-title">'+esc(p.title)+'</div><div class="page-url">'+esc(p.url)+'</div></div></div><div class="page-status"><span class="status-dot '+esc(p.status)+'"></span> '+esc(p.statusLabel)+' · Last updated: '+esc(p.updated)+'</div><div class="page-actions"><button onclick="SystemPagesService.editPage(\''+esc(p.id)+'\')">Edit</button><button onclick="SystemPagesService.previewPage(\''+esc(p.id)+'\')">Preview</button></div></div>';
  }).join('');
}

function createPage(){ return callBackend('/system-pages', { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }).then(function(r){ if(!r) toast('Creating new system page…'); }); }
function editPage(id){ return callBackend('/system-pages/' + encodeURIComponent(id)).then(function(r){ if(!r) toast('Editing page…'); }); }
function previewPage(id){ return callBackend('/system-pages/' + encodeURIComponent(id) + '/preview').then(function(r){ if(!r) toast('Previewing page…'); }); }

var _initDone = false;
function init(){
  if(_initDone) return;
  _initDone = true;
  SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'system-pages',title:'System Pages',subtitle:'Manage all system and static pages on your platform',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,hideSearch:true});
  loadData().then(render);
}

window.SystemPagesService = { init:init, createPage:createPage, editPage:editPage, previewPage:previewPage, __ready:true };
})();
