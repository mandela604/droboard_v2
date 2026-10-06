/**
 * reports-flags-service.js — Reports & Flags page logic (pure call-and-render).
 * Backend-ready: set USE_API=true and point API_BASE at the real API
 * to fetch data via callBackend(); demo paths keep working with local data.
 */
(function () {
  'use strict';

  const USE_API = false;
  const API_BASE = '/api/editor';

  async function callBackend(path, options) {
    if (!USE_API) return null;
    try {
      const res = await fetch(API_BASE + path, options || {});
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  const FLAGS = [
    { id:'FLG-0047', title:'Inappropriate Content in "The Ruthless CEO"', desc:'Chapter 12 contains explicit content not marked as mature.', type:'content', reporter:'Reader_2345', status:'pending', date:'Jun 17, 2026', ico:'fa-flag', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0046', title:'Spam Comments on "Bound by the Alpha"', desc:'Multiple spam comments promoting external websites.', type:'spam', reporter:'ModBot', status:'pending', date:'Jun 16, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0045', title:'Plagiarism: "His Hidden Luna"', desc:'Sections of this story appear to be copied from another work.', type:'plagiarism', reporter:'Author_789', status:'resolved', date:'Jun 15, 2026', ico:'fa-copy', bg:'#e3ecfd', clr:'var(--blue)' },
    { id:'FLG-0044', title:'Harassment in Comments', desc:'User making offensive remarks towards the author.', type:'abuse', reporter:'LunaSkye', status:'pending', date:'Jun 14, 2026', ico:'fa-hand', bg:'#ece9fb', clr:'#5b4bcf' },
    { id:'FLG-0043', title:'Fake Account Reporting', desc:'Account suspected of impersonating a verified author.', type:'other', reporter:'Admin_Team', status:'resolved', date:'Jun 13, 2026', ico:'fa-user-slash', bg:'#eef0f2', clr:'#5b6470' },
    { id:'FLG-0042', title:'Explicit Cover Image', desc:'Book cover contains nudity that violates guidelines.', type:'content', reporter:'Reader_8901', status:'dismissed', date:'Jun 12, 2026', ico:'fa-image', bg:'#fde3e3', clr:'var(--red)' },
    { id:'FLG-0041', title:'Copyright Infringement', desc:'Author claims their work was republished without permission.', type:'plagiarism', reporter:'MiaCarter', status:'pending', date:'Jun 11, 2026', ico:'fa-copyright', bg:'#e3ecfd', clr:'var(--blue)' },
    { id:'FLG-0040', title:'Spam Promo in Bio', desc:'Author bio contains links to competitor platform.', type:'spam', reporter:'ModBot', status:'resolved', date:'Jun 10, 2026', ico:'fa-bug', bg:'#fde3e3', clr:'var(--red)' },
  ];
  const TYPE_META = { content:{label:'Content',cls:'content'}, spam:{label:'Spam',cls:'spam'}, plagiarism:{label:'Plagiarism',cls:'plagiarism'}, abuse:{label:'Abuse',cls:'abuse'}, other:{label:'Other',cls:'other'} };
  let currentView='all';
  function statusPillHtml(s){const m={pending:{cls:'pending',label:'Pending'},resolved:{cls:'resolved',label:'Resolved'},dismissed:{cls:'dismissed',label:'Dismissed'}}[s]||{cls:'pending',label:'Pending'};return `<span class="status-pill ${m.cls}"><span class="dot"></span>${m.label}</span>`}
  function viewSource(){if(currentView==='all')return FLAGS;return FLAGS.filter(r=>r.status===currentView)}
  function currentFiltered(){const q=(document.getElementById('tableSearch').value||'').trim().toLowerCase();const t=document.getElementById('typeSelect').value;const s=document.getElementById('statusSelect').value;let l=viewSource();if(s)l=l.filter(r=>r.status===s);if(t)l=l.filter(r=>r.type===t);if(q)l=l.filter(r=>r.id.toLowerCase().includes(q)||r.title.toLowerCase().includes(q)||r.reporter.toLowerCase().includes(q));return l}
  function renderTable(list){const b=document.getElementById('tableBody');if(!list.length){b.innerHTML=`<tr class="empty-row"><td colspan="6"><i class="fas fa-flag"></i>No reports match this search.</td></tr>`;return}
  b.innerHTML=list.slice(0,8).map(r=>{const m=TYPE_META[r.type]||TYPE_META.other;return `<tr><td data-label="Flag Details"><div class="flag-cell"><div class="flag-ico" style="background:${r.bg};color:${r.clr}"><i class="fas ${r.ico}"></i></div><div><div class="flag-title">${r.title}</div><div class="flag-desc">${r.desc}</div></div></div></td><td data-label="Type"><span class="type-pill ${m.cls}">${m.label}</span></td><td data-label="Reported By" style="font-weight:600;font-size:12.5px">${r.reporter}</td><td data-label="Status">${statusPillHtml(r.status)}</td><td data-label="Date" style="font-weight:600;font-size:12.5px">${r.date}</td><td data-label="Actions"><div class="actions-cell"><button class="act-btn" title="View" onclick="toast('Opening report…')"><i class="fas fa-eye"></i></button><button class="act-btn" title="Resolve" onclick="toast('Resolving report…')"><i class="fas fa-check"></i></button><button class="act-btn" title="More" onclick="toast('More actions…')"><i class="fas fa-ellipsis"></i></button></div></td></tr>`}).join('')}
  function renderPageInfo(c){const t={all:47,pending:18,resolved:24,dismissed:5};const total=t[currentView]??c;const s=Math.min(8,c);document.getElementById('pageInfo').innerHTML=`Showing <b>${c?1:0}</b> to <b>${s}</b> of <b>${total.toLocaleString()}</b> reports`}
  function refresh(){const l=currentFiltered();renderTable(l);renderPageInfo(l.length)}
  function renderPagination(){const w=document.getElementById('pageBtns');const p=[1,2,3,4,5,6];w.innerHTML=`<button class="pg-btn" disabled><i class="fas fa-chevron-left"></i></button>`+p.map(p=>`<button class="pg-btn${p===1?' active':''}" data-p="${p}">${p}</button>`).join('')+`<button class="pg-btn"><i class="fas fa-chevron-right"></i></button>`;w.querySelectorAll('[data-p]').forEach(b=>{b.addEventListener('click',()=>{w.querySelectorAll('.pg-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active')})})}

  function bindEvents(){
    document.querySelectorAll('.top-tab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.top-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');currentView=tab.dataset.view;document.getElementById('statusSelect').value='';renderPagination();refresh()})});
    document.getElementById('tableSearch').addEventListener('input',refresh);document.getElementById('typeSelect').addEventListener('change',refresh);document.getElementById('statusSelect').addEventListener('change',(e)=>{const s=e.target.value;currentView=s||'all';document.querySelectorAll('.top-tab').forEach(t=>t.classList.toggle('active',t.dataset.view===currentView));renderPagination();refresh()});
  }

  let _inited = false;

  function init(){
    DroboardShell.attach('#dashboardRoot', {
      activeFile: 'reports-flags.html',
      title: 'Reports & Flags',
      subtitle: 'Review and manage all content reports and flags',
      user: { name: 'Reina Morgan', role: 'General Editor', avatar: 'https://i.pravatar.cc/100?img=47' },
      notifCount: 8,
      searchPlaceholder: 'Search by title, reporter, or ID...',
      mobileSearchTarget: '#tableSearch',
      onSearch: (v) => { document.getElementById('tableSearch').value = v; refresh(); },
    });
    if (_inited) { refresh(); return; }
    _inited = true;
    bindEvents();
    document.getElementById('pendingCount').textContent=FLAGS.filter(r=>r.status==='pending').length;
    renderPagination();refresh();
  }

  window.ReportsFlagsService = { init: init };

})();
