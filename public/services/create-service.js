/* ═══════════════════════════════════════════════════════════════
   CREATE SERVICE — call-and-render for public/Pages/create.html
   create.html is markup only; ALL page logic lives here, moved VERBATIM.
   Backend-ready pattern only: USE_API=false, API_BASE='/api' (no fetch
   calls implemented yet). When going live: set USE_API=true, update
   API_BASE, add fetch calls.
   Wiring: <script src="../services/create-service.js"></script> placed
   synchronously (no defer/async) exactly where the inline block was, so
   parse-time execution order/timing is unchanged. Self-boots on load;
   no init() call needed. Window globals below preserve the onclick contract.
   ═══════════════════════════════════════════════════════════════ */
(function () {

/* Backend-ready pattern only — implement NO fetch calls while false. */
const USE_API=false, API_BASE='/api';

/* ══════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════ */
const CATEGORIES = ['💔 Betrayal','👑 Family','🎓 Campus','🔥 Revenge','🏙️ Urban Love','💍 Marriage','🌙 Elegy','😱 Thriller'];
const GENRES = ['💔 Betrayal','👑 Family','✨ Twist','🏙️ Urban','💍 Marriage','🎓 Campus','🔥 Revenge','💔 Heartbreak','😂 Comedy','😱 Thriller','🤝 Friendship','🔍 Mystery','✨ Inspirational','🙏 Faith','🌙 Elegy'];
const MAX_GENRES = 5, MAX_TAGS = 5;

const DEMO_SERIES = [
  {id:'s1',title:'His Secret and Her Shadow',cover:'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=75',category:'💔 Betrayal',season:1,lastChapter:7},
  {id:'s2',title:'The Lagos Wives',cover:'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=75',category:'💍 Marriage',season:2,lastChapter:14},
  {id:'s3',title:'Campus Confessions',cover:'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=75',category:'🎓 Campus',season:1,lastChapter:4},
  {id:'s4',title:'Midnight Revenge',cover:'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=75',category:'🔥 Revenge',season:1,lastChapter:12},
];

const STOCKS = [
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=75',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&q=75',
  'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=400&q=75',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=75',
  'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&q=75',
  'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=400&q=75',
];

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let state = {
  type: null, uploadedText: '',
  isContinuing: false, chosenSeriesId: null,
  seriesTitle: '', season: 1, chapterNum: 1,
  category: null, genres: [], tags: [],
  coverData: '', title: '', synopsis: '', plot: '',
  chapters: [], // {id, title, content, eng:{poll,pred,debate}}
  pubMode: 'now',
};
let chIdCounter = 0;
let dropdownOpen = false;

function mkEngState(){ return {
  poll:{on:false,expanded:false,q:'',opts:['','']},
  pred:{on:false,expanded:false,q:'',opts:['','','']},
  debate:{on:false,expanded:false,motion:''},
};}

/* Stage order depends on type: 'link' only applies to series.
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
  if (state.type !== 'series') return all.filter(k => k !== 'link');
  return all;
}
let currentIdx = 0; // index into stageOrder()

const STAGE_TITLES = {
  type:'Story Type', link:'Series Link', details:'Details', plot:'Full Plot', chapters:'Chapters', review:'Review'
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
    if (state.isContinuing) return !!state.chosenSeriesId;
    return document.getElementById('seriesTitleInp').value.trim().length>1;
  }
  if (key==='details') return getActiveTitle().trim().length>2 && !!state.category && state.genres.length>0 && document.getElementById('synopsisInput').value.trim().length>4;
  if (key==='plot') return wordCount(document.getElementById('plotInput').value)>=15;
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
    link:'⚠️ Pick a series to continue, or name your new series',
    details:'⚠️ Add a title, category, at least one genre, and a synopsis',
    plot:'⚠️ Add a full plot (15+ words)',
    chapters:'⚠️ Every chapter needs a title and some content (20+ characters)',
    review:'⚠️ Please confirm the agreement checkbox',
  };
  toast(msgs[key] || '⚠️ Please complete this step');
}
function getActiveTitle(){
  if (state.type === 'series'){
    if (state.isContinuing && state.chosenSeriesId){
      const s = DEMO_SERIES.find(x=>x.id===state.chosenSeriesId);
      return s ? s.title : '';
    }
    return document.getElementById('seriesTitleInp').value.trim();
  }
  return document.getElementById('titleInput').value.trim();
}

/* ══════════════════════════════════════════════════════
   STAGE: TYPE
══════════════════════════════════════════════════════ */
function selectType(t){
  state.type = t;
  document.querySelectorAll('.type-card').forEach(c=>c.classList.toggle('sel', c.dataset.type===t));
  document.getElementById('standaloneTitleFg').style.display = t==='series' ? 'none' : '';
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
    if (!document.getElementById('seriesTitleInp').value) document.getElementById('seriesTitleInp').value = titleGuess;
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
   STAGE: SERIES LINK
══════════════════════════════════════════════════════ */
function buildDropdownMenu(){
  document.getElementById('sddMenu').innerHTML = DEMO_SERIES.map(s=>{
    const nextCh = s.lastChapter+1;
    return `<div class="sdd-item" data-id="${s.id}" onclick="chooseSeries('${s.id}')">
      <img class="sdd-item-img" src="${s.cover}" loading="lazy"/>
      <div>
        <div class="sdd-item-title">${esc(s.title)}</div>
        <div class="sdd-item-sub">${s.category} · Season ${s.season} · next: Ch.${nextCh}</div>
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
  document.getElementById('newSeriesTitleFg').style.display = isOn ? 'none' : '';
  if (!isOn){ clearSeriesChoice(); }
  updateNavButtons();
}
function toggleDropdown(){ dropdownOpen = !dropdownOpen; document.getElementById('sddMenu').classList.toggle('show', dropdownOpen); document.getElementById('sddTrigger').classList.toggle('open', dropdownOpen); }
function chooseSeries(id){
  const s = DEMO_SERIES.find(x=>x.id===id); if (!s) return;
  state.chosenSeriesId = id;
  const nextCh = s.lastChapter+1;
  document.getElementById('seasonInp').value = s.season;
  document.getElementById('chapterNumInp').value = nextCh;
  pickCategory(s.category);
  setCover(s.cover);
  document.getElementById('sddFace').innerHTML = `<div class="sdd-sel-inner"><img class="sdd-sel-img" src="${s.cover}"/><div><div class="sdd-sel-title">${esc(s.title)}</div><div class="sdd-sel-meta">Adding Chapter ${nextCh}</div></div></div>`;
  document.getElementById('selStrip').classList.add('show');
  document.getElementById('ssImg').src = s.cover;
  document.getElementById('ssName').textContent = s.title;
  document.getElementById('ssMeta').textContent = `Season ${s.season} · Adding Chapter ${nextCh}`;
  toggleDropdown();
  toast(`✅ Linked to "${s.title}" — writing Chapter ${nextCh}`);
  updateNavButtons();
}
function clearSeriesChoice(){
  state.chosenSeriesId = null;
  document.getElementById('sddFace').innerHTML = `<span class="sdd-ph">Tap to choose a series…</span>`;
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
function pickCategory(c){ state.category = c; renderCategoryGrid(); updateNavButtons(); }
function renderGenreGrid(){
  document.getElementById('genreGrid').innerHTML = GENRES.map(g=>{
    const on = state.genres.includes(g);
    const disabled = !on && state.genres.length>=MAX_GENRES;
    return `<div class="sel-pill${on?' on':''}${disabled?' disabled':''}" onclick="toggleGenre('${g.replace(/'/g,"\\'")}')">${g}</div>`;
  }).join('');
  document.getElementById('genreCounter').textContent = `${state.genres.length} / ${MAX_GENRES} selected`;
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
function applyCoverUrl(){
  const url = document.getElementById('coverUrlInput').value.trim();
  if (!url) { toast('Paste an image URL first'); return; }
  setCover(url);
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
   STAGE: PLOT
══════════════════════════════════════════════════════ */
document.getElementById('plotInput').addEventListener('input', function(){
  state.plot = this.value;
  document.getElementById('plotCount').textContent = `${wordCount(this.value)} words`;
  updateNavButtons();
});

/* ══════════════════════════════════════════════════════
   STAGE: CHAPTERS
══════════════════════════════════════════════════════ */
function renderChapterStageCopy(){
  const isShort = state.type === 'short';
  document.getElementById('chStageTitle').textContent = isShort ? 'Write your story' : 'Write it chapter by chapter';
  document.getElementById('chStageDesc').textContent = isShort
    ? 'A short story is a single piece — write it below, then optionally add a poll/debate/prediction.'
    : 'Write each chapter, then optionally turn on a poll, debate, or prediction for it.';
  document.getElementById('addChBtn').style.display = isShort ? 'none' : 'flex';
  if (isShort && state.chapters.length === 0) addChapter();
  if (!isShort && state.chapters.length === 0) addChapter();
  renderChapters();
}
function addChapter(){
  if (state.type==='short' && state.chapters.length>=1) return;
  chIdCounter++;
  const ch = { id: chIdCounter, title:'', content:'', authorNote:'', open:true, eng: mkEngState() };
  state.chapters.push(ch);
  // Import uploaded text into first chapter only, once
  if (state.uploadedText && state.chapters.length===1){
    ch.content = state.uploadedText.split(/\n\n+/).map(p=>`<p>${esc(p)}</p>`).join('');
  }
  renderChapters();
  updateNavButtons();
  setTimeout(()=>{ document.getElementById(`chCard-${ch.id}`)?.scrollIntoView({behavior:'smooth', block:'center'}); }, 60);
}
function removeChapter(id){
  state.chapters = state.chapters.filter(c=>c.id!==id);
  renderChapters(); updateNavButtons();
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
  const wa = document.getElementById('wa'+id); wa.focus();
  if (cmd==='h1') document.execCommand('formatBlock', false, 'h1');
  else if (cmd==='h2') document.execCommand('formatBlock', false, 'h2');
  else if (cmd==='blockquote') document.execCommand('formatBlock', false, 'blockquote');
  else document.execCommand(cmd);
  updateChWordCount(id);
}
function insertSceneBreak(id){
  const wa = document.getElementById('wa'+id); wa.focus();
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
          ${!isShort && idx>0?`<div class="ch-mini-btn" onclick="moveChapter(${ch.id},-1)"><i class="fas fa-chevron-up"></i></div>`:''}
          ${!isShort && idx<state.chapters.length-1?`<div class="ch-mini-btn" onclick="moveChapter(${ch.id},1)"><i class="fas fa-chevron-down"></i></div>`:''}
          ${!isShort?`<div class="ch-mini-btn danger" onclick="removeChapter(${ch.id})"><i class="fas fa-trash"></i></div>`:''}
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
            <div class="mt-btn" onclick="fmtCh(${ch.id},'bold')"><i class="fas fa-bold"></i></div>
            <div class="mt-btn" onclick="fmtCh(${ch.id},'italic')"><i class="fas fa-italic"></i></div>
            <div class="mt-div"></div>
            <div class="mt-lbl" onclick="fmtCh(${ch.id},'h1')">H1</div>
            <div class="mt-lbl" onclick="fmtCh(${ch.id},'h2')">H2</div>
            <div class="mt-div"></div>
            <div class="mt-btn" onclick="fmtCh(${ch.id},'blockquote')"><i class="fas fa-quote-left"></i></div>
            <div class="mt-btn" onclick="insertSceneBreak(${ch.id})"><i class="fas fa-minus"></i></div>
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
function renderReview(){
  state.chapters.forEach(ch=>syncChapterContent(ch.id));
  document.getElementById('reviewCover').style.backgroundImage = state.coverData ? `url('${state.coverData}')` : 'none';
  document.getElementById('reviewTitle').textContent = getActiveTitle() || 'Untitled Story';
  document.getElementById('reviewBadges').innerHTML = [
    state.type === 'short' ? '📄 Short Story' : '📖 Series',
    state.category || '', ...state.genres
  ].filter(Boolean).map(b=>`<span class="review-badge">${b}</span>`).join('');
  document.getElementById('reviewSynopsis').textContent = document.getElementById('synopsisInput').value.trim() || '—';
  document.getElementById('reviewPlot').textContent = document.getElementById('plotInput').value.trim() || '—';
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
══════════════════════════════════════════════════════ */
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
function submitStory(){
  if (!stageIsValid('review')){ flagInvalid('review'); return; }
  saveDraft(false);
  localStorage.removeItem('droboard_create_story_draft');
  document.querySelectorAll('.stage').forEach(s=>s.classList.remove('active'));
  document.getElementById('successWrap').classList.add('show');
  document.getElementById('wizardNav').style.display = 'none';
  document.getElementById('stepRail').style.display = 'none';
  const label = state.pubMode==='schedule' ? 'Scheduled!' : 'Submitted for review!';
  document.getElementById('successTitle').textContent = label;
  document.getElementById('successSub').textContent = `"${getActiveTitle() || 'Your story'}" has been ${state.pubMode==='schedule'?'scheduled and sent to our editors':'sent to our editors'}. We'll notify you once it's live.`;
  document.getElementById('tbSub').textContent = 'Submitted ✓';
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
buildDropdownMenu();
renderCategoryGrid();
renderGenreGrid();
renderTags();
buildStockRow();
if (isNewChapterMode()) {
  const bid = getNewChapterBookId();
  state.type = 'series';
  state.isContinuing = true;
  state.chosenSeriesId = bid;
  state.chapterNum = 57; // TODO backend: GET next chapter number for bid
  document.querySelector('.tb-h').textContent = 'Add New Chapter';
  document.getElementById('tbSub').textContent = 'Book ' + bid + ' · Chapters';
  goToStage(0); // chapters (order is [chapters, review] in this mode)
  if (state.chapters.length === 0) addChapter();
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
window.chooseSeries = chooseSeries;
window.clearSeriesChoice = clearSeriesChoice;
window.renderCategoryGrid = renderCategoryGrid;
window.pickCategory = pickCategory;
window.renderGenreGrid = renderGenreGrid;
window.toggleGenre = toggleGenre;
window.renderTags = renderTags;
window.handleTagKey = handleTagKey;
window.removeTag = removeTag;
window.onTitleInput = onTitleInput;
window.updateCharCount = updateCharCount;
window.handleCoverFile = handleCoverFile;
window.applyCoverUrl = applyCoverUrl;
window.setCover = setCover;
window.buildStockRow = buildStockRow;
window.pickStock = pickStock;
window.renderChapterStageCopy = renderChapterStageCopy;
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
window.saveDraft = saveDraft;
window.submitStory = submitStory;
window.startAnother = startAnother;
window.goBackOrExit = goBackOrExit;

})();
