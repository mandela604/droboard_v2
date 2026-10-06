/**
 * dashboard-page-service.js — Overview dashboard page logic (pure call-and-render).
 * Extracted verbatim from dashboard.html inline script.
 * Page now calls MarketingDashboard.init().
 * Backend-ready: implement fetch endpoints in shared/marketing-data.js and swap reads; no HTML change.
 */
(function(){
'use strict';
const shell = MarketingSidebar.attach('#dashRoot',{
  activeItem:'dashboard', title:'Dashboard', subtitle:'Growth & marketing overview',
  user:{name:'Tari Benson',role:'Marketing Lead',avatar:'https://i.pravatar.cc/100?img=32'}, notifCount:5,
  searchPlaceholder:'Search anything…',
});

const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

function greetByHour(){
  const h = new Date().getHours();
  if(h<12) return 'Good morning, Tari 👋';
  if(h<18) return 'Good afternoon, Tari 👋';
  return 'Good evening, Tari 👋';
}
function fmtNum(n){
  n = n || 0;
  if (n >= 1000000) return (n/1000000).toFixed(n>=10000000?0:1).replace(/\.0$/,'') + 'M';
  if (n >= 1000) return (n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'') + 'K';
  return String(n);
}
function fmtDateRange(startDate, endDate){
  if(!startDate && !endDate) return 'Not scheduled';
  const fmt = (d) => { if(!d) return 'TBD'; const dt = new Date(d+'T00:00:00'); if(isNaN(dt)) return d; return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/* Each panel below renders independently. Wrapping every one of these
   in safeRun() means one section throwing (e.g. a data field that's
   missing or shaped differently than expected) can never leave the
   other panels stuck on their "Loading…" skeleton — that was the bug
   here: campaignsList referenced a field that didn't exist on the
   dashboard payload, threw, and silently killed every panel queued
   after it in the same function. */
function safeRun(label, fn){
  try { fn(); }
  catch(e){ console.error('[Dashboard] ' + label + ' failed:', e); }
}
async function safeRunAsync(label, fn){
  try { await fn(); }
  catch(e){ console.error('[Dashboard] ' + label + ' failed:', e); }
}

function renderWelcomeStats(d){
  document.getElementById('welcomeStats').innerHTML = `
    <div class="welcome-stat"><b>${d.activeCampaigns}</b><span>Active Campaigns</span></div>
    <div class="welcome-stat"><b>${d.livePromotions}</b><span>Live Promotions</span></div>
    <div class="welcome-stat"><b>${d.upcomingEventsCount}</b><span>Upcoming Events</span></div>
    <div class="welcome-stat"><b>${d.avgEngagementRate}</b><span>Avg Engagement</span></div>`;
}

function renderStatCards(d){
  const stats = [
    { n:d.activeCampaigns, l:'Active Campaigns', ico:'fa-bullseye', cls:'accent' },
    { n:d.livePromotions, l:'Live Promotions', ico:'fa-bullhorn', cls:'green' },
    { n:d.sponsoredPlacementsLive, l:'Sponsored Placements', ico:'fa-star', cls:'amber' },
    { n:d.homepageBannersLive, l:'Homepage Banners Live', ico:'fa-image', cls:'blue' },
  ];
  document.getElementById('statCards').innerHTML = stats.map(s=>`
    <div class="stat-card">
      <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
      <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
    </div>`).join('');
}

/* Active Campaigns now pulls straight from the real campaign records
   (the same source campaigns.html reads), rather than a
   `d.activeCampaignsList` field that never actually existed on the
   dashboard summary object — that mismatch was the root cause of the
   whole page getting stuck on "Loading…". */
async function renderActiveCampaigns(){
  const all = await MarketingData.getCampaigns();
  const active = all
    .filter(c => c.status === 'live' || c.status === 'scheduled')
    .sort((a,b) => (b.status === 'live') - (a.status === 'live'))
    .slice(0, 4);

  if(!active.length){
    document.getElementById('campaignsList').innerHTML = `<div class="empty-note">No active or scheduled campaigns right now.</div>`;
    return;
  }

  document.getElementById('campaignsList').innerHTML = active.map(c => `
    <div class="cmp-card" data-id="${c.id}">
      <div class="cmp-top">
        <span class="cmp-name">${c.name}</span>
        <span class="type-chip">${c.type}</span>
        <span class="status-pill ${c.status}">${c.status}</span>
      </div>
      <div class="cmp-meta">
        <span class="cmp-stat"><i class="fas fa-satellite-dish"></i>${c.channel || '—'}</span>
        <span class="cmp-stat"><i class="fas fa-eye"></i>${fmtNum(c.reach)} reach</span>
        <span class="cmp-stat"><i class="fas fa-arrow-pointer"></i>${c.ctr || 0}% CTR</span>
        <span class="cmp-stat"><i class="fas fa-calendar"></i>${fmtDateRange(c.startDate, c.endDate)}</span>
      </div>
    </div>`).join('');

  document.querySelectorAll('#campaignsList .cmp-card').forEach(card => {
    card.addEventListener('click', () => { location.href = 'campaigns.html'; });
  });
}

function renderQuickActions(d){
  document.getElementById('qaGrid').innerHTML = d.quickActions.map(qa=>`
    <div class="qa-card" data-href="${qa.href||'#'}">
      <div class="qa-ico" style="background:${BG_MAP[qa.cls]};color:${ICO_MAP[qa.cls]}"><i class="fas ${qa.icon}"></i></div>
      <div class="qa-txt"><b>${qa.label}</b><span>Get started</span></div>
    </div>`).join('');
  document.querySelectorAll('.qa-card').forEach(c=>{
    c.addEventListener('click', ()=>{
      const href = c.dataset.href;
      if(href && href!=='#') location.href = href; else toast('Opening…');
    });
  });
}

function renderEvents(d){
  if(!d.upcomingEvents || !d.upcomingEvents.length){
    document.getElementById('eventsList').innerHTML = `<div class="empty-note">No upcoming events or contests scheduled.</div>`;
    return;
  }
  document.getElementById('eventsList').innerHTML = d.upcomingEvents.map(e=>`
    <div class="evt-row">
      <div class="evt-ico"><i class="fas ${e.type==='Contest'?'fa-trophy':'fa-calendar-star'}"></i></div>
      <div class="evt-body">
        <div class="evt-name">${e.name}</div>
        <div class="evt-meta">${e.type} · ${e.date}</div>
        <div class="evt-detail">${e.detail}</div>
      </div>
    </div>`).join('');
}

function renderAnalytics(d){
  const a = d.analyticsSnapshot;
  document.getElementById('analyticsSnapshot').innerHTML = `
    <div class="an-grid">
      <div class="an-item"><div class="an-lbl">Impressions</div><div class="an-val">${a.impressions}</div></div>
      <div class="an-item"><div class="an-lbl">Clicks</div><div class="an-val">${a.clicks}</div></div>
      <div class="an-item"><div class="an-lbl">CTR</div><div class="an-val">${a.ctr}</div></div>
      <div class="an-item"><div class="an-lbl">Conversions</div><div class="an-val">${a.conversions}</div></div>
    </div>
    <div style="margin-top:10px;font-size:11.5px;color:var(--text-muted);display:flex;align-items:center;gap:6px">
      <i class="fas fa-arrow-trend-up" style="color:var(--green)"></i> Revenue lift this week: <b class="an-val up" style="font-size:12.5px">${a.revenueLift}</b>
    </div>`;
}

function renderActivity(d){
  document.getElementById('activityList').innerHTML = d.recentActivity.map(a=>`
    <div class="act-row">
      <div class="act-dot" style="background:${BG_MAP[a.color]||'var(--table-head)'};color:${ICO_MAP[a.color]||'var(--text-faint)'}"><i class="fas ${a.icon}"></i></div>
      <div class="act-body">
        <div class="act-text">${a.text}</div>
        <div class="act-time">${a.time}</div>
      </div>
    </div>`).join('');
}

async function init(){
  document.getElementById('greetTitle').textContent = greetByHour();

  let d;
  try {
    d = await MarketingData.getDashboard();
  } catch(e){
    console.error('[Dashboard] getDashboard failed:', e);
    document.getElementById('statCards').innerHTML = `<div class="err-note"><i class="fas fa-triangle-exclamation"></i> Couldn't load dashboard data. Try refreshing the page.</div>`;
    return;
  }

  safeRun('welcome stats', () => renderWelcomeStats(d));
  safeRun('stat cards', () => renderStatCards(d));
  safeRun('quick actions', () => renderQuickActions(d));
  safeRun('upcoming events', () => renderEvents(d));
  safeRun('analytics snapshot', () => renderAnalytics(d));
  safeRun('recent activity', () => renderActivity(d));

  // Runs independently of the block above since it awaits its own
  // fetch — its failure (or slowness) shouldn't hold up anything else.
  await safeRunAsync('active campaigns', renderActiveCampaigns);
}

window.MarketingDashboard={init:init};
})();
