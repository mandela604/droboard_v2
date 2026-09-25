/**
 * awards-service.js — Awards catalog + criteria + auto-grant engine
 * ────────────────────────────────────────────────────────────────────
 * Super Admin defines award types and their criteria.
 * Backend later evaluates criteria and populates user_awards.
 * Going live: swap USE_API=true, no HTML change.
 *
 * Data consumed by profile: window.AwardsEngine.grantedFor(handle)
 * Data shapes: contract is at the BOTTOM of this file.
 */
(function(){
'use strict';
if(window.__awardsService) return; window.__awardsService = true;

const USE_API = false;
const API_BASE = '/api/awards';

// ── Demo catalog ──
// criteria: { metric, op, value, genre?, period? }
// metric: 'reads' | 'books' | 'followers' | 'rating' | 'genre_rank'
// op: '>=' | 'top'  (top N in genre)
// period: '2025' | '2025-H2' | null (all-time)
const CATALOG = [
  { id:'aw_top_romance_2025', name:'Top Romance 2025', icon:'fa-crown', color:'gold',
    desc:'Top-ranked romance writers this season', status:'active',
    criteria:{ metric:'genre_rank', op:'top', value:10, genre:'romance', period:'2025' } },
  { id:'aw_1m_reads', name:'1M+ Reads', icon:'fa-fire', color:'red',
    desc:'One million cumulative reads', status:'active',
    criteria:{ metric:'reads', op:'>=', value:1000000 } },
  { id:'aw_verified_writer', name:'Verified Writer', icon:'fa-check-circle', color:'blue',
    desc:'Identity & manuscript review passed', status:'active',
    criteria:{ metric:'manual', op:'admin', value:0 } },
  { id:'aw_rising_star', name:'Rising Star', icon:'fa-star', color:'purple',
    desc:'Top 20 newcomers by growth in 60 days', status:'draft',
    criteria:{ metric:'growth', op:'top', value:20, period:'2025-H2' } },
  { id:'aw_100k_reads', name:'100K Reads', icon:'fa-bolt', color:'green',
    desc:'One hundred thousand reads', status:'active',
    criteria:{ metric:'reads', op:'>=', value:100000 } },
];

let catalog = JSON.parse(JSON.stringify(CATALOG));

// Seed user_awards auto-resolved from criteria against PLATFORM_USERS / demo stats
// Verified/medal holders also stored here so profile has one source of truth.
let userAwards = [
  { handle:'Ada_Writes', awardId:'aw_top_romance_2025', grantedAt:'2025-06-15' },
  { handle:'Ada_Writes', awardId:'aw_1m_reads', grantedAt:'2025-03-02' },
  { handle:'Ada_Writes', awardId:'aw_verified_writer', grantedAt:'2024-11-10' },
  { handle:'Ifeanyi_Story', awardId:'aw_1m_reads', grantedAt:'2025-01-20' },
  { handle:'Ifeanyi_Story', awardId:'aw_100k_reads', grantedAt:'2024-08-15' },
];

function loadFromDemo(){
  try{
    var D = window.AdminDemo || {};
    // catalog stays as-is for now; if backend later seeds it, it will override
    if(D.AWARDS_CATALOG && Array.isArray(D.AWARDS_CATALOG)) catalog = JSON.parse(JSON.stringify(D.AWARDS_CATALOG));
    if(D.USER_AWARDS && Array.isArray(D.USER_AWARDS)) userAwards = JSON.parse(JSON.stringify(D.USER_AWARDS));
  }catch(e){}
}
if(window.AdminDemo) loadFromDemo(); else window.addEventListener('DOMContentLoaded', loadFromDemo);

function list(){ return catalog.slice(); }
function byId(id){ return catalog.find(function(a){ return a.id===id; }) || null; }
function awardsForHandle(handle){
  return userAwards.filter(function(r){ return r.handle===handle; }).map(function(r){
    var a = byId(r.awardId); if(!a) return null;
    return { id:a.id, name:a.name, icon:a.icon, color:a.color, desc:a.desc, grantedAt:r.grantedAt };
  }).filter(Boolean);
}
function stats(){
  return {
    total: catalog.length,
    active: catalog.filter(function(a){ return a.status==='active'; }).length,
    draft: catalog.filter(function(a){ return a.status==='draft'; }).length,
    auto: catalog.filter(function(a){ return a.criteria.metric!=='manual'; }).length,
    manual: catalog.filter(function(a){ return a.criteria.metric==='manual'; }).length,
  };
}
function createAward(payload){
  var id = 'aw_' + (payload.name||'award').toLowerCase().replace(/[^a-z0-9]+/g,'_').slice(0,24) + '_' + Date.now().toString(36);
  var rec = {
    id:id, name:payload.name||'New Award', icon:payload.icon||'fa-award', color:payload.color||'gold',
    desc:payload.desc||'', status:payload.status||'draft',
    criteria: payload.criteria || { metric:'reads', op:'>=', value:0 }
  };
  catalog.unshift(rec); return rec;
}
function updateAward(id, patch){
  var a = byId(id); if(!a) return null;
  if(patch.name!=null) a.name=patch.name;
  if(patch.icon!=null) a.icon=patch.icon;
  if(patch.color!=null) a.color=patch.color;
  if(patch.desc!=null) a.desc=patch.desc;
  if(patch.status!=null) a.status=patch.status;
  if(patch.criteria!=null) a.criteria=patch.criteria;
  return a;
}
function deleteAward(id){
  var idx = catalog.findIndex(function(a){ return a.id===id; }); if(idx<0) return false;
  catalog.splice(idx,1);
  userAwards = userAwards.filter(function(r){ return r.awardId!==id; });
  return true;
}
function grant(awardId, handle){
  if(!byId(awardId)) return false;
  if(userAwards.some(function(r){ return r.awardId===awardId && r.handle===handle; })) return false;
  userAwards.push({ handle:handle, awardId:awardId, grantedAt:new Date().toISOString().slice(0,10) });
  return true;
}
function revoke(awardId, handle){
  var n = userAwards.length;
  userAwards = userAwards.filter(function(r){ return !(r.awardId===awardId && r.handle===handle); });
  return userAwards.length!==n;
}
function holders(awardId){ return userAwards.filter(function(r){ return r.awardId===awardId; }).map(function(r){ return r.handle; }); }

// ── Auto-grant evaluator (demo) ──
// In production this runs as a backend cron. Here it is a pure function
// so the contract is explicit: criteria in, handles out.
function evaluateCriteria(criteria, users){
  // users: array of { handle, stats:{reads,books,followers,rating}, genreRanks? }
  // Returns array of handles that satisfy criteria.
  if(!criteria) return [];
  if(criteria.metric==='manual') return []; // never auto-grants
  if(criteria.metric==='reads'){
    var v = Number(criteria.value)||0;
    return (users||[]).filter(function(u){ return (u.stats && Number(u.stats.reads)||0) >= v; }).map(function(u){ return u.handle; });
  }
  if(criteria.metric==='genre_rank'){
    // demo: handled by caller that pre-sorted; here treat as reads-gte for simplicity
    var topN = Number(criteria.value)||10;
    var genre = criteria.genre;
    var sorted = (users||[]).filter(function(u){
      var gs = u.genres || u.topGenres || [];
      return !genre || gs.indexOf(genre)!==-1;
    }).sort(function(a,b){ return (Number(b.stats&&b.stats.reads)||0) - (Number(a.stats&&a.stats.reads)||0); });
    return sorted.slice(0, topN).map(function(u){ return u.handle; });
  }
  return [];
}
async function runAutoGrant(){
  // Demo re-resolve: clear auto-granted, re-evaluate. Manual grants are preserved.
  var autoIds = catalog.filter(function(a){ return a.criteria.metric!=='manual'; }).map(function(a){ return a.id; });
  userAwards = userAwards.filter(function(r){ return autoIds.indexOf(r.awardId)===-1; });
  var users = [];
  try{ users = (window.AdminDemo && window.AdminDemo.PLATFORM_USERS) ? window.AdminDemo.PLATFORM_USERS.map(function(u){
    return { handle:u.username||u.handle, stats:u.stats||{}, genres:u.genres||u.topGenres||[] };
  }) : []; }catch(e){}
  // fallback: seed known handles so page isn't empty before AdminDemo loads
  if(!users.length) users = [{handle:'Ada_Writes',stats:{reads:1200000},genres:['romance']},{handle:'Ifeanyi_Story',stats:{reads:980000},genres:['romance']}];
  catalog.filter(function(a){ return a.criteria.metric!=='manual' && a.status==='active'; }).forEach(function(a){
    var winners = evaluateCriteria(a.criteria, users);
    winners.forEach(function(h){
      if(!userAwards.some(function(r){ return r.handle===h && r.awardId===a.id; }))
        userAwards.push({ handle:h, awardId:a.id, grantedAt:new Date().toISOString().slice(0,10) });
    });
  });
  return userAwards.slice();
}

// Expose
window.AwardsService = { list:list, byId:byId, stats:stats, create:createAward, update:updateAward, remove:deleteAward, holders:holders, grant:grant, revoke:revoke, evaluate:evaluateCriteria, runAutoGrant:runAutoGrant };
window.AwardsEngine = { grantedFor:awardsForHandle, runAutoGrant:runAutoGrant };

/* ── API contract (when USE_API=true) ──
GET    /api/awards              -> Award[]
POST   /api/awards              body AwardPayload -> Award
PUT    /api/awards/:id          body Partial<AwardPayload>
DELETE /api/awards/:id
GET    /api/awards/user/:handle -> Award[]  (grantedFor)
POST   /api/awards/:id/grant    body { handle }
POST   /api/awards/:id/revoke   body { handle }
POST   /api/awards/run-auto-grant

AwardPayload: { name, icon, color, desc, status: 'active'|'draft'|'archived', criteria:{ metric, op, value, genre?, period? } }
Award: AwardPayload & { id }
UserAward: { handle, awardId, grantedAt: ISODate }
*/

/* ── DemoData extension (optional) ──
Add to super-admin/data/admin-demo-data.js:
  AWARDS_CATALOG: CATALOG,
  USER_AWARDS: userAwards,
so AdminDemo seeding can inject catalog if desired.
*/

})();
