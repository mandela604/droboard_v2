/* ═══════════════════════════════════════════════════════════════
   CREATE SERVICE — call-and-render for public/Pages/create.html
   create.html is markup only; ALL page logic lives here, moved VERBATIM.
   Backend-ready pattern: USE_API=false, API_BASE='/api'. Demo shapes load
   through the DATA LAYER functions (loadBooks/loadStocks/loadAccountStatus/
   recordSubmission); live paths already POST via postJSON. Going live: flip
   USE_API=true and swap the data-layer function bodies for fetch calls.
   Wiring: <script src="../services/create-service.js"></script> placed
   synchronously (no defer/async) exactly where the inline block was, so
   parse-time execution order/timing is unchanged. Self-boots on load;
   no init() call needed. Window globals below preserve the onclick contract.
   ═══════════════════════════════════════════════════════════════ */
(function () {

/* Backend-ready pattern only: USE_API=false, API_BASE='/api' (demo paths run,
   live paths POST to the backend). Flip USE_API=true when going live. */
const USE_API=false, API_BASE='/api';
const SHORT_MAX = 25; // must match backend books.service SHORT_MAX

/* ══════════════════════════════════════════════════════
   CONFIG
   Category / genre / trope taxonomy comes from the editors'
   Categories & Genres page (window.EditorDemo, active entries
   only). Legacy emoji lists stay as fallback if the data file
   isn't loaded.
══════════════════════════════════════════════════════ */
const EDITOR_TAX = (function () {
  const D = window.EditorDemo || {};
  const active = list => (Array.isArray(list) ? list : []).filter(x => x && x.status !== 'inactive');
  return { categories: active(D.CATEGORIES), genres: active(D.GENRES), tropes: active(D.TROPES) };
})();
const LEGACY_CATEGORIES = ['💔 Betrayal','👑 Family','🎓 Campus','🔥 Revenge','🏙️ Urban Love','💍 Marriage','🌙 Elegy','😱 Thriller'];
const CATEGORIES = EDITOR_TAX.categories.length ? EDITOR_TAX.categories.map(c => c.name) : LEGACY_CATEGORIES;
const GENRES = ['💔 Betrayal','👑 Family','✨ Twist','🏙️ Urban','💍 Marriage','🎓 Campus','🔥 Revenge','💔 Heartbreak','😂 Comedy','😱 Thriller','🤝 Friendship','🔍 Mystery','✨ Inspirational','🙏 Faith','🌙 Elegy'];
const MAX_GENRES = 5, MAX_TAGS = 5, MAX_TROPES = 3;

/* Genres & tropes are tailored to the picked category. A category with no
   specific entries falls back to the full active lists so the step can
   never dead-end. */
function genresFor(cat) {
  if (!cat) return [];
  const own = EDITOR_TAX.genres.filter(g => g.cat === cat).map(g => g.name);
  if (own.length) return own;
  if (EDITOR_TAX.genres.length) return EDITOR_TAX.genres.map(g => g.name);
  return GENRES; // legacy fallback (editor data file not loaded)
}
function tropesFor(cat) {
  if (!cat || !EDITOR_TAX.tropes.length) return [];
  const ownGenres = EDITOR_TAX.genres.filter(g => g.cat === cat).map(g => g.name);
  const own = EDITOR_TAX.tropes.filter(t => ownGenres.indexOf(t.genre) > -1).map(t => t.name);
  if (own.length) return own;
  return EDITOR_TAX.tropes.map(t => t.name);
}

/* ══════════════════════════════════════════════════════
   DATA LAYER — every demo shape is loaded through a function.
   At cutover: change the function bodies to fetch(...), touch
   nothing else. Call sites stay synchronous on the caches.
══════════════════════════════════════════════════════ */
let MY_BOOKS = [];   // author's books — continue-existing-book list
let STOCKS = [];     // stock cover images
let accountStatus = { demoAs:null, flow:null };

function loadBooks(){
  // Live swap:
  //   return fetch(API_BASE+'/author/books',{credentials:'include'})
  //     .then(r=>r.json()).then(list=>{ MY_BOOKS=list; });
  MY_BOOKS = [
    {id:'s1',title:'His Secret and Her Shadow',cover:'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=75',category:'💔 Betrayal',lastChapter:7},
    {id:'s2',title:'The Lagos Wives',cover:'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=75',category:'💍 Marriage',lastChapter:14},
    {id:'s3',title:'Campus Confessions',cover:'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=75',category:'🎓 Campus',lastChapter:4},
    {id:'s4',title:'Midnight Revenge',cover:'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=75',category:'🔥 Revenge',lastChapter:12},
  ];
  return Promise.resolve();
}
function loadStocks(){
  // Live swap: fetch covers library, or keep static CDN list.
  STOCKS = [
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=75',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=75',
    'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=75',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=75',
    'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&q=75',
    'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=75',
  ];
  return Promise.resolve();
}
function loadAccountStatus(){
  // Live swap:
  //   return fetch(API_BASE+'/account/status',{credentials:'include'})
  //     .then(r=>r.json()).then(s=>{ accountStatus=s; });
  try {
    accountStatus = {
      demoAs: localStorage.getItem('droboard_demo_as'),
      flow: JSON.parse(localStorage.getItem('dro_writer_flow') || 'null'),
    };
  } catch (e) { accountStatus = { demoAs:null, flow:null }; }
  return Promise.resolve();
}
function recordSubmission(){
  // Writer-flow flag — demo handoff to the senior-editor review queue.
  // Live swap: POST /api/submissions; the backend review queue owns the
  // flag, so this whole function body gets deleted.
  if (isNewChapterMode()) return;
  try {
    // Approval is sticky: once approved, never downgrade to pending.
    const prev = JSON.parse(localStorage.getItem('dro_writer_flow') || 'null');
    if (!prev || prev.status !== 'approved') {
      localStorage.setItem('dro_writer_flow', JSON.stringify({
        status: 'pending',
        title: getActiveTitle() || 'Untitled Story',
        genre: state.category || (state.genres && state.genres[0]) || '',
        chapters: (state.chapters || []).length,
        at: Date.now(),
      }));
    }
  } catch (e) {}
  loadAccountStatus();
}

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let state = {
  type: null, uploadedText: '',
  isContinuing: false, chosenBookId: null,
  chapterNum: 1,
  category: null, genres: [], tropes: [], tags: [],
  coverData: '', title: '', synopsis: '', plot: '',
  plotActs: [
    { name:'Act 1 — Setup', from:1, to:16, hint:'Introduce your world, main characters, and the problem that kicks everything off.', summary:'', open:true },
    { name:'Act 2 — Escalation', from:17, to:50, hint:'Conflicts deepen, stakes rise, twists land. Most of your chapters live here.', summary:'', open:true },
    { name:'Act 3 — Resolution', from:51, to:60, hint:'Final confrontation, loose ends tied, and how it ends for your characters.', summary:'', open:true },
  ],
  chapters: [], // {id, title, content, eng:{poll,pred,debate}}
  cast: [], // {id, name, role:'Lead'|'Antagonist'|'Support'|'Minor', arc}
  pubMode: 'now', schedAt: '',
};
let chIdCounter = 0;
let castIdCounter = 0;
let dropdownOpen = false;

function mkEngState(){ return {
  poll:{on:false,expanded:false,q:'',opts:['','']},
  pred:{on:false,expanded:false,q:'',opts:['','','']},
  debate:{on:false,expanded:false,motion:''},
};}

/* Stage order depends on type: 'link' only applies to long stories.
   New-chapter mode (from book workspace ?book= &newChapter=1) jumps straight to Chapters. */
function isNewChapterMode(){
  try {
    const p = new URLSearchParams(location.search);
    return p.get('newChapter') === '1' && !!p.get('book');
  } catch(e){ return false; }
}
function getNewChapterBookId(){
  try { return new URLSearchParams(location.search).get('book') || ''; } catch(e){ return ''; }
}
function stageOrder(){
  if (isNewChapterMode()) return ['chapters','review'];
  const all = ['type','link','details','plot','chapters','review'];
  if (state.type !== 'long') return all.filter(k => k !== 'link');
  return all;
}
let currentIdx = 0; // index into stageOrder()

const STAGE_TITLES = {
  type:'Story Type', link:'Book Link', details:'Details', plot:'Full Plot', chapters:'Chapters', review:'Review'
};

/* ══════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════ */
function toast(msg, dur=2200){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), dur);
}
function wordCount(str){ return (str||'').trim().match(/\S+/g)?.length || 0; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function markUnsaved(){ /* hook for future autosave indicator */ }

/* ══════════════════════════════════════════════════════
   STEP RAIL
══════════════════════════════════════════════════════ */
function renderStepRail(){
  const order = stageOrder();
  document.getElementById('stepRail').innerHTML = order.map((key,i)=>{
    const n = i+1;
    const cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : '';
    const icon = i < currentIdx ? '<i class="fas fa-check" style="font-size:9px"></i>' : n;
    return `<div class="step-dot-wrap ${cls}" onclick="jumpToStep(${i})">
      <div class="step-line"></div>
      <div class="step-dot">${icon}</div>
      <div class="step-lbl">${STAGE_TITLES[key]}</div>
    </div>`;
  }).join('');
}
function jumpToStep(i){
  if (i > currentIdx && !stageIsValid(stageOrder()[currentIdx])) { toast('⚠️ Please finish this step first'); return; }
  if (i < currentIdx) goToStage(i);
}

/* ══════════════════════════════════════════════════════
   STAGE NAVIGATION
══════════════════════════════════════════════════════ */
function goToStage(i){
  const order = stageOrder();
  currentIdx = Math.max(0, Math.min(i, order.length-1));
  const key = order[currentIdx];
  document.querySelectorAll('.stage').forEach(s=>s.classList.toggle('active', s.dataset.key === key));
  document.getElementById('tbSub').textContent = `Step ${currentIdx+1} of ${order.length} · ${STAGE_TITLES[key]}`;
  renderStepRail();
  updateNavButtons();
  window.scrollTo({top:0,behavior:'smooth'});
  if (key === 'chapters') renderChapterStageCopy();
  if (key === 'review') renderReview();
}
function nextStage(){
  const order = stageOrder();
  const key = order[currentIdx];
  if (!stageIsValid(key)){ flagInvalid(key); return; }
  if (key === 'review'){ submitStory(); return; }
  // Continuing an existing book: same locked flow as the author center's
  // "+ New Chapter" — jump straight into chapters, everything else read-only.
  if (key === 'link' && state.isContinuing && state.chosenBookId){
    location.href = 'create.html?book=' + encodeURIComponent(state.chosenBookId) + '&newChapter=1';
    return;
  }
  goToStage(currentIdx+1);
}
function prevStage(){ if (currentIdx>0) goToStage(currentIdx-1); }

function updateNavButtons(){
  const order = stageOrder();
  const key = order[currentIdx];
  const backBtn = document.getElementById('wnavBack');
  const nextBtn = document.getElementById('wnavNext');
  backBtn.style.visibility = currentIdx===0 ? 'hidden' : 'visible';
  if (key === 'review'){
    nextBtn.className = 'wnav-btn submit';
    nextBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
  } else {
    nextBtn.className = 'wnav-btn next';
    nextBtn.innerHTML = 'Continue <i class="fas fa-arrow-right" style="font-size:11px"></i>';
  }
  nextBtn.classList.toggle('disabled', !stageIsValid(key));
}

function stageIsValid(key){
  if (key==='type') return !!state.type;
  if (key==='link'){
    if (state.isContinuing) return !!state.chosenBookId;
    return document.getElementById('bookTitleInp').value.trim().length>1;
  }
  if (key==='details') return getActiveTitle().trim().length>2 && !!state.category && state.genres.length>0 && document.getElementById('synopsisInput').value.trim().length>4;
  if (key==='plot') return plotWords()>=15;
  if (key==='chapters') return state.chapters.length>0 && state.chapters.every(c=>{
    const wa = document.getElementById('wa'+c.id);
    const text = (wa ? wa.innerText : (c.content||'').replace(/<[^>]+>/g,' ')) || '';
    return c.title.trim() && text.trim().length>20;
  });
  if (key==='review') return document.getElementById('agreeCheck')?.checked;
  return true;
}
function flagInvalid(key){
  const msgs = {
    type:'⚠️ Choose a story type to continue',
    link:'⚠️ Pick a book to continue, or name your new story',
    details:'⚠️ Add a title, category, at least one genre, and a synopsis',
    plot:'⚠️ Summarise your plot across the acts (15+ words)',
    chapters:'⚠️ Every chapter needs a title and some content (20+ characters)',
    review:'⚠️ Please confirm the agreement checkbox',
  };
  toast(msgs[key] || '⚠️ Please complete this step');
}
function getActiveTitle(){
  if (state.type === 'long'){
    if (state.isContinuing && state.chosenBookId){
      const s = MY_BOOKS.find(x=>x.id===state.chosenBookId);
      return s ? s.title : '';
    }
    return document.getElementById('bookTitleInp').value.trim();
  }
  return document.getElementById('titleInput').value.trim();
}

/* ══════════════════════════════════════════════════════
   STAGE: TYPE
══════════════════════════════════════════════════════ */
function selectType(t){
  state.type = t;
  document.querySelectorAll('.type-card').forEach(c=>c.classList.toggle('sel', c.dataset.type===t));
  document.getElementById('standaloneTitleFg').style.display = t==='long' ? 'none' : '';
  updateNavButtons();
}

function triggerFileUpload(){ document.getElementById('fileInput').click(); }
function handleFileSelect(input){
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    state.uploadedText = e.target.result;
    document.getElementById('uploadZone').classList.add('has-file');
    document.getElementById('uzFileName').textContent = file.name;
    document.getElementById('uzFileSub').textContent = `${(file.size/1024).toFixed(1)} KB · Ready to import`;
    // Auto-fill title guess from filename
    const guess = file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
    const titleGuess = guess.charAt(0).toUpperCase()+guess.slice(1);
    if (!document.getElementById('titleInput').value) document.getElementById('titleInput').value = titleGuess;
    if (!document.getElementById('bookTitleInp').value) document.getElementById('bookTitleInp').value = titleGuess;
    toast('✅ File imported — text will fill Chapter 1');
  };
  reader.readAsText(file);
}
function removeUpload(){
  state.uploadedText='';
  document.getElementById('uploadZone').classList.remove('has-file');
  document.getElementById('fileInput').value='';
}

/* ══════════════════════════════════════════════════════
   STAGE: BOOK LINK
   (demo list; live: GET /api/author/books — same shape minus season)
   ══════════════════════════════════════════════════════ */
function buildDropdownMenu(){
  document.getElementById('sddMenu').innerHTML = MY_BOOKS.map(s=>{
    const nextCh = s.lastChapter+1;
    return `<div class="sdd-item" data-id="${s.id}" onclick="chooseBook('${s.id}')">
      <img class="sdd-item-img" src="${s.cover}" loading="lazy"/>
      <div>
        <div class="sdd-item-title">${esc(s.title)}</div>
        <div class="sdd-item-sub">${s.category} · ${s.lastChapter} chapters · next: Ch.${nextCh}</div>
      </div>
    </div>`;
  }).join('');
}
function handleToggleClick(e){ if (e.target.closest('.tog2')) return; const chk=document.getElementById('contChk'); chk.checked=!chk.checked; applyToggleState(chk.checked); }
function handleToggleChange(){ applyToggleState(document.getElementById('contChk').checked); }
function applyToggleState(isOn){
  state.isContinuing = isOn;
  document.getElementById('contTogRow').classList.toggle('on', isOn);
  const block = document.getElementById('continueBlock');
  block.classList.toggle('open', isOn);
  document.getElementById('newBookTitleFg').style.display = isOn ? 'none' : '';
  if (!isOn){ clearBookChoice(); }
  updateNavButtons();
}
function toggleDropdown(){ dropdownOpen = !dropdownOpen; document.getElementById('sddMenu').classList.toggle('show', dropdownOpen); document.getElementById('sddTrigger').classList.toggle('open', dropdownOpen); }
function chooseBook(id){
  const s = MY_BOOKS.find(x=>x.id===id); if (!s) return;
  state.chosenBookId = id;
  const nextCh = s.lastChapter+1;
  state.chapterNum = nextCh;
  pickCategory(s.category);
  setCover(s.cover);
  document.getElementById('sddFace').innerHTML = `<div class="sdd-sel-inner"><img class="sdd-sel-img" src="${s.cover}"/><div><div class="sdd-sel-title">${esc(s.title)}</div><div class="sdd-sel-meta">Adding Chapter ${nextCh}</div></div></div>`;
  document.getElementById('selStrip').classList.add('show');
  document.getElementById('ssImg').src = s.cover;
  document.getElementById('ssName').textContent = s.title;
  document.getElementById('ssMeta').textContent = `${s.lastChapter} chapters · Adding Chapter ${nextCh}`;
  toggleDropdown();
  toast(`✅ Linked to "${s.title}" — writing Chapter ${nextCh}`);
  updateNavButtons();
}
function clearBookChoice(){
  state.chosenBookId = null;
  document.getElementById('sddFace').innerHTML = `<span class="sdd-ph">Tap to choose a book…</span>`;
  document.getElementById('selStrip').classList.remove('show');
  updateNavButtons();
}
document.addEventListener('click', function(e){
  const trigger = document.getElementById('sddTrigger'), menu = document.getElementById('sddMenu');
  if (dropdownOpen && trigger && menu && !trigger.contains(e.target) && !menu.contains(e.target)){ dropdownOpen=false; menu.classList.remove('show'); trigger.classList.remove('open'); }
}, true);

/* ══════════════════════════════════════════════════════
   STAGE: DETAILS
══════════════════════════════════════════════════════ */
function renderCategoryGrid(){
  document.getElementById('categoryGrid').innerHTML = CATEGORIES.map(c=>
    `<div class="sel-pill${state.category===c?' on':''}" onclick="pickCategory('${c.replace(/'/g,"\\'")}')">${c}</div>`).join('');
}
function pickCategory(c){
  const changed = state.category !== c;
  state.category = c;
  if (changed) { state.genres = []; state.tropes = []; }
  renderCategoryGrid();
  revealTaxonomy();
  updateNavButtons();
}
/* Genre + trope groups stay hidden until a category is picked. */
function revealTaxonomy(){
  const cat = state.category;
  const gfg = document.getElementById('genreFg');
  const tf = document.getElementById('tropeFg');
  const hint = document.getElementById('catHint');
  if (hint) hint.style.display = cat ? 'none' : '';
  if (gfg) gfg.style.display = cat ? '' : 'none';
  if (cat) renderGenreGrid();
  const tropes = cat ? tropesFor(cat) : [];
  if (tf) tf.style.display = (cat && tropes.length) ? '' : 'none';
  if (cat && tropes.length) renderTropeGrid();
}
function renderGenreGrid(){
  const list = genresFor(state.category);
  document.getElementById('genreGrid').innerHTML = list.map(g=>{
    const on = state.genres.includes(g);
    const disabled = !on && state.genres.length>=MAX_GENRES;
    return `<div class="sel-pill${on?' on':''}${disabled?' disabled':''}" onclick="toggleGenre('${g.replace(/'/g,"\\'")}')">${g}</div>`;
  }).join('');
  document.getElementById('genreCounter').textContent = `${state.genres.length} / ${MAX_GENRES} selected`;
}
function renderTropeGrid(){
  const list = tropesFor(state.category);
  document.getElementById('tropeGrid').innerHTML = list.map(t=>{
    const on = state.tropes.includes(t);
    const disabled = !on && state.tropes.length>=MAX_TROPES;
    return `<div class="sel-pill${on?' on':''}${disabled?' disabled':''}" onclick="toggleTrope('${t.replace(/'/g,"\\'")}')">${t}</div>`;
  }).join('');
  document.getElementById('tropeCounter').textContent = `${state.tropes.length} / ${MAX_TROPES} selected`;
}
function toggleTrope(t){
  const i = state.tropes.indexOf(t);
  if (i>-1) state.tropes.splice(i,1);
  else { if (state.tropes.length>=MAX_TROPES){ toast(`Max ${MAX_TROPES} tropes`); return; } state.tropes.push(t); }
  renderTropeGrid();
}
function toggleGenre(g){
  const i = state.genres.indexOf(g);
  if (i>-1) state.genres.splice(i,1);
  else { if (state.genres.length>=MAX_GENRES){ toast(`Max ${MAX_GENRES} genres`); return; } state.genres.push(g); }
  renderGenreGrid(); updateNavButtons();
}
function renderTags(){
  const wrap = document.getElementById('tagsWrap');
  const chips = state.tags.map((t,i)=>`<div class="tag-chip">#${esc(t)}<i class="fas fa-times" onclick="removeTag(${i})"></i></div>`).join('');
  wrap.innerHTML = chips + `<input class="tag-input-inline" id="tagInput" placeholder="${state.tags.length>=MAX_TAGS?'Max tags reached':'Type a tag and press Enter…'}" ${state.tags.length>=MAX_TAGS?'disabled':''} onkeydown="handleTagKey(event)"/>`;
  document.getElementById('tagCounter').textContent = `${state.tags.length} / ${MAX_TAGS} added`;
}
function handleTagKey(e){
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const val = e.target.value.trim().replace(/^#/,'');
  if (!val) return;
  if (state.tags.length>=MAX_TAGS){ toast(`Max ${MAX_TAGS} tags`); return; }
  if (state.tags.includes(val)){ toast('Tag already added'); e.target.value=''; return; }
  state.tags.push(val); renderTags();
  document.getElementById('tagInput')?.focus();
}
function removeTag(i){ state.tags.splice(i,1); renderTags(); }
function onTitleInput(){
  const n = document.getElementById('titleInput').value.length;
  document.getElementById('titleCount').textContent = `${n} / 120`;
  updateNavButtons();
}
function updateCharCount(inputId,countId,max){
  const val = document.getElementById(inputId).value;
  const el = document.getElementById(countId);
  el.textContent = `${val.length} / ${max}`;
  el.classList.toggle('warn', val.length > max*0.9);
  updateNavButtons();
}
function handleCoverFile(e){
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => setCover(ev.target.result);
  reader.readAsDataURL(file);
}
function setCover(src){
  state.coverData = src;
  const drop = document.getElementById('coverDrop');
  const img = document.getElementById('coverPreviewImg');
  img.src = src; img.style.display = 'block';
  drop.classList.add('has-img');
  drop.querySelector('.cover-drop-txt').textContent = 'Tap to change cover';
}
function buildStockRow(){
  document.getElementById('stockRow').innerHTML = STOCKS.map((url,i)=>
    `<div class="stock-thumb" id="st${i}" onclick="pickStock('${url}',${i})"><img src="${url}" loading="lazy"/></div>`).join('');
}
function pickStock(url,idx){
  setCover(url);
  document.querySelectorAll('.stock-thumb').forEach(el=>el.classList.remove('picked'));
  document.getElementById(`st${idx}`)?.classList.add('picked');
}

/* ══════════════════════════════════════════════════════
   STAGE: PLOT — three acts, each with a chapter-range chip,
   a plain-English explanation, and a summary textarea.
══════════════════════════════════════════════════════ */
function plotText(){ return state.plotActs.map(a=>a.summary||'').join(' '); }
function plotWords(){ return wordCount(plotText()); }
function renderPlotActs(){
  const el = document.getElementById('plotActs');
  if (!el) return;
  el.innerHTML = state.plotActs.map((a,ai)=>`
    <div class="plot-act">
      <div class="plot-act-top">
        <input class="plot-act-name-inp" value="${escAttr(a.name)}" oninput="renameAct(${ai},this.value)" placeholder="Act name"/>
        <div class="plot-act-actions">
          ${state.plotActs.length>1?`<div class="plot-act-btn danger" onclick="removeAct(${ai})" title="Remove act"><i class="fas fa-trash"></i></div>`:''}
          <div class="plot-act-btn" onclick="toggleAct(${ai})" title="${a.open?'Collapse':'Expand'}"><i class="fas fa-chevron-down plot-act-arrow ${a.open?'open':''}"></i></div>
        </div>
      </div>
      <div class="plot-act-body ${a.open?'open':''}">
        <div class="plot-act-range-row"><span class="plot-act-count">Ch.&nbsp;<input type="number" min="1" class="plot-range-inp" value="${a.from}" oninput="updatePlotRange(${ai},'from',this.value)"/>&nbsp;–&nbsp;<input type="number" min="1" class="plot-range-inp" value="${a.to}" oninput="updatePlotRange(${ai},'to',this.value)"/></span></div>
        ${a.hint?`<div class="plot-act-hint">${esc(a.hint)}</div>`:''}
        <textarea class="plot-act-summary" rows="3" placeholder="Summarise what happens in this act…" oninput="updatePlotAct(${ai},this.value)">${esc(a.summary)}</textarea>
      </div>
    </div>`).join('')
    + `<button type="button" class="plot-acts-add" onclick="addAct()"><i class="fas fa-plus"></i> Add another act</button>`;
  updatePlotCount();
}
function toggleAct(ai){ state.plotActs[ai].open = !state.plotActs[ai].open; renderPlotActs(); }
function renameAct(ai,v){ state.plotActs[ai].name=v; }
function removeAct(ai){
  if (state.plotActs.length<=1){ toast('Keep at least one act'); return; }
  state.plotActs.splice(ai,1);
  renderPlotActs();
}
function addAct(){
  const last=state.plotActs[state.plotActs.length-1];
  const from=(last?Number(last.to)||1:0)+1;
  state.plotActs.push({ name:`Act ${state.plotActs.length+1} — New act`, from, to:from+9, hint:'', summary:'', open:true });
  renderPlotActs();
}

/* Optional cast — mirrors the author center's Characters card (avatar,
   age · archetype, arc, trait tags). Photo/stats live in the author center
   after approval; create flow keeps the planning shape. Never blocks Next. */
const CAST_ROLES = ['Protagonist','Lead','Antagonist','Love Interest','Mentor','Support','Minor','Other'];
const MAX_CAST_TRAITS = 4;
function displayRole(c){ return c.role==='Other' ? ((c.roleOther||'').trim() || 'Other') : c.role; }
const CAST_TRAIT_PRESETS = ['Ruthless','Guarded','Business Heir','Anti-hero','Loyal','Proud','Shy','Sassy','Clever','Revengeful','Naive','Hot-tempered'];
const CAST_GRADS = ['linear-gradient(135deg,#f43f5e,#fb7185)','linear-gradient(135deg,#8b5cf6,#a78bfa)','linear-gradient(135deg,#0ea5e9,#38bdf8)','linear-gradient(135deg,#f59e0b,#fbbf24)','linear-gradient(135deg,#10b981,#34d399)','linear-gradient(135deg,#6366f1,#818cf8)'];
function initialsOf(name){
  const parts=(name||'').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase();
}
function renderCast(){
  const el = document.getElementById('castList'); if (!el) return;
  el.innerHTML = state.cast.length ? state.cast.map((c,ci)=>`
    <div class="cast-row">
      <div class="cast-top">
        <div class="cast-av" style="background:${CAST_GRADS[ci%CAST_GRADS.length]}" onclick="document.getElementById('castFile-${c.id}').click()" title="Tap to add photo">
          ${c.img?`<img class="cast-av-img" src="${c.img}" alt=""/>`:`<span id="cav-${c.id}">${initialsOf(c.name)}</span>`}
          <input type="file" accept="image/*" id="castFile-${c.id}" style="display:none" onchange="handleCastFile(${c.id},this)"/>
        </div>
        <div class="cast-top-main">
          <div class="cast-name-line">
            <input class="cast-name-inp" value="${escAttr(c.name)}" placeholder="Character name" oninput="updateCastMember(${c.id},'name',this.value)"/>
            <select class="cast-role-sel" onchange="setCastRole(${c.id},this.value)">
              ${CAST_ROLES.map(r=>`<option${c.role===r?' selected':''}>${r}</option>`).join('')}
            </select>
            <div class="plot-act-btn" onclick="toggleCast(${c.id})" title="${c.open?'Collapse':'Expand'}"><i class="fas fa-chevron-down cast-arrow ${c.open?'open':''}"></i></div>
            <div class="cast-del" onclick="removeCastMember(${c.id})" title="Remove"><i class="fas fa-times"></i></div>
          </div>
          <div class="cast-meta-line">
            ${c.role==='Other'?`<input class="cast-role-other-inp" value="${escAttr(c.roleOther||'')}" placeholder="Role name" oninput="updateCastMember(${c.id},'roleOther',this.value)"/><span class="cast-meta-dot">·</span>`:''}
            <input class="cast-age-inp" type="number" min="1" value="${escAttr(c.age)}" placeholder="Age" oninput="updateCastMember(${c.id},'age',this.value)"/>
            <span class="cast-meta-dot">·</span>
            <input class="cast-arch-inp" value="${escAttr(c.archetype)}" placeholder="Anti-hero, shy girl, mama's boy…" oninput="updateCastMember(${c.id},'archetype',this.value)"/>
          </div>
        </div>
      </div>
      <div class="cast-body ${c.open?'open':''}">
        <input class="cast-arc-inp" value="${escAttr(c.arc)}" placeholder="One-line arc — e.g. Starts cold; ends choosing trust." oninput="updateCastMember(${c.id},'arc',this.value)"/>
        <div class="cast-presets">
          ${CAST_TRAIT_PRESETS.map(t=>`<div class="cast-preset${c.traits.indexOf(t)>-1?' on':''}" onclick="toggleCastTrait(${c.id},'${t}')">${t}</div>`).join('')}
        </div>
        <div class="cast-tags">
          ${c.traits.map(t=>`<span class="cast-tag">${esc(t)}<i class="fas fa-times" onclick="removeCastTraitOf(${c.id},'${t.replace(/'/g,"\\'")}')"></i></span>`).join('')}
          <input class="cast-tag-inp" placeholder="+ trait" maxlength="20" onkeydown="if(event.key==='Enter'){event.preventDefault();addCastTrait(${c.id},this.value,this)}"/>
        </div>
      </div>
    </div>`).join('')
    : `<div class="cast-empty">Optional — add the faces of your story so editors see your leads at a glance.</div>`;
}
function addCastMember(){
  if (state.cast.length>=5){ toast('Max 5 characters for now'); return; }
  castIdCounter++;
  state.cast.push({ id:castIdCounter, name:'', role:'Lead', roleOther:'', age:'', archetype:'', arc:'', traits:[], img:'', open:true });
  renderCast();
}
function removeCastMember(id){ state.cast = state.cast.filter(c=>c.id!==id); renderCast(); }
function updateCastMember(id,field,val){
  const c=state.cast.find(x=>x.id===id); if (!c) return;
  c[field]=val;
  // Live initials — only when there's no photo covering the avatar
  if (field==='name' && !c.img){
    const av=document.getElementById('cav-'+id);
    if (av) av.textContent=initialsOf(val);
  }
}
function setCastRole(id,role){ const c=state.cast.find(x=>x.id===id); if (c) c.role=role; renderCast(); }
function toggleCast(id){ const c=state.cast.find(x=>x.id===id); if (c) c.open=!c.open; renderCast(); }
function handleCastFile(id, input){
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => { const c=state.cast.find(x=>x.id===id); if (c){ c.img=e.target.result; renderCast(); } };
  r.readAsDataURL(f);
}
function toggleCastTrait(id,t){
  const c=state.cast.find(x=>x.id===id); if (!c) return;
  const i=c.traits.indexOf(t);
  if (i>-1) c.traits.splice(i,1);
  else { if (c.traits.length>=MAX_CAST_TRAITS){ toast(`Max ${MAX_CAST_TRAITS} traits`); return; } c.traits.push(t); }
  renderCast();
}
function addCastTrait(id,val){
  const c=state.cast.find(x=>x.id===id); if (!c) return;
  const t=(val||'').trim(); if (!t) return;
  if (c.traits.indexOf(t)>-1){ toast('Already added'); return; }
  if (c.traits.length>=MAX_CAST_TRAITS){ toast(`Max ${MAX_CAST_TRAITS} traits`); return; }
  c.traits.push(t); renderCast();
}
function removeCastTraitOf(id,t){ const c=state.cast.find(x=>x.id===id); if (!c) return; const i=c.traits.indexOf(t); if (i>-1) c.traits.splice(i,1); renderCast(); }
function updatePlotRange(ai,field,val){
  let n = parseInt(val,10); if (!Number.isFinite(n) || n<1) n=1;
  state.plotActs[ai][field]=n;
}
function updatePlotAct(ai,v){
  state.plotActs[ai].summary=v;
  state.plot = plotText();
  updatePlotCount(); updateNavButtons();
}
function updatePlotCount(){
  const el = document.getElementById('plotCount');
  if (el) el.textContent = `${plotWords()} words`;
}

/* ══════════════════════════════════════════════════════
   STAGE: CHAPTERS
══════════════════════════════════════════════════════ */
function renderChapterStageCopy(){
  const isShort = state.type === 'short';
  document.getElementById('chStageTitle').textContent = isShort ? 'Write your story' : 'Write it chapter by chapter';
  document.getElementById('chStageDesc').textContent = isShort
    ? `A short story holds up to ${SHORT_MAX} chapters — write below, then optionally add a poll/debate/prediction.`
    : 'Write each chapter, then optionally turn on a poll, debate, or prediction for it.';
  document.getElementById('addChBtn').style.display = (isShort && state.chapters.length>=SHORT_MAX) ? 'none' : 'flex';
  if (isShort && state.chapters.length === 0) addChapter();
  if (!isShort && state.chapters.length === 0) addChapter();
  renderChapters();
}
function refreshAddBtn(){
  const btn = document.getElementById('addChBtn');
  if (!btn) return;
  btn.style.display = (state.type==='short' && state.chapters.length>=SHORT_MAX) ? 'none' : 'flex';
}
function addChapter(){
  if (state.type==='short' && state.chapters.length>=SHORT_MAX){ toast(`Short stories hold max ${SHORT_MAX} chapters`); return; }
  chIdCounter++;
  const ch = { id: chIdCounter, title:'', content:'', authorNote:'', open:true, eng: mkEngState() };
  state.chapters.push(ch);
  // Import uploaded text into first chapter only, once
  if (state.uploadedText && state.chapters.length===1){
    ch.content = state.uploadedText.split(/\n\n+/).map(p=>`<p>${esc(p)}</p>`).join('');
  }
  renderChapters();
  refreshAddBtn();
  updateNavButtons();
  setTimeout(()=>{ document.getElementById(`chCard-${ch.id}`)?.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
}
function removeChapter(id){
  state.chapters = state.chapters.filter(c=>c.id!==id);
  renderChapters(); refreshAddBtn(); updateNavButtons();
}
function toggleChapterOpen(id){
  syncChapterContent(id);
  const ch = state.chapters.find(c=>c.id===id); if (!ch) return;
  ch.open = !ch.open; renderChapters();
}
function moveChapter(id, dir){
  syncChapterContent(id);
  const i = state.chapters.findIndex(c=>c.id===id); const j = i+dir;
  if (j<0 || j>=state.chapters.length) return;
  [state.chapters[i], state.chapters[j]] = [state.chapters[j], state.chapters[i]];
  renderChapters();
}
function updateChTitle(id, val){
  const ch = state.chapters.find(c=>c.id===id); if (!ch) return;
  ch.title = val;
  const dispTitle = document.getElementById('chTitle-disp-'+id);
  if (dispTitle) dispTitle.textContent = val.trim() || 'Untitled chapter';
  updateNavButtons();
}
/* Persist the contenteditable's current HTML into state so re-renders never wipe what was typed */
function syncChapterContent(id){
  const ch = state.chapters.find(c=>c.id===id); if (!ch) return;
  const wa = document.getElementById('wa'+id);
  if (wa) ch.content = wa.innerHTML;
  const nt = document.getElementById('note'+id);
  if (nt) ch.authorNote = nt.value.slice(0, 500);
}
function updateAuthorNote(id, val){
  const ch = state.chapters.find(c=>c.id===id); if (!ch) return;
  ch.authorNote = (val || '').slice(0, 500);
  const cnt = document.getElementById('noteCount'+id);
  if (cnt) cnt.textContent = `${ch.authorNote.length}/500`;
}
function updateChWordCount(id){
  syncChapterContent(id);
  const wa = document.getElementById('wa'+id);
  const wc = wordCount(wa?.innerText || '');
  const el = document.getElementById('wc-disp-'+id);
  if (el) el.textContent = `${wc} words`;
  const sub = document.getElementById('chSub-disp-'+id);
  const ch = state.chapters.find(c=>c.id===id);
  if (sub && ch){
    const tags = [];
    if (ch.eng.poll.on) tags.push('poll');
    if (ch.eng.pred.on) tags.push('prediction');
    if (ch.eng.debate.on) tags.push('debate');
    sub.textContent = `${wc} words${tags.length?' · '+tags.join(', '):''}`;
  }
  updateNavButtons();
}
function fmtCh(id, cmd){
  const wa = document.getElementById('wa'+id); if (!wa) return;
  let sel = document.getSelection();
  // Only steal focus if the caret/selection isn't already inside the editor
  if (!sel || !sel.anchorNode || !wa.contains(sel.anchorNode)){ wa.focus(); sel = document.getSelection(); }
  if (cmd==='bold' || cmd==='italic'){ document.execCommand(cmd); updateChWordCount(id); return; }
  const tag = { h5:'h5', blockquote:'blockquote' }[cmd];
  if (!tag) return;
  let node = sel && sel.anchorNode;
  if (node && node.nodeType===3) node = node.parentElement;
  const inside = node && node.closest ? node.closest(tag) : null;
  if (inside){
    // Toggle OFF: pull the content back out into a plain paragraph
    const p = document.createElement('p');
    p.innerHTML = inside.innerHTML;
    inside.replaceWith(p);
    const r = document.createRange();
    r.selectNodeContents(p); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
  } else {
    // Toggle ON: same call the original toolbar used (keeps the red-line look)
    document.execCommand('formatBlock', false, tag);
  }
  updateChWordCount(id);
}
function insertSceneBreak(id){
  const wa = document.getElementById('wa'+id); if (!wa) return;
  const sel = document.getSelection();
  if (!sel || !sel.anchorNode || !wa.contains(sel.anchorNode)) wa.focus();
  document.execCommand('insertHTML', false, '<p style="text-align:center;color:#555;letter-spacing:.3em">✦ ✦ ✦</p><p><br></p>');
  updateChWordCount(id);
}

/* Engagement */
function toggleEngTool(chId, type){
  syncChapterContent(chId);
  const ch = state.chapters.find(c=>c.id===chId); if (!ch) return;
  ch.eng[type].on = !ch.eng[type].on;
  ch.eng[type].expanded = ch.eng[type].on; // auto-expand when turning on, auto-collapse when off
  renderChapters();
  updateChWordCount(chId);
}
/* Header-only click: expand/collapse the accordion body without touching the on/off switch */
function toggleEngExpand(chId, type){
  syncChapterContent(chId);
  const ch = state.chapters.find(c=>c.id===chId); if (!ch) return;
  if (!ch.eng[type].on) return;
  ch.eng[type].expanded = !ch.eng[type].expanded;
  renderChapters();
}
function updateEngField(chId, type, field, val){
  const ch = state.chapters.find(c=>c.id===chId); if (!ch) return;
  ch.eng[type][field] = val;
}
function updateOpt(chId, type, i, val){
  const ch = state.chapters.find(c=>c.id===chId); if (!ch) return;
  ch.eng[type].opts[i] = val;
}
function addOpt(chId, type){
  syncChapterContent(chId);
  const ch = state.chapters.find(c=>c.id===chId); if (!ch || ch.eng[type].opts.length>=4) return;
  ch.eng[type].opts.push(''); renderChapters();
}
function removeOpt(chId, type, i){
  syncChapterContent(chId);
  const ch = state.chapters.find(c=>c.id===chId); if (!ch || ch.eng[type].opts.length<=2) return;
  ch.eng[type].opts.splice(i,1); renderChapters();
}

function renderChapters(){
  const list = document.getElementById('chaptersList');
  const empty = document.getElementById('emptyChState');
  const isShort = state.type === 'short';
  document.getElementById('chCountLbl').textContent = isShort ? '1 story piece' : `${state.chapters.length} chapter${state.chapters.length===1?'':'s'}`;

  if (!state.chapters.length){ list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display = 'none';

  function engCard(ch, type, icoClass, name, desc, icon, bodyHtml){
    const e = ch.eng[type];
    const open = e.on && e.expanded;
    return `<div class="eng-card ${e.on?'on':''}">
      <div class="eng-card-hd" onclick="toggleEngExpand(${ch.id},'${type}')">
        <div class="eng-tool-icon ${icoClass}">${icon}</div>
        <div class="eng-tool-label"><div class="eng-tool-name ${icoClass}">${name}</div><div class="eng-tool-desc">${desc}</div></div>
        <label class="mini-tog" onclick="event.stopPropagation()"><input type="checkbox" ${e.on?'checked':''} onchange="toggleEngTool(${ch.id},'${type}')"/><div class="mini-tog-tr"><div class="mini-tog-th"></div></div></label>
        <i class="fas fa-chevron-down eng-arrow ${open?'open':''} ${e.on?'':'disabled'}"></i>
      </div>
      <div class="eng-card-body ${open?'open':''}">${bodyHtml}</div>
    </div>`;
  }

  list.innerHTML = state.chapters.map((ch,idx)=>{
    const eng = ch.eng;

    const pollBody = `
      <div class="eng-config-lbl">Poll question</div>
      <input class="opt-input" style="width:100%;margin-bottom:8px" placeholder="e.g. Who was truly wrong here?" value="${esc(eng.poll.q)}" oninput="updateEngField(${ch.id},'poll','q',this.value)"/>
      <div class="eng-config-lbl">Options</div>
      ${eng.poll.opts.map((o,i)=>`<div class="opt-row"><input class="opt-input" placeholder="Option ${i+1}" value="${esc(o)}" oninput="updateOpt(${ch.id},'poll',${i},this.value)"/>${eng.poll.opts.length>2?`<div class="opt-del" onclick="removeOpt(${ch.id},'poll',${i})"><i class="fas fa-times"></i></div>`:''}</div>`).join('')}
      ${eng.poll.opts.length<4?`<div class="add-opt-btn" onclick="addOpt(${ch.id},'poll')"><i class="fas fa-plus"></i> Add option</div>`:''}`;

    const predBody = `
      <div class="eng-config-lbl">Prediction question</div>
      <input class="opt-input" style="width:100%;margin-bottom:8px" placeholder="e.g. What happens in the next chapter?" value="${esc(eng.pred.q)}" oninput="updateEngField(${ch.id},'pred','q',this.value)"/>
      <div class="eng-config-lbl">Options</div>
      ${eng.pred.opts.map((o,i)=>`<div class="opt-row"><input class="opt-input" placeholder="Prediction ${i+1}" value="${esc(o)}" oninput="updateOpt(${ch.id},'pred',${i},this.value)"/>${eng.pred.opts.length>2?`<div class="opt-del" onclick="removeOpt(${ch.id},'pred',${i})"><i class="fas fa-times"></i></div>`:''}</div>`).join('')}
      ${eng.pred.opts.length<4?`<div class="add-opt-btn" onclick="addOpt(${ch.id},'pred')"><i class="fas fa-plus"></i> Add option</div>`:''}`;

    const debBody = `
      <div class="eng-config-lbl">The motion</div>
      <textarea class="opt-input" style="width:100%;min-height:56px;resize:vertical" placeholder='e.g. "Ada should stay and fight for her marriage."' oninput="updateEngField(${ch.id},'debate','motion',this.value)">${esc(eng.debate.motion)}</textarea>
      <div class="debate-sides-preview">
        <div class="deb-side-prev for">✅ FOR</div>
        <div class="deb-side-prev against">❌ AGAINST</div>
      </div>`;

    return `<div class="ch-card" id="chCard-${ch.id}">
      <div class="ch-card-hd" onclick="toggleChapterOpen(${ch.id})">
        <div class="ch-num-badge">${isShort?'—':idx+1}</div>
        <div class="ch-card-title-wrap">
          <div class="ch-card-title" id="chTitle-disp-${ch.id}">${esc(ch.title.trim()) || 'Untitled chapter'}</div>
          <div class="ch-card-sub" id="chSub-disp-${ch.id}">0 words</div>
        </div>
        <div class="ch-card-actions" onclick="event.stopPropagation()">
          ${!isShort && !isNewChapterMode() && idx>0?`<div class="ch-mini-btn" onclick="moveChapter(${ch.id},-1)"><i class="fas fa-chevron-up"></i></div>`:''}
          ${!isShort && !isNewChapterMode() && idx<state.chapters.length-1?`<div class="ch-mini-btn" onclick="moveChapter(${ch.id},1)"><i class="fas fa-chevron-down"></i></div>`:''}
          ${!isShort && !isNewChapterMode()?`<div class="ch-mini-btn danger" onclick="removeChapter(${ch.id})"><i class="fas fa-trash"></i></div>`:''}
        </div>
        <i class="fas fa-chevron-down ch-arrow ${ch.open?'open':''}"></i>
      </div>
      <div class="ch-card-body ${ch.open?'open':''}">
        <div class="ch-field">
          <label class="ch-field-lbl">${isShort ? 'Story title' : 'Chapter title'}</label>
          <input class="tf-input" value="${esc(ch.title)}" placeholder="${isShort?'e.g. The Runaway Bride':'e.g. The night she asked him to be honest'}" oninput="updateChTitle(${ch.id},this.value)"/>
        </div>
        <div class="ch-field">
          <label class="ch-field-lbl">${isShort ? 'Full story text' : 'Chapter text'}</label>
          <div class="mini-toolbar">
            <div class="mt-btn" onmousedown="event.preventDefault()" onclick="fmtCh(${ch.id},'bold')"><i class="fas fa-bold"></i></div>
            <div class="mt-btn" onmousedown="event.preventDefault()" onclick="fmtCh(${ch.id},'italic')"><i class="fas fa-italic"></i></div>
            <div class="mt-div"></div>
            <div class="mt-lbl" onmousedown="event.preventDefault()" onclick="fmtCh(${ch.id},'h5')">H5</div>
            <div class="mt-div"></div>
            <div class="mt-btn" onmousedown="event.preventDefault()" onclick="fmtCh(${ch.id},'blockquote')"><i class="fas fa-quote-left"></i></div>
            <div class="mt-btn" onmousedown="event.preventDefault()" onclick="insertSceneBreak(${ch.id})"><i class="fas fa-minus"></i></div>
          </div>
          <div class="ch-writing-area" id="wa${ch.id}" contenteditable="true" data-placeholder="Write here…" oninput="updateChWordCount(${ch.id})">${ch.content||''}</div>
          <div class="ch-word-count" id="wc-disp-${ch.id}">0 words</div>
        </div>
        <div class="ch-field">
          <label class="ch-field-lbl">Author's note <span style="opacity:.55;font-weight:500">(optional · shown below content)</span></label>
          <textarea class="opt-input" id="note${ch.id}" style="width:100%;min-height:56px;resize:vertical" maxlength="500" placeholder="e.g. Thanks for reading! Next chapter drops Friday." oninput="updateAuthorNote(${ch.id},this.value)">${esc(ch.authorNote||'')}</textarea>
          <div class="ch-word-count" id="noteCount${ch.id}">${(ch.authorNote||'').length}/500</div>
        </div>

        <div class="eng-block">
          <div class="eng-block-lbl"><i class="fas fa-bolt" style="font-size:9px"></i> Engagement for this chapter (optional)</div>
          ${engCard(ch,'poll','poll','Poll','Ask readers to vote','📊',pollBody)}
          ${engCard(ch,'pred','pred','Prediction',"Let readers guess what's next",'🔮',predBody)}
          ${engCard(ch,'debate','deb','Debate','Readers vote FOR or AGAINST a motion','⚔️',debBody)}
        </div>
      </div>
    </div>`;
  }).join('');

  // Recompute word counts / subtitles for all chapters after (re)render
  state.chapters.forEach(ch=>{
    const wa = document.getElementById('wa'+ch.id);
    const wc = wordCount(wa?.innerText || '');
    const wcEl = document.getElementById('wc-disp-'+ch.id);
    if (wcEl) wcEl.textContent = `${wc} words`;
    const sub = document.getElementById('chSub-disp-'+ch.id);
    if (sub){
      const tags = [];
      if (ch.eng.poll.on) tags.push('poll');
      if (ch.eng.pred.on) tags.push('prediction');
      if (ch.eng.debate.on) tags.push('debate');
      sub.textContent = `${wc} words${tags.length?' · '+tags.join(', '):''}`;
    }
  });
}

/* ══════════════════════════════════════════════════════
   STAGE: REVIEW
══════════════════════════════════════════════════════ */
function setPubMode(mode){
  state.pubMode = mode;
  document.getElementById('pubNowOpt').classList.toggle('sel', mode==='now');
  document.getElementById('pubSchedOpt').classList.toggle('sel', mode==='schedule');
  document.getElementById('schedRow').classList.toggle('show', mode==='schedule');
}
/* First-book submissions go straight to review — no scheduling.
   Demo session/reader state: writer session or an already-approved
   account counts as NOT first book (schedule allowed). */
function isFirstBookSubmission(){
  if (accountStatus.demoAs === 'writer') return false;
  return !(accountStatus.flow && accountStatus.flow.status === 'approved');
}
function applyFirstBookRules(){
  if (!isFirstBookSubmission()) return;
  const opt = document.getElementById('pubSchedOpt');
  const row = document.getElementById('schedRow');
  if (opt) opt.style.display = 'none';
  if (row) row.classList.remove('show');
  state.pubMode = 'now'; state.schedAt = '';
  const now = document.getElementById('pubNowOpt');
  if (now) now.classList.add('sel');
  if (opt) opt.classList.remove('sel');
}
function plotReviewHtml(){
  return state.plotActs.map(a=>{
    const s = (a.summary||'').trim();
    if (!s) return '';
    return `<div style="margin-bottom:8px"><b style="color:var(--tx-high)">${esc(a.name)}</b> <span style="color:var(--tx-faint);font-size:11px">(Ch. ${a.from} – ${a.to})</span><div style="margin-top:2px">${esc(s)}</div></div>`;
  }).join('');
}
function renderReview(){
  applyFirstBookRules();
  // Continuing an existing book: no publish options — the chapter just appends.
  if (isNewChapterMode()){
    state.pubMode = 'now'; state.schedAt = '';
    document.querySelectorAll('.pub-opts').forEach(el=>el.style.display='none');
    const sr = document.getElementById('schedRow'); if (sr) sr.classList.remove('show');
  }
  state.chapters.forEach(ch=>syncChapterContent(ch.id));
  document.getElementById('reviewCover').style.backgroundImage = state.coverData ? `url('${state.coverData}')` : 'none';
  document.getElementById('reviewTitle').textContent = getActiveTitle() || 'Untitled Story';
  document.getElementById('reviewBadges').innerHTML = [
    state.type === 'short' ? '📄 Short Story' : '📖 Long Story',
    state.category || '', ...state.genres, ...state.tropes
  ].filter(Boolean).map(b=>`<span class="review-badge">${b}</span>`).join('');
  document.getElementById('reviewSynopsis').textContent = document.getElementById('synopsisInput').value.trim() || '—';
  document.getElementById('reviewPlot').innerHTML = plotReviewHtml() || '—';
  const castRow = document.getElementById('castReviewRow');
  const castEl = document.getElementById('reviewCast');
  if (castEl){
    const list = state.cast.filter(c=>(c.name||'').trim());
    castEl.innerHTML = list.length
      ? list.map(c=>{
          const meta=[c.age?esc(c.age):'', c.archetype?esc(c.archetype):''].filter(Boolean).join(' · ');
          const traits=(c.traits||[]).length?` <span style="color:var(--tx-faint);font-size:10px">${c.traits.map(t=>esc(t)).join(' · ')}</span>`:'';
          return `<div style="margin-bottom:6px"><b style="color:var(--tx-high)">${esc(c.name.trim())}</b> <span style="color:var(--acc3);font-size:9px;font-weight:800;text-transform:uppercase">${esc(displayRole(c))}</span>${meta?` <span style="color:var(--tx-faint);font-size:11px">— ${meta}</span>`:''}${traits}${(c.arc||'').trim()?`<div style="font-size:11px;color:var(--tx-muted);margin-top:1px">${esc(c.arc.trim())}</div>`:''}</div>`;
        }).join('')
      : '';
    if (castRow) castRow.style.display = list.length ? '' : 'none';
  }
  document.getElementById('reviewChCount').textContent = state.chapters.length;
  document.getElementById('reviewChList').innerHTML = state.chapters.map((c,i)=>{
    const tmp = document.createElement('div'); tmp.innerHTML = c.content || '';
    const wc = wordCount(tmp.innerText || '');
    const engIcons = [c.eng.poll.on?'📊':'',c.eng.pred.on?'🔮':'',c.eng.debate.on?'⚔️':'',(c.authorNote||'').trim()?'📝':''].filter(Boolean).map(e=>`<span>${e}</span>`).join('');
    return `<div class="review-ch-item">
      <div class="review-ch-num">${i+1}</div>
      <div class="review-ch-txt">${esc(c.title.trim()) || 'Untitled chapter'}</div>
      <div class="review-ch-eng">${engIcons}</div>
      <div class="review-ch-words">${wc} words</div>
    </div>`;
  }).join('') || '<div style="font-size:11px;color:var(--tx-faint);padding:8px 0">No chapters added.</div>';
  updateNavButtons();
}

/* ══════════════════════════════════════════════════════
   DRAFT SAVE / SUBMIT
   Demo (USE_API=false): localStorage draft + success screen, so the full
   flow is visible. Live (USE_API=true): POST /api/books/batch (new story)
   or POST /api/books/:id/chapters (new-chapter mode), then success screen.
   ══════════════════════════════════════════════════════ */
function syncReviewControls(){
  // Read the schedule control the review stage renders (was dropped before).
  const sched = document.getElementById('schedDateInp');
  state.schedAt = (state.pubMode==='schedule' && sched) ? sched.value : '';
}
// Demo display names carry emoji ('💔 Betrayal'); live genre names don't.
// Live swap: fetch GET /api/genres and match — until then, strip + send.
function apiGenre(g){ return String(g||'').replace(/^[^\p{L}\p{N}]+/u,'').trim(); }
// Live swap: fetch GET /api/categories and map display→id. Omitted until then
// (backend categoryId is optional; unknown keys must NOT be sent — strict mode).
function buildBookPayload(){
  const kind = state.type === 'short' ? 'short' : 'long';
  const book = {
    title: getActiveTitle(),
    synopsis: document.getElementById('synopsisInput').value.trim(),
    genre: apiGenre(state.genres[0] || ''),
    cover: state.coverData || '',
    tags: state.tags.slice(0, 5),
    kind,
  };
  return book;
}
function buildChapterPayload(ch, idx){
  syncChapterContent(ch.id);
  const tmp = document.createElement('div'); tmp.innerHTML = ch.content || '';
  const out = { n: idx + 1 };
  if ((ch.title||'').trim()) out.title = ch.title.trim();
  if (ch.content) out.content = ch.content;
  const wc = wordCount(tmp.innerText || '');
  if (wc) out.words = wc;
  if ((ch.authorNote||'').trim()) out.authorNote = ch.authorNote.trim().slice(0, 500);
  if (ch.eng.poll.on && ch.eng.poll.q.trim()) {
    const opts = ch.eng.poll.opts.map(o=>String(o||'').trim()).filter(Boolean).slice(0, 4);
    if (opts.length >= 2) out.poll = { q: ch.eng.poll.q.trim().slice(0,300), opts };
  }
  if (ch.eng.pred.on && ch.eng.pred.q.trim()) {
    const opts = ch.eng.pred.opts.map(o=>String(o||'').trim()).filter(Boolean).slice(0, 4);
    if (opts.length >= 2) out.prediction = { q: ch.eng.pred.q.trim().slice(0,300), opts };
  }
  if (ch.eng.debate.on && (ch.eng.debate.motion||'').trim()) out.debate = { motion: ch.eng.debate.motion.trim().slice(0,500) };
  if (state.pubMode==='schedule' && state.schedAt) { out.status = 'scheduled'; out.scheduledAt = state.schedAt; }
  return out;
}
async function postJSON(path, body){
  const res = await fetch(API_BASE + path, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(()=>null);
  if (!res.ok) throw new Error((data && (data.error || data.message)) || ('submit_' + res.status));
  return data;
}
function showSuccess(){
  document.querySelectorAll('.stage').forEach(s=>s.classList.remove('active'));
  document.getElementById('successWrap').classList.add('show');
  document.getElementById('wizardNav').style.display = 'none';
  document.getElementById('stepRail').style.display = 'none';
  const primary = document.getElementById('successPrimaryBtn');
  const ghost = document.getElementById('successGhostBtn');
  if (isNewChapterMode()){
    const bid = getNewChapterBookId();
    document.getElementById('successTitle').textContent = 'Chapter added!';
    document.getElementById('successSub').textContent = `Chapter ${state.chapterNum} has been added to your book. It's live with the rest of the story.`;
    document.getElementById('tbSub').textContent = 'Chapter added ✓';
    if (primary){ primary.textContent = 'Back to book workspace'; primary.onclick = ()=>{ location.href = '../author/book-workspace.html?book=' + encodeURIComponent(bid); }; }
    if (ghost){ ghost.textContent = 'Write another chapter'; ghost.onclick = ()=>{ location.reload(); }; }
    return;
  }
  const label = state.pubMode==='schedule' ? 'Scheduled!' : 'Submitted for review!';
  document.getElementById('successTitle').textContent = label;
  document.getElementById('successSub').textContent = `"${getActiveTitle() || 'Your story'}" has been ${state.pubMode==='schedule'?'scheduled and sent to our editors':'sent to our editors'}. We'll notify you once it's live.`;
  document.getElementById('tbSub').textContent = 'Submitted ✓';
}
function saveDraft(manual){
  try{
    // Sync chapter content from DOM into a serializable snapshot
    state.chapters.forEach(ch=>syncChapterContent(ch.id));
    const snapshot = Object.assign({}, state, {
      chapters: state.chapters.map(c => ({
        id:c.id, title:c.title, eng:c.eng, content: c.content || '', authorNote: (c.authorNote||'').slice(0,500)
      }))
    });
    localStorage.setItem('droboard_create_story_draft', JSON.stringify(snapshot));
    if (manual) toast('💾 Draft saved');
  }catch(e){ if (manual) toast('⚠️ Could not save draft'); }
}
async function submitStory(){
  if (!stageIsValid('review')){ flagInvalid('review'); return; }
  saveDraft(false);
  syncReviewControls();
  if (!USE_API){
    recordSubmission();
    showSuccess(); localStorage.removeItem('droboard_create_story_draft'); return;
  }
  const btn = document.getElementById('wnavNext');
  if (btn) { btn.classList.add('disabled'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…'; }
  try {
    if (isNewChapterMode()) {
      const bid = getNewChapterBookId();
      const ch = state.chapters[0] || { title:'', content:'' };
      await postJSON(`/api/books/${encodeURIComponent(bid)}/chapters`, buildChapterPayload(ch, state.chapterNum - 1));
    } else {
      await postJSON('/api/books/batch', {
        book: buildBookPayload(),
        chapters: state.chapters.map((c, i) => buildChapterPayload(c, i)),
      });
    }
    localStorage.removeItem('droboard_create_story_draft');
    showSuccess();
  } catch(e) {
    toast('⚠️ Submit failed: ' + (e.message || 'network error'));
    updateNavButtons();
  }
}
function startAnother(){
  location.reload();
}
function goBackOrExit(){
  if (currentIdx>0){ prevStage(); return; }
  if (isNewChapterMode()){ location.href = '../author/book-workspace.html?book=' + encodeURIComponent(getNewChapterBookId()); return; }
  saveDraft(false);
  toast('Draft saved · exiting…');
  setTimeout(()=>{ history.back(); }, 700);
}

setInterval(()=>saveDraft(false), 15000);

/* ══════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════ */
loadBooks();
loadStocks();
loadAccountStatus().then(applyFirstBookRules);
buildDropdownMenu();
renderCategoryGrid();
revealTaxonomy();
renderTags();
renderPlotActs();
renderCast();
buildStockRow();
if (isNewChapterMode()) {
  const bid = getNewChapterBookId();
  state.type = 'long';
  state.isContinuing = true;
  state.chosenBookId = bid;
  // Demo number = that book's last chapter + 1; live replaces it with the real count below.
  const demoBook = MY_BOOKS.find(x=>x.id===bid);
  state.chapterNum = demoBook ? demoBook.lastChapter+1 : 1;
  document.querySelector('.tb-h').textContent = 'Add New Chapter';
  document.getElementById('tbSub').textContent = 'Book ' + bid + ' · Ch.' + state.chapterNum;
  goToStage(0); // chapters (order is [chapters, review] in this mode)
  if (state.chapters.length === 0) addChapter();
  if (USE_API) {
    // Live: next number = current chapter count + 1.
    fetch(API_BASE + '/api/books/' + encodeURIComponent(bid) + '/chapters', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null).then(list => {
        const n = Array.isArray(list) ? list.length : (list && list.length);
        if (Number.isInteger(n)) { state.chapterNum = n + 1; document.getElementById('tbSub').textContent = 'Book ' + bid + ' · Chapter ' + state.chapterNum; }
      }).catch(()=>{});
  }
} else {
  goToStage(0);
}

/* ══════════════════════════════════════════════════════
   WINDOW CONTRACT — identical globals the HTML expects.
   (Top-level function declarations in a classic script become
   window props; inside this IIFE we re-expose them explicitly
   so every static + dynamically-rendered onclick/onchange/
   oninput/onkeydown handler resolves exactly as before.)
══════════════════════════════════════════════════════ */
window.mkEngState = mkEngState;
window.isNewChapterMode = isNewChapterMode;
window.getNewChapterBookId = getNewChapterBookId;
window.stageOrder = stageOrder;
window.toast = toast;
window.wordCount = wordCount;
window.esc = esc;
window.markUnsaved = markUnsaved;
window.renderStepRail = renderStepRail;
window.jumpToStep = jumpToStep;
window.goToStage = goToStage;
window.nextStage = nextStage;
window.prevStage = prevStage;
window.updateNavButtons = updateNavButtons;
window.stageIsValid = stageIsValid;
window.flagInvalid = flagInvalid;
window.getActiveTitle = getActiveTitle;
window.selectType = selectType;
window.triggerFileUpload = triggerFileUpload;
window.handleFileSelect = handleFileSelect;
window.removeUpload = removeUpload;
window.buildDropdownMenu = buildDropdownMenu;
window.handleToggleClick = handleToggleClick;
window.handleToggleChange = handleToggleChange;
window.applyToggleState = applyToggleState;
window.toggleDropdown = toggleDropdown;
window.chooseBook = chooseBook;
window.clearBookChoice = clearBookChoice;
window.renderCategoryGrid = renderCategoryGrid;
window.pickCategory = pickCategory;
window.revealTaxonomy = revealTaxonomy;
window.renderGenreGrid = renderGenreGrid;
window.toggleGenre = toggleGenre;
window.renderTropeGrid = renderTropeGrid;
window.toggleTrope = toggleTrope;
window.plotText = plotText;
window.plotWords = plotWords;
window.renderPlotActs = renderPlotActs;
window.updatePlotAct = updatePlotAct;
window.updatePlotRange = updatePlotRange;
window.renameAct = renameAct;
window.removeAct = removeAct;
window.addAct = addAct;
window.toggleAct = toggleAct;
window.renderCast = renderCast;
window.addCastMember = addCastMember;
window.removeCastMember = removeCastMember;
window.updateCastMember = updateCastMember;
window.setCastRole = setCastRole;
window.toggleCast = toggleCast;
window.handleCastFile = handleCastFile;
window.toggleCastTrait = toggleCastTrait;
window.addCastTrait = addCastTrait;
window.removeCastTraitOf = removeCastTraitOf;
window.updatePlotCount = updatePlotCount;
window.renderTags = renderTags;
window.handleTagKey = handleTagKey;
window.removeTag = removeTag;
window.onTitleInput = onTitleInput;
window.updateCharCount = updateCharCount;
window.handleCoverFile = handleCoverFile;
window.setCover = setCover;
window.buildStockRow = buildStockRow;
window.pickStock = pickStock;
window.renderChapterStageCopy = renderChapterStageCopy;
window.refreshAddBtn = refreshAddBtn;
window.addChapter = addChapter;
window.removeChapter = removeChapter;
window.toggleChapterOpen = toggleChapterOpen;
window.moveChapter = moveChapter;
window.updateChTitle = updateChTitle;
window.syncChapterContent = syncChapterContent;
window.updateAuthorNote = updateAuthorNote;
window.updateChWordCount = updateChWordCount;
window.fmtCh = fmtCh;
window.insertSceneBreak = insertSceneBreak;
window.toggleEngTool = toggleEngTool;
window.toggleEngExpand = toggleEngExpand;
window.updateEngField = updateEngField;
window.updateOpt = updateOpt;
window.addOpt = addOpt;
window.removeOpt = removeOpt;
window.renderChapters = renderChapters;
window.setPubMode = setPubMode;
window.renderReview = renderReview;
window.syncReviewControls = syncReviewControls;
window.apiGenre = apiGenre;
window.buildBookPayload = buildBookPayload;
window.buildChapterPayload = buildChapterPayload;
window.postJSON = postJSON;
window.showSuccess = showSuccess;
window.saveDraft = saveDraft;
window.submitStory = submitStory;
window.startAnother = startAnother;
window.goBackOrExit = goBackOrExit;

})();
