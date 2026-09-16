(function(){
  'use strict';
  if(window.SeniorEditorsService) return;

  const PAGE_SIZE = 6;
  let ALL = [];
  let filtered = [];
  let currentPage = 1;
  let authorPool = [];
  let assignments = {};

  const ICO_MAP = { red:'var(--red)', amber:'var(--amber)', blue:'var(--blue)', purple:'var(--purple)', green:'var(--green)', accent:'var(--accent)' };
  const BG_MAP  = { red:'var(--red-bg)', amber:'var(--amber-bg)', blue:'var(--blue-bg)', purple:'var(--purple-bg)', green:'var(--green-bg)', accent:'rgba(255,0,80,.1)' };

  function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  async function init(){
    const [editors, pool, assigns] = await Promise.all([
      ChiefEditorData.getSeniorEditors(),
      ChiefEditorData.getAuthorPool(),
      ChiefEditorData.getAssignments(),
    ]);
    ALL = editors;
    authorPool = pool;
    assignments = assigns;

    renderStatCards();
    applyFilters();
    bindToolbar();
  }

  function renderStatCards(){
    const behind = ALL.filter(e=>e.status==='behind').length;
    const totalAuthors = ALL.reduce((sum,e)=>sum+e.authorsManaged,0);
    const stats = [
      { n:ALL.length, l:'Senior Editors', ico:'fa-people-group', cls:'accent' },
      { n:ALL.length-behind, l:'On Track or Ahead', ico:'fa-circle-check', cls:'blue' },
      { n:behind, l:'Behind Quota', ico:'fa-triangle-exclamation', cls:'red' },
      { n:totalAuthors, l:'Authors Managed', ico:'fa-user-tie', cls:'purple' },
    ];
    document.getElementById('statCards').innerHTML = stats.map(s=>`
      <div class="stat-card">
        <div class="stat-ico" style="background:${BG_MAP[s.cls]};color:${ICO_MAP[s.cls]}"><i class="fas ${s.ico}"></i></div>
        <div><div class="stat-num">${s.n}</div><div class="stat-lbl">${s.l}</div></div>
      </div>`).join('');
  }

  function applyFilters(){
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const statusVal = document.getElementById('statusFilter').value;
    const sortVal = document.getElementById('sortSelect').value;

    filtered = ALL.filter(e=>{
      const matchesQ = !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
      const matchesStatus = statusVal==='all' || e.status===statusVal;
      return matchesQ && matchesStatus;
    });

    filtered.sort((a,b)=>{
      if(sortVal==='name') return a.name.localeCompare(b.name);
      if(sortVal==='authors-desc') return b.authorsManaged-a.authorsManaged;
      if(sortVal==='quota-asc') return (a.invited/a.target)-(b.invited/b.target);
      if(sortVal==='pay-desc') return parseFloat(b.monthlyPay.replace(/[^0-9.]/g,''))-parseFloat(a.monthlyPay.replace(/[^0-9.]/g,''));
      return 0;
    });

    currentPage = 1;
    renderGrid();
  }

  function renderGrid(){
    document.getElementById('resultCount').textContent = filtered.length;

    const box = document.getElementById('edGrid');
    if(!filtered.length){
      box.innerHTML = `<div class="empty-msg"><i class="fas fa-user-slash" style="font-size:20px;margin-bottom:8px;display:block"></i>No senior editors match your filters.</div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
    if(currentPage>totalPages) currentPage = totalPages;
    const start = (currentPage-1)*PAGE_SIZE;
    const pageItems = filtered.slice(start, start+PAGE_SIZE);

    box.innerHTML = pageItems.map(e=>{
      const pct = Math.min(100, Math.round(e.invited/e.target*100));
      const statusLabel = e.status==='behind' ? 'Behind' : e.status==='ahead' ? 'Ahead' : 'On track';
      const assigned = assignments[e.id] || [];
      const assignedCount = assigned.length;
      return `
      <div class="ed-card" data-id="${e.id}">
        <div class="ed-top">
          <img class="ed-avatar" src="${e.avatar}" alt="${e.name}"/>
          <div class="ed-name-wrap">
            <div class="ed-name">${esc(e.name)} ${e.openReports>0?`<span class="report-dot" title="${e.openReports} open report(s)"></span>`:''}</div>
            <div class="ed-email">${esc(e.email)}</div>
          </div>
          <div class="ed-top-right">
            <span class="ed-status ${e.status}">${statusLabel}</span>
            <div class="ed-dots-wrap">
              <button class="ed-dots-btn" data-editor-id="${e.id}" title="More actions"><i class="fas fa-ellipsis-vertical"></i></button>
              <div class="ed-dots-menu" data-menu-for="${e.id}">
                <button class="ed-dots-item" data-editor-action="assign-authors" data-editor-id="${e.id}">
                  <i class="fas fa-user-plus"></i> Assign Authors
                  ${assignedCount?`<span class="ed-dots-badge">${assignedCount}</span>`:''}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="ed-meta-row">
          <div class="ed-meta-item"><span>Authors</span><b>${e.authorsManaged}</b></div>
          <div class="ed-meta-item"><span>Assigned</span><b>${assignedCount}</b></div>
          <div class="ed-meta-item"><span>Joined</span><b>${esc(e.joined)}</b></div>
          <div class="ed-meta-item"><span>Monthly Pay</span><b>${esc(e.monthlyPay)}</b></div>
          <div class="ed-meta-item"><span>YTD Paid</span><b>${esc(e.ytdPaid)}</b></div>
        </div>

        <div>
          <div class="ed-quota-label"><span>Invite quota — ${e.invited}/${e.target}</span><span>Due ${esc(e.deadline)}</span></div>
          <div class="ed-quota-track"><div class="ed-quota-fill ${e.status}" style="width:${pct}%"></div></div>
        </div>

        <div class="ed-actions">
          <button class="mini-btn ghost" data-action="view" data-id="${e.id}"><i class="fas fa-eye"></i> View Profile</button>
          <button class="mini-btn" data-action="message" data-id="${e.id}"><i class="fas fa-comment-dots"></i> Message</button>
          ${e.status==='behind'
            ? `<button class="mini-btn danger" data-action="quota" data-id="${e.id}"><i class="fas fa-triangle-exclamation"></i> Take Action</button>`
            : `<button class="mini-btn" data-action="quota" data-id="${e.id}"><i class="fas fa-bullseye"></i> Manage Quota</button>`}
        </div>
      </div>`;
    }).join('');

    renderPagination(totalPages);
    bindGridEvents();
  }

  function renderPagination(totalPages){
    const box = document.getElementById('pagination');
    if(totalPages<=1){
      box.innerHTML = `<div class="pg-info">Showing all ${filtered.length} editor${filtered.length===1?'':'s'}</div>`;
      return;
    }

    const start = (currentPage-1)*PAGE_SIZE+1;
    const end = Math.min(filtered.length, currentPage*PAGE_SIZE);

    let pageBtns = '';
    const pushBtn = (p) => { pageBtns += `<button class="pg-btn${p===currentPage?' active':''}" data-page="${p}">${p}</button>`; };
    const pushEllipsis = () => { pageBtns += `<span class="pg-ellipsis">…</span>`; };

    if(totalPages<=7){
      for(let p=1;p<=totalPages;p++) pushBtn(p);
    } else {
      pushBtn(1);
      if(currentPage>3) pushEllipsis();
      const from = Math.max(2, currentPage-1);
      const to = Math.min(totalPages-1, currentPage+1);
      for(let p=from;p<=to;p++) pushBtn(p);
      if(currentPage<totalPages-2) pushEllipsis();
      pushBtn(totalPages);
    }

    box.innerHTML = `
      <div class="pg-info">Showing ${start}–${end} of ${filtered.length} editors</div>
      <div class="pg-controls">
        <button class="pg-btn" id="pgPrev" ${currentPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
        ${pageBtns}
        <button class="pg-btn" id="pgNext" ${currentPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>
      </div>`;

    document.getElementById('pgPrev').addEventListener('click', ()=>{ currentPage--; renderGrid(); });
    document.getElementById('pgNext').addEventListener('click', ()=>{ currentPage++; renderGrid(); });
    box.querySelectorAll('[data-page]').forEach(b=>{
      b.addEventListener('click', ()=>{ currentPage = parseInt(b.dataset.page,10); renderGrid(); });
    });
  }

  function bindToolbar(){
    let searchDebounce;
    document.getElementById('searchInput').addEventListener('input', ()=>{
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(applyFilters, 180);
    });
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortSelect').addEventListener('change', applyFilters);
    document.getElementById('inviteBtn').addEventListener('click', ()=>{
      if(typeof window.toast==='function') window.toast('Opening invite form…');
    });
  }

  function bindGridEvents(){
    const toast = typeof window.toast==='function' ? window.toast : (m)=>console.log(m);

    document.querySelectorAll('.ed-dots-btn').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const id = btn.dataset.editorId;
        document.querySelectorAll('.ed-dots-menu.open').forEach(m=>{ if(m.dataset.menuFor!==id) m.classList.remove('open'); });
        const menu = document.querySelector(`.ed-dots-menu[data-menu-for="${id}"]`);
        menu.classList.toggle('open');
      });
    });

    document.addEventListener('click', e=>{
      if(!e.target.closest('.ed-dots-wrap')){
        document.querySelectorAll('.ed-dots-menu.open').forEach(m=>m.classList.remove('open'));
      }
    });

    document.querySelectorAll('[data-editor-action="assign-authors"]').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const editorId = btn.dataset.editorId;
        const editor = ALL.find(x=>x.id===editorId);
        if(!editor) return;
        document.querySelectorAll('.ed-dots-menu.open').forEach(m=>m.classList.remove('open'));

        AssignAuthorsSheet.open({
          editorId: editorId,
          editorName: editor.name,
          editorAvatar: editor.avatar,
          authorPool: authorPool,
          assignedIds: assignments[editorId] || [],
          onSave: async function(edId, newIds){
            assignments[edId] = newIds;
            await ChiefEditorData.saveAssignments({ [edId]: newIds });
            renderGrid();
            toast(`Authors updated for ${editor.name}`);
          }
        });
      });
    });

    document.querySelectorAll('[data-action]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const editor = ALL.find(x=>x.id===el.dataset.id);
        if(!editor) return;
        const action = el.dataset.action;
        if(action==='view') toast(`Opening ${editor.name}'s profile…`);
        else if(action==='message') toast(`Opening message thread with ${editor.name}…`);
        else if(action==='quota') toast(`Opening quota options for ${editor.name}…`);
      });
    });
  }

  window.SeniorEditorsService = { init };
})();
