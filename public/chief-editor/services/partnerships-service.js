(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief-editor';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend error ' + res.status);
  return res.json();
}

async function loadData(){
  const d = await ChiefEditorData.getPartnerships();
  document.getElementById('publisherList').innerHTML = d.publishingPartners.map(p => `
    <div class="partner-card"><div class="pc-name">${p.name} <span class="status-pill ${p.status}">${p.status}</span></div><div class="pc-meta"><span>🏷️ ${p.type}</span><span>🌎 ${p.region}</span><span>📚 ${p.titlesLicensed} titles</span><span>💰 ${p.revenue}</span></div></div>`).join('');
  document.getElementById('translationList').innerHTML = d.translationPartners.map(t => `
    <div class="partner-card"><div class="pc-name">${t.name} <span class="status-pill ${t.status}">${t.status}</span></div><div class="pc-meta"><span>🗣️ ${t.languages}</span><span>🌍 ${t.territories}</span><span>💰 ${t.revenue}</span></div></div>`).join('');
  document.getElementById('contestList').innerHTML = d.writingContests.map(c => `
    <div class="partner-card"><div class="pc-name">${c.name} <span class="status-pill ${c.status}">${c.status}</span></div><div class="pc-meta"><span>🏆 ${c.prize}</span><span>📅 ${c.deadline}</span><span>📝 ${c.entries} entries</span></div></div>`).join('');
  document.getElementById('mediaList').innerHTML = d.ipMediaOpportunities.map(m => `
    <div class="partner-card"><div class="pc-name">${m.title} <span class="status-pill ${m.status}">${m.status}</span></div><div class="pc-meta"><span>🎬 ${m.type}</span><span>🤝 ${m.partner}</span><span>💰 ${m.value}</span></div></div>`).join('');
  document.getElementById('requestsList').innerHTML = d.partnershipRequests.map(r => `
    <div class="partner-card"><div class="pc-name">${r.from} <span class="status-pill ${r.status}">${r.status}</span></div><div class="pc-meta"><span>🏷️ ${r.type}</span><span>📅 ${r.date}</span></div><div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">${r.notes}</div></div>`).join('');
}

function init(){
  const shell = ChiefEditorSidebar.attach('#partnershipsRoot',{activeItem:'partnerships',title:'Partnerships',subtitle:'Manage platform partnerships',user:{name:'Reina Morgan',role:'Chief Editor',avatar:'https://i.pravatar.cc/100?img=47'},notifCount:6});
  return loadData();
}

window.PartnershipsService = { init: init };

})();
