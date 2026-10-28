(function(){
'use strict';

/* ── Backend header — live endpoints with demo fallbacks ── */
const USE_API = true;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options || {}));
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch (e) { /* non-JSON error */ }
    const err = new Error((body && body.error) || ('backend error: ' + res.status));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* Demo handoff: review outcomes feed the reader -> writer UI on the profile.
   Backend replaces this once the API owns submissions. Returns true if this
   queue item was the current reader's pending book. */
let LIVE = false;
async function decideReview(id, status, feedback, contract){
  if (!LIVE) return { ok: true, demo: true };
  const body = { action: status, feedback: feedback || undefined };
  if (contract) body.contract = contract;
  return callBackend('/review-queue/' + encodeURIComponent(id), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function recordFlowOutcome(s, status, feedback){
  if (LIVE) return false;
  try {
    const flow = JSON.parse(localStorage.getItem('dro_writer_flow') || 'null');
    if (!flow || flow.status !== 'pending') return false;
    if (flow.title && s.title && cleanTitle(flow.title) !== cleanTitle(s.title)) return false;
    flow.status = status;
    if (feedback) flow.feedback = String(feedback).slice(0, 300);
    flow.at = Date.now();
    localStorage.setItem('dro_writer_flow', JSON.stringify(flow));
    return true;
  } catch (e) { return false; }
}

/* Demo handoff: surface the current reader's pending book at the top of the
   queue so an editor can review it (the API serves this later). */
function ownPendingSubmission(){
  if (LIVE) return null;
  try {
    const flow = JSON.parse(localStorage.getItem('dro_writer_flow') || 'null');
    if (!flow || flow.status !== 'pending' || !flow.title) return null;
    const title = cleanTitle(flow.title);
    return {
      id: 'REV-ME', title, author: 'You_Reader', genre: flow.genre || 'Fiction',
      submitted: 'just now', words: Math.max(MIN_WORDS, Number(flow.words) || 0),
      status: 'pending', priority: 'high', feedback: '',
      chapters: 1, cover: coverFor(title, 0), avatar: null,
      synopsis: flow.synopsis || flow.plot || 'No synopsis provided by the author.',
      kyc: flow.kyc || null,
      editor: CURRENT_EDITOR,
    };
  } catch (e) { return null; }
}

const shell = SeniorEditorSidebar.attach('#queueRoot', {
  activeItem: 'review-queue',
  title: 'Review Queue',
  subtitle: 'Review full book submissions',
  user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
  notifCount: 4,
  onSearch: v => { document.getElementById('searchInput').value = v; currentPg = 1; applyFilters(); }
});

/* Cover art pulled from the Discover page's story assets */
const COVER_MAP = {
  "The CEO's Hidden Son":         'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
  "Wolf King's Vow":              'https://i.postimg.cc/MXBR6bfY/wolf3.jpg',
  'Betrayed by the Mafia Prince': 'https://i.postimg.cc/fkdXzjS8/wolf.jpg',
  'Bound by the Ruthless Alpha':  'https://i.postimg.cc/xqmHfyNR/wolf2.jpg',
  "The Duke's Secret":            'https://i.postimg.cc/fkdXzjSj/wife.jpg',
};
const COVER_FALLBACK = [
  'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
  'https://i.postimg.cc/cgLZJNmC/8.jpg',
  'https://i.postimg.cc/0MyxNqfz/7.jpg',
  'https://i.postimg.cc/N9jY0w4m/5.jpg',
  'https://i.postimg.cc/tY7KnJyr/images.jpg',
];
function coverFor(title, i) { return COVER_MAP[title] || COVER_FALLBACK[i % COVER_FALLBACK.length]; }

const AVATARS = {
  'Luna Skye':       'https://i.pravatar.cc/60?img=24',
  'Elena Vasquez':   'https://i.pravatar.cc/60?img=31',
  'Marcus Webb Jr.': 'https://i.pravatar.cc/60?img=33',
  'Chioma Okafor':   'https://i.pravatar.cc/60?img=5',
  'Lena Park':       'https://i.pravatar.cc/60?img=47',
  'Isabelle Moreau': 'https://i.pravatar.cc/60?img=44',
  'Wren Okonkwo':    'https://i.pravatar.cc/60?img=41',
  'Amara Chen':      'https://i.pravatar.cc/60?img=16',
};

/* Manuscripts are submitted whole (min. 5,000 words), split into a handful of
   opening chapters for review. The raw data file stores older chapter-style
   word counts, so we correct/enrich each submission here to reflect that
   whole-book minimum, and attach a chapter count (4 or 5). */
const OVERRIDE = {
  'REV-001': { words: 5450, chapters: 10 },
  'REV-002': { words: 5600, chapters: 8 },
  'REV-003': { words: 5100, chapters: 10 },
  'REV-004': { words: 5300, chapters: 7 },
  'REV-005': { words: 5150, chapters: 10 },
  'REV-006': { words: 5400, chapters: 9 },
  'REV-007': { words: 5050, chapters: 10 },
  'REV-008': { words: 5250, chapters: 6 },
};
const MIN_WORDS = 5000;

const CURRENT_EDITOR = { name: 'Chioma Reddy', avatar: 'https://i.pravatar.cc/100?img=5' };

function cleanTitle(t){ return t.replace(/\s*-\s*Ch\.\d+$/i, '').trim(); }

/* "Backend" contract types — tries a real endpoint first, falls back to demo
   data since there's no live contracts API yet. */
const DEMO_CONTRACTS = [
  { id: 'standard', label: 'Standard Royalty Contract', detail: '60/40 author-platform split · non-exclusive', type: 'Non_Exclusive', termMonths: 12, revenueSplit: 60 },
  { id: 'premium',  label: 'Premium Exclusive Contract', detail: '70/30 author-platform split · exclusive, 12-month term', type: 'Exclusive_Publishing', termMonths: 12, revenueSplit: 70 },
  { id: 'flex',     label: 'Flex Starter Contract',       detail: '50/50 split · month-to-month, for new authors', type: 'Non_Exclusive', termMonths: 1, revenueSplit: 50 },
];
let CONTRACTS = [];
async function loadContracts(){
  try{
    const live = await callBackend('/contract-types');
    if(!Array.isArray(live) || !live.length) throw new Error('no contract types');
    CONTRACTS = live;
  }catch(err){
    CONTRACTS = JSON.parse(JSON.stringify(DEMO_CONTRACTS));
  }
}

const PER_PAGE = 4;
let allSubs = [], filtered = [], activeStat = 'all', currentPg = 1;
let acceptTargetId = null;

async function loadQueue(){
  try{
    const d = await callBackend('/review-queue');
    if (d && Array.isArray(d.items)) { LIVE = true; return d; }
  }catch(err){ /* fall through to demo */ }
  return SeniorEditorData.getReviewQueue();
}

async function init(){
  await loadContracts();
  const d = await loadQueue();
  const rows = Array.isArray(d) ? d : (d.items || []);
  allSubs = rows.map((it, i) => {
    const title = cleanTitle(it.title || it.book || 'Untitled');
    const ov = OVERRIDE[it.id] || {};
    const words = it.words != null ? it.words : (ov.words != null ? ov.words : MIN_WORDS);
    return {
      ...it,
      title,
      words,
      chapters: it.chapters != null ? it.chapters : (ov.chapters != null ? ov.chapters : (i % 2 === 0 ? 5 : 4)),
      cover: it.cover || coverFor(title, i),
      avatar: it.avatar || AVATARS[it.author] || null,
      genre: it.genre || 'Fiction',
      synopsis: it.synopsis || 'No synopsis provided by the author.',
      priority: it.priority || 'medium',
      submitted: it.submitted || 'just now',
      editor: CURRENT_EDITOR,
    };
  });

  const own = ownPendingSubmission();
  if (own) allSubs.unshift(own);

  buildStats();
  buildFilterPills();
  applyFilters();

  document.getElementById('searchInput').addEventListener('input', () => { currentPg = 1; applyFilters(); });
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeContractModal(); closeSheet(); } });

  document.getElementById('contractModalOv').addEventListener('click', e => { if (e.target.id === 'contractModalOv') closeContractModal(); });
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.row-dots')) {
      document.querySelectorAll('.row-menu.open').forEach(m => m.classList.remove('open'));
    }
  });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const action = el.dataset.action;
    if (action === 'close-contract-modal') closeContractModal();
    if (action === 'cwiz-next'){
      if(wizardStep === 1){
        const cid = document.getElementById('contractType').value;
        if(!cid){ document.getElementById('contractModalError').textContent = 'Please select a contract type.'; document.getElementById('contractModalError').classList.add('show'); return; }
        document.getElementById('contractModalError').classList.remove('show');
        openWizard(2);
      } else if(wizardStep === 2){
        syncPricingFromDOM();
        openWizard(3);
      }
    }
    if (action === 'cwiz-back'){
      if(wizardStep > 1){
        if(wizardStep === 3) syncPricingFromDOM();
        openWizard(wizardStep - 1);
      }
    }
    if (action === 'submit-contract') submitAccept();
  });
  document.getElementById('contractType').addEventListener('change', updateContractHint);
}

function buildStats(){
  const total = allSubs.length;
  const pending = allSubs.filter(s => s.status === 'pending').length;
  const approved = allSubs.filter(s => s.status === 'approved').length;
  const rejected = allSubs.filter(s => s.status === 'rejected').length;
  const stats = [
    { n: total,    l: 'Total Submissions', ico: 'fa-inbox',        clr: 'var(--accent)', bg: 'rgba(255,0,80,.1)' },
    { n: pending,  l: 'Awaiting Review',   ico: 'fa-hourglass-half', clr: 'var(--amber)', bg: 'var(--amber-bg)' },
    { n: approved, l: 'Accepted',          ico: 'fa-file-signature', clr: 'var(--green)', bg: 'var(--green-bg)' },
    { n: rejected, l: 'Declined',          ico: 'fa-xmark',         clr: 'var(--red)',    bg: 'var(--red-bg)' },
  ];
  document.getElementById('statRow').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-ico" style="background:${s.bg};color:${s.clr}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

function buildFilterPills(){
  const statuses = ['all', ...new Set(allSubs.map(s => s.status))];
  const counts = { all: allSubs.length };
  allSubs.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  document.getElementById('filterRow').innerHTML = statuses.map(st => `
    <button class="filter-pill${st===activeStat?' on':''}" data-status="${st}">
      ${st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
      <span class="pill-count">${counts[st] || 0}</span>
    </button>`).join('');
  document.querySelectorAll('.filter-pill').forEach(p => p.addEventListener('click', () => {
    activeStat = p.dataset.status; currentPg = 1;
    document.querySelectorAll('.filter-pill').forEach(x => x.classList.toggle('on', x === p));
    applyFilters();
  }));
}

function applyFilters(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();

  filtered = allSubs.filter(s => {
    const matchSt = activeStat === 'all' || s.status === activeStat;
    const matchQ  = !q || s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q);
    return matchSt && matchQ;
  });

  document.getElementById('subCount').textContent = `${filtered.length} of ${allSubs.length}`;
  const maxPg = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if (currentPg > maxPg) currentPg = maxPg;
  renderPage();
}

function renderPage(){
  const start = (currentPg - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);

  if (!page.length){
    document.getElementById('subList').innerHTML = `<div class="empty-msg">No submissions match your filters.</div>`;
    document.getElementById('pgn').innerHTML = '';
    return;
  }

  document.getElementById('subList').innerHTML = page.map(s => `
    <div class="row-item" data-id="${s.id}">
      <img class="row-cover" src="${s.cover}" alt="${s.title} cover" loading="lazy"/>
      <div class="row-main">
        <div class="row-title">${s.title}</div>
        <div class="row-meta">
          <span>✍️ ${s.author}</span>
          <span class="hide-sm">${s.genre}</span>
          <span>📖 ${s.chapters} ch · ${s.words.toLocaleString()} words</span>
        </div>
        <div class="row-editor">${s.editor.avatar ? '<img src="'+s.editor.avatar+'" alt=""/>' : ''} ${s.editor.name}</div>
      </div>
      <div class="row-tags">
        <span class="status-pill ${s.status}">${s.status}</span>
        <span class="prio-pill ${s.priority}">${s.priority}</span>
      </div>
      <div class="row-dots">
        <button class="row-dots-btn" data-menu="${s.id}"><i class="fas fa-ellipsis-vertical"></i></button>
        <div class="row-menu" id="menu-${s.id}">
          <div class="row-menu-item" data-view-profile="${s.author}"><i class="fas fa-user"></i> View Profile</div>
        </div>
      </div>
    </div>`).join('');

  document.querySelectorAll('.row-item').forEach(el => el.addEventListener('click', e => {
    if (e.target.closest('.row-dots')) return;
    openSheet(el.dataset.id);
  }));
  document.querySelectorAll('.row-dots-btn').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.menu;
      const menu = document.getElementById('menu-' + id);
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.row-menu.open').forEach(m => m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });
  });
  document.querySelectorAll('[data-view-profile]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const author = el.dataset.viewProfile;
      window.location.href = '../Pages/profile.html?author=' + encodeURIComponent(author);
    });
  });
  renderPagination();
}

function renderPagination(){
  const total = filtered.length;
  const maxPg = Math.ceil(total / PER_PAGE);
  if (maxPg <= 1) { document.getElementById('pgn').innerHTML = ''; return; }
  const start = (currentPg - 1) * PER_PAGE + 1;
  const end = Math.min(currentPg * PER_PAGE, total);

  let btns = '';
  for (let i = 1; i <= maxPg; i++) btns += `<button class="page-btn${i===currentPg?' active':''}" data-pg="${i}">${i}</button>`;

  document.getElementById('pgn').innerHTML = `
    <span class="pagination-info">Showing ${start}–${end} of ${total}</span>
    <div class="pagination-controls">
      <button class="page-btn" id="pgPrev" ${currentPg===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
      ${btns}
      <button class="page-btn" id="pgNext" ${currentPg===maxPg?'disabled':''}><i class="fas fa-chevron-right"></i></button>
    </div>`;

  document.getElementById('pgPrev').addEventListener('click', () => { currentPg--; renderPage(); });
  document.getElementById('pgNext').addEventListener('click', () => { currentPg++; renderPage(); });
  document.querySelectorAll('.page-btn[data-pg]').forEach(b => b.addEventListener('click', () => { currentPg = parseInt(b.dataset.pg); renderPage(); }));
}

/* ── Slide-up book preview sheet ── */
function openSheet(id){
  const s = allSubs.find(x => x.id === id); if (!s) return;

  document.getElementById('sheetCover').src = s.cover;
  document.getElementById('sheetCover').alt = s.title;
  document.getElementById('sheetTitle').textContent = s.title;
  document.getElementById('sheetAuthor').innerHTML = `✍️ ${s.author} · ${s.genre}`;

  let html = `<div class="sheet-meta-grid">
    <div class="sheet-meta-item"><b>${s.chapters}</b><span>Chapters</span></div>
    <div class="sheet-meta-item"><b>${s.words.toLocaleString()}</b><span>Words</span></div>
    <div class="sheet-meta-item"><b style="text-transform:capitalize">${s.priority}</b><span>Priority</span></div>
    <div class="sheet-meta-item"><b><span class="status-pill ${s.status}" style="font-size:9px">${s.status}</span></b><span>Status</span></div>
  </div>`;
  html += `<div class="sheet-section-lbl">Synopsis</div><div class="sheet-synopsis">${s.synopsis}</div>`;
  html += `<div style="font-size:11px;color:var(--text-faint);margin-top:8px">Submitted ${s.submitted} · Manuscript meets the 5,000-word minimum for review.</div>`;

  if (s.feedback) {
    html += `<div class="feedback-box"><i class="fas fa-comment-dots"></i><span><strong>Editorial feedback:</strong> ${s.feedback}</span></div>`;
  }

  html += `<div class="reject-panel" id="rejectPanel">
    <div class="sheet-section-lbl">Feedback for author</div>
    <textarea id="rejectFeedback" placeholder="Explain why this submission isn't being accepted…"></textarea>
  </div>`;

  html += `<div class="reject-panel" id="acceptPanel">
    <div class="sheet-section-lbl">Confirm Acceptance</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">This will approve the book and make it visible on the platform. You can still add a contract later from the Contracts page.</p>
  </div>`;

  if (s.status === 'pending') {
    html += `<div class="modal-action-row">
      <button class="ghost" id="mActRead"><i class="fas fa-book-open"></i> Read Full Manuscript</button>
      <button class="danger" id="mActReject"><i class="fas fa-xmark"></i> Reject</button>
      <button class="primary" id="mActAccept"><i class="fas fa-check"></i> Accept</button>
      <button class="primary outline" id="mActContract"><i class="fas fa-file-signature"></i> Accept for Contract</button>
    </div>`;
  } else {
    html += `<div class="modal-action-row">
      <button class="ghost" id="mActRead"><i class="fas fa-book-open"></i> Read Full Manuscript</button>
      <button id="mActClose2"><i class="fas fa-xmark"></i> Close</button>
    </div>`;
  }

  document.getElementById('sheetBody').innerHTML = html;

  document.getElementById('mActRead').onclick = () => {
    window.location.href = '../author/book-workspace.html?id=' + encodeURIComponent(s.bookId || s.id);
  };
  if (s.status === 'pending') {
    let acceptStep = 0;
    document.getElementById('mActAccept').onclick = () => {
      if (acceptStep === 0) {
        document.getElementById('acceptPanel').classList.add('show');
        document.getElementById('mActAccept').innerHTML = '<i class="fas fa-check"></i> Confirm Accept';
        acceptStep = 1;
      } else {
        doQuickAccept(s);
      }
    };
    document.getElementById('mActContract').onclick = () => openContractModal(s.id);
    document.getElementById('mActReject').onclick = () => {
      const panel = document.getElementById('rejectPanel');
      const showing = panel.classList.toggle('show');
      const btn = document.getElementById('mActReject');
      if (showing) {
        btn.innerHTML = `<i class="fas fa-check"></i> Confirm Rejection`;
        btn.onclick = async () => {
          const fb = document.getElementById('rejectFeedback').value.trim();
          if (!fb) { toast('⚠️ Add feedback for the author before rejecting'); return; }
          try {
            await decideReview(s.id, 'rejected', fb);
          } catch (err) {
            toast('⚠️ Could not reject: ' + (err.message || 'server error'));
            return;
          }
          s.status = 'rejected'; s.feedback = fb;
          const wasOurs = recordFlowOutcome(s, 'rejected', fb);
          toast(`↩️ "${s.title}" declined` + (wasOurs ? ' — author stays a reader, feedback sent' : ''));
          closeSheet(); buildStats(); buildFilterPills(); applyFilters();
        };
      }
    };
  } else {
    document.getElementById('mActClose2').onclick = closeSheet;
  }

  document.getElementById('sheetBackdrop').classList.add('open');
  document.getElementById('detailSheet').classList.add('open');
  document.getElementById('detailSheet').scrollTop = 0;
}
function closeSheet(){
  document.getElementById('sheetBackdrop').classList.remove('open');
  document.getElementById('detailSheet').classList.remove('open');
  const ap = document.getElementById('acceptPanel'); if(ap) ap.classList.remove('show');
  const rp = document.getElementById('rejectPanel'); if(rp) rp.classList.remove('show');
}

/* ── Quick Accept (no contract) ── */
async function doQuickAccept(s){
  const btn = document.getElementById('mActAccept');
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Accepting…';
    await decideReview(s.id, 'approved', 'Accepted — book is now live on the platform.');
    s.status = 'approved';
    s.feedback = 'Accepted — book is now live on the platform.';
    const upgraded = recordFlowOutcome(s, 'approved');
    toast('✅ "' + s.title + '" is now live!' + (upgraded ? ' — author upgraded to Writer' : ''));
    closeSheet(); buildStats(); buildFilterPills(); applyFilters();
  } catch (err) {
    toast('\u26a0\ufe0f Error: ' + (err.message || 'Something went wrong'));
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Confirm Accept';
  }
}

/* ── Accept for Contract — 3-step wizard (monetization via ContractMonetization component) ── */
let mzMonet = null;
let wizardStep = 1;
let totalChaptersForBook = 5;

function updateContractHint(){
  const c = CONTRACTS.find(x => x.id === document.getElementById('contractType').value);
  document.getElementById('contractHint').textContent = c ? c.detail : '';
}

/* monetization table lives in shared/contract-monetization.js (mzMonet) */

function syncPricingFromDOM(){
  if (mzMonet) mzMonet.getTerms();
}

function openWizard(step){
  wizardStep = step;
  const panels = document.querySelectorAll('.cwiz-panel');
  panels.forEach(p => p.classList.remove('on'));
  document.getElementById('cwizP' + step).classList.add('on');

  const steps = document.querySelectorAll('.cwiz-step');
  steps.forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('on', 'done');
    if(sn === step) s.classList.add('on');
    else if(sn < step) s.classList.add('done');
  });

  document.getElementById('cwizBack').style.display = step > 1 ? '' : 'none';
  document.getElementById('cwizNext').style.display = step < 3 ? '' : 'none';
  document.getElementById('contractConfirmBtn').style.display = step === 3 ? '' : 'none';

  if(step === 2){
    // monetization component persists (mounted per modal open)
  }
  if(step === 3){
    syncPricingFromDOM();
    buildSummary();
    document.getElementById('contractPassword').value = '';
    document.getElementById('contractModalError').classList.remove('show');
  }
}

function buildSummary(){
  const contractId = document.getElementById('contractType').value;
  const contract = CONTRACTS.find(c => c.id === contractId);
  const t = mzMonet ? mzMonet.getTerms() : { freeChapters: 0, adsPerChapter: 0, allowAdUnlock: false, rows: [], paidCount: 0, adChapters: 0 };
  const paid = t.rows.filter(function (ch) { return !ch.free; });

  let html = '';
  html += '<div class="cs-row"><span class="cs-label">Contract</span><span class="cs-val">' + (contract ? contract.label : '—') + '</span></div>';
  html += '<div class="cs-row"><span class="cs-label">Free chapters</span><span class="cs-val">' + (t.freeChapters > 0 ? '1 – ' + t.freeChapters : 'None') + '</span></div>';
  html += '<div class="cs-row"><span class="cs-label">Ad unlock</span><span class="cs-val">' + (t.allowAdUnlock ? t.adsPerChapter + ' ads/chapter (' + t.adChapters + ' chapters)' : 'OFF') + '</span></div>';
  paid.forEach(ch => {
    html += '<div class="cs-row"><span class="cs-label">Ch. ' + ch.num + '</span><span class="cs-val">' + ch.price + ' coins' + (ch.ads > 0 ? ' or ' + ch.ads + ' ads' : '') + '</span></div>';
  });
  document.getElementById('cwizSummary').innerHTML = html;
}

function openContractModal(id){
  const s = allSubs.find(x => x.id === id); if (!s) return;
  acceptTargetId = id;
  totalChaptersForBook = s.chapters;
  document.getElementById('cwizSub').textContent = 'Set contract terms and pricing for "' + s.title + '" by ' + s.author + '.';
  document.getElementById('contractType').innerHTML = CONTRACTS.map(c => '<option value="' + c.id + '">' + c.label + '</option>').join('');
  updateContractHint();
  mzMonet = ContractMonetization.mount('#cwizMonet', {
    totalChapters: totalChaptersForBook,
    initial: { freeChapters: 3, adsPerChapter: 2, allowAdUnlock: true },
    // The wizard is about setting terms, not reviewing them — the
    // per-chapter summary at the bottom of the table is noise here.
    hideSummary: true,
  });
  document.getElementById('contractPassword').value = '';
  document.getElementById('contractModalError').classList.remove('show');
  document.getElementById('contractModalOv').classList.add('open');
  openWizard(1);
}

function closeContractModal(){
  document.getElementById('contractModalOv').classList.remove('open');
  acceptTargetId = null;
  mzMonet = null;
  wizardStep = 1;
}

async function submitAccept(){
  const s = allSubs.find(x => x.id === acceptTargetId); if (!s) return;
  const t = mzMonet ? mzMonet.getTerms() : { freeChapters: 0, adsPerChapter: 0, allowAdUnlock: false, rows: [] };
  const contractId = document.getElementById('contractType').value;
  const freeChapters = t.freeChapters;
  const allowAdUnlock = t.allowAdUnlock;
  const adsPerChapter = t.adsPerChapter;
  const password = document.getElementById('contractPassword').value;
  const errBox = document.getElementById('contractModalError');

  if (!s.kyc || s.kyc.status !== 'approved' || !s.kyc.type) {
    errBox.textContent = 'Identity missing — verify the author\u2019s KYC record in Contract Review before accepting for a contract.';
    errBox.classList.add('show');
    return;
  }

  if (!s.kyc.idPhotos || !s.kyc.idPhotos.front || !s.kyc.idPhotos.back) {
    errBox.textContent = 'ID photos missing — check the author\u2019s documents in Contract Review before accepting for a contract.';
    errBox.classList.add('show');
    return;
  }

  if (!password) { errBox.textContent = 'Please enter your password to confirm this action.'; errBox.classList.add('show'); return; }

  const contract = CONTRACTS.find(c => c.id === contractId);
  const paid = t.rows.filter(function (ch) { return !ch.free; });
  const adCount = paid.filter(ch => ch.ads > 0).length;
  const pricingSummary = paid.map(ch => 'Ch.' + ch.num + ': ' + ch.price + ' coins' + (ch.ads > 0 ? ' or ' + ch.ads + ' ads' : '')).join(', ');

  const btn = document.getElementById('contractConfirmBtn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming\u2026';
  try {
    const feedback = 'Accepted under ' + contract.label + '. Free chapters: ' + freeChapters + '. Ad unlock: ' + (allowAdUnlock ? 'ON (' + adsPerChapter + ' ads/chapter, ' + adCount + ' chapters)' : 'OFF') + '. Pricing: ' + (pricingSummary || 'all free') + '.';
    await decideReview(s.id, 'approved', feedback, {
      type: contract.type,
      termMonths: contract.termMonths,
      revenueSplit: contract.revenueSplit,
      note: 'Offer created from the review queue acceptance.',
      pricing: { freeChapters: freeChapters, adsPerChapter: adsPerChapter, allowAdUnlock: allowAdUnlock, rows: t.rows || [] },
    });
    s.status = 'approved';
    s.feedback = feedback;
    const upgraded = recordFlowOutcome(s, 'approved', feedback);
    toast('✅ "' + s.title + '" accepted — ' + contract.label + (upgraded ? ' · author upgraded to Writer' : ''));
    closeContractModal(); closeSheet();
    buildStats(); buildFilterPills(); applyFilters();
  } catch (err) {
    errBox.textContent = err.status === 409 && /identit/i.test(err.message || '')
      ? 'The book is accepted and live, but no contract was sent: this author’s identity is not verified yet. Approve their KYC, then send the offer from Contract Review.'
      : (err.message || 'Something went wrong. Please try again.');
    errBox.classList.add('show');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-signature"></i> Confirm Acceptance';
  }
}

window.ReviewQueueService = { init };

})();
