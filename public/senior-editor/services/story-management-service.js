(function(){
'use strict';

/* ── Backend-ready header (for future API use; demo paths keep working) ── */
const USE_API = false;
const API_BASE = '/api/senior-editor';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

var shell = null;

/* ── Covers ── */
var COVER_MAP = {
  'Bound by the Ruthless Alpha':  'https://i.postimg.cc/xqmHfyNR/wolf2.jpg',
  "The CEO's Hidden Son":         'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
  "Wolf King's Vow":              'https://i.postimg.cc/MXBR6bfY/wolf3.jpg',
  'Betrayed by the Mafia Prince': 'https://i.postimg.cc/fkdXzjS8/wolf.jpg',
  "The Duke's Secret":            'https://i.postimg.cc/fkdXzjSj/wife.jpg'
};
var FALLBACK = [
  'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
  'https://i.postimg.cc/cgLZJNmC/8.jpg',
  'https://i.postimg.cc/0MyxNqfz/7.jpg',
  'https://i.postimg.cc/N9jY0w4m/5.jpg',
  'https://i.postimg.cc/tY7KnJyr/images.jpg'
];
function coverFor(title, i) { return COVER_MAP[title] || FALLBACK[i % FALLBACK.length]; }

/* ── Author avatars ── */
var AVATARS = {
  'Chioma Okafor':   'https://i.pravatar.cc/40?img=5',
  'Luna Skye':       'https://i.pravatar.cc/40?img=24',
  'Elena Vasquez':   'https://i.pravatar.cc/40?img=31',
  'Marcus Webb Jr.': 'https://i.pravatar.cc/40?img=33',
  'Isabelle Moreau': 'https://i.pravatar.cc/40?img=44'
};

/* ── Extra data keyed by story id ─ NOTE: no "chapters" key here to avoid collision ── */
var EXTRA = {
  'ST-001': { reads: 52100, wordGoal: 150000, synopsis: 'Alpha Kade never expected his ex-mate to return — pregnant with his child and bound by a ruthless pact made in blood.', recentChs: [
    { n: 31, title: "The Alpha's Command", words: 3800, status: 'published', date: '2d ago' },
    { n: 30, title: 'No Escape',           words: 4100, status: 'published', date: '5d ago' },
    { n: 32, title: 'Untitled Draft',      words: 1200, status: 'draft',     date: 'In progress' }
  ]},
  'ST-002': { reads: 28400, wordGoal: 120000, synopsis: 'When CEO Damian Cole discovers the orphan child on his doorstep shares his blood, his carefully built world starts to crack.', recentChs: [
    { n: 24, title: 'The Hidden Truth',      words: 3450, status: 'published', date: '2h ago' },
    { n: 23, title: 'Boardroom Lies',        words: 4200, status: 'published', date: '3d ago' },
    { n: 22, title: "The Assistant's Secret",words: 3900, status: 'published', date: '5d ago' }
  ]},
  'ST-003': { reads: 12300, wordGoal: 100000, synopsis: 'Wolf King Lucian made a vow in the old tongue — a vow that cannot be broken, even by death.', recentChs: [
    { n: 12, title: "Moon's Edge",    words: 5200, status: 'published', date: '4h ago' },
    { n: 11, title: 'The Pack Council',words: 4700, status: 'published', date: '8d ago' },
    { n: 10, title: 'Blood Oath',     words: 4900, status: 'published', date: '15d ago' }
  ]},
  'ST-004': { reads: 9800, wordGoal: 80000, synopsis: 'Betrayal runs in the Ricci bloodline — but Aria never expected it to come from the man she loved.', recentChs: [
    { n: 7, title: "The Don's Offer", words: 2800, status: 'published', date: '6h ago' },
    { n: 6, title: 'Silk & Smoke',    words: 3100, status: 'published', date: '14d ago' },
    { n: 5, title: 'Guns & Roses',    words: 2950, status: 'published', date: '28d ago' }
  ]},
  'ST-005': { reads: 67800, wordGoal: 155000, synopsis: 'The Duke of Ashford keeps one secret that could undo everything — and Lady Elara is dangerously close to finding it.', recentChs: [
    { n: 31, title: 'Epilogue: A New Season', words: 3600, status: 'published', date: '1w ago' },
    { n: 30, title: 'The Revelation Ball',    words: 4400, status: 'published', date: '2w ago' },
    { n: 29, title: 'Letters Never Sent',     words: 4100, status: 'published', date: '3w ago' }
  ]}
};

var PER_PAGE   = 4;
var allStories = [];
var filtered   = [];
var activeStat = 'all';
var currentPg  = 1;

/* ── Init ── */
async function init() {
  shell = SeniorEditorSidebar.attach('#smRoot', {
    activeItem: 'story-management',
    title: 'Story Management',
    subtitle: 'Assigned stories & chapter status',
    user: { name: 'Chioma Reddy', role: 'Senior Editor', avatar: 'https://i.pravatar.cc/100?img=5' },
    notifCount: 4,
    onSearch: function(v) { document.getElementById('searchInput').value = v; currentPg = 1; applyFilters(); }
  });

  // Future backend path (disabled by default; demo path keeps working):
  // const remote = await callBackend('/story-management');
  // if (remote) { /* map remote payload to allStories */ }

  var d = await SeniorEditorData.getStories();

  /* Build allStories — keep original "chapters" (count) as chapterCount to avoid collision */
  allStories = d.stories.map(function(s, i) {
    var ex = EXTRA[s.id] || {};
    return {
      id:           s.id,
      title:        s.title,
      author:       s.author,
      genre:        s.genre,
      chapterCount: s.chapters,   /* renamed from "chapters" */
      status:       s.status,
      lastUpdated:  s.lastUpdated,
      words:        s.words,
      rating:       s.rating,
      cover:        coverFor(s.title, i),
      avatar:       AVATARS[s.author] || null,
      reads:        ex.reads    || Math.floor(Math.random() * 20000 + 3000),
      wordGoal:     ex.wordGoal || Math.round(s.words * 1.25),
      synopsis:     ex.synopsis || 'No synopsis available.',
      recentChs:    ex.recentChs || []
    };
  });

  buildGenreSelect();
  buildStats();
  buildFilterPills();
  applyFilters();

  document.getElementById('searchInput').addEventListener('input', function() { currentPg = 1; applyFilters(); });
  document.getElementById('sortSel').addEventListener('change', applyFilters);
  document.getElementById('genreSel').addEventListener('change', function() { currentPg = 1; applyFilters(); });
  document.getElementById('modalOv').addEventListener('click', closeModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
}

/* ── Stats ── */
function buildStats() {
  var total    = allStories.length;
  var ongoing  = allStories.filter(function(s){ return s.status === 'ongoing'; }).length;
  var done     = allStories.filter(function(s){ return s.status === 'completed'; }).length;
  var totalWords = allStories.reduce(function(n, s){ return n + s.words; }, 0);
  var stats = [
    { n: total,                      l: 'Assigned Stories',  ico: 'fa-book',         clr: 'var(--accent)', bg: 'rgba(255,0,80,.1)' },
    { n: ongoing,                    l: 'Ongoing',           ico: 'fa-pen',          clr: 'var(--blue)',   bg: 'var(--blue-bg)' },
    { n: done,                       l: 'Completed',         ico: 'fa-circle-check', clr: 'var(--green)',  bg: 'var(--green-bg)' },
    { n: totalWords.toLocaleString(),l: 'Total Words',       ico: 'fa-align-left',   clr: 'var(--purple)', bg: 'var(--purple-bg)' }
  ];
  document.getElementById('statRow').innerHTML = stats.map(function(s) {
    return '<div class="stat-card"><div class="stat-ico" style="background:' + s.bg + ';color:' + s.clr + '"><i class="fas ' + s.ico + '"></i></div><div><div class="stat-num">' + s.n + '</div><div class="stat-lbl">' + s.l + '</div></div></div>';
  }).join('');
}

/* ── Genre select ── */
function buildGenreSelect() {
  var genres = [];
  allStories.forEach(function(s) { if (genres.indexOf(s.genre) === -1) genres.push(s.genre); });
  genres.sort();
  var el = document.getElementById('genreSel');
  genres.forEach(function(g) { el.innerHTML += '<option value="' + g + '">' + g + '</option>'; });
}

/* ── Filter pills ── */
function buildFilterPills() {
  var statuses = ['all'];
  allStories.forEach(function(s) { if (statuses.indexOf(s.status) === -1) statuses.push(s.status); });
  var counts = { all: allStories.length };
  allStories.forEach(function(s) { counts[s.status] = (counts[s.status] || 0) + 1; });

  document.getElementById('filterRow').innerHTML = statuses.map(function(st) {
    var label = st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1);
    return '<button class="filter-pill' + (st === activeStat ? ' on' : '') + '" data-status="' + st + '">' + label + '<span class="pill-count">' + (counts[st] || 0) + '</span></button>';
  }).join('');

  document.querySelectorAll('.filter-pill').forEach(function(p) {
    p.addEventListener('click', function() {
      activeStat = p.dataset.status;
      currentPg = 1;
      document.querySelectorAll('.filter-pill').forEach(function(x) { x.classList.toggle('on', x === p); });
      applyFilters();
    });
  });
}

/* ── Apply filters + sort ── */
function applyFilters() {
  var q     = document.getElementById('searchInput').value.trim().toLowerCase();
  var genre = document.getElementById('genreSel').value;
  var sort  = document.getElementById('sortSel').value;

  filtered = allStories.filter(function(s) {
    var matchSt = activeStat === 'all' || s.status === activeStat;
    var matchQ  = !q || s.title.toLowerCase().indexOf(q) > -1 || s.author.toLowerCase().indexOf(q) > -1 || s.genre.toLowerCase().indexOf(q) > -1;
    var matchG  = !genre || s.genre === genre;
    return matchSt && matchQ && matchG;
  });

  if (sort === 'rating')   filtered.sort(function(a,b){ return b.rating - a.rating; });
  if (sort === 'chapters') filtered.sort(function(a,b){ return b.chapterCount - a.chapterCount; });
  if (sort === 'words')    filtered.sort(function(a,b){ return b.words - a.words; });
  if (sort === 'alpha')    filtered.sort(function(a,b){ return a.title.localeCompare(b.title); });

  var maxPg = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if (currentPg > maxPg) currentPg = maxPg;

  document.getElementById('storyCount').textContent = '(' + filtered.length + ' of ' + allStories.length + ')';
  renderPage();
}

/* ── Render page ── */
function renderPage() {
  var start = (currentPg - 1) * PER_PAGE;
  var page  = filtered.slice(start, start + PER_PAGE);

  if (!page.length) {
    document.getElementById('storyList').innerHTML = '<div class="empty-msg"><i class="fas fa-book-open"></i>No stories match your filters.</div>';
    document.getElementById('pgn').innerHTML = '';
    return;
  }

  document.getElementById('storyList').innerHTML = page.map(function(s) {
    var pct = Math.min(100, Math.round(s.words / s.wordGoal * 100));
    var av  = s.avatar ? '<img src="' + s.avatar + '" alt="' + s.author + '"/>' : '';
    return '<div class="story-card" data-id="' + s.id + '">' +
      '<div class="sc-cover-wrap">' +
        '<img class="sc-cover" src="' + s.cover + '" alt="' + s.title + '" loading="lazy"/>' +
        '<span class="sc-badge ' + s.status + '" title="' + s.status + '">' + (s.status === 'completed' ? '✓' : '●') + '</span>' +
      '</div>' +
      '<div class="sc-info">' +
        '<div class="sc-title">' + s.title + '<span class="status-pill ' + s.status + '">' + s.status + '</span></div>' +
        '<div class="sc-author-row">' + av + s.author + '<span class="genre-tag">' + s.genre + '</span></div>' +
        '<div class="sc-stats">' +
          '<span class="sc-stat"><i class="fas fa-list-ol"></i>' + s.chapterCount + ' ch</span>' +
          '<span class="sc-stat"><i class="fas fa-pen"></i>' + s.words.toLocaleString() + ' words</span>' +
          '<span class="sc-stat"><i class="fas fa-star" style="color:#ffd166"></i>' + s.rating + '</span>' +
          '<span class="sc-stat"><i class="fas fa-eye"></i>' + s.reads.toLocaleString() + '</span>' +
          '<span class="sc-stat"><i class="fas fa-clock"></i>' + s.lastUpdated + '</span>' +
        '</div>' +
        '<div class="sc-progress">' +
          '<div class="sc-prog-label"><span>Word progress</span><span>' + pct + '% of ' + s.wordGoal.toLocaleString() + '</span></div>' +
          '<div class="sc-prog-bar"><div class="sc-prog-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="sc-actions">' +
          '<button class="sc-btn" data-act="edit" data-id="' + s.id + '"><i class="fas fa-pen"></i> Edit</button>' +
          '<button class="sc-btn" data-act="analytics" data-id="' + s.id + '"><i class="fas fa-chart-line"></i> Analytics</button>' +
          '<button class="sc-btn" data-act="feature" data-id="' + s.id + '"><i class="fas fa-star"></i> Feature</button>' +
          '<button class="sc-btn danger" data-act="unpublish" data-id="' + s.id + '"><i class="fas fa-eye-slash"></i> Unpublish</button>' +
        '</div>' +
      '</div>' +
      '<i class="fas fa-chevron-right" style="color:var(--text-faint);font-size:11px;flex-shrink:0;margin-top:2px"></i>' +
    '</div>';
  }).join('');

  document.querySelectorAll('.story-card').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.closest('[data-act]')) return;
      openModal(el.dataset.id);
    });
  });

  document.querySelectorAll('[data-act]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var s = allStories.find(function(x){ return x.id === btn.dataset.id; });
      var act = btn.dataset.act;
      if (act === 'edit')      toast('✏️ Opening editor for "' + s.title + '"…');
      if (act === 'analytics') location.href = 'story-analytics.html';
      if (act === 'feature')   toast('⭐ "' + s.title + '" added to Featured Stories');
      if (act === 'unpublish') toast('🚫 "' + s.title + '" unpublished');
    });
  });

  renderPagination();
}

/* ── Pagination ── */
function renderPagination() {
  var total = filtered.length;
  var maxPg = Math.ceil(total / PER_PAGE);
  if (maxPg <= 1) { document.getElementById('pgn').innerHTML = ''; return; }

  var start = (currentPg - 1) * PER_PAGE + 1;
  var end   = Math.min(currentPg * PER_PAGE, total);
  var btns  = '';

  for (var i = 1; i <= maxPg; i++) {
    if (maxPg > 6 && i > 2 && i < maxPg - 1 && Math.abs(i - currentPg) > 1) {
      if (i === 3 || i === maxPg - 2) btns += '<span style="color:var(--text-faint);padding:0 3px;font-size:12px">…</span>';
      continue;
    }
    btns += '<button class="pgn-btn' + (i === currentPg ? ' on' : '') + '" data-pg="' + i + '">' + i + '</button>';
  }

  document.getElementById('pgn').innerHTML =
    '<span class="pgn-info">Showing ' + start + '–' + end + ' of ' + total + '</span>' +
    '<div class="pgn-btns">' +
      '<button class="pgn-btn" id="pgPrev"' + (currentPg === 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left" style="font-size:9px"></i></button>' +
      btns +
      '<button class="pgn-btn" id="pgNext"' + (currentPg === maxPg ? ' disabled' : '') + '><i class="fas fa-chevron-right" style="font-size:9px"></i></button>' +
    '</div>';

  document.getElementById('pgPrev').addEventListener('click', function(){ currentPg--; renderPage(); });
  document.getElementById('pgNext').addEventListener('click', function(){ currentPg++; renderPage(); });
  document.querySelectorAll('.pgn-btn[data-pg]').forEach(function(b) {
    b.addEventListener('click', function(){ currentPg = parseInt(b.dataset.pg); renderPage(); });
  });
}

/* ── Modal ── */
function openModal(id) {
  var s = allStories.find(function(x){ return x.id === id; });
  if (!s) return;

  document.getElementById('modalCover').src = s.cover;
  document.getElementById('modalCover').alt = s.title;
  document.getElementById('modalName').textContent = s.title;

  var av = s.avatar ? '<img src="' + s.avatar + '" alt="' + s.author + '"/>' : '';
  document.getElementById('modalAuthor').innerHTML = av + '<strong>' + s.author + '</strong><span class="genre-tag">' + s.genre + '</span>';
  document.getElementById('modalTags').innerHTML = '<span class="status-pill ' + s.status + '">' + s.status + '</span>';

  var full = Math.floor(s.rating);
  document.getElementById('modalStars').textContent = '★'.repeat(full) + '☆'.repeat(5 - full);
  document.getElementById('modalRating').textContent = s.rating;
  document.getElementById('modalReads').textContent = '· ' + s.reads.toLocaleString() + ' reads';

  var pct = Math.min(100, Math.round(s.words / s.wordGoal * 100));
  var metaItems = [
    { l: 'Chapters',    v: s.chapterCount },
    { l: 'Total Words', v: s.words.toLocaleString() },
    { l: 'Rating',      v: '⭐ ' + s.rating },
    { l: 'Last Updated',v: s.lastUpdated },
    { l: 'Word Goal',   v: pct + '%' },
    { l: 'Genre',       v: s.genre }
  ];
  document.getElementById('metaGrid').innerHTML = metaItems.map(function(m) {
    return '<div class="meta-item"><div class="meta-lbl">' + m.l + '</div><div class="meta-val">' + m.v + '</div></div>';
  }).join('');

  document.getElementById('synopsisBox').textContent = s.synopsis;

  var chs = s.recentChs.slice(0, 5);
  document.getElementById('chapterList').innerHTML = chs.length
    ? chs.map(function(c) {
        return '<div class="ch-item">' +
          '<div class="ch-num">Ch' + c.n + '</div>' +
          '<div class="ch-title">' + c.title + '</div>' +
          '<span class="ch-status ' + c.status + '">' + c.status + '</span>' +
          '<div class="ch-meta">' + c.words.toLocaleString() + ' w · ' + c.date + '</div>' +
        '</div>';
      }).join('')
    : '<div style="font-size:12px;color:var(--text-faint);padding:8px 0">No chapter data available.</div>';

  document.getElementById('modalActions').innerHTML =
    '<button class="primary" id="mActEdit"><i class="fas fa-pen"></i> Edit Story</button>' +
    '<button id="mActAnalytics"><i class="fas fa-chart-line"></i> Analytics</button>' +
    '<button id="mActFeature"><i class="fas fa-star"></i> Feature</button>' +
    '<button class="danger" id="mActUnpublish"><i class="fas fa-eye-slash"></i> Unpublish</button>';

  document.getElementById('mActEdit').onclick      = function(){ toast('✏️ Opening editor for "' + s.title + '"…'); closeModal(); };
  document.getElementById('mActAnalytics').onclick = function(){ location.href = 'story-analytics.html'; };
  document.getElementById('mActFeature').onclick   = function(){ toast('⭐ "' + s.title + '" added to Featured Stories'); closeModal(); };
  document.getElementById('mActUnpublish').onclick = function(){ toast('🚫 "' + s.title + '" unpublished'); closeModal(); };

  document.getElementById('modalOv').classList.add('open');
  document.getElementById('modalSlide').classList.add('open');
  document.getElementById('modalSlide').scrollTop = 0;
}

function closeModal() {
  document.getElementById('modalOv').classList.remove('open');
  document.getElementById('modalSlide').classList.remove('open');
}

window.StoryManagementService = { init: init };

})();
