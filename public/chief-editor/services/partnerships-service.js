(function(){
'use strict';

/* ── Backend-ready header ── */
const USE_API = false;
const API_BASE = '/api/chief';
async function callBackend(path, options){
  if(!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if(!res.ok) throw new Error('backend error ' + res.status);
  return res.json();
}

/* Live loaders: GET /partnerships/{kind} + /partnerships/requests → demo shapes.
   Backend Partnership docs: {id, kind, name, detail, status, meta:{...kind-specific}};
   PartnershipRequest: {id, name, detail, status}. Extra display fields (type/region/
   revenue/prize/…) live in `meta` — mapped defensively below. */
function mapMeta(p){ return (p && p.meta) || {}; }
async function liveList(path, mapper){
  const d = await callBackend(path);
  const items = Array.isArray(d) ? d : ((d && d.items) || []);
  return items.map(mapper);
}
async function loadLive(){
  const [pub, tr, ct, ip, rq] = await Promise.all([
    liveList('/partnerships/publishing?limit=50', p => {
      const m = mapMeta(p);
      return { name:p.name, status:p.status, type:m.type||'', region:m.region||'', titlesLicensed:m.titlesLicensed||0, revenue:m.revenue||'' };
    }),
    liveList('/partnerships/translations?limit=50', t => {
      const m = mapMeta(t);
      return { name:t.name, status:t.status, languages:m.languages||'', territories:m.territories||'', revenue:m.revenue||'' };
    }),
    liveList('/partnerships/contests?limit=50', c => {
      const m = mapMeta(c);
      return { name:c.name, status:c.status, prize:m.prize||'', deadline:m.deadline||'', entries:m.entries||0 };
    }),
    liveList('/partnerships/ip-media?limit=50', x => {
      const m = mapMeta(x);
      return { title:x.name, status:x.status, type:m.type||'', partner:m.partner||'', value:m.value||'' };
    }),
    liveList('/partnerships/requests?limit=50', r => {
      const m = mapMeta(r);
      return { from:r.name, status:r.status, type:m.type||'', date:r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '', notes:r.detail||m.notes||'' };
    }),
  ]);
  if(!pub.length && !tr.length && !ct.length && !ip.length && !rq.length) return null;
  return {
    publishingPartners: pub,
    translationPartners: tr,
    writingContests: ct,
    ipMediaOpportunities: ip,
    partnershipRequests: rq,
  };
}

async function loadData(){
  let d = null;
  try{ d = await loadLive(); }catch(e){ console.warn('[Partnerships] live load failed, using demo data', e); }
  if(!d) d = await ChiefEditorData.getPartnerships();
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
