/**
 * earnings-overview-service.js — Earnings Overview page logic (pure call-and-render). */
(function () {
'use strict';

const USE_API = true;
const API_BASE = '/api/senior-editor';

async function callBackend(path, options) {
  if (!USE_API) return null;
  try {
    const res = await fetch(API_BASE + path, options);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('[EarningsOverviewService] backend unavailable, using demo data', e);
    return null;
  }
}

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun'];const AUTHOR_DATA=[45600,38900,32400,35600,41200,48300];const PLATFORM_DATA=[28400,25600,23800,26400,29100,30800];const AD_DATA=[12600,11800,10900,11400,12100,11500];
function renderChart(){const max=Math.max(...AUTHOR_DATA,...PLATFORM_DATA,...AD_DATA);const c=document.getElementById('earningsChart');c.innerHTML=MONTHS.map((m,i)=>{const ah=(AUTHOR_DATA[i]/max)*140;const ph=(PLATFORM_DATA[i]/max)*140;const adh=(AD_DATA[i]/max)*140;return `<div class="bar"><div style="display:flex;flex-direction:column;gap:2px;width:100%;align-items:center"><div class="bar-fill" style="height:${ah}px;background:var(--green)"></div><div class="bar-fill" style="height:${ph}px;background:var(--accent)"></div><div class="bar-fill" style="height:${adh}px;background:var(--blue)"></div></div><div class="bar-lbl">${m}</div></div>`}).join('')}
/* Author earnings figures are dollars ('$24,110'); restated in the currency
   Super Admin set for staff reporting. */
function money(n){ if(window.DroboardCurrency && DroboardCurrency.usdToMoney) return DroboardCurrency.usdToMoney(n); return typeof n==='string' ? n : '$' + Number(n||0).toLocaleString('en-US'); }

/* Top earners will be loaded from API. Empty by default. */
const TOP_EARNERS=[];
function renderTopEarners(){document.getElementById('topEarners').innerHTML=TOP_EARNERS.length ? TOP_EARNERS.map(e=>`<div class="pp-row"><img class="pp-av" src="${e.avatar}"/><div class="pp-info"><div class="pp-name">${e.name}</div><div class="pp-book">${e.book}</div></div><div class="pp-earn"><b>${money(e.earn)}</b><span>${e.pct}</span></div></div>`).join('') : '<div style="text-align:center;color:var(--text-faint);padding:20px">Loading earnings data...</div>'}

/* Overview stats will be loaded from API. Empty by default. */
const OVERVIEW_STATS=[];
function renderStatCards(){const el=document.getElementById('overviewStats');if(!el)return;
  el.innerHTML=OVERVIEW_STATS.length ? OVERVIEW_STATS.map(s=>`<div class="stat-card"><div class="num" style="color:${s.c}">—</div><div class="lbl">${s.l}</div><div class="delta ${s.up?'up':'down'}"><i class="fas fa-arrow-${s.up?'up':'down'}" style="font-size:8px"></i> Loading...</div></div>`).join('') : '<div style="text-align:center;color:var(--text-faint);padding:20px">Loading earnings overview...</div>'}

function init(){
  (async function() {
    const user = await (window.SeniorEditorGetUser || (async () => null))();
    SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'earnings-overview',title:'Earnings Overview',subtitle:'Track platform revenue, author payouts and earnings trends',user:null,notifCount:0,hideSearch:true});
  })();
  callBackend('/earnings-overview');
  renderChart();renderTopEarners();renderStatCards();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
// Real CSV download: POST → stream the file the backend returns as a download.
function downloadCsv(path, filename, failMsg){
  return fetch(API_BASE + path, { method:'POST', credentials:'include' })
    .then(function(res){
      if(!res.ok) throw new Error('HTTP ' + res.status);
      var cd = res.headers.get('Content-Disposition') || '';
      var m = /filename="?([^";]+)"?/.exec(cd);
      return res.blob().then(function(blob){ return { blob: blob, name: (m && m[1]) || filename }; });
    })
    .then(function(x){
      var url = URL.createObjectURL(x.blob);
      var a = document.createElement('a');
      a.href = url; a.download = x.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      svcToast('CSV downloaded');
    })
    .catch(function(e){ console.warn('[export] failed', e); svcToast(failMsg); });
}
function exportReport(){ return downloadCsv('/earnings/export', 'earnings-overview.csv', 'Export failed — is the backend reachable?'); }
function openDetailedAnalytics(){ return callBackend('/earnings/analytics').then(function(r){ if(!r) svcToast('Opening detailed analytics…'); }); }
function openFullLeaderboard(){ return callBackend('/earnings/leaderboard').then(function(r){ if(!r) svcToast('Opening full leaderboard…'); }); }

window.EarningsOverviewService={init:init,exportReport:exportReport,openDetailedAnalytics:openDetailedAnalytics,openFullLeaderboard:openFullLeaderboard};

})();
