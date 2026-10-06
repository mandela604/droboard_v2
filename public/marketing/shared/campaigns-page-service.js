/**
 * campaigns-page-service.js — Campaigns page logic (pure call-and-render).
 * Extracted verbatim from campaigns.html inline script.
 * Page now calls CampaignsPage.init().
 * Backend-ready: implement fetch endpoints in shared/marketing-data.js and swap reads; no HTML change.
 */
(function(){
'use strict';

const shell = MarketingSidebar.attach('#cmpRoot', {
  activeItem: 'campaigns',
  title: 'Campaigns',
  subtitle: 'Story pushes & business campaigns, in one place',
  user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
  notifCount: 5,
  searchPlaceholder: 'Search campaigns…',
  onSearch: (v) => { document.getElementById('searchInput').value = v; currentPg = 1; applyFilters(); }
});

/* ─────────────────────────────────────────
   PLACEMENT SURFACES — passed straight into CampaignWizard.
   No page-level legend/explainer here anymore; the wizard's
   Setup step is the single place surfaces are picked/explained.
───────────────────────────────────────── */
const PLACEMENTS = [
  { id:'discover',      label:'Homepage / Discover', icon:'fa-house',          desc:'Banner slider & popular grid' },
  { id:'search',        label:'Search Results',      icon:'fa-magnifying-glass', desc:'Surfaced among organic results' },
  { id:'feed',          label:'Social Feed',         icon:'fa-rss',            desc:'Native post in the feed tab' },
  { id:'profile',       label:'Profile Pages',       icon:'fa-circle-user',    desc:'On author/reader profile screens' },
  { id:'status',        label:'Status / Stories',    icon:'fa-circle-notch',   desc:'Status ring row at the top of feed' },
  { id:'genre-hub',     label:'Genre Hub',           icon:'fa-layer-group',    desc:'Community hub for a genre' },
  { id:'end-of-story',  label:'End of Story',        icon:'fa-book-open',      desc:'"You may also like" after a chapter' },
  { id:'comments',      label:'Inside Comments',     icon:'fa-comment-dots',   desc:'Sponsored slot in comment threads' },
];
const PLACEMENT_MAP = {}; PLACEMENTS.forEach(p => PLACEMENT_MAP[p.id] = p);

/* ─────────────────────────────────────────
   STORY LIBRARY — passed into CampaignWizard's story picker
───────────────────────────────────────── */
const STORY_LIBRARY = [
  { id:'ST-001', title:'Bound by the Ruthless Alpha', author:'Chioma Okafor', genre:'Romance & Betrayal', cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg' },
  { id:'ST-002', title:"The CEO's Hidden Son", author:'Luna Skye', genre:'Billionaire & CEO', cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg' },
  { id:'ST-003', title:"Wolf King's Vow", author:'Elena Vasquez', genre:'Werewolf & Fantasy', cover:'https://i.postimg.cc/MXBR6bfY/wolf3.jpg' },
  { id:'ST-004', title:'Betrayed by the Mafia Prince', author:'Marcus Webb Jr.', genre:'Mafia & Urban', cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg' },
  { id:'ST-005', title:"The Duke's Secret", author:'Isabelle Moreau', genre:'Historical & Regency', cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg' },
  { id:'ST-006', title:'Revenge at the Ivy League', author:'Wren Okonkwo', genre:'Campus & Revenge', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg' },
  { id:'ST-007', title:'The Runaway Bride in Socked Feet', author:'Ifeanyi_Story', genre:'Twist & Drama', cover:'https://i.postimg.cc/tY7KnJyr/images.jpg' },
  { id:'ST-008', title:'The Letter He Never Sent', author:'Efe_O', genre:'Elegy & Heartbreak', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg' },
];


const PER_PAGE = 5;
/* Campaign records live in shared/marketing-data.js — ONE list shared by
   campaigns, ad-manager and dashboard (status cascades to linked ads). */
let allCampaigns = [];
let creativeCounts = {};
let filtered = [];
let activeType = 'all';
let activeStatus = 'all';
let currentPg = 1;
let delTargetId = null;

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
async function init() {
  try { allCampaigns = await MarketingData.getCampaigns(); }
  catch (e) { allCampaigns = []; }
  try {
    const counts = {};
    await Promise.all((allCampaigns || []).map(async (c) => {
      try { counts[c.id] = (await MarketingData.getAdsByCampaign(c.id)).length; }
      catch (e) { counts[c.id] = 0; }
    }));
    creativeCounts = counts;
  } catch (e) { creativeCounts = {}; }
  buildPlacementSelect();
  buildTypeFilterRow();
  buildStatusFilterRow();
  buildStats();
  applyFilters();

  document.getElementById('searchInput').addEventListener('input', () => { currentPg = 1; applyFilters(); });
  document.getElementById('sortSel').addEventListener('change', applyFilters);
  document.getElementById('placementSel').addEventListener('change', () => { currentPg = 1; applyFilters(); });
  document.getElementById('newCampaignBtn').addEventListener('click', openCreateWizard);

  document.getElementById('detailOv').addEventListener('click', closeDetail);
  document.getElementById('detailClose').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDetail(); closeDel(); } });
}

/* ─────────────────────────────────────────
   CampaignWizard hookup — this IS "in-page campaign setup" now.
   Create and Edit both hand off to the shared wizard component;
   this page just persists whatever payload it returns.
───────────────────────────────────────── */
function openCreateWizard() {
  CampaignWizard.open({
    mode: 'create',
    placements: PLACEMENTS,
    storyLibrary: STORY_LIBRARY,
    defaultOwner: 'Tari Benson',
    onSubmit: async (payload) => {
      const record = Object.assign({
        id: 'CMP-' + String(Date.now()).slice(-6),
        status: inferInitialStatus(payload),
        reach: 0, impressions: 0, clicks: 0, ctr: 0, conversions: 0,
        updatedAt: new Date().toISOString(),
      }, payload);
      try { allCampaigns.unshift(await MarketingData.createCampaign(record)); }
      catch (e) { allCampaigns.unshift(record); }
      toast(`🎯 "${payload.name}" created`);
      buildStats(); buildTypeFilterRow(); buildStatusFilterRow(); applyFilters();
    },
  });
}

function openEditWizard(id) {
  const c = allCampaigns.find(x => x.id === id);
  if (!c) return;
  CampaignWizard.open({
    mode: 'edit',
    campaign: c,
    placements: PLACEMENTS,
    storyLibrary: STORY_LIBRARY,
    onSubmit: async (payload) => {
      // status is managed separately via the Pause/Resume/Set Live quick action,
      // so it isn't touched by the wizard payload.
      try { Object.assign(c, await MarketingData.updateCampaign(c.id, payload)); }
      catch (e) { Object.assign(c, payload); }
      c.updatedAt = new Date().toISOString();
      toast(`✅ "${c.name}" updated`);
      buildStats(); buildTypeFilterRow(); buildStatusFilterRow(); applyFilters();
    },
  });
}

function inferInitialStatus(payload) {
  if (!payload.startDate) return 'draft';
  const today = new Date().toISOString().slice(0, 10);
  return payload.startDate > today ? 'scheduled' : 'live';
}

/* ─────────────────────────────────────────
   STATS
───────────────────────────────────────── */
function buildStats() {
  const total = allCampaigns.length;
  const live = allCampaigns.filter(c => c.status === 'live').length;
  const storyCount = allCampaigns.filter(c => c.type === 'story').length;
  const businessCount = allCampaigns.filter(c => c.type === 'business').length;
  const stats = [
    { n: total, l: 'Total Campaigns', ico: 'fa-bullseye', clr: 'var(--accent)', bg: 'rgba(255,0,80,.1)' },
    { n: live, l: 'Live Now', ico: 'fa-signal', clr: 'var(--green)', bg: 'var(--green-bg)' },
    { n: storyCount, l: 'Platform Story Pushes', ico: 'fa-book-open', clr: 'var(--purple)', bg: 'var(--purple-bg)' },
    { n: businessCount, l: 'Business Campaigns', ico: 'fa-briefcase', clr: 'var(--blue)', bg: 'var(--blue-bg)' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s => `
    <div class="stat-card"><div class="stat-ico" style="background:${s.bg};color:${s.clr}"><i class="fas ${s.ico}"></i></div>
    <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div></div>`).join('');
}

/* ─────────────────────────────────────────
   PLACEMENT <select> FILTER (browsing only — not setup)
───────────────────────────────────────── */
function buildPlacementSelect() {
  const el = document.getElementById('placementSel');
  el.innerHTML = '<option value="">All Placements</option>' + PLACEMENTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
}

/* ─────────────────────────────────────────
   TYPE + STATUS FILTER PILLS
───────────────────────────────────────── */
function buildTypeFilterRow() {
  const counts = { all: allCampaigns.length, story: 0, business: 0 };
  allCampaigns.forEach(c => counts[c.type]++);
  const types = [
    { id:'all', label:'All Types' },
    { id:'story', label:'📖 Platform Story' },
    { id:'business', label:'💼 Business' },
  ];
  document.getElementById('typeFilterRow').innerHTML = types.map(t =>
    `<button class="filter-pill type-${t.id}${t.id===activeType?' on':''}" data-type="${t.id}">${t.label}<span class="pill-count">${counts[t.id]}</span></button>`
  ).join('');
  document.querySelectorAll('#typeFilterRow .filter-pill').forEach(p => {
    p.addEventListener('click', () => { activeType = p.dataset.type; currentPg = 1; buildTypeFilterRow(); applyFilters(); });
  });
}

function buildStatusFilterRow() {
  const statuses = ['all', 'live', 'scheduled', 'draft', 'paused', 'ended'];
  const counts = { all: allCampaigns.length };
  allCampaigns.forEach(c => counts[c.status] = (counts[c.status] || 0) + 1);
  document.getElementById('statusFilterRow').innerHTML = statuses.map(st => {
    const label = st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1);
    return `<button class="filter-pill${st===activeStatus?' on':''}" data-status="${st}">${label}<span class="pill-count">${counts[st]||0}</span></button>`;
  }).join('');
  document.querySelectorAll('#statusFilterRow .filter-pill').forEach(p => {
    p.addEventListener('click', () => { activeStatus = p.dataset.status; currentPg = 1; buildStatusFilterRow(); applyFilters(); });
  });
}

/* ─────────────────────────────────────────
   FILTER + SORT + PAGINATE
───────────────────────────────────────── */
function applyFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const placement = document.getElementById('placementSel').value;
  const sort = document.getElementById('sortSel').value;

  filtered = allCampaigns.filter(c => {
    const matchesType = activeType === 'all' || c.type === activeType;
    const matchesStatus = activeStatus === 'all' || c.status === activeStatus;
    const searchable = [c.name, c.owner, c.storyTitle, c.storyAuthor, c.advertiserName].filter(Boolean).join(' ').toLowerCase();
    const matchesQ = !q || searchable.includes(q);
    const matchesPlacement = !placement || (c.placements || []).includes(placement);
    return matchesType && matchesStatus && matchesQ && matchesPlacement;
  });

  if (sort === 'ctr') filtered.sort((a,b) => (b.ctr||0) - (a.ctr||0));
  else if (sort === 'reach') filtered.sort((a,b) => (b.reach||0) - (a.reach||0));
  else if (sort === 'alpha') filtered.sort((a,b) => a.name.localeCompare(b.name));
  else filtered.sort((a,b) => (b.startDate||'').localeCompare(a.startDate||''));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if (currentPg > totalPages) currentPg = totalPages;

  document.getElementById('cmpCount').textContent = `${filtered.length} of ${allCampaigns.length}`;
  renderPage();
}

function fmtDate(d) {
  if (!d) return 'TBD';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1],10)-1] + ' ' + parseInt(parts[2],10) + ', ' + parts[0];
}
function fmtNum(n) { n = n || 0; return n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/,'') + 'K' : String(n); }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function placementChipsHtml(ids, limit) {
  const list = ids || [];
  const shown = limit ? list.slice(0, limit) : list;
  let html = shown.map(id => {
    const p = PLACEMENT_MAP[id]; if (!p) return '';
    return `<span class="pchip"><i class="fas ${p.icon}"></i>${p.label}</span>`;
  }).join('');
  if (limit && list.length > limit) html += `<span class="pchip">+${list.length - limit} more</span>`;
  return html;
}

function typeChipHtml(c) {
  const obj = c.objective && CampaignWizard.OBJECTIVES.find(o => o.id === c.objective);
  if (obj) {
    const cls = obj.isBusiness ? 'business' : 'story';
    return `<span class="type-chip ${cls}"><i class="fas ${obj.icon}"></i> ${esc(obj.label)}</span>`;
  }
  return c.type === 'story'
    ? `<span class="type-chip story"><i class="fas fa-book-open"></i> Platform Story</span>`
    : `<span class="type-chip business"><i class="fas fa-briefcase"></i> Business</span>`;
}

/* Reuses the wizard's own audience-estimate math so numbers stay consistent
   between the Setup wizard and this read-only detail view. */
function buildTargetTags(t) {
  const tags = [];
  if (t.interests && t.interests.length) tags.push(`🎯 ${t.interests.join(', ')}`);
  if (t.similarStories) tags.push('📚 Similar Stories');
  if (t.tippedLast30Days) tags.push('❤️ Tipped (30d)');
  if (t.unlockedChapters && t.unlockedChapters.enabled) tags.push(`💰 ≥${t.unlockedChapters.min} Chapters`);
  if (t.readTime && t.readTime.enabled) tags.push(`⏱️ ${t.readTime.hours}+ hrs/mo`);
  if (t.followersOfSimilarAuthors) tags.push('👥 Similar Authors\' Followers');
  if (t.country && t.country !== 'All Countries') tags.push(`🌍 ${t.country}`);
  if (t.language && t.language !== 'All Languages') tags.push(`🗣️ ${t.language}`);
  if (t.age && t.age.enabled) tags.push(`📱 Age ${t.age.min}-${t.age.max}`);
  const a = t.advanced || {};
  if (a.boughtCoinsRecently) tags.push('🎁 Bought Coins Recently');
  if (a.innerCircleMembers) tags.push('⭐ Inner Circle');
  if (a.highlyActiveReaders) tags.push('🔥 Highly Active');
  if (a.inactiveReaders) tags.push('😴 Inactive (Re-engage)');
  if (a.finishedSimilarBooks) tags.push('📖 Finished Similar Books');
  if (a.genreHubMembers) tags.push('🏷️ Genre Hub Members');
  if (a.followingSpecificAuthors && a.followingSpecificAuthors.enabled) tags.push(`📋 Following: ${(a.followingSpecificAuthors.authors||[]).join(', ') || '—'}`);
  return tags;
}

/* ─────────────────────────────────────────
   RENDER CAMPAIGN LIST
───────────────────────────────────────── */
function renderPage() {
  const start = (currentPg - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);

  if (!page.length) {
    document.getElementById('campaignList').innerHTML = '<div class="empty-msg"><i class="fas fa-bullseye"></i>No campaigns match your filters.</div>';
    document.getElementById('pgn').innerHTML = '';
    return;
  }

  document.getElementById('campaignList').innerHTML = page.map(c => {
    const dates = (c.startDate || c.endDate) ? (fmtDate(c.startDate) + ' – ' + fmtDate(c.endDate)) : 'Not scheduled';
    const cover = c.type === 'story' ? `<img class="cmp-cover" src="${c.storyCover}" alt=""/>` : '';
    const sub = c.type === 'story'
      ? `Promoting <b>${esc(c.storyTitle)}</b> by @${esc(c.storyAuthor)}`
      : `Advertiser: <b>${esc(c.advertiserName)}</b>${c.advertiserEmail ? ' · ' + esc(c.advertiserEmail) : ''}`;
    const budgetStat = c.hasBudget
      ? `<span class="cmp-stat"><i class="fas fa-sack-dollar"></i>$${fmtNum(c.spent)} / $${fmtNum(c.budget)}</span>`
      : `<span class="cmp-stat"><i class="fas fa-gift"></i>No budget</span>`;

    return `<div class="cmp-card" data-id="${c.id}">
      <div class="cmp-top">
        ${cover}
        <span class="cmp-name">${esc(c.name)}</span>
        ${typeChipHtml(c)}
        <span class="status-pill ${c.status}">${c.status}</span>
      </div>
      <div class="cmp-sub">${sub}</div>
      <div class="placement-chips">${placementChipsHtml(c.placements, 4)}</div>
      <div class="cmp-meta">
        <span class="cmp-stat"><i class="fas fa-eye"></i>${fmtNum(c.reach)} reach</span>
        <span class="cmp-stat"><i class="fas fa-arrow-pointer"></i>${c.ctr||0}% CTR</span>
        <span class="cmp-stat"><i class="fas fa-rectangle-ad"></i>${creativeCounts[c.id]||0} creatives</span>
        ${budgetStat}
        <span class="cmp-stat"><i class="fas fa-calendar"></i>${dates}</span>
      </div>
      <div class="cmp-actions">
        <button class="cmp-btn" data-act="edit" data-id="${c.id}"><i class="fas fa-pen"></i> Edit</button>
        <button class="cmp-btn" data-act="toggle" data-id="${c.id}"><i class="fas fa-${c.status === 'live' ? 'pause' : 'play'}"></i> ${c.status === 'live' ? 'Pause' : (c.status === 'paused' ? 'Resume' : 'Set Live')}</button>
        <button class="cmp-btn" data-act="ads" data-id="${c.id}"><i class="fas fa-rectangle-ad"></i> Ads</button>
        <button class="cmp-btn danger" data-act="delete" data-id="${c.id}"><i class="fas fa-trash"></i> Delete</button>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.cmp-card').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target.closest('[data-act]')) return; openDetail(el.dataset.id); });
  });
  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = btn.dataset.act, id = btn.dataset.id;
      if (act === 'edit') openEditWizard(id);
      if (act === 'delete') openDel(id);
      if (act === 'toggle') quickToggleStatus(id);
      if (act === 'ads') location.href = 'ad-manager.html?campaign=' + encodeURIComponent(id);
    });
  });

  renderPagination();
}

function renderPagination() {
  const total = filtered.length;
  const maxPg = Math.ceil(total / PER_PAGE);
  if (maxPg <= 1) { document.getElementById('pgn').innerHTML = ''; return; }

  const start = (currentPg - 1) * PER_PAGE + 1;
  const end = Math.min(currentPg * PER_PAGE, total);
  let btns = '';
  for (let i = 1; i <= maxPg; i++) {
    if (maxPg > 6 && i > 2 && i < maxPg - 1 && Math.abs(i - currentPg) > 1) {
      if (i === 3 || i === maxPg - 2) btns += '<span style="color:var(--text-faint);padding:0 3px;font-size:12px">…</span>';
      continue;
    }
    btns += `<button class="pgn-btn${i===currentPg?' on':''}" data-pg="${i}">${i}</button>`;
  }

  document.getElementById('pgn').innerHTML = `
    <span class="pgn-info">Showing ${start}–${end} of ${total}</span>
    <div class="pgn-btns">
      <button class="pgn-btn" id="pgPrev"${currentPg===1?' disabled':''}><i class="fas fa-chevron-left" style="font-size:9px"></i></button>
      ${btns}
      <button class="pgn-btn" id="pgNext"${currentPg===maxPg?' disabled':''}><i class="fas fa-chevron-right" style="font-size:9px"></i></button>
    </div>`;

  document.getElementById('pgPrev').addEventListener('click', () => { currentPg--; renderPage(); });
  document.getElementById('pgNext').addEventListener('click', () => { currentPg++; renderPage(); });
  document.querySelectorAll('.pgn-btn[data-pg]').forEach(b => b.addEventListener('click', () => { currentPg = parseInt(b.dataset.pg); renderPage(); }));
}

/* ─────────────────────────────────────────
   DETAIL MODAL (read-only view; Edit hands off to the wizard)
───────────────────────────────────────── */
function openDetail(id) {
  const c = allCampaigns.find(x => x.id === id); if (!c) return;

  const coverEl = document.getElementById('dCover');
  if (c.type === 'story') { coverEl.src = c.storyCover; coverEl.style.display = 'block'; }
  else coverEl.style.display = 'none';

  document.getElementById('dName').textContent = c.name;
  document.getElementById('dTags').innerHTML = `${typeChipHtml(c)}<span class="status-pill ${c.status}">${c.status}</span>`;
  document.getElementById('dOwnerLine').innerHTML = c.type === 'story'
    ? `<span><i class="fas fa-book"></i> ${esc(c.storyTitle)} — @${esc(c.storyAuthor)}</span>`
    : `<span><i class="fas fa-building"></i> ${esc(c.advertiserName)}${c.advertiserEmail ? ' · ' + esc(c.advertiserEmail) : ''}</span>`;

  document.getElementById('dPlacements').innerHTML = placementChipsHtml(c.placements);

  const metaItems = [
    { l: 'Impressions', v: fmtNum(c.impressions) },
    { l: 'Clicks', v: fmtNum(c.clicks) },
    { l: 'Reach', v: fmtNum(c.reach) },
    { l: 'CTR', v: (c.ctr||0) + '%' },
    { l: 'Conversions', v: fmtNum(c.conversions) },
    { l: 'Budget', v: c.hasBudget ? ('$' + fmtNum(c.spent) + ' / $' + fmtNum(c.budget)) : 'No budget' },
    { l: 'Owner', v: esc(c.owner || 'Unassigned') },
    { l: 'Dates', v: (c.startDate || c.endDate) ? (fmtDate(c.startDate) + ' – ' + fmtDate(c.endDate)) : 'Not scheduled' },
  ];
  document.getElementById('dMetaGrid').innerHTML = metaItems.map(m =>
    `<div class="meta-item"><div class="meta-lbl">${m.l}</div><div class="meta-val">${m.v}</div></div>`).join('');

  const targetingSection = document.getElementById('dTargetingSection');
  if (c.audienceTargeting) {
    targetingSection.style.display = 'block';
    const tags = buildTargetTags(c.audienceTargeting);
    document.getElementById('dTargetTags').innerHTML = tags.length
      ? tags.map(tag => `<span class="tag-chip">${esc(tag)}</span>`).join('')
      : `<span class="tag-chip empty">No targeting filters — reaching all readers</span>`;
    const est = CampaignWizard.estimateAudience(c.audienceTargeting);
    document.getElementById('dEstimate').innerHTML = `
      <div class="estimate-top">
        <div class="estimate-ico"><i class="fas fa-users"></i></div>
        <div><div class="estimate-count">${est.count.toLocaleString('en-US')} Readers</div><div class="estimate-lbl">Estimated Audience</div></div>
      </div>
      <div class="estimate-stats">
        <div class="estimate-stat"><b>${est.reach}</b><span>Potential Reach</span></div>
        <div class="estimate-stat"><b>${est.competition}</b><span>Competition</span></div>
      </div>`;
  } else {
    targetingSection.style.display = 'none';
  }

  document.getElementById('dDesc').textContent = c.description || 'No description added yet.';

  document.getElementById('dActions').innerHTML =
    `<button class="primary" id="dActEdit"><i class="fas fa-pen"></i> Edit Campaign</button>
     <button id="dActToggle"><i class="fas fa-${c.status === 'live' ? 'pause' : 'play'}"></i> ${c.status === 'live' ? 'Pause' : (c.status === 'paused' ? 'Resume' : 'Set Live')}</button>
     <button class="danger" id="dActDelete"><i class="fas fa-trash"></i> Delete</button>`;

  document.getElementById('dActEdit').onclick = () => { closeDetail(); openEditWizard(c.id); };
  document.getElementById('dActToggle').onclick = () => { quickToggleStatus(c.id); closeDetail(); };
  document.getElementById('dActDelete').onclick = () => { closeDetail(); openDel(c.id); };

  document.getElementById('detailOv').classList.add('open');
  document.getElementById('detailSlide').classList.add('open');
  document.getElementById('detailSlide').scrollTop = 0;
}
function closeDetail() {
  document.getElementById('detailOv').classList.remove('open');
  document.getElementById('detailSlide').classList.remove('open');
}

/* ─────────────────────────────────────────
   QUICK STATUS TOGGLE (status now lives outside the wizard)
───────────────────────────────────────── */
async function quickToggleStatus(id) {
  const c = allCampaigns.find(x => x.id === id); if (!c) return;
  const next = c.status === 'live' ? 'paused' : 'live';
  try { Object.assign(c, await MarketingData.updateCampaign(id, { status: next })); }
  catch (e) { c.status = next; }
  toast(c.status === 'live' ? `▶️ "${c.name}" is now live (linked ads resume)` : `⏸️ "${c.name}" paused (linked ads off)`);
  buildStats(); buildStatusFilterRow(); applyFilters();
}

/* ─────────────────────────────────────────
   DELETE MODAL
───────────────────────────────────────── */
function openDel(id) {
  const c = allCampaigns.find(x => x.id === id); if (!c) return;
  delTargetId = id;
  document.getElementById('delSub').textContent = `This will permanently remove "${c.name}". This can't be undone.`;
  document.getElementById('delError').classList.remove('show');
  document.getElementById('delOv').classList.add('open');
}
function closeDel() {
  document.getElementById('delOv').classList.remove('open');
  delTargetId = null;
}
async function submitDel() {
  const c = allCampaigns.find(x => x.id === delTargetId); if (!c) return;
  try { await MarketingData.deleteCampaign(c.id); } catch (e) {}
  allCampaigns = allCampaigns.filter(x => x.id !== c.id);
  toast(`🗑️ "${c.name}" deleted`);
  closeDel();
  buildStats(); buildTypeFilterRow(); buildStatusFilterRow(); applyFilters();
}

/* ─────────────────────────────────────────
   SHARED EVENT DELEGATION (delete modal only — wizard handles its own)
───────────────────────────────────────── */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'close-del') closeDel();
  else if (action === 'submit-del') submitDel();
});
document.getElementById('delOv').addEventListener('click', (e) => { if (e.target.id === 'delOv') closeDel(); });

window.CampaignsPage={init:init};
})();
