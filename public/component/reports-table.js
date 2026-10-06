/**
 * component/reports-table.js — Shared story-reports queue (SE + CE modules)
 * ─────────────────────────────────────────────────────────────────────────
 * One card UI, one shared demo store, two scoped views:
 *   Senior Editor: scope { seIds:['SE-01'] } → own authors' reports only.
 *     Anything outside scope is never rendered (hidden, not read-only).
 *   Chief Editor:  scope { seIds:[...managed...] } → team aggregate with
 *     an SE filter. Resolving stamps resolvedBy visibly in both modules.
 *
 * Usage:
 *   DroboardReportsTable.attach(document.getElementById('reportsMount'), {
 *     seIds: ['SE-01'], viewerName: 'Chioma Reddy', canResolve: true,
 *     showSeFilter: false, pageSize: 6,
 *     onChapter: (report) => { location.href = '...'; },  // optional override
 *     onChange: () => { ...refresh page stats... },       // optional
 *   });
 *   DroboardReportsTable.getScoped(['SE-01']);  // scoped rows (for page stats)
 *   DroboardReportsTable.stats(['SE-01']);      // {total,pending,resolved,dismissed,byType}
 *
 * Demo store: seed + localStorage overlay (dro_reports_table) merged by id,
 * so SE and CE pages share mutations live. Backend-ready: set USE_API=true.
 *   GET  /api/reports/story?seId=SE-01 (repeat for team scope)
 *   POST /api/reports/story/:id/resolve | /dismiss | reopen
 */
(function () {
'use strict';
if (window.__droboardReportsTable) return;
window.__droboardReportsTable = true;

const USE_API = false;
const API_BASE = '/api/reports/story';
const LS_KEY = 'dro_reports_table';
async function callBackend(path, options){
  if (!USE_API) return null;
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error('backend error: ' + res.status);
  return res.json();
}

/* ── Seed: story reports only, each owned by one SE ── */
const SEED = [
  { id:'FLG-0047', seId:'SE-01', seName:'Chioma Reddy', authorId:'u1', storyId:'story-betrayal-1', storyTitle:'Season of Betrayal', author:'Ada_Writes', cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', chapter:'Chapter 12', chN:12, type:'content', severity:'high', desc:'Chapter 12 contains explicit content not marked as mature.', reporter:'Reader_2345', status:'pending', date:'Jun 17, 2026' },
  { id:'FLG-0046', seId:'SE-01', seName:'Chioma Reddy', authorId:'u11', storyId:'story-alpha-1', storyTitle:'Bound by the Alpha', author:'Luna_Grey', cover:'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', chapter:'Synopsis', chN:1, type:'spam', severity:'medium', desc:'Synopsis stuffed with external links to another platform.', reporter:'ModBot', status:'pending', date:'Jun 16, 2026' },
  { id:'FLG-0045', seId:'SE-01', seName:'Chioma Reddy', authorId:'w6', storyId:'story-luna-1', storyTitle:'His Hidden Luna', author:'Efe_O', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', chapter:'Chapters 3–5', chN:3, type:'plagiarism', severity:'high', desc:'Sections appear copied from another published work.', reporter:'Author_789', status:'resolved', date:'Jun 15, 2026', resolvedBy:'Chioma Reddy' },
  { id:'FLG-0044', seId:'SE-02', seName:'Daniel Carter', authorId:'u5', storyId:'story-mafia-1', storyTitle:'Mafia Prince', author:'Zara_M', cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', chapter:'Chapter 6', chN:6, type:'abuse', severity:'high', desc:'Story glorifies non-consensual content; readers flagged Ch.6.', reporter:'LunaSkye', status:'pending', date:'Jun 14, 2026' },
  { id:'FLG-0043', seId:'SE-01', seName:'Chioma Reddy', authorId:'u7', storyId:'story-campus-1', storyTitle:'Campus Queen', author:'CampusQueen', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg', chapter:'Entire story', chN:1, type:'other', severity:'low', desc:'Listed under Romance but reads as erotica — wrong shelf.', reporter:'Admin_Team', status:'resolved', date:'Jun 13, 2026', resolvedBy:'Chioma Reddy' },
  { id:'FLG-0042', seId:'SE-05', seName:'Priya Nair', authorId:'u3', storyId:'story-wolf-1', storyTitle:'The Wolf Beside the Bed', author:'Chiamaka_N', cover:'https://i.postimg.cc/fkdXzjSj/wolf.jpg', chapter:'Cover', chN:1, type:'content', severity:'medium', desc:'Book cover flagged as overly explicit for general audiences.', reporter:'Reader_8901', status:'dismissed', date:'Jun 12, 2026' },
  { id:'FLG-0041', seId:'SE-01', seName:'Chioma Reddy', authorId:'w6', storyId:'story-elegy-1', storyTitle:'The Letter He Never Sent', author:'Efe_O', cover:'https://i.postimg.cc/N9jY0w4m/5.jpg', chapter:'Entire story', chN:1, type:'plagiarism', severity:'high', desc:'Author claims this work was republished without permission.', reporter:'MiaCarter', status:'pending', date:'Jun 11, 2026' },
  { id:'FLG-0040', seId:'SE-02', seName:'Daniel Carter', authorId:'u9', storyId:'story-drama-1', storyTitle:'His Secret Life', author:'Kemi_A', cover:'https://i.postimg.cc/0MyxNqfz/7.jpg', chapter:'Author bio', chN:1, type:'spam', severity:'low', desc:'Author bio links to a competitor platform.', reporter:'ModBot', status:'resolved', date:'Jun 10, 2026', resolvedBy:'Adaeze Bello' },
  { id:'FLG-0039', seId:'SE-01', seName:'Chioma Reddy', authorId:'u1', storyId:'story-revenge-1', storyTitle:'His Sweet Revenge', author:'Ada_Writes', cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', chapter:'Chapter 21', chN:21, type:'content', severity:'medium', desc:'Graphic revenge scene reported as gratuitous by 14 readers.', reporter:'Reader_5560', status:'pending', date:'Jun 9, 2026' },
  { id:'FLG-0038', seId:'SE-10', seName:'Tobias Adeyemi', authorId:'u15', storyId:'story-horror-1', storyTitle:'The House on Willow Lane', author:'Bode_Rex', cover:'https://i.postimg.cc/JDzmhWqj/2.jpg', chapter:'Chapter 2', chN:2, type:'abuse', severity:'medium', desc:'Horror content minors can access; age-gate requested.', reporter:'Reader_1123', status:'pending', date:'Jun 8, 2026' },
  { id:'FLG-0037', seId:'SE-02', seName:'Daniel Carter', authorId:'w12', storyId:'story-fantasy-1', storyTitle:'Alpha Bloodline', author:'Ifeanyi_Story', cover:'https://i.postimg.cc/fkdXzjSj/wolf.jpg', chapter:'Chapter 9', chN:9, type:'plagiarism', severity:'high', desc:'Passages match a 2019 webnovel chapter nearly verbatim.', reporter:'Author_402', status:'pending', date:'Jun 7, 2026' },
  { id:'FLG-0036', seId:'SE-05', seName:'Priya Nair', authorId:'u14', storyId:'story-campus-2', storyTitle:'Lagos After Midnight', author:'Dami_Cole', cover:'https://i.postimg.cc/ftRZbhKx/3.jpg', chapter:'Entire story', chN:1, type:'other', severity:'low', desc:'Miscategorized: listed Campus, reads as Mystery.', reporter:'Reader_7788', status:'dismissed', date:'Jun 6, 2026' },
  { id:'FLG-0035', seId:'SE-01', seName:'Chioma Reddy', authorId:'u1', storyId:'story-betrayal-1', storyTitle:'Season of Betrayal', author:'Ada_Writes', cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg', chapter:'Chapter 63', chN:63, type:'content', severity:'medium', desc:'Cliffhanger chapters reported as engagement bait by 6 readers.', reporter:'Reader_9910', status:'pending', date:'Jun 5, 2026' },
  { id:'FLG-0034', seId:'SE-10', seName:'Tobias Adeyemi', authorId:'u10', storyId:'story-campus-3', storyTitle:'New Voice Rising', author:'Dami_Cole', cover:'https://i.postimg.cc/cgLZJNmC/8.jpg', chapter:'Chapter 1', chN:1, type:'spam', severity:'low', desc:'First chapter padded with promo links for another serial.', reporter:'ModBot', status:'pending', date:'Jun 4, 2026' },
];

function readOverlay(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
  catch (e){ return {}; }
}
function writeOverlay(ov){
  try { localStorage.setItem(LS_KEY, JSON.stringify(ov)); } catch (e){}
}
function allReports(){
  var ov = readOverlay();
  return SEED.map(function(s){
    var patch = ov[s.id];
    return patch ? Object.assign({}, s, patch) : Object.assign({}, s);
  });
}
function savePatch(id, patch){
  var ov = readOverlay();
  ov[id] = Object.assign({}, ov[id], patch);
  writeOverlay(ov);
}
function normSe(v){ return String(v || '').toLowerCase(); }
function inScope(r, seIds){
  if (!seIds || seIds === 'all') return true;
  var want = (Array.isArray(seIds) ? seIds : [seIds]).map(normSe);
  return want.indexOf(normSe(r.seId)) !== -1;
}
function getScoped(seIds){
  return allReports().filter(function(r){ return inScope(r, seIds); });
}
function stats(seIds){
  var list = getScoped(seIds);
  var byType = { content: 0, spam: 0, plagiarism: 0, abuse: 0, other: 0 };
  var s = { total: list.length, pending: 0, resolved: 0, dismissed: 0, byType: byType };
  list.forEach(function(r){
    if (s[r.status] !== undefined && r.status !== 'total') s[r.status]++;
    if (byType[r.type] !== undefined) byType[r.type]++;
  });
  return s;
}

/* ── Self-contained card CSS (same visual language both modules) ── */
const CSS = `
.drt-tabs{display:flex;gap:4px;background:var(--table-head);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:16px;width:fit-content;max-width:100%;overflow-x:auto}
.drt-tab{font-size:11.5px;font-weight:700;font-family:inherit;padding:8px 16px;border-radius:8px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:7px;white-space:nowrap}
.drt-tab.active{background:var(--card);color:var(--text);box-shadow:0 1px 4px rgba(15,23,42,.08);border:1px solid var(--border)}
.drt-count{font-size:9.5px;font-weight:800;padding:1px 6px;border-radius:20px;background:var(--table-head);color:var(--text-faint)}
.drt-tab.active .drt-count{background:var(--accent-soft,rgba(255,0,80,.1));color:var(--accent)}
.drt-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.drt-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:9px 13px}
.drt-search input{border:none;background:none;outline:none;font-size:12.5px;font-family:inherit;color:var(--text);width:100%}
.drt-search i{color:var(--text-faint);font-size:12px}
.drt-select{font-size:12px;font-weight:600;font-family:inherit;color:var(--text);background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:9px 12px;cursor:pointer;outline:none}
.drt-list{display:flex;flex-direction:column;gap:12px}
.drt-card{border:1px solid var(--border);border-radius:14px;padding:16px;transition:.15s;background:var(--card);cursor:pointer}
.drt-card:hover{border-color:var(--accent)}
.drt-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.drt-cover{width:44px;height:62px;border-radius:8px;object-fit:cover;flex-shrink:0}
.drt-title-wrap{flex:1;min-width:180px}
.drt-title{font-size:13.5px;font-weight:800;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.drt-sub{font-size:10.5px;color:var(--text-faint);margin-top:2px}
.drt-badges{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap}
.drt-pill{font-size:9px;font-weight:800;padding:3px 9px;border-radius:20px;text-transform:uppercase;white-space:nowrap;border:1px solid transparent}
.drt-pill.type-content{background:var(--amber-bg);color:var(--amber)}
.drt-pill.type-spam{background:var(--red-bg);color:var(--red)}
.drt-pill.type-plagiarism{background:var(--blue-bg);color:var(--blue)}
.drt-pill.type-abuse{background:rgba(91,75,207,.1);color:#5b4bcf}
.drt-pill.type-other{background:var(--table-head);color:var(--text-faint)}
.drt-pill.sev-high{background:var(--red-bg);color:var(--red)}
.drt-pill.sev-medium{background:var(--amber-bg);color:var(--amber)}
.drt-pill.sev-low{background:var(--table-head);color:var(--text-faint)}
.drt-pill.status-pending{background:#fff;color:var(--red);border-color:var(--red)}
.drt-pill.status-resolved{background:var(--blue-bg);color:var(--blue)}
.drt-pill.status-dismissed{background:var(--table-head);color:var(--text-faint)}
.drt-reason{font-size:12.5px;color:var(--text-muted);line-height:1.55;margin-bottom:10px}
.drt-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.drt-btn{font-size:11px;font-weight:700;padding:7px 13px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.drt-btn:hover{border-color:var(--accent);color:var(--accent)}
.drt-btn.primary{background:var(--accent);border-color:transparent;color:#fff}
.drt-btn.danger{color:var(--red)}
.drt-btn:disabled{opacity:.4;cursor:default;pointer-events:none}
.drt-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px;flex-wrap:wrap}
.drt-pg-info{font-size:11px;color:var(--text-faint);font-weight:600}
.drt-pg-controls{display:flex;align-items:center;gap:6px}
.drt-pg-btn{min-width:30px;height:30px;padding:0 6px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text);font-size:11.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit}
.drt-pg-btn.active{background:var(--accent);border-color:transparent;color:#fff}
.drt-pg-btn:disabled{opacity:.35;cursor:default;pointer-events:none}
.drt-empty{text-align:center;padding:36px 20px;color:var(--text-faint);font-size:12.5px}
.drt-overlay{position:fixed;inset:0;background:rgba(10,10,20,.55);z-index:1200;display:none;align-items:center;justify-content:center;padding:20px}
.drt-overlay.open{display:flex}
.drt-modal{background:var(--card);border:1px solid var(--border);border-radius:16px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto}
.drt-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.drt-modal-head b{font-size:14px}
.drt-modal-x{width:28px;height:28px;border-radius:8px;border:1px solid var(--input-border);background:var(--input-bg);color:var(--text-muted);cursor:pointer;font-size:12px}
.drt-modal-body{padding:18px 20px;font-size:12.5px;line-height:1.6}
.drt-kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px}
.drt-kv:last-child{border-bottom:none}
.drt-kv span{color:var(--text-muted);font-weight:600}
.drt-kv b{text-align:right}
.drt-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px 18px;border-top:1px solid var(--border);flex-wrap:wrap}
`;
function injectStyles(){
  if (document.getElementById('drt-style')) return;
  const st = document.createElement('style');
  st.id = 'drt-style';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function chapterUrl(r){
  return '../Pages/full-reader.html?story=' + encodeURIComponent(r.storyId) + '&ch=' + (r.chN || 1);
}

const SEV_ORDER = { high: 0, medium: 1, low: 2 };
const TYPE_LABEL = { content: 'Content', spam: 'Spam', plagiarism: 'Plagiarism', abuse: 'Abuse', other: 'Other' };

function attach(mount, opts){
  opts = opts || {};
  injectStyles();
  const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!root) return null;

  const seIds = opts.seIds || 'all';
  const viewerName = opts.viewerName || 'You';
  const canResolve = opts.canResolve !== false;
  const showSeFilter = !!opts.showSeFilter;
  const pageSize = opts.pageSize || 6;
  const onChapter = opts.onChapter || function(r){ location.href = chapterUrl(r); };
  const onChange = opts.onChange || null;

  let tab = 'all', q = '', type = '', se = '', sort = 'newest', page = 1;
  const instId = 'drt' + (++attach._n || (attach._n = 1));

  function scoped(){ return getScoped(seIds); }
  function seOptions(){
    const map = {};
    scoped().forEach(function(r){ map[r.seId] = r.seName || r.seId; });
    return Object.keys(map).map(function(id){ return { id: id, name: map[id] }; });
  }
  function filtered(){
    let list = scoped();
    if (tab !== 'all') list = list.filter(function(r){ return r.status === tab; });
    if (type) list = list.filter(function(r){ return r.type === type; });
    if (se) list = list.filter(function(r){ return normSe(r.seId) === normSe(se); });
    if (q) list = list.filter(function(r){
      return (r.id + ' ' + r.storyTitle + ' ' + r.author + ' ' + r.reporter).toLowerCase().indexOf(q) !== -1;
    });
    list = list.slice();
    if (sort === 'oldest') list.reverse();
    else if (sort === 'severity') list.sort(function(a, b){ return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9); });
    return list;
  }
  function counts(){
    const list = scoped();
    const c = { all: list.length, pending: 0, resolved: 0, dismissed: 0 };
    list.forEach(function(r){ if (c[r.status] !== undefined && r.status !== 'all') c[r.status]++; });
    return c;
  }
  function emit(){ if (typeof onChange === 'function') { try { onChange(); } catch (e){} } }

  function tabHtml(){
    const c = counts();
    const tabs = [['all', 'All'], ['pending', 'Pending'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']];
    return '<div class="drt-tabs">' + tabs.map(function(t){
      return '<button class="drt-tab' + (tab === t[0] ? ' active' : '') + '" data-drt-tab="' + t[0] + '">' + t[1]
        + ' <span class="drt-count">' + c[t[0]] + '</span></button>';
    }).join('') + '</div>';
  }
  function toolbarHtml(){
    let h = '<div class="drt-toolbar"><div class="drt-search"><i class="fas fa-magnifying-glass"></i>'
      + '<input data-drt-q placeholder="Search story, author, reporter, ID…" value="' + esc(q) + '"/></div>';
    h += '<select class="drt-select" data-drt-type><option value="">All types</option>'
      + ['content', 'spam', 'plagiarism', 'abuse', 'other'].map(function(t){
        return '<option value="' + t + '"' + (type === t ? ' selected' : '') + '>' + TYPE_LABEL[t] + '</option>';
      }).join('') + '</select>';
    if (showSeFilter) {
      h += '<select class="drt-select" data-drt-se><option value="">All editors</option>'
        + seOptions().map(function(o){
          return '<option value="' + esc(o.id) + '"' + (normSe(se) === normSe(o.id) ? ' selected' : '') + '>' + esc(o.name) + '</option>';
        }).join('') + '</select>';
    }
    h += '<select class="drt-select" data-drt-sort>'
      + '<option value="newest"' + (sort === 'newest' ? ' selected' : '') + '>Newest first</option>'
      + '<option value="oldest"' + (sort === 'oldest' ? ' selected' : '') + '>Oldest first</option>'
      + '<option value="severity"' + (sort === 'severity' ? ' selected' : '') + '>By severity</option>'
      + '</select></div>';
    return h;
  }
  function cardHtml(r){
    const canAct = canResolve && r.status === 'pending';
    return '<div class="drt-card" data-drt-open="' + r.id + '">'
      + '<div class="drt-top"><img class="drt-cover" src="' + esc(r.cover || '') + '" alt=""/>'
      + '<div class="drt-title-wrap"><div class="drt-title">' + esc(r.storyTitle)
      + ' <span style="color:var(--text-faint);font-weight:600">· ' + esc(r.chapter || '') + '</span></div>'
      + '<div class="drt-sub">by ' + esc(r.author) + (showSeFilter ? ' · ' + esc(r.seName || r.seId) : '') + ' · reported by ' + esc(r.reporter) + '</div></div>'
      + '<div class="drt-badges"><span class="drt-pill type-' + r.type + '">' + (TYPE_LABEL[r.type] || r.type) + '</span>'
      + '<span class="drt-pill sev-' + r.severity + '">' + r.severity + '</span>'
      + '<span class="drt-pill status-' + r.status + '">' + r.status + '</span></div></div>'
      + '<div class="drt-reason">' + esc(r.desc) + '</div>'
      + '<div class="drt-foot"><span style="font-size:10.5px;color:var(--text-faint);font-weight:600">' + esc(r.id) + ' · ' + esc(r.date)
      + (r.resolvedBy ? ' · by ' + esc(r.resolvedBy) : '') + '</span>'
      + '<span style="flex:1"></span>'
      + '<button class="drt-btn" data-drt-view="' + r.id + '"><i class="fas fa-eye"></i> Chapter</button>'
      + (canAct ? '<button class="drt-btn primary" data-drt-resolve="' + r.id + '"><i class="fas fa-check"></i> Resolve</button>'
        + '<button class="drt-btn danger" data-drt-dismiss="' + r.id + '"><i class="fas fa-xmark"></i> Dismiss</button>' : '')
      + '</div></div>';
  }
  function render(){
    const list = filtered();
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);
    let h = tabHtml() + toolbarHtml();
    h += items.length
      ? '<div class="drt-list">' + items.map(cardHtml).join('') + '</div>'
      : '<div class="drt-empty"><i class="fas fa-flag" style="font-size:24px;display:block;margin-bottom:8px"></i>No story reports match.</div>';
    h += '<div class="drt-pager"><div class="drt-pg-info">Showing ' + (list.length ? start + 1 : 0) + '–' + Math.min(start + pageSize, list.length) + ' of ' + list.length + '</div>'
      + '<div class="drt-pg-controls"><button class="drt-pg-btn" data-drt-pg="prev"' + (page === 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    for (let p = 1; p <= totalPages; p++) {
      h += '<button class="drt-pg-btn' + (p === page ? ' active' : '') + '" data-drt-pg="' + p + '">' + p + '</button>';
    }
    h += '<button class="drt-pg-btn" data-drt-pg="next"' + (page === totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button></div></div>';
    h += '<div class="drt-overlay" data-drt-ov><div class="drt-modal"><div class="drt-modal-head"><b>Report details</b><button class="drt-modal-x" data-drt-close>✕</button></div><div class="drt-modal-body" data-drt-modalbody></div><div class="drt-modal-foot" data-drt-modalfoot></div></div></div>';
    root.innerHTML = h;
    bind();
  }
  function detailsHtml(r){
    const rows = [
      ['Report', r.id], ['Story', r.storyTitle + ' (' + (r.chapter || '') + ')'],
      ['Author', r.author], ['Owner (SE)', (r.seName || r.seId)],
      ['Reporter', r.reporter], ['Type', (TYPE_LABEL[r.type] || r.type)],
      ['Severity', r.severity], ['Filed', r.date], ['Status', r.status]
    ];
    if (r.resolvedBy) rows.push(['Handled by', r.resolvedBy]);
    return '<div class="drt-reason" style="margin-bottom:12px">' + esc(r.desc) + '</div>'
      + rows.map(function(kv){ return '<div class="drt-kv"><span>' + kv[0] + '</span><b>' + esc(kv[1]) + '</b></div>'; }).join('');
  }
  function openDetails(id){
    const r = scoped().find(function(x){ return x.id === id; });
    if (!r) return;
    const ov = root.querySelector('[data-drt-ov]');
    root.querySelector('[data-drt-modalbody]').innerHTML = detailsHtml(r);
    const canAct = canResolve && r.status === 'pending';
    root.querySelector('[data-drt-modalfoot]').innerHTML = '<button class="drt-btn" data-drt-close>Close</button>'
      + '<button class="drt-btn" data-drt-goto="' + r.id + '"><i class="fas fa-book-open"></i> Open chapter</button>'
      + (canAct ? '<button class="drt-btn primary" data-drt-resolve="' + r.id + '"><i class="fas fa-check"></i> Resolve</button>'
        + '<button class="drt-btn danger" data-drt-dismiss="' + r.id + '"><i class="fas fa-xmark"></i> Dismiss</button>' : '');
    ov.classList.add('open');
  }
  function find(id){ return scoped().find(function(x){ return x.id === id; }); }
  function doResolve(id){
    const r = find(id);
    if (!r || r.status !== 'pending' || !canResolve) return;
    callBackend('/' + id + '/resolve', { method: 'POST' }).catch(function(){});
    savePatch(id, { status: 'resolved', resolvedBy: viewerName });
    render(); emit();
  }
  function doDismiss(id){
    const r = find(id);
    if (!r || r.status !== 'pending' || !canResolve) return;
    if (!confirm('Dismiss report ' + id + ' on "' + r.storyTitle + '"? No violation will be recorded.')) return;
    callBackend('/' + id + '/dismiss', { method: 'POST' }).catch(function(){});
    savePatch(id, { status: 'dismissed', resolvedBy: viewerName });
    render(); emit();
  }
  function doReopen(id){
    const r = find(id);
    if (!r || r.status === 'pending' || !canResolve) return;
    savePatch(id, { status: 'pending', resolvedBy: '' });
    render(); emit();
  }
  function bind(){
    root.querySelectorAll('[data-drt-tab]').forEach(function(b){
      b.addEventListener('click', function(){ tab = b.getAttribute('data-drt-tab'); page = 1; render(); });
    });
    const qi = root.querySelector('[data-drt-q]');
    if (qi) qi.addEventListener('input', function(){ q = qi.value.trim().toLowerCase(); page = 1; renderListOnly(); });
    const ty = root.querySelector('[data-drt-type]');
    if (ty) ty.addEventListener('change', function(){ type = ty.value; page = 1; render(); });
    const sef = root.querySelector('[data-drt-se]');
    if (sef) sef.addEventListener('change', function(){ se = sef.value; page = 1; render(); });
    const so = root.querySelector('[data-drt-sort]');
    if (so) so.addEventListener('change', function(){ sort = so.value; page = 1; render(); });
    root.querySelectorAll('[data-drt-pg]').forEach(function(b){
      b.addEventListener('click', function(){
        const v = b.getAttribute('data-drt-pg');
        const totalPages = Math.max(1, Math.ceil(filtered().length / pageSize));
        if (v === 'prev') page = Math.max(1, page - 1);
        else if (v === 'next') page = Math.min(totalPages, page + 1);
        else page = Math.min(totalPages, Math.max(1, parseInt(v, 10) || 1));
        render();
      });
    });
    root.querySelectorAll('[data-drt-view]').forEach(function(b){
      b.addEventListener('click', function(e){
        e.stopPropagation();
        const r = find(b.getAttribute('data-drt-view'));
        if (r) onChapter(r);
      });
    });
    root.querySelectorAll('[data-drt-resolve]').forEach(function(b){
      b.addEventListener('click', function(e){ e.stopPropagation(); doResolve(b.getAttribute('data-drt-resolve')); });
    });
    root.querySelectorAll('[data-drt-dismiss]').forEach(function(b){
      b.addEventListener('click', function(e){ e.stopPropagation(); doDismiss(b.getAttribute('data-drt-dismiss')); });
    });
    root.querySelectorAll('[data-drt-open]').forEach(function(card){
      card.addEventListener('click', function(e){
        if (e.target.closest('[data-drt-view],[data-drt-resolve],[data-drt-dismiss],button')) return;
        openDetails(card.getAttribute('data-drt-open'));
      });
    });
    const ov = root.querySelector('[data-drt-ov]');
    if (ov) ov.addEventListener('click', function(e){
      if (e.target === ov || e.target.closest('[data-drt-close]')) ov.classList.remove('open');
    });
    const goto = root.querySelector('[data-drt-goto]');
    if (goto) goto.addEventListener('click', function(){
      const r = find(goto.getAttribute('data-drt-goto'));
      ov.classList.remove('open');
      if (r) onChapter(r);
    });
  }
  // search keystrokes re-render only the list region (keeps focus in the box)
  function renderListOnly(){
    const keepFocus = root.querySelector('[data-drt-q]');
    const val = keepFocus ? keepFocus.value : '';
    const sel = keepFocus ? keepFocus.selectionStart : 0;
    render();
    const again = root.querySelector('[data-drt-q]');
    if (again) { again.focus(); try { again.setSelectionRange(sel, sel); } catch (e){} again.value = val; }
  }

  render();
  return {
    refresh: function(){ render(); emit(); },
    scoped: function(){ return getScoped(seIds); },
    stats: function(){ return stats(seIds); }
  };
}

window.DroboardReportsTable = { attach: attach, getScoped: getScoped, stats: stats, chapterUrl: chapterUrl };

})();
