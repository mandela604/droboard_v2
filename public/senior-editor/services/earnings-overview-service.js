/**
 * earnings-overview-service.js — Earnings Overview page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and implement endpoints to swap demo data for live API.
 * Demo paths keep working when USE_API=false.
 */
(function () {
'use strict';

const USE_API = false;
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
const TOP_EARNERS=[
  {name:'Amara Okafor',avatar:'https://i.pravatar.cc/100?img=45',book:'The Ruthless CEO',earn:'$24,110',pct:'+22%'},
  {name:'Isabella Rossi',avatar:'https://i.pravatar.cc/100?img=38',book:'His Hidden Luna',earn:'$21,050',pct:'+18%'},
  {name:'Sofia Lindqvist',avatar:'https://i.pravatar.cc/100?img=32',book:'Bound by the Alpha',earn:'$18,420',pct:'+15%'},
  {name:'Layla Haddad',avatar:'https://i.pravatar.cc/100?img=48',book:'Broken Vows',earn:'$15,780',pct:'+12%'},
];
function renderTopEarners(){document.getElementById('topEarners').innerHTML=TOP_EARNERS.map(e=>`<div class="pp-row"><img class="pp-av" src="${e.avatar}"/><div class="pp-info"><div class="pp-name">${e.name}</div><div class="pp-book">${e.book}</div></div><div class="pp-earn"><b>${e.earn}</b><span>${e.pct}</span></div></div>`).join('')}

function init(){
  SeniorEditorSidebar.attach('#dashboardRoot',{activeItem:'earnings-overview',title:'Earnings Overview',subtitle:'Track platform revenue, author payouts and earnings trends',user:{name:'Reina Morgan',role:'General Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:8,hideSearch:true});
  // Backend swap point (demo paths keep working when USE_API=false):
  // callBackend('/earnings-overview').then(function (data) { if (data) { renderChart(); renderTopEarners(); } });
  callBackend('/earnings-overview');
  renderChart();renderTopEarners();
}

function svcToast(m){ if(typeof window.toast==='function'){ try{ window.toast(m); return; }catch(e){} } }
function exportReport(){ return callBackend('/earnings/export', { method:'POST' }).then(function(r){ if(!r) svcToast('Exporting earnings report…'); }); }
function openDetailedAnalytics(){ return callBackend('/earnings/analytics').then(function(r){ if(!r) svcToast('Opening detailed analytics…'); }); }
function openFullLeaderboard(){ return callBackend('/earnings/leaderboard').then(function(r){ if(!r) svcToast('Opening full leaderboard…'); }); }

window.EarningsOverviewService={init:init,exportReport:exportReport,openDetailedAnalytics:openDetailedAnalytics,openFullLeaderboard:openFullLeaderboard};

})();
