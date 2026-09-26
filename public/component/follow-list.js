/* ═══════════════════════════════════════════════════════════════
   FOLLOW LIST COMPONENT — paginated, configurable
   Same list powers Profile "Following" and Genre Hub "Members"
   and any future followers list. Self-contained CSS.

   Usage:
     <div id="myList"></div>
     <script src="../component/follow-list.js"></script>
     <script>
       const api = FollowList.attach('#myList', {
         perPage: 8,
         onToggle: (handle, item) => ProfileData.followUser(me, handle),
         onProfileClick: (handle) => location.href='profile.html?u='+handle,
         emptyText: 'No members yet.'
       });
       api.setData(members); // [{name, handle, avatar, av, role, meta, posts, following}]
     </script>
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FollowList) return;

  const CSS = `
    .fl-list{display:flex;flex-direction:column}
    .fl-item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--bd,rgba(0,0,0,.06));background:var(--l1,#fff);cursor:pointer}
    .fl-item:last-child{border-bottom:none}
    .fl-av{width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--l2,#f3f1f5)}
    .fl-av img{width:100%;height:100%;object-fit:cover;display:block}
    .fl-info{flex:1;min-width:0}
    .fl-name{font-size:13px;font-weight:700;color:var(--tx-high,#17151b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fl-meta{font-size:11px;color:var(--tx-muted,#635f6e);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fl-btn{padding:6px 12px;border-radius:16px;font-size:11px;font-weight:700;border:1px solid var(--bd,rgba(0,0,0,.08));background:var(--l2,#f3f1f5);color:var(--tx-body,#3a3a3a);cursor:pointer;white-space:nowrap}
    .fl-btn.ing{background:var(--acc,#ff0050);border-color:var(--acc,#ff0050);color:#fff}
    .fl-empty{padding:40px 14px;text-align:center;color:var(--tx-muted,#635f6e);font-size:12px}
    .fl-pager{display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px}
    .fl-pg{width:32px;height:32px;border-radius:9px;background:var(--l2,#f3f1f5);color:var(--tx-body,#17151b);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid var(--bd,#efedf2);cursor:pointer}
    .fl-pg.on{background:var(--acc,#ff0050);color:#fff;border-color:var(--acc,#ff0050)}
    .fl-pg:disabled{opacity:.35;pointer-events:none}
  `;

  function inject() {
    if (document.getElementById('fl-style')) return;
    const s = document.createElement('style'); s.id='fl-style'; s.textContent=CSS; document.head.appendChild(s);
  }
  function esc(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function createInstance(container, opts) {
    inject();
    const el = typeof container==='string' ? document.querySelector(container) : container;
    if (!el) return null;
    opts = opts || {};
    const perPage = opts.perPage || 8;
    const emptyText = opts.emptyText || 'Nothing here yet.';
    let data = [];
    let page = 1;

    function render() {
      const total = data.length;
      const tp = Math.max(1, Math.ceil(total / perPage));
      if (page > tp) page = tp;
      if (!total) {
        el.innerHTML = '<div class="fl-empty">'+esc(emptyText)+'</div>';
        const pg = el.nextElementSibling;
        if (pg && pg.classList.contains('fl-pager')) pg.innerHTML='';
        return;
      }
      const start = (page-1)*perPage;
      const slice = data.slice(start, start+perPage);
      el.innerHTML = slice.map(item => {
        const handle = item.handle || item.name || '';
        const name = item.name || handle;
        const av = item.avatar || item.av || 'https://i.pravatar.cc/100?img=12';
        const meta = item.meta || (item.role ? (item.role + (item.posts!=null?' · '+item.posts+' posts':'')) : '');
        const following = !!item.following;
        return '<div class="fl-item" data-handle="'+esc(handle)+'">'
          + '<div class="fl-av"><img src="'+esc(av)+'" loading="lazy" alt=""/></div>'
          + '<div class="fl-info"><div class="fl-name">@'+esc(name)+'</div><div class="fl-meta">'+esc(meta)+'</div></div>'
          + (opts.showButton===false ? '' : '<button class="fl-btn'+(following?' ing':'')+'" data-toggle="'+esc(handle)+'">'+(following?'Following':'Follow')+'</button>')
          + '</div>';
      }).join('');

      // pager element is sibling .fl-pager or create one
      let pager = el.nextElementSibling;
      if (!pager || !pager.classList.contains('fl-pager')) {
        pager = document.createElement('div'); pager.className='fl-pager';
        el.parentNode.insertBefore(pager, el.nextSibling);
      }
      if (tp <= 1) { pager.innerHTML=''; return; }
      let h = '<button class="fl-pg" data-p="prev" '+(page===1?'disabled':'')+'><i class="fas fa-chevron-left" style="font-size:10px"></i></button>';
      for (let i=1;i<=tp;i++) h += '<button class="fl-pg '+(i===page?'on':'')+'" data-p="'+i+'">'+i+'</button>';
      h += '<button class="fl-pg" data-p="next" '+(page===tp?'disabled':'')+'><i class="fas fa-chevron-right" style="font-size:10px"></i></button>';
      pager.innerHTML = h;
      pager.querySelectorAll('[data-p]').forEach(b=> b.addEventListener('click', ()=>{
        const p=b.dataset.p; if(p==='prev') page--; else if(p==='next') page++; else page=parseInt(p); render();
        el.scrollIntoView({behavior:'smooth',block:'start'});
      }));

      // bind row clicks
      el.querySelectorAll('.fl-item').forEach(row=>{
        row.addEventListener('click', (e)=>{
          if (e.target.closest('[data-toggle]')) return;
          const h=row.getAttribute('data-handle');
          if (opts.onProfileClick) opts.onProfileClick(h, row);
          else location.href='profile.html?u='+encodeURIComponent(h);
        });
      });
      el.querySelectorAll('[data-toggle]').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const h=btn.getAttribute('data-toggle');
          const item=data.find(d=> (d.handle||d.name)===h);
          if (opts.onToggle) opts.onToggle(h, item, btn);
        });
      });
    }

    function setData(list) { data = Array.isArray(list)? list.slice() : []; page=1; render(); }
    function getData(){ return data.slice(); }
    function setPage(p){ page=p; render(); }

    // expose instance
    const api = { setData, getData, setPage, render, el, get page(){return page}, get total(){return data.length} };
    // store on element for re-attach
    el._flApi = api;
    render();
    return api;
  }

  function attach(container, opts) {
    const el = typeof container==='string' ? document.querySelector(container) : container;
    if (el && el._flApi) return el._flApi;
    return createInstance(container, opts);
  }

  window.FollowList = { attach, create: createInstance };
  window.DroboardFollowList = window.FollowList;
})();
