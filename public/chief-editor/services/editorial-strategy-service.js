(function(){
'use strict';

/* ── Backend-ready header (thin init — demo path kept) ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend error ' + res.status);
  return res.json();
}

async function loadData(){
  const data = await ChiefEditorData.getEditorialStrategy();
  document.getElementById('strategyNotes').textContent = data.strategyNotes;

  document.getElementById('genreTable').querySelector('tbody').innerHTML = data.genrePriorities.map(g => `
    <tr>
      <td><strong>${g.genre}</strong></td>
      <td><span class="prio-pill ${g.priority}">${g.priority}</span></td>
      <td>${g.currentSubmissions} / ${g.targetSubmissions}</td>
      <td>${g.growth}</td>
      <td style="color:var(--text-muted);font-size:11px">${g.notes}</td>
    </tr>`).join('');

  document.getElementById('goalsContainer').innerHTML = data.quarterlyGoals.map(g => `
    <div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;margin-bottom:8px;color:var(--accent)">${g.quarter}</div>
      <ul class="goal-list">${g.goals.map(gl => `<li><i class="fas fa-check-circle"></i>${gl}</li>`).join('')}</ul>
    </div>`).join('');

  document.getElementById('campaignsContainer').innerHTML = data.seasonalCampaigns.map(c => `
    <div class="campaign-card">
      <div class="cc-name">${c.name}</div>
      <span class="status-pill ${c.status}">${c.status}</span>
      <div class="cc-meta"><span>📅 ${c.deadline}</span><span>💰 ${c.budget}</span><span>📝 ${c.submissions}/${c.target}</span></div>
    </div>`).join('');

  document.getElementById('acquisitionContainer').innerHTML = data.acquisitionTargets.map(a => `
    <div class="acq-card">
      <div class="ac-name">${a.author} <span class="status-pill ${a.status}">${a.status}</span></div>
      <div class="ac-meta">${a.genre} · ${a.followers} followers</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${a.notes}</div>
    </div>`).join('');

  document.getElementById('detailedNotes').innerHTML = data.strategyNotes;
}

function init(){
  const shell = ChiefEditorSidebar.attach('#strategyRoot', {
    activeItem: 'editorial-strategy', title: 'Editorial Strategy', subtitle: 'Content strategy & planning',
    user: { name: 'Reina Morgan', role: 'Chief Editor', avatar: 'https://i.pravatar.cc/100?img=47' }, notifCount: 6,
  });
  return loadData();
}

window.EditorialStrategyService = { init: init };

})();
