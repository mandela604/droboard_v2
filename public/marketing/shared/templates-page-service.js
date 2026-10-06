/**
 * templates-page-service.js — Flyer Templates page logic (pure call-and-render).
 * Extracted verbatim from templates.html inline script. Page now calls TemplatesService.init().
 * Backend-ready: implement fetch/store endpoints and swap the store reads/writes; no HTML change.
 */
(function(){
'use strict';
if(window.TemplatesService&&window.TemplatesService.__ready)return;
/* Data self-load: page HTML no longer includes shared/flyer-templates-data.js.
   Service pulls it during parse; delete these 3 lines at go-live. */
if(typeof window.FlyerTemplates==='undefined'&&typeof document!=='undefined'&&document.readyState==='loading'){
  document.write('<script src="shared/flyer-templates-data.js"><\/script>');
}

MarketingSidebar.attach('#root',{activeItem:'templates',title:'Flyer Templates',subtitle:'Marketing owns the system — fixed templates, every writer reuses them',user:{name:'Tari Benson',role:'Marketing Lead',avatar:'https://i.pravatar.cc/100?img=45'},notifCount:3});

let store = (window.FlyerTemplates||[]).slice();
let editingId=null, pickedIcon='fa-image', pickedAccent='#ff0050';
const ICONS=['fa-image','fa-whatsapp','fa-share-nodes','fa-wand-magic-sparkles','fa-fire','fa-tiktok','fa-qrcode','fa-user-pen','fa-clock','fa-bullhorn','fa-star','fa-crown','fa-heart','fa-gem'];
const VARS = window.FlyerTemplateVars||{};

function stats(){
  document.getElementById('tmplStats').innerHTML=''
    +sCard(store.length,'Total templates','fa-layer-group','var(--accent)')
    +sCard(store.filter(function(t){return t.size==='1:1'}).length,'1:1 Square','fa-square','var(--purple)')
    +sCard(store.filter(function(t){return t.size==='9:16'}).length,'9:16 Vertical','fa-mobile-screen','var(--green)')
    +sCard(store.filter(function(t){return (t.variants||[]).length}).length,'With variants','fa-clone','var(--amber)');
  function sCard(n,l,ico,c){return '<div class="tmpl-stat"><div class="num" style="color:'+c+'"><i class="fas '+ico+'" style="margin-right:6px"></i>'+n+'</div><div class="lbl">'+l+'</div></div>';}
}
function filtered(){
  const q=(document.getElementById('tmplQ').value||'').toLowerCase();
  const sz=document.getElementById('tmplSize').value;
  return store.filter(function(t){
    if(sz!=='all' && t.size!==sz) return false;
    if(q && t.name.toLowerCase().indexOf(q)===-1 && (t.desc||'').toLowerCase().indexOf(q)===-1) return false;
    return true;
  });
}
function render(){
  stats();
  const items=filtered();
  const el=document.getElementById('tmplList');
  if(!items.length){ el.innerHTML='<div style="text-align:center;padding:28px;color:var(--text-faint);font-size:12.5px">No templates match.</div>'; return; }
  el.innerHTML=items.map(function(t){
    return '<div class="tmpl-card" data-id="'+t.id+'">'
      +'<div class="tmpl-thumb" style="background:'+t.accent+'"><i class="fas '+t.icon+'"></i></div>'
      +'<div class="tmpl-info"><div class="tmpl-name">'+esc(t.name)+'</div><div class="tmpl-meta">'+esc(t.size)+' · '+esc(t.px||'')+' · '+esc((t.vars||[]).length+' vars')+'</div><div class="tmpl-desc">'+esc(t.desc||'')+'</div></div>'
      +'<div class="tmpl-badges"><span class="tmpl-badge size">'+esc(t.size)+'</span>'+(t.variants?'<span class="tmpl-badge ratio">'+t.variants.length+' variants</span>':'')+'</div>'
      +'<div class="tmpl-actions"><button class="tmpl-act previewBtn" title="Preview"><i class="fas fa-eye"></i></button><button class="tmpl-act editBtn" title="Edit"><i class="fas fa-pen"></i></button><button class="tmpl-act delBtn" title="Delete"><i class="fas fa-trash"></i></button></div>'
      +'</div>';
  }).join('');
  // Row click opens preview; action buttons don't bubble
  el.querySelectorAll('.tmpl-card').forEach(function(card){
    var id=card.getAttribute('data-id');
    card.addEventListener('click', function(e){
      if(e.target.closest('.tmpl-actions')) return;
      previewTpl(id);
    });
    var pb=card.querySelector('.previewBtn');
    if(pb) pb.addEventListener('click', function(e){ e.stopPropagation(); previewTpl(id); });
    var eb=card.querySelector('.editBtn');
    if(eb) eb.addEventListener('click', function(e){ e.stopPropagation(); openEdit(id); });
    var db=card.querySelector('.delBtn');
    if(db) db.addEventListener('click', function(e){ e.stopPropagation(); onDelete(id); });
  });
}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function renderIconGrid(){ const g=document.getElementById('teIconGrid'); if(!g) return; g.innerHTML=ICONS.map(function(ic){return '<button type="button" class="tmpl-icon-opt'+(ic===pickedIcon?' on':'')+'" data-ic="'+ic+'"><i class="fas '+ic+'"></i></button>';}).join(''); g.querySelectorAll('.tmpl-icon-opt').forEach(function(b){ b.addEventListener('click', function(){ pickedIcon=b.getAttribute('data-ic'); renderIconGrid(); }); }); }
function renderVarChips(selected){
  const el=document.getElementById('teVars'); if(!el) return;
  el.innerHTML=Object.keys(VARS).map(function(k){
    const on=(selected||[]).indexOf(k)!==-1;
    return '<button type="button" class="tmpl-var-chip'+(on?' on':'')+'" data-k="'+k+'">'+esc(VARS[k].label)+'</button>';
  }).join('');
  el.querySelectorAll('.tmpl-var-chip').forEach(function(b){ b.addEventListener('click', function(){ b.classList.toggle('on'); }); });
}
function selectedVars(){ return Array.from(document.querySelectorAll('#teVars .tmpl-var-chip.on')).map(function(b){return b.getAttribute('data-k');}); }
function previewTpl(id){
  var t=store.find(function(x){return x.id===id;}); if(!t) return;
  window.FlyerTemplates = store.slice();
  var isReaderTpl = t.id==='tmpl_platform_reader';
  var isFollowTpl = t.id==='tmpl_follow_me' || t.id==='tmpl_spotlight' || isReaderTpl || t.id==='tmpl_platform_invite';
  var demo = {
    title:'The Last Sunrise', authorName:'Tobi Adenuga', handle:'@tobi_adenuga',
    userPhoto:'https://i.pravatar.cc/150?img=68', bio:'Writer of heartfelt stories. Follow me for new chapters every week.',
    hook:'She left without a word. Five years later, he found her — and the truth.',
    genre:'Romance', link:'https://droboard.com/full-reader.html?story=the-last-sunrise', storeUrl:'',
    cover:'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=600&h=600&fit=crop',
    authorPhoto:'https://i.pravatar.cc/100?img=68', platformTag:'Discover stories worth sharing.',
    ctaText: isFollowTpl ? 'Follow Me →' : '', accent:'',
    stats: isReaderTpl ? { hoursRead:48, booksRead:12, streak:7 } : { reads:12800, followers:420, books:7 }
  };
  if(t.category==='platform' && t.id.indexOf('countdown')!==-1){ demo.title='Season Drop'; demo.hook='Something big is coming to DroBoard.'; }
  FlyerPreview.open({ templateId:t.id, vars: demo });
}
function closeTmplModal(){ document.getElementById('tmplModalBg').classList.remove('open'); }
window.closeTmplModal=closeTmplModal;
document.getElementById('tmplModalBg').addEventListener('click', function(e){ if(e.target===this) closeTmplModal(); });
function openNew(){
  editingId=null; document.getElementById('tmplModalTitle').textContent='New Template';
  document.getElementById('teName').value=''; document.getElementById('teDesc').value='';
  document.getElementById('teSize').value='1:1'; pickedIcon='fa-image'; pickedAccent='#ff0050';
  document.getElementById('teAccent').value=pickedAccent; document.getElementById('teAccentHex').textContent=pickedAccent;
  document.getElementById('teBlocks').value='heroCover, title, hook, cta, link, logo';
  document.getElementById('teVariants').value=''; document.getElementById('teVariantsWrap').style.display='none';
  renderIconGrid(); renderVarChips(['cover','title','authorName','hook','link','storeUrl','ctaText','accent']);
  document.getElementById('tmplModalBg').classList.add('open');
}
function openEdit(id){
  const t=store.find(function(x){return x.id===id;}); if(!t) return;
  editingId=id; document.getElementById('tmplModalTitle').textContent='Edit — '+t.name;
  document.getElementById('teName').value=t.name; document.getElementById('teDesc').value=t.desc||'';
  document.getElementById('teSize').value=t.size||'1:1'; pickedIcon=t.icon||'fa-image'; pickedAccent=t.accent||'#ff0050';
  document.getElementById('teAccent').value=pickedAccent; document.getElementById('teAccentHex').textContent=pickedAccent;
  document.getElementById('teBlocks').value=(t.blocks||[]).join(', ');
  const hasVar=(t.variants||[]).length; document.getElementById('teVariantsWrap').style.display= hasVar ? '' : 'none';
  document.getElementById('teVariants').value=(t.variants||[]).join(', ');
  renderIconGrid(); renderVarChips(t.vars||[]);
  document.getElementById('tmplModalBg').classList.add('open');
}
document.getElementById('teSize').addEventListener('change', function(){ const isC=this.value==='9:16' || document.getElementById('teName').value.toLowerCase().indexOf('countdown')!==-1; document.getElementById('teVariantsWrap').style.display=isC?'':'none'; });
document.getElementById('teName').addEventListener('input', function(){ if(this.value.toLowerCase().indexOf('countdown')!==-1) document.getElementById('teVariantsWrap').style.display=''; });
document.getElementById('teAccent').addEventListener('input', function(){ document.getElementById('teAccentHex').textContent=this.value; });
function onSave(){
  const name=document.getElementById('teName').value.trim(); if(!name){ toast('Name is required'); return; }
  const size=document.getElementById('teSize').value||'1:1';
  const px = size==='9:16'?'1080 × 1920': size==='16:9'?'1920 × 1080':'1080 × 1080';
  const blocks=document.getElementById('teBlocks').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  const vars=selectedVars(); if(!vars.length){ toast('Pick at least one variable'); return; }
  const variants=document.getElementById('teVariants').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
  const payload={ name:name, desc:document.getElementById('teDesc').value.trim(), size:size, px:px, ratio:size, accent:document.getElementById('teAccent').value||'#ff0050', icon:pickedIcon, vars:vars, blocks:blocks.length?blocks:['heroCover','title','cta','link','logo'] };
  if(variants.length) payload.variants=variants;
  if(payload.vars.indexOf('ctaText')===-1) payload.vars.push('ctaText');
  if(payload.vars.indexOf('accent')===-1) payload.vars.push('accent');
  // preserve category
  if(editingId){
    const idx=store.findIndex(function(x){return x.id===editingId;});
    if(idx>=0){ payload.category=store[idx].category; payload.published=store[idx].published; Object.assign(store[idx], payload); }
  } else { payload.id='tmpl_'+Date.now().toString(36); payload.category='writer'; store.push(payload); }
  window.FlyerTemplates=store.slice();
  closeTmplModal(); render(); toast(editingId?'Template updated':'Template created');
}
function onDelete(id){
  const t=store.find(function(x){return x.id===id;}); if(!t) return;
  if(!confirm('Delete "'+t.name+'"?')) return;
  store=store.filter(function(x){return x.id!==id;});
  window.FlyerTemplates=store.slice(); render(); toast('Template deleted');
}
function init(){
// Re-sync from data module: document.write-injected data script executes after
// this file finishes parsing, so refresh here (init runs last) to pick it up.
if(window.FlyerTemplates) store = window.FlyerTemplates.slice();
document.getElementById('tmplQ').addEventListener('input', render);
document.getElementById('tmplSize').addEventListener('change', render);
document.getElementById('tmplNew').addEventListener('click', openNew);
document.getElementById('teSave').addEventListener('click', onSave);
function toast(m){ const el=document.createElement('div'); el.style.cssText='position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#1a1730;color:#fff;padding:8px 16px;border-radius:20px;font-size:11px;font-weight:600;z-index:3000'; el.textContent=m; document.body.appendChild(el); setTimeout(function(){el.remove();},1500); }
render();
}
window.TemplatesService={init:init,__ready:true};
})();
