/**
 * system-pages-service.js — System Pages page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
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
  {id:'home',title:'Home Page',url:'/home',icon:'fa-house',tone:'pink',status:'active',statusLabel:'Published',updated:'Jun 15, 2026',content:'Welcome to Droboard — where stories come alive.'},
  {id:'about',title:'About Us',url:'/about',icon:'fa-circle-info',tone:'blue',status:'active',statusLabel:'Published',updated:'Jun 10, 2026',content:'Droboard is your platform for discovering and sharing great stories.'},
  {id:'contact',title:'Contact Us',url:'/contact',icon:'fa-envelope',tone:'amber',status:'active',statusLabel:'Published',updated:'Jun 8, 2026',content:'Get in touch: support@droboard.com'},
  {id:'terms',title:'Terms of Service',url:'/terms',icon:'fa-file-lines',tone:'purple',status:'active',statusLabel:'Published',updated:'Jun 5, 2026',content:'By using Droboard, you agree to our terms and conditions.'},
  {id:'privacy',title:'Privacy Policy',url:'/privacy',icon:'fa-shield',tone:'green',status:'active',statusLabel:'Published',updated:'Jun 3, 2026',content:'Your privacy matters. We collect minimal data to serve you better.'},
  {id:'faq',title:'FAQ',url:'/faq',icon:'fa-question-circle',tone:'pink',status:'draft',statusLabel:'Draft',updated:'May 28, 2026',questions:[{q:'How do I publish a story?',a:'Go to your dashboard, click "Create New", fill in details, and submit for review.'},{q:'How long does review take?',a:'Typically 3-5 business days. You will be notified once approved.'},{q:'Can I edit after publishing?',a:'Yes! Go to Your Library, find your book, and click Edit. Changes go back to SE for approval.'}]} ,
  {id:'help',title:'Help Center',url:'/help',icon:'fa-bullhorn',tone:'blue',status:'draft',statusLabel:'Draft',updated:'May 25, 2026',content:'Find answers and guides to make the most of Droboard.'},
  {id:'guidelines',title:'Community Guidelines',url:'/guidelines',icon:'fa-gavel',tone:'amber',status:'hidden',statusLabel:'Hidden',updated:'May 20, 2026',content:'Be respectful, original, and helpful to fellow writers and readers.'}
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
    return '<div class="page-card" data-page-id="'+esc(p.id)+'"><div class="page-top"><div class="page-icon '+esc(p.tone)+'"><i class="fas '+esc(p.icon)+'"></i></div><div><div class="page-title">'+esc(p.title)+'</div><div class="page-url">'+esc(p.url)+'</div></div></div><div class="page-status"><span class="status-dot '+esc(p.status)+'"></span> '+esc(p.statusLabel)+' · Last updated: '+esc(p.updated)+'</div><div class="page-actions"><button class="btn-view" data-view="'+esc(p.id)+'" title="View page">View</button> <button class="btn-edit" data-edit="'+esc(p.id)+'" title="Edit page">Edit</button></div></div>';
  }).join('');
  el.querySelectorAll('[data-view]').forEach(function(b){
    b.addEventListener('click', function(){ openPageEditor(this.dataset.view); });
  });
  el.querySelectorAll('[data-edit]').forEach(function(b){
    b.addEventListener('click', function(){ openPageEditor(this.dataset.edit); });
  });
}
function openPageEditor(pageId){
  var p = PAGES.find(function(x){ return x.id === pageId; }) || {};
  
  // Replace the grid directly with editor form
  var container = document.getElementById('pagesGrid');
  if(!container) return;
  
  var simpleEditor = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:32px;max-width:900px;margin:32px auto"><h2 style="font-size:18px;font-weight:800;margin-bottom:24px">Editing '+esc(p.title)+'</h2>' +
    '<div class="form-group" style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:8px">Page Title</label><input type="text" id="editTitle" value="'+esc(p.title||'')+'" style="width:100%;padding:12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px"/></div>' +
    '<div class="form-group" style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:8px">URL Path</label><input type="text" id="editUrl" value="'+esc(p.url||'')+'" style="width:100%;padding:12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px"/><small style="color:var(--text-faint);font-size:10.5px;margin-top:6px;display:block">Use format like /about or /help-center</small></div>';
  
  if(p.id === 'faq') {
    var faqQuestions = p.questions || [];
    simpleEditor += '<div class="form-group" style="margin-bottom:24px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:12px">Frequently Asked Questions</label>' +
      '<div id="qaContainer_' + pageId + '" style="display:flex;flex-direction:column;gap:16px">'+faqQuestions.map(function(qa, i){
        return '<div class="qa-pair" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:16px"><div style="display:flex;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:700;color:var(--text-faint);min-width:24px">Q'+(i+1)+'</span>' +
          '<input type="text" class="qa-question" placeholder="Enter question..." value="'+esc(qa.q||'')+'" style="flex:1;padding:10px;border:1px solid var(--input-border);border-radius:6px;background:#fff;color:var(--text);font-size:12.5px"/></div>' +
          '<div style="display:flex;gap:8px"><span style="font-size:11px;font-weight:700;color:var(--text-faint);min-width:24px">A</span>' +
          '<textarea class="qa-answer" rows="3" placeholder="Enter answer..." style="flex:1;padding:10px;border:1px solid var(--input-border);border-radius:6px;background:#fff;color:var(--text);font-size:12.5px">'+esc(qa.a||'')+'</textarea></div>' +
          '<button class="remove-qa" style="margin-top:10px;padding:6px 12px;background:var(--red);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Remove Question</button></div>';
      }).join('')+'</div>' +
      '<button id="addQABtn_'+pageId+'" style="margin-top:12px;padding:10px 18px;background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue);border-radius:6px;font-size:12px;font-weight:700;cursor:pointer">+ Add More Question</button></div>';
    
    // Build complete editor with HTML then attach all handlers synchronously
    simpleEditor += '<div class="form-group" style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:8px">Status</label><select id="editStatus" style="width:100%;padding:12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px"><option value="active" '+((p.status||'')==='active'?'selected':'')+'>Published</option><option value="draft" '+((p.status||'')==='draft'?'selected':'')+'>Draft</option><option value="hidden" '+((p.status||'')==='hidden'?'selected':'')+'>Hidden</option></select></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:32px"><button id="savePageBtn" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Save Changes</button><button id="cancelPageBtn" style="padding:12px 24px;background:var(--card);color:var(--text);border:1px solid var(--input-border);border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Cancel</button></div></div>';
    
    container.innerHTML = simpleEditor;
    
    // Attach cancel handler
    var cancelBtn = document.getElementById('cancelPageBtn');
    if(cancelBtn) cancelBtn.onclick = function(){ render(); };
    
    // Attach add QA handler
    var addBtn = document.getElementById('addQABtn_'+pageId);
    if(addBtn) addBtn.onclick = function(){
      var qaCont = document.getElementById('qaContainer_'+pageId);
      var cnt = qaCont.querySelectorAll('.qa-pair').length + 1;
      qaCont.insertAdjacentHTML('beforeend', '<div class="qa-pair" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:8px;padding:16px"><div style="display:flex;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:700;color:var(--text-faint);min-width:24px">Q'+cnt+'</span>' +
        '<input type="text" class="qa-question" placeholder="Enter question..." style="flex:1;padding:10px;border:1px solid var(--input-border);border-radius:6px;background:#fff;color:var(--text);font-size:12.5px"/></div>' +
        '<div style="display:flex;gap:8px"><span style="font-size:11px;font-weight:700;color:var(--text-faint);min-width:24px">A</span>' +
        '<textarea class="qa-answer" rows="3" placeholder="Enter answer..." style="flex:1;padding:10px;border:1px solid var(--input-border);border-radius:6px;background:#fff;color:var(--text);font-size:12.5px"></textarea></div>' +
        '<button class="remove-qa" style="margin-top:10px;padding:6px 12px;background:var(--red);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Remove Question</button></div>');
      qaCont.parentElement.querySelectorAll('.remove-qa').forEach(function(btn){ btn.onclick = function(){ this.closest('.qa-pair').remove(); }; });
    };
    
    // Attach remove QA handlers for existing ones
    container.querySelectorAll('.remove-qa').forEach(function(btn){
      btn.onclick = function(){ this.closest('.qa-pair').remove(); };
    });
    
    // Attach save handler
    var saveBtn = document.getElementById('savePageBtn');
    if(saveBtn) saveBtn.onclick = function(){
      p.title = document.getElementById('editTitle').value;
      p.url = document.getElementById('editUrl').value;
      var qaCont = document.getElementById('qaContainer_'+pageId);
      p.questions = Array.from(qaCont.querySelectorAll('.qa-pair')).map(function(pair){ return { q: pair.querySelector('.qa-question').value, a: pair.querySelector('.qa-answer').value }; });
      p.status = document.getElementById('editStatus').value;
      p.updated = 'Just now';
      var idx = PAGES.findIndex(function(x){ return x.id === pageId; });
      if(idx > -1) PAGES[idx] = p;
      render();
      toast('FAQ saved successfully.');
    };
    
  } else {
    simpleEditor += '<div class="form-group" style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:8px">Content (Plain text)</label><textarea id="editBody" rows="12" style="width:100%;padding:12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px;font-family:inherit">'+esc(p.content||'')+'</textarea><small style="color:var(--text-faint);font-size:10.5px;margin-top:6px;display:block">Write your page content here in plain text</small></div>';
    
    // Complete editor HTML
    simpleEditor += '<div class="form-group" style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:var(--text-faint);margin-bottom:8px">Status</label><select id="editStatus" style="width:100%;padding:12px;border:1px solid var(--input-border);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px"><option value="active" '+((p.status||'')==='active'?'selected':'')+'>Published</option><option value="draft" '+((p.status||'')==='draft'?'selected':'')+'>Draft</option><option value="hidden" '+((p.status||'')==='hidden'?'selected':'')+'>Hidden</option></select></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:32px"><button id="savePageBtn" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Save Changes</button><button id="cancelPageBtn" style="padding:12px 24px;background:var(--card);color:var(--text);border:1px solid var(--input-border);border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Cancel</button></div></div>';
    
    container.innerHTML = simpleEditor;
    
    // Attach handlers
    var cancelBtn = document.getElementById('cancelPageBtn');
    var saveBtn = document.getElementById('savePageBtn');
    
    if(cancelBtn) cancelBtn.onclick = function(){ render(); };
    
    if(saveBtn) saveBtn.onclick = function(){
      p.title = document.getElementById('editTitle').value;
      p.url = document.getElementById('editUrl').value;
      p.content = document.getElementById('editBody').value;
      p.status = document.getElementById('editStatus').value;
      p.updated = 'Just now';
      var idx = PAGES.findIndex(function(x){ return x.id === pageId; });
      if(idx > -1) PAGES[idx] = p;
      render();
      toast('Page saved successfully.');
    };
  }
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
  SuperAdminSidebar.attach('#dashboardRoot',{activeItem:'system-pages',title:'System Pages',subtitle:'Status of every system and static page on your platform',user:{name:'Tobi Adenuga',role:'Super Admin',avatar:'https://i.pravatar.cc/100?img=68'},notifCount:9,hideSearch:true});
  loadData().then(render);
}

window.SystemPagesService = { init:init, __ready:true };
})();
