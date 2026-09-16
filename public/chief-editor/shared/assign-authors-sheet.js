(function(){
  'use strict';
  if(window.AssignAuthorsSheet) return;

  const CSS = `
    .aas-overlay{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.45);opacity:0;transition:opacity .25s;pointer-events:none}
    .aas-overlay.open{opacity:1;pointer-events:auto}
    .aas-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%) translateY(100%);width:100%;max-width:480px;max-height:85vh;background:var(--card,#fff);border-radius:18px 18px 0 0;z-index:9999;display:flex;flex-direction:column;transition:transform .3s cubic-bezier(.4,0,.2,1);box-shadow:0 -8px 30px rgba(0,0,0,.18)}
    .aas-sheet.open{transform:translateX(-50%) translateY(0)}
    .aas-handle{width:36px;height:4px;border-radius:4px;background:var(--border,#ddd);margin:10px auto 0;flex-shrink:0}
    .aas-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px;flex-shrink:0}
    .aas-header h3{font-size:15px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px}
    .aas-header h3 i{color:var(--accent,#ff0050);font-size:14px}
    .aas-close{width:30px;height:30px;border-radius:50%;border:none;background:var(--table-head,#f3f4f6);color:var(--text,#1a1a2e);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
    .aas-close:hover{background:var(--red-bg,#fff0f0);color:var(--red,#e53e3e)}
    .aas-search{margin:0 18px 12px;display:flex;align-items:center;gap:8px;background:var(--input-bg,#f8f9fb);border:1px solid var(--input-border,#e2e4e9);border-radius:10px;padding:9px 13px;flex-shrink:0}
    .aas-search i{color:var(--text-faint,#9ca3af);font-size:12px}
    .aas-search input{border:none;background:none;outline:none;font-size:12.5px;font-family:inherit;color:var(--text,#1a1a2e);width:100%}
    .aas-count{text-align:center;font-size:11px;font-weight:600;color:var(--text-muted,#6b7280);padding:0 18px 8px;flex-shrink:0}
    .aas-list{flex:1;overflow-y:auto;padding:0 18px 18px;-webkit-overflow-scrolling:touch}
    .aas-empty{text-align:center;padding:30px 16px;color:var(--text-faint,#9ca3af);font-size:12.5px}
    .aas-empty i{font-size:20px;margin-bottom:8px;display:block}
    .aas-author{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;cursor:pointer;transition:.15s;border:1px solid transparent}
    .aas-author:hover{background:var(--table-head,#f8f9fb);border-color:var(--border,#e2e4e9)}
    .aas-author.assigned{background:rgba(255,0,80,.06);border-color:rgba(255,0,80,.2)}
    .aas-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0}
    .aas-info{flex:1;min-width:0}
    .aas-name{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px}
    .aas-name .verified{color:var(--accent,#ff0050);font-size:10px}
    .aas-meta{font-size:10.5px;color:var(--text-muted,#6b7280);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aas-tag{font-size:9.5px;font-weight:700;padding:3px 10px;border-radius:20px;flex-shrink:0;text-transform:uppercase;letter-spacing:.02em;transition:.15s}
    .aas-tag.assigned{background:var(--accent,#ff0050);color:#fff}
    .aas-tag.unassigned{background:var(--table-head,#f3f4f6);color:var(--text-muted,#6b7280)}
    .aas-footer{padding:12px 18px;border-top:1px solid var(--border,#e2e4e9);display:flex;gap:10px;flex-shrink:0}
    .aas-footer button{flex:1;padding:10px;border-radius:10px;border:none;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;transition:.15s}
    .aas-footer .aas-save{background:var(--accent,#ff0050);color:#fff}
    .aas-footer .aas-save:hover{filter:brightness(1.05)}
    .aas-footer .aas-cancel{background:var(--table-head,#f3f4f6);color:var(--text,#1a1a2e)}
    .aas-footer .aas-cancel:hover{background:var(--border,#e2e4e9)}
    .aas-ed-badge{display:flex;align-items:center;gap:8px;padding:8px 12px;margin:0 18px 10px;background:var(--table-head,#f8f9fb);border-radius:10px;flex-shrink:0}
    .aas-ed-badge img{width:28px;height:28px;border-radius:50%;object-fit:cover}
    .aas-ed-badge span{font-size:11.5px;font-weight:700;color:var(--text,#1a1a2e)}
    .aas-ed-badge small{font-size:10px;color:var(--text-muted,#6b7280);margin-left:auto}
  `;

  let styleEl = null;
  function injectCSS(){
    if(styleEl) return;
    styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
  }

  function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  function createSheet(opts){
    injectCSS();
    const editorId = opts.editorId;
    const editorName = opts.editorName || '';
    const editorAvatar = opts.editorAvatar || '';
    const authorPool = opts.authorPool || [];
    const assignedIds = new Set(opts.assignedIds || []);
    let searchQ = '';

    const overlay = document.createElement('div');
    overlay.className = 'aas-overlay';
    const sheet = document.createElement('div');
    sheet.className = 'aas-sheet';

    function renderList(q){
      const filtered = q
        ? authorPool.filter(a => a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q) || a.genres.some(g => g.includes(q)))
        : authorPool;

      if(!filtered.length){
        return `<div class="aas-empty"><i class="fas fa-user-slash"></i>No authors match "${esc(q)}"</div>`;
      }

      return filtered.map(a => {
        const isAssigned = assignedIds.has(a.id);
        return `<div class="aas-author${isAssigned?' assigned':''}" data-author-id="${a.id}">
          <img class="aas-avatar" src="${esc(a.avatar)}" alt="${esc(a.name)}"/>
          <div class="aas-info">
            <div class="aas-name">${esc(a.name)} ${a.verified?'<i class="fas fa-circle-check verified"></i>':''}</div>
            <div class="aas-meta">${a.genres.slice(0,2).map(g=>esc(g)).join(' · ')} · ${a.reads} reads</div>
          </div>
          <span class="aas-tag ${isAssigned?'assigned':'unassigned'}">${isAssigned?'Assigned':'Assign'}</span>
        </div>`;
      }).join('');
    }

    function renderCount(){
      return `${assignedIds.size} of ${authorPool.length} authors assigned`;
    }

    sheet.innerHTML = `
      <div class="aas-handle"></div>
      <div class="aas-header">
        <h3><i class="fas fa-user-plus"></i> Assign Authors</h3>
        <button class="aas-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="aas-ed-badge">
        <img src="${esc(editorAvatar)}" alt="${esc(editorName)}"/>
        <span>${esc(editorName)}</span>
        <small>${assignedIds.size} assigned</small>
      </div>
      <div class="aas-search"><i class="fas fa-search"></i><input type="text" placeholder="Search by name, handle, or genre…" /></div>
      <div class="aas-count">${renderCount()}</div>
      <div class="aas-list">${renderList('')}</div>
      <div class="aas-footer">
        <button class="aas-cancel">Cancel</button>
        <button class="aas-save">Save Assignments</button>
      </div>`;

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const listEl = sheet.querySelector('.aas-list');
    const searchInput = sheet.querySelector('input');
    const countEl = sheet.querySelector('.aas-count');
    const edBadgeSmall = sheet.querySelector('.aas-ed-badge small');

    function refresh(){
      listEl.innerHTML = renderList(searchQ);
      countEl.textContent = renderCount();
      edBadgeSmall.textContent = `${assignedIds.size} assigned`;
    }

    searchInput.addEventListener('input', ()=>{
      searchQ = searchInput.value.trim().toLowerCase();
      refresh();
    });

    listEl.addEventListener('click', e=>{
      const row = e.target.closest('.aas-author');
      if(!row) return;
      const id = row.dataset.authorId;
      if(assignedIds.has(id)) assignedIds.delete(id);
      else assignedIds.add(id);
      refresh();
    });

    sheet.querySelector('.aas-close').addEventListener('click', close);
    sheet.querySelector('.aas-cancel').addEventListener('click', close);
    sheet.querySelector('.aas-save').addEventListener('click', ()=>{
      if(opts.onSave) opts.onSave(editorId, Array.from(assignedIds));
      close();
    });

    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });

    function open(){
      requestAnimationFrame(()=>{
        overlay.classList.add('open');
        sheet.classList.add('open');
        setTimeout(()=>searchInput.focus(), 350);
      });
    }

    function close(){
      overlay.classList.remove('open');
      sheet.classList.remove('open');
      setTimeout(()=>{ overlay.remove(); }, 350);
    }

    open();
    return { close };
  }

  window.AssignAuthorsSheet = { open: createSheet };
})();
