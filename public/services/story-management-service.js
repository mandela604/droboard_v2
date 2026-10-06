/* ===============================================================
   STORY MANAGEMENT SERVICE
   Series manager data + render/mutation/charts (verbatim move from story-management.html). Auto-initializes on load.
   When going live: set USE_API = true, update API_BASE.
   =============================================================== */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api';


/* ── DATA ── */
const SERIES_DATA = [
  {
    id:'s1',
    cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    cat:'💔 Betrayal',
    title:"I came home early and caught my husband kissing my late sister's photograph",
    tagline:"A Lagos woman's quiet unravelling after an impossible discovery.",
    status:'ongoing',
    seasons:2,
    reads:'171k',
    likes:'24.3k',
    comments:'4.1k',
    saves:'6.8k',
    chapters:[
      {id:'c1',num:1,title:'The Morning Everything Changed',reads:22400,status:'published',date:'Jan 12, 2025',words:1840},
      {id:'c2',num:2,title:'What the Photo Couldn\'t Explain',reads:19200,status:'published',date:'Jan 19, 2025',words:2100},
      {id:'c3',num:3,title:'She Asked Me Not to Ask',reads:17800,status:'published',date:'Jan 26, 2025',words:1960},
      {id:'c4',num:4,title:'The Third Drawer on the Left',reads:15600,status:'published',date:'Feb 2, 2025',words:2240},
      {id:'c5',num:5,title:'Season 2: I Packed One Bag',reads:14100,status:'published',date:'Apr 5, 2025',words:2050},
      {id:'c6',num:6,title:'His Mother Knew',reads:12800,status:'published',date:'Apr 12, 2025',words:1780},
      {id:'c7',num:7,title:'The Last Person I Called',reads:0,status:'scheduled',date:'Jun 20, 2025',words:900},
      {id:'c8',num:8,title:'What She Left Behind',reads:0,status:'draft',date:'—',words:420},
    ]
  },
  {
    id:'s2',
    cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg',
    cat:'💔 Heartbreak',
    title:"He proposed with my best friend's ring",
    tagline:'What happens when betrayal comes from both directions at once.',
    status:'ongoing',
    seasons:1,
    reads:'96k',
    likes:'19.2k',
    comments:'2.9k',
    saves:'4.1k',
    chapters:[
      {id:'c1',num:1,title:'The Ring I Recognised',reads:34500,status:'published',date:'Mar 1, 2025',words:1620},
      {id:'c2',num:2,title:'Adeola\'s Silence',reads:28300,status:'published',date:'Mar 8, 2025',words:1900},
      {id:'c3',num:3,title:'She Was in the Front Row',reads:22100,status:'published',date:'Mar 15, 2025',words:2010},
      {id:'c4',num:4,title:'The Last Bridesmaid',reads:0,status:'scheduled',date:'Jun 14, 2025',words:1540},
    ]
  },
  {
    id:'s3',
    cover:'https://i.postimg.cc/cgLZJNmC/8.jpg',
    cat:'👑 Family',
    title:"My uncle claimed the inheritance using my late mother's stolen will",
    tagline:'A family legacy. A stolen document. A fight no one saw coming.',
    status:'ongoing',
    seasons:3,
    reads:'138k',
    likes:'21k',
    comments:'3.6k',
    saves:'5.4k',
    chapters:[
      {id:'c1',num:1,title:'After the Burial',reads:19200,status:'published',date:'Dec 3, 2024',words:1750},
      {id:'c2',num:2,title:'Uncle Chukwuma Smiled at the Lawyer',reads:17800,status:'published',date:'Dec 10, 2024',words:2000},
      {id:'c3',num:3,title:'The Original Is Missing',reads:16400,status:'published',date:'Dec 17, 2024',words:1820},
      {id:'c4',num:4,title:'Season 2: A Different Notary',reads:15100,status:'published',date:'Feb 20, 2025',words:2150},
      {id:'c5',num:5,title:'She Kept a Copy',reads:13900,status:'published',date:'Feb 27, 2025',words:1940},
      {id:'c6',num:6,title:'Season 3: Court Date',reads:12200,status:'published',date:'May 10, 2025',words:2260},
      {id:'c7',num:7,title:'The Judge\'s Pause',reads:0,status:'draft',date:'—',words:680},
      {id:'c8',num:8,title:'Closing Arguments',reads:0,status:'draft',date:'—',words:0},
    ]
  },
  {
    id:'s4',
    cover:'https://i.postimg.cc/N9jY0w4m/5.jpg',
    cat:'💔 Betrayal',
    title:'She found his second phone at their anniversary dinner',
    tagline:'He had a whole life she never knew about.',
    status:'ongoing',
    seasons:2,
    reads:'88k',
    likes:'14k',
    comments:'2.1k',
    saves:'3.9k',
    chapters:[
      {id:'c1',num:1,title:'Table for Two, Life for Three',reads:16200,status:'published',date:'Feb 5, 2025',words:1700},
      {id:'c2',num:2,title:'The Password Hint Was Her Name',reads:14800,status:'published',date:'Feb 12, 2025',words:1880},
      {id:'c3',num:3,title:'I Finished My Dessert',reads:13400,status:'published',date:'Feb 19, 2025',words:2020},
      {id:'c4',num:4,title:'Season 2: What She Chose',reads:11200,status:'published',date:'Apr 28, 2025',words:1960},
      {id:'c5',num:5,title:'The Transfer Was Already Scheduled',reads:0,status:'scheduled',date:'Jun 20, 2025',words:1340},
    ]
  },
  {
    id:'s5',
    cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
    cat:'✨ Twist',
    title:'The runaway bride — I left at the altar in my socked feet',
    tagline:'Everyone watched. Only she knew why.',
    status:'complete',
    seasons:1,
    reads:'312k',
    likes:'45k',
    comments:'8.7k',
    saves:'12.1k',
    chapters:[
      {id:'c1',num:1,title:'The Dress Fit Perfectly',reads:58000,status:'published',date:'Sep 1, 2024',words:1520},
      {id:'c2',num:2,title:'Something I Heard the Night Before',reads:52400,status:'published',date:'Sep 8, 2024',words:1800},
      {id:'c3',num:3,title:'The Walk Down Was the Easy Part',reads:47300,status:'published',date:'Sep 15, 2024',words:2100},
      {id:'c4',num:4,title:'My Socks Were the Last Thing They Expected',reads:43200,status:'published',date:'Sep 22, 2024',words:1940},
      {id:'c5',num:5,title:'The Voicemail I Left Him',reads:38800,status:'published',date:'Sep 29, 2024',words:2240},
      {id:'c6',num:6,title:'He Called Back',reads:35100,status:'published',date:'Oct 6, 2024',words:2080},
      {id:'c7',num:7,title:'What We Built Instead',reads:29600,status:'published',date:'Oct 13, 2024',words:1860},
      {id:'c8',num:8,title:'She Was Right About the Dress',reads:26400,status:'published',date:'Oct 20, 2024',words:2010},
    ]
  }
];

let activeSeries = null;
let _confirmCb = null;
let _chEditId = null;
let _editingSeriesStatus = 'ongoing';

/* ─ get series id from URL or default to s1 ─ */
function getUrlSid() {
  const p = new URLSearchParams(location.search);
  return p.get('sid') || 's1';
}

/* ── UTILS ── */
function toast(msg, dur=2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}
function fmtN(n) {
  if (typeof n === 'string') return n;
  return n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n);
}
function getStatusClass(s) {
  return s==='published'?'csp-pub':s==='scheduled'?'csp-sch':'csp-draft';
}
function getStatusLabel(s) {
  return s==='published'?'Published':s==='scheduled'?'Scheduled':'Draft';
}
function getStatusIcon(s) {
  return s==='published'?'✓':s==='scheduled'?'⏰':'📝';
}
function calcWords(ch) {
  /* In a real backend this comes from the server. 
     Here we just return the stored value. */
  return ch.words || 0;
}

/* ── SERIES SELECTOR BAR ── */
function renderSelector() {
  const bar = document.getElementById('seriesSelector');
  bar.innerHTML = SERIES_DATA.map(s => `
    <div class="ss-item${s.id===activeSeries.id?' active':''}" onclick="loadSeries('${s.id}')">
      <div class="ss-item-cover" style="background-image:url('${s.cover}')"></div>
      <span class="ss-item-name">${s.title}</span>
    </div>
  `).join('') + `<div class="ss-add" onclick="toast('📝 Create new series…')"><i class="fas fa-plus" style="font-size:10px"></i> New Series</div>`;
}

/* ── LOAD SERIES ── */
function loadSeries(sid) {
  activeSeries = SERIES_DATA.find(s => s.id === sid) || SERIES_DATA[0];
  document.getElementById('topTitle').textContent = 'Series Manager';
  renderSelector();
  renderContent();
  history.replaceState(null,'','?sid='+sid);
}

/* ── MAIN CONTENT RENDER ── */
function renderContent() {
  const s = activeSeries;
  const statusBadgeClass = s.status==='ongoing'?'sb-ongoing':s.status==='complete'?'sb-complete':'sb-paused';
  const statusLabel = s.status==='ongoing'?'Ongoing':s.status==='complete'?'Complete':'Paused';

  const totalReads = s.chapters.reduce((a,c)=>a+(c.reads||0),0);
  const pubCount = s.chapters.filter(c=>c.status==='published').length;
  const draftCount = s.chapters.filter(c=>c.status==='draft').length;
  const schedCount = s.chapters.filter(c=>c.status==='scheduled').length;

  document.getElementById('mainContent').innerHTML = `

    <!-- SERIES INFO CARD -->
    <div class="series-info-card">
      <div class="sic-hero" onclick="triggerCoverUpload()" title="Change cover photo">
        <img class="sic-hero-img" src="${s.cover}" id="sic-cover-img" loading="lazy" alt=""/>
        <div class="sic-hero-grad"></div>
        <div class="sic-edit-cover"><i class="fas fa-camera"></i> Change Cover</div>
      </div>
      <div class="sic-body">
        <div class="sic-cat-row">
          <span class="sic-cat" id="sic-cat-display">${s.cat}</span>
          <span class="sic-status-badge ${statusBadgeClass}" id="sic-status-display">${statusLabel}</span>
        </div>
        <div class="sic-title" id="sic-title-display">${s.title}</div>

        <div class="sic-fields">
          <div class="sic-field">
            <div class="sic-label">Series Title</div>
            <input class="sic-input" id="sic-title-input" value="${s.title.replace(/"/g,'&quot;')}" placeholder="Series title…"/>
          </div>
          <div class="sic-field">
            <div class="sic-label">Tagline / Description</div>
            <textarea class="sic-input sic-textarea" id="sic-tagline-input" placeholder="Short description…">${s.tagline||''}</textarea>
          </div>
          <div class="sic-row">
            <div class="sic-field">
              <div class="sic-label">Category</div>
              <select class="sic-select" id="sic-cat-select">
                ${['💔 Betrayal','✨ Twist','👑 Family','🏙️ Urban','💍 Marriage','🔥 Revenge','🎓 Campus','🌙 Elegy'].map(c=>`<option value="${c}"${c===s.cat?' selected':''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="sic-field">
              <div class="sic-label">Seasons <span style="font-size:8px;color:var(--tx-faint)">(read-only)</span></div>
              <input class="sic-input" id="sic-seasons-input" type="number" value="${s.seasons}" readonly title="Season count is managed automatically via chapter season numbers"/>
            </div>
          </div>
          <div class="sic-field">
            <div class="sic-label">Series Status</div>
            <div class="status-toggle-row" id="statusToggleRow">
              <button class="status-btn${s.status==='ongoing'?' active-ongoing':''}" data-status="ongoing" onclick="setSeriesStatus('ongoing',this)"><i class="fas fa-pen" style="font-size:9px;margin-right:4px"></i>Ongoing</button>
              <button class="status-btn${s.status==='complete'?' active-complete':''}" data-status="complete" onclick="setSeriesStatus('complete',this)"><i class="fas fa-check" style="font-size:9px;margin-right:4px"></i>Complete</button>
              <button class="status-btn${s.status==='paused'?' active-paused':''}" data-status="paused" onclick="setSeriesStatus('paused',this)"><i class="fas fa-pause" style="font-size:9px;margin-right:4px"></i>Paused</button>
            </div>
          </div>
        </div>

        <button class="sic-save-btn" onclick="saveSeriesInfo()"><i class="fas fa-floppy-disk" style="font-size:12px;margin-right:6px"></i>Save Changes</button>

        <div class="sic-danger-row">
          <button class="sic-danger-btn pause" onclick="pauseSeries()"><i class="fas fa-pause" style="font-size:10px;margin-right:4px"></i>Pause Series</button>
          <button class="sic-danger-btn delete" onclick="confirmDeleteSeries()"><i class="fas fa-trash" style="font-size:10px;margin-right:4px"></i>Delete Series</button>
        </div>
      </div>
    </div>

    <!-- STATS — Chapters, Total Reads, Published, Drafts, Scheduled -->
    <div class="stats-mini">
      <div class="stat-mini"><div class="stat-mini-num b">${s.chapters.length}</div><div class="stat-mini-label">Chapters</div></div>
      <div class="stat-mini"><div class="stat-mini-num r">${fmtN(totalReads)}</div><div class="stat-mini-label">Total Reads</div></div>
      <div class="stat-mini"><div class="stat-mini-num g">${pubCount}</div><div class="stat-mini-label">Published</div></div>
      <div class="stat-mini"><div class="stat-mini-num gold">${draftCount}</div><div class="stat-mini-label">Drafts</div></div>
      <div class="stat-mini"><div class="stat-mini-num sch">${schedCount}</div><div class="stat-mini-label">Scheduled</div></div>
    </div>

    <!-- CHAPTERS SECTION -->
    <div class="sh">
      <div class="sh-title"><i class="fas fa-list" style="font-size:9px;color:var(--green)"></i>Chapters (${s.chapters.length})</div>
      <div class="sh-more" onclick="addNewChapter()">+ Add Chapter</div>
    </div>
    <div class="chapter-list" id="chapterList"></div>
    <button class="add-ch-btn" onclick="addNewChapter()">
      <i class="fas fa-plus-circle"></i>
      Add Chapter ${s.chapters.length + 1}
      <span style="font-size:9px;color:rgba(52,211,153,.5);font-weight:600;margin-left:2px">→ Story Editor</span>
    </button>

    <div class="sdiv"></div>

    <!-- ANALYTICS SECTION -->
    <div class="sh" style="margin-bottom:12px">
      <div class="sh-title"><i class="fas fa-chart-bar" style="font-size:9px;color:var(--blue)"></i>Chapter Analytics</div>
      <div style="font-size:9px;font-weight:700;color:var(--tx-muted);background:rgba(255,255,255,.04);border:1px solid var(--bd);padding:3px 9px;border-radius:8px">All time</div>
    </div>
    <div class="analytics-section">
      <div class="anlyt-card-sm">
        <div class="anlyt-card-sm-title"><i class="fas fa-chart-column" style="color:var(--blue);font-size:10px"></i>Views Per Chapter</div>
        <div class="chart-wrap" id="viewsChart"></div>
      </div>
      <div class="anlyt-card-sm" id="dropoffSection">
        <div class="anlyt-card-sm-title"><i class="fas fa-arrow-trend-down" style="color:var(--acc);font-size:10px"></i>Chapter Drop-off Rate</div>
        <div id="dropoffChart"></div>
      </div>
    </div>
  `;

  _editingSeriesStatus = s.status;
  renderChapters();
  renderCharts();
}

/* ── CHAPTER LIST RENDER ── */
function renderChapters() {
  const s = activeSeries;
  const list = document.getElementById('chapterList');
  if (!list) return;
  if (s.chapters.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><p>No chapters yet. Add your first one!</p></div>`;
    return;
  }
  list.innerHTML = s.chapters.map((ch, i) => `
    <div class="chapter-item" draggable="true" data-idx="${i}" data-cid="${ch.id}" id="chitem-${ch.id}">
      <div class="ch-drag-handle"><i class="fas fa-grip-vertical"></i></div>
      <div class="ch-num">${ch.num}</div>
      <div class="ch-info">
        <div class="ch-title">${ch.title}</div>
        <div class="ch-meta">
          <span><i class="far fa-eye" style="font-size:7px"></i>${ch.reads>0?fmtN(ch.reads):'—'}</span>
          <span><i class="far fa-clock" style="font-size:7px"></i>${ch.date}</span>
          ${calcWords(ch) > 0 ? `<span><i class="fas fa-align-left" style="font-size:7px"></i>${calcWords(ch).toLocaleString()} words</span>` : ''}
          <span class="ch-status-pill ${getStatusClass(ch.status)}">${getStatusIcon(ch.status)} ${getStatusLabel(ch.status)}</span>
        </div>
      </div>
      <div class="ch-actions">
        <div class="ch-act edit" title="Edit chapter" onclick="openChEdit('${ch.id}')"><i class="fas fa-pencil"></i></div>
        <div class="ch-act delete" title="Delete chapter" onclick="confirmDeleteChapter('${ch.id}','${ch.title.replace(/'/g,"\\'").replace(/"/g,'&quot;')}')"><i class="fas fa-trash"></i></div>
      </div>
    </div>
  `).join('');

  initDragDrop();
}

/* ── DRAG AND DROP ── */
function initDragDrop() {
  const items = document.querySelectorAll('.chapter-item');
  let dragSrc = null;

  items.forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      document.querySelectorAll('.chapter-item').forEach(i => i.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== dragSrc) {
        document.querySelectorAll('.chapter-item').forEach(i => i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      }
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && item !== dragSrc) {
        const fromIdx = parseInt(dragSrc.dataset.idx);
        const toIdx = parseInt(item.dataset.idx);
        const chapters = activeSeries.chapters;
        const moved = chapters.splice(fromIdx, 1)[0];
        chapters.splice(toIdx, 0, moved);
        chapters.forEach((c, i) => c.num = i + 1);
        renderChapters();
        renderCharts();
        toast('↕️ Chapters reordered!');
      }
    });
  });
}

/* ── SERIES STATUS ── */
function setSeriesStatus(status, btn) {
  _editingSeriesStatus = status;
  document.querySelectorAll('.status-btn').forEach(b => {
    b.className = 'status-btn';
    if (b.dataset.status === status) b.classList.add('active-' + status);
  });
}

/* ── SAVE SERIES INFO ── */
function saveSeriesInfo() {
  const title = document.getElementById('sic-title-input').value.trim();
  if (!title) { toast('✍️ Series title can\'t be empty!'); return; }

  const cat = document.getElementById('sic-cat-select').value;
  const tagline = document.getElementById('sic-tagline-input').value.trim();

  activeSeries.title = title;
  activeSeries.cat = cat;
  activeSeries.tagline = tagline;
  activeSeries.status = _editingSeriesStatus;
  /* seasons is read-only, derived from chapter season numbers in backend */

  const td = document.getElementById('sic-title-display');
  const cd = document.getElementById('sic-cat-display');
  const sd = document.getElementById('sic-status-display');
  if (td) td.textContent = title;
  if (cd) cd.textContent = cat;
  if (sd) {
    const labels = {ongoing:'Ongoing',complete:'Complete',paused:'Paused'};
    const classes = {ongoing:'sb-ongoing',complete:'sb-complete',paused:'sb-paused'};
    sd.textContent = labels[_editingSeriesStatus];
    sd.className = 'sic-status-badge ' + classes[_editingSeriesStatus];
  }
  renderSelector();
  toast('✅ Series info saved!');
}

/* ── COVER UPLOAD ── */
function triggerCoverUpload() {
  document.getElementById('coverFileInput').click();
}
function handleCoverFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('⚠️ Please select an image file'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    const url = e.target.result;
    activeSeries.cover = url;
    const img = document.getElementById('sic-cover-img');
    if (img) img.src = url;
    renderSelector();
    toast('🖼️ Cover updated!');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

/* ── PAUSE SERIES ── */
function pauseSeries() {
  activeSeries.status = 'paused';
  _editingSeriesStatus = 'paused';
  document.querySelectorAll('.status-btn').forEach(b => {
    b.className = 'status-btn';
    if (b.dataset.status === 'paused') b.classList.add('active-paused');
  });
  const sd = document.getElementById('sic-status-display');
  if (sd) { sd.textContent = 'Paused'; sd.className = 'sic-status-badge sb-paused'; }
  toast('⏸️ Series paused.');
}

/* ── DELETE SERIES ── */
function confirmDeleteSeries() {
  openConfirm(
    '🗑️',
    'Delete entire series?',
    `"${activeSeries.title.substring(0,48)}…" and all ${activeSeries.chapters.length} chapters will be permanently deleted.`,
    () => {
      const idx = SERIES_DATA.findIndex(s => s.id === activeSeries.id);
      if (idx > -1) SERIES_DATA.splice(idx, 1);
      if (SERIES_DATA.length === 0) {
        toast('Series deleted. No more series.');
        document.getElementById('mainContent').innerHTML = '<div class="empty-state" style="padding:40px 0"><i class="fas fa-tv"></i><p>No series yet. Create one!</p></div>';
        document.getElementById('seriesSelector').innerHTML = '';
        return;
      }
      loadSeries(SERIES_DATA[0].id);
      toast('🗑️ Series deleted.');
    },
    'Delete Series',
    'confirm-delete'
  );
}

/* ── CHAPTER EDIT ── */
function openChEdit(cid) {
  const ch = activeSeries.chapters.find(c => c.id === cid);
  if (!ch) return;
  _chEditId = cid;
  document.getElementById('chEditTitle').textContent = `Edit Chapter ${ch.num}`;

  const isPublished = ch.status === 'published';
  const isScheduled = ch.status === 'scheduled';
  const isDraft = ch.status === 'draft';

  /* word count — always read-only (calculated by backend) */
  /* date — read-only if published, editable if draft */
  /* status buttons: published=locked, scheduled=click to reschedule, draft=click shows modal */

  document.getElementById('chEditBody').innerHTML = `
    <div>
      <div class="ce-label">Chapter Title${isPublished ? ' <span style="color:var(--tx-faint);font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(read-only once published)</span>' : ''}</div>
      <input class="ce-input" id="ce-title" value="${ch.title.replace(/"/g,'&quot;')}" placeholder="Chapter title…" ${isPublished ? 'readonly' : ''}/>
    </div>
    <div class="ce-row">
      <div>
        <div class="ce-label">Publish Date${isDraft ? '' : ' <span style="color:var(--tx-faint);font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(read-only)</span>'}</div>
        <input class="ce-input" id="ce-date" value="${ch.date==='—'?'':ch.date}" placeholder="e.g. Jun 14, 2025" type="text" ${isPublished ? 'readonly' : ''}/>
      </div>
      <div>
        <div class="ce-label">Word Count <span style="color:var(--tx-faint);font-weight:400;text-transform:none;letter-spacing:0;font-size:9px">(auto)</span></div>
        <input class="ce-input" id="ce-words" type="number" value="${calcWords(ch)}" readonly title="Word count is calculated automatically"/>
        <div class="ce-input-hint">Calculated from story content</div>
      </div>
    </div>
    <div>
      <div class="ce-label">Status</div>
      <div class="ce-status-row" id="ceStatusRow">
        <button class="ce-status-btn${ch.status==='published'?' active-published locked':''}" data-st="published"
          onclick="${isPublished ? 'void(0)' : 'setCeStatus(\'published\',this)'}"
          ${isPublished ? 'title="Already published — cannot revert" style="cursor:not-allowed"' : ''}>
          ✓ Published
        </button>
        <button class="ce-status-btn${ch.status==='draft'?' active-draft':''}" data-st="draft"
          onclick="handleDraftClick('${ch.id}', this)">
          📝 Draft
        </button>
        <button class="ce-status-btn${ch.status==='scheduled'?' active-scheduled':''}" data-st="scheduled"
          onclick="handleScheduledClick('${ch.id}', this)">
          ⏰ Scheduled
        </button>
      </div>
    </div>

    <!-- Reschedule section — shown only for scheduled chapters -->
    <div class="reschedule-wrap${isScheduled?' show':''}" id="rescheduleWrap">
      <div class="ce-label">Reschedule Date & Time</div>
      <div class="ce-row">
        <div>
          <input class="ce-input" type="date" id="ce-reschedule-date" value="${isScheduled && ch.date !== '—' ? tryParseDate(ch.date) : ''}"/>
        </div>
        <div>
          <input class="ce-input" type="time" id="ce-reschedule-time" value="09:00"/>
        </div>
      </div>
      <div style="font-size:9px;color:var(--blue);margin-top:4px"><i class="fas fa-info-circle" style="font-size:8px"></i> Current: ${ch.date}</div>
    </div>

    <div>
      <div class="ce-label">Author's Note (optional)</div>
      <textarea class="ce-input ce-textarea" id="ce-note" placeholder="Note for readers before this chapter…">${ch.note||''}</textarea>
    </div>
    ${!isPublished ? `<button class="ce-save-btn" onclick="saveChEdit()"><i class="fas fa-floppy-disk" style="font-size:11px;margin-right:6px"></i>Save Chapter</button>` : `<div style="font-size:10px;color:var(--tx-muted);text-align:center;padding:8px;background:rgba(52,211,153,.04);border:1px solid rgba(52,211,153,.1);border-radius:10px">✓ Published chapters are locked for reader trust. Open in editor to make corrections.</div>`}
    <button style="width:100%;padding:10px;border-radius:12px;background:rgba(56,189,248,.06);border:1.5px solid rgba(56,189,248,.15);color:var(--blue);font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:2px" onclick="openStoryEditor(${ch.num})">
      <i class="fas fa-pen-to-square" style="font-size:11px;margin-right:6px"></i>Open in Story Editor
    </button>
  `;

  document.getElementById('chEditOv').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function tryParseDate(dateStr) {
  /* Try to convert "Jun 20, 2025" → "2025-06-20" for date input */
  try {
    const d = new Date(dateStr);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  } catch(e) {}
  return '';
}

function setCeStatus(st, btn) {
  document.querySelectorAll('#ceStatusRow .ce-status-btn').forEach(b => {
    b.className = 'ce-status-btn';
    if (b.dataset.st === st) b.classList.add('active-'+st);
  });
  /* Show/hide reschedule section */
  const rw = document.getElementById('rescheduleWrap');
  if (rw) rw.classList.toggle('show', st === 'scheduled');
}

function handleDraftClick(cid, btn) {
  const ch = activeSeries.chapters.find(c => c.id === cid);
  if (!ch) return;
  if (ch.status === 'published') {
    /* Published → Draft: show confirmation modal */
    closeChEdit();
    openConfirm(
      '📝',
      'Revert to Draft?',
      `This will unpublish "${ch.title.substring(0,40)}…" and remove it from readers' feeds. Are you sure?`,
      () => {
        ch.status = 'draft';
        ch.date = '—';
        renderChapters();
        updateStatsMini();
        toast('📝 Chapter moved back to draft and unpublished.');
      },
      'Move to Draft',
      'confirm-warn'
    );
  } else if (ch.status === 'scheduled') {
    /* Scheduled → Draft: confirm to cancel scheduling */
    closeChEdit();
    openConfirm(
      '📝',
      'Cancel Scheduled Release?',
      `"${ch.title.substring(0,40)}…" will no longer publish automatically. It will be saved as a draft.`,
      () => {
        ch.status = 'draft';
        ch.date = '—';
        renderChapters();
        updateStatsMini();
        toast('📝 Scheduling cancelled. Saved as draft.');
      },
      'Move to Draft',
      'confirm-warn'
    );
  } else {
    /* Already draft — just highlight it */
    setCeStatus('draft', btn);
  }
}

function handleScheduledClick(cid, btn) {
  const ch = activeSeries.chapters.find(c => c.id === cid);
  if (!ch) return;
  if (ch.status === 'published') {
    /* Can't schedule a published chapter */
    toast('⚠️ Published chapters cannot be rescheduled.');
    return;
  }
  /* For draft or already scheduled — open reschedule section */
  setCeStatus('scheduled', btn);
}

function saveChEdit() {
  const ch = activeSeries.chapters.find(c => c.id === _chEditId);
  if (!ch) return;
  if (ch.status === 'published') { toast('ℹ️ Published chapters are read-only'); return; }

  const title = document.getElementById('ce-title').value.trim();
  if (!title) { toast('✍️ Chapter title can\'t be empty!'); return; }
  ch.title = title;
  ch.note = document.getElementById('ce-note')?.value.trim() || '';

  /* word count is read-only, skip */
  
  const activeSt = document.querySelector('#ceStatusRow .ce-status-btn[class*="active"]');
  const newStatus = activeSt ? activeSt.dataset.st : ch.status;

  if (newStatus === 'scheduled') {
    const dateVal = document.getElementById('ce-reschedule-date')?.value;
    const timeVal = document.getElementById('ce-reschedule-time')?.value || '09:00';
    if (!dateVal) { toast('📅 Pick a schedule date'); return; }
    /* Format for display */
    const d = new Date(dateVal + 'T' + timeVal);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    ch.date = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${timeVal}`;
    ch.status = 'scheduled';
  } else {
    ch.status = newStatus;
    if (newStatus === 'draft') ch.date = '—';
    else if (newStatus === 'published') {
      const dateVal = document.getElementById('ce-date')?.value.trim();
      ch.date = dateVal || new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
    }
  }

  closeChEdit();
  renderChapters();
  renderCharts();
  updateStatsMini();
  toast('✅ Chapter saved!');
}

function updateStatsMini() {
  const s = activeSeries;
  const totalReads = s.chapters.reduce((a,c)=>a+(c.reads||0),0);
  const pubCount = s.chapters.filter(c=>c.status==='published').length;
  const draftCount = s.chapters.filter(c=>c.status==='draft').length;
  const schedCount = s.chapters.filter(c=>c.status==='scheduled').length;
  const nums = document.querySelectorAll('.stat-mini-num');
  if (nums[0]) nums[0].textContent = s.chapters.length;
  if (nums[1]) nums[1].textContent = fmtN(totalReads);
  if (nums[2]) nums[2].textContent = pubCount;
  if (nums[3]) nums[3].textContent = draftCount;
  if (nums[4]) nums[4].textContent = schedCount;
}

function closeChEdit() {
  document.getElementById('chEditOv').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── ADD NEW CHAPTER → STORY EDITOR ── */
function addNewChapter() {
  const nextNum = activeSeries.chapters.length + 1;
  openStoryEditor(nextNum);
}

function openStoryEditor(chNum) {
  closeChEdit();
  const params = new URLSearchParams({
    sid: activeSeries.id,
    chapterNum: chNum,
    seriesTitle: activeSeries.title,
    cat: activeSeries.cat,
  });
  /* Navigate to story-editor.html (the full editor). Fall back to story-editor.html first, then create.html */
  toast(`📝 Opening Story Editor · Chapter ${chNum}…`);
  setTimeout(() => {
    window.location.href = 'story-editor.html?' + params.toString();
  }, 700);
}

/* ── DELETE CHAPTER ── */
function confirmDeleteChapter(cid, title) {
  openConfirm(
    '🗑️',
    'Delete this chapter?',
    `"${title}" will be permanently deleted and can't be recovered.`,
    () => {
      activeSeries.chapters = activeSeries.chapters.filter(c => c.id !== cid);
      activeSeries.chapters.forEach((c, i) => c.num = i + 1);
      renderChapters();
      renderCharts();
      updateStatsMini();
      toast('🗑️ Chapter deleted.');
    }
  );
}

/* ── CONFIRM OVERLAY ── */
function openConfirm(icon, title, sub, cb, btnLabel='Delete', btnClass='confirm-delete') {
  _confirmCb = cb;
  document.getElementById('confirmIcon').textContent = icon;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmSub').textContent = sub;
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.textContent = btnLabel;
  okBtn.className = 'confirm-btn ' + btnClass;
  document.getElementById('confirmOv').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOv').classList.remove('open');
  _confirmCb = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  if (_confirmCb) _confirmCb();
  closeConfirm();
});

/* ── SERIES SETTINGS ── */
function openSeriesSettings() {
  document.getElementById('settingsOv').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSeriesSettings() {
  document.getElementById('settingsOv').classList.remove('open');
  document.body.style.overflow = '';
}
function toggleSetting(el) {
  el.classList.toggle('on');
}
function saveSeriesSettings() {
  closeSeriesSettings();
  toast('⚙️ Series settings saved!');
}

/* ── CHARTS ── */
function renderCharts() {
  const s = activeSeries;
  const published = s.chapters.filter(c => c.reads > 0);

  const chartWrap = document.getElementById('viewsChart');
  if (!chartWrap) return;
  const maxReads = Math.max(...published.map(c => c.reads), 1);

  if (published.length === 0) {
    chartWrap.innerHTML = '<div style="width:100%;text-align:center;font-size:11px;color:var(--tx-faint);padding:20px 0">No published chapter data yet</div>';
  } else {
    const colors = ['var(--acc)','var(--acc2)','var(--blue)','var(--green)','var(--purple)','var(--gold)','var(--orange)','var(--acc3)'];
    chartWrap.innerHTML = published.map((ch, i) => {
      const pct = Math.round((ch.reads / maxReads) * 100);
      const color = colors[i % colors.length];
      return `
        <div class="chart-bar-col">
          <div class="chart-bar" style="height:${pct}%;background:${color};background:linear-gradient(180deg,${color},rgba(0,0,0,0) 200%)">
            <span class="chart-bar-val">${fmtN(ch.reads)}</span>
          </div>
          <div class="chart-bar-label">Ch${ch.num}</div>
        </div>`;
    }).join('');
  }

  const dropoffDiv = document.getElementById('dropoffChart');
  if (!dropoffDiv || published.length < 2) {
    if (dropoffDiv) dropoffDiv.innerHTML = '<div style="font-size:11px;color:var(--tx-faint);padding:8px 0">Need 2+ published chapters for drop-off data.</div>';
    return;
  }
  const baseReads = published[0].reads;
  dropoffDiv.innerHTML = published.map((ch, i) => {
    const pct = Math.round((ch.reads / baseReads) * 100);
    const retainColor = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--gold)' : 'var(--acc)';
    const drop = i === 0 ? 0 : Math.round(((published[i-1].reads - ch.reads) / published[i-1].reads) * 100);
    return `
      <div class="dropoff-row">
        <div class="dropoff-label">Ch${ch.num}: ${ch.title.substring(0,15)}${ch.title.length>15?'…':''}</div>
        <div class="dropoff-bar-wrap">
          <div class="dropoff-bar-fill" style="width:${pct}%;background:${retainColor}"></div>
        </div>
        <div class="dropoff-pct" style="color:${retainColor}">${pct}%</div>
      </div>
      ${i > 0 && drop > 0 ? `<div style="font-size:8px;color:${drop>20?'var(--acc)':'var(--tx-faint)'};margin:-2px 0 4px 68px">↓ ${drop}% drop from previous</div>` : ''}
    `;
  }).join('');
}

/* ── INIT ── */
const initSid = getUrlSid();
activeSeries = SERIES_DATA.find(s => s.id === initSid) || SERIES_DATA[0];
renderSelector();
renderContent();

  /* -- window exports (verbatim-move: preserve inline onclick globals) -- */
  window.getUrlSid = getUrlSid;
  window.toast = toast;
  window.fmtN = fmtN;
  window.getStatusClass = getStatusClass;
  window.getStatusLabel = getStatusLabel;
  window.getStatusIcon = getStatusIcon;
  window.calcWords = calcWords;
  window.renderSelector = renderSelector;
  window.loadSeries = loadSeries;
  window.renderContent = renderContent;
  window.renderChapters = renderChapters;
  window.initDragDrop = initDragDrop;
  window.setSeriesStatus = setSeriesStatus;
  window.saveSeriesInfo = saveSeriesInfo;
  window.triggerCoverUpload = triggerCoverUpload;
  window.handleCoverFileSelect = handleCoverFileSelect;
  window.pauseSeries = pauseSeries;
  window.confirmDeleteSeries = confirmDeleteSeries;
  window.openChEdit = openChEdit;
  window.tryParseDate = tryParseDate;
  window.setCeStatus = setCeStatus;
  window.handleDraftClick = handleDraftClick;
  window.handleScheduledClick = handleScheduledClick;
  window.saveChEdit = saveChEdit;
  window.updateStatsMini = updateStatsMini;
  window.closeChEdit = closeChEdit;
  window.addNewChapter = addNewChapter;
  window.openStoryEditor = openStoryEditor;
  window.confirmDeleteChapter = confirmDeleteChapter;
  window.openConfirm = openConfirm;
  window.closeConfirm = closeConfirm;
  window.openSeriesSettings = openSeriesSettings;
  window.closeSeriesSettings = closeSeriesSettings;
  window.toggleSetting = toggleSetting;
  window.saveSeriesSettings = saveSeriesSettings;
  window.renderCharts = renderCharts;
  try { Object.defineProperty(window, 'SERIES_DATA', { configurable: true, enumerable: true, get: function () { return SERIES_DATA; }, set: function (val) { SERIES_DATA = val; } }); } catch (e) { try { window['SERIES_DATA'] = SERIES_DATA; } catch (_) {} }
  try { Object.defineProperty(window, 'activeSeries', { configurable: true, enumerable: true, get: function () { return activeSeries; }, set: function (val) { activeSeries = val; } }); } catch (e) { try { window['activeSeries'] = activeSeries; } catch (_) {} }
  try { Object.defineProperty(window, '_confirmCb', { configurable: true, enumerable: true, get: function () { return _confirmCb; }, set: function (val) { _confirmCb = val; } }); } catch (e) { try { window['_confirmCb'] = _confirmCb; } catch (_) {} }
  try { Object.defineProperty(window, '_chEditId', { configurable: true, enumerable: true, get: function () { return _chEditId; }, set: function (val) { _chEditId = val; } }); } catch (e) { try { window['_chEditId'] = _chEditId; } catch (_) {} }
  try { Object.defineProperty(window, '_editingSeriesStatus', { configurable: true, enumerable: true, get: function () { return _editingSeriesStatus; }, set: function (val) { _editingSeriesStatus = val; } }); } catch (e) { try { window['_editingSeriesStatus'] = _editingSeriesStatus; } catch (_) {} }
  try { Object.defineProperty(window, 'initSid', { configurable: true, enumerable: true, get: function () { return initSid; }, set: function (val) { initSid = val; } }); } catch (e) { try { window['initSid'] = initSid; } catch (_) {} }
})();
