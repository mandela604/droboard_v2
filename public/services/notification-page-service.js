/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION PAGE SERVICE — call-and-render only for Pages/notifications.html
   Pages/notifications.html owns markup only; this file owns fetch + render.
   Demo: DemoData.NOTIFS (central-demo-data.js) + localStorage overrides
   Live: set USE_API=true → GET /api/notifications
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__notifPageService) return;
  window.__notifPageService = true;

  const USE_API = false;
  const API_BASE = '/api';
  const STORE_KEY = 'dro_notifs_override';

  let NOTIFS;
  let activeFilter = 'all';
  let openMenuId = null;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch(e){ return {}; }
  }
  function writeStore(patch) {
    try { const cur = readStore(); Object.assign(cur, patch); localStorage.setItem(STORE_KEY, JSON.stringify(cur)); } catch(e){}
  }

  async function loadNotifs() {
    if (USE_API) {
      const res = await fetch(`${API_BASE}/notifications`, { credentials:'include' });
      if (!res.ok) throw new Error('Notifs API failed');
      return res.json();
    }
    await new Promise(r=> setTimeout(r, 60));
    const base = (window.DemoData && DemoData.NOTIFS) ? JSON.parse(JSON.stringify(DemoData.NOTIFS)) : [];
    // apply local overrides: deleted ids, read states
    const store = readStore();
    const deleted = new Set(store.deleted || []);
    const readMap = store.readMap || {};
    base.forEach(g=>{
      g.items = g.items.filter(i=> !deleted.has(i.id));
      g.items.forEach(i=> { if (readMap[i.id]!==undefined) i.unread = !readMap[i.id]; });
    });
    return base.filter(g=> g.items.length);
  }

  function avatarHTML(n) {
    if (n.avatar) return `<div class="n-avatar ${n.cover ? 'cover' : ''}"><img src="${n.avatar}" alt="" loading="lazy"/></div>`;
    return `<div class="n-avatar icon-av" style="background:${n.iconBg};color:${n.iconColor}"><i class="fas ${n.icon}"></i></div>`;
  }
  function badgeHTML(n) {
    if (!n.badge) return '';
    return `<div class="n-badge ${n.badge}"><i class="fas ${n.badgeIcon}"></i></div>`;
  }
  function menuHTML(id) {
    return `<div class="card-menu" id="menu-${id}" data-id="${id}">
      <button class="card-menu-item" data-act="read"><i class="fas fa-check"></i> Mark as read</button>
      <button class="card-menu-item" data-act="unread"><i class="fas fa-circle"></i> Mark as unread</button>
      <button class="card-menu-item" data-act="mute"><i class="fas fa-bell-slash"></i> Mute this type</button>
      <button class="card-menu-item danger" data-act="delete"><i class="fas fa-trash"></i> Delete</button>
    </div>`;
  }
  function cardHTML(n) {
    const unreadCls = n.unread ? 'unread' : '';
    const timeOnRight = /Yesterday|days|week/i.test(n.time);
    return `<div class="n-card ${unreadCls}" data-cat="${n.cat}" data-accent="${n.accent}" data-id="${n.id}">
      <div class="n-avatar-wrap">${avatarHTML(n)}${badgeHTML(n)}</div>
      <div class="n-body">
        <div class="n-title">${n.title}</div>
        <div class="n-desc">${n.desc}</div>
        ${n.link ? `<div class="n-link ${n.linkClass || ''}">${n.link}</div>` : ''}
        ${!timeOnRight ? `<div class="n-time">${n.time}</div>` : ''}
      </div>
      <div class="n-right">
        ${timeOnRight ? `<div class="n-meta-time">${n.time}</div>` : ''}
        ${n.unread ? '<div class="n-dot"></div>' : ''}
        ${n.thumb ? `<div class="n-thumb"><img src="${n.thumb}" alt="" loading="lazy"/></div>` : ''}
        <button class="n-more" data-menu="${n.id}" aria-label="More"><i class="fas fa-ellipsis"></i></button>
        ${menuHTML(n.id)}
      </div>
    </div>`;
  }
  function findNotif(id) {
    const sid = String(id);
    for (const g of NOTIFS) { const n = g.items.find(i => String(i.id) === sid); if (n) return n; }
    return null;
  }
  function persistRead(id, isRead) {
    const s = readStore(); s.readMap = s.readMap || {}; s.readMap[id]=isRead; writeStore(s);
  }
  function persistDelete(id) {
    const s = readStore(); s.deleted = s.deleted || []; if(!s.deleted.includes(id)) s.deleted.push(id); writeStore(s);
  }
  function updateBadges() {
    const reader = typeof isReader === 'function' ? isReader() : false;
    const counts = { all: 0, activity: 0, stories: 0, community: 0, revenue: 0, system: 0 };
    NOTIFS.forEach(g => g.items.forEach(i => {
      if (!i.unread) return;
      if (reader && i.cat==='system' && i.type==='contract') return;
      counts.all++; if (counts[i.cat] !== undefined) counts[i.cat]++;
    }));
    Object.keys(counts).forEach(k => {
      const el = document.getElementById('b-' + k);
      if (!el) return;
      if (counts[k] > 0) { el.textContent = counts[k] > 99 ? '99+' : counts[k]; el.style.display = 'flex'; }
      else el.style.display = 'none';
    });
  }
  function closeAllMenus() {
    document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
    openMenuId = null;
  }
  function render() {
    closeAllMenus();
    let html = '';
    const reader = typeof isReader === 'function' ? isReader() : false;
    NOTIFS.forEach(group => {
      let items = activeFilter === 'all' ? group.items.slice() : group.items.filter(i => i.cat === activeFilter);
      if (reader) {
        if (activeFilter === 'system') items = items.filter(i => i.type==='security' || i.type==='reward' || i.type==='rewards' || i.type==='gift' || i.badge==='check' || i.badge==='gift' || i.type==='security');
        else if (activeFilter === 'all') items = items.filter(i => !(i.cat==='system' && i.type==='contract'));
      }
      if (!items.length) return;
      html += `<div class="day-label">${group.day}</div>`;
      html += items.map(cardHTML).join('');
    });
    document.getElementById('feed').innerHTML = html || '<div class="empty">No notifications in this category</div>';
    updateBadges();
    bindMenus();
    bindCardClicks();
  }
  function bindCardClicks() {
    document.querySelectorAll('.n-card').forEach(card=>{
      card.addEventListener('click', (e)=>{
        if (e.target.closest('.n-more') || e.target.closest('.card-menu')) return;
        const id = card.dataset.id;
        const n = findNotif(id);
        if (!n) return;
        // mark read on click
        if (n.unread) { n.unread=false; persistRead(id,true); updateBadges(); card.classList.remove('unread'); const dot=card.querySelector('.n-dot'); if(dot) dot.remove(); }
        // navigate based on type
        if (n.link && n.link.includes('Chapter')) location.href='bridge.html?id='+encodeURIComponent(n.title||'');
        else if (n.type==='follow' || n.type==='like') location.href='profile.html?u='+encodeURIComponent((n.title.match(/@(\w+)/)||[])[1]||'');
        else if (n.cat==='stories') location.href='discover.html';
        else toast(n.title.replace(/<[^>]*>/g,''));
      });
    });
  }
  function toast(m){ let t=document.getElementById('notifToast'); if(!t){ t=document.createElement('div'); t.id='notifToast'; t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:8px 18px;border-radius:20px;font-size:12px;z-index:999;opacity:0;transition:.3s'; document.body.appendChild(t);} t.textContent=m; t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2000); }
  function bindMenus() {
    document.querySelectorAll('.n-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = +btn.dataset.menu;
        const menu = document.getElementById('menu-' + id);
        if (!menu) return;
        const wasOpen = menu.classList.contains('open');
        closeAllMenus();
        if (!wasOpen) { menu.classList.add('open'); openMenuId = id; }
      });
    });
    document.querySelectorAll('.card-menu-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const menu = item.closest('.card-menu');
        const raw = menu ? menu.dataset.id : '';
        const id = raw;
        const sid = String(raw);
        const act = item.dataset.act;
        const n = findNotif(sid);
        if (!n && act !== 'delete') return;
        if (act === 'read' && n) { n.unread = false; persistRead(sid,true); }
        if (act === 'unread' && n) { n.unread = true; persistRead(sid,false); }
        if (act === 'delete') {
          NOTIFS.forEach(g => { g.items = g.items.filter(i => String(i.id) !== sid); });
          persistDelete(sid);
        }
        if (act === 'mute') { item.textContent = ' Muted'; toast('Muted '+(n?n.cat:'')); }
        else toast(act==='delete' ? 'Deleted' : 'Updated');
        closeAllMenus(); render();
      });
    });
  }
  function bindEvents() {
    document.querySelectorAll('#filterRow .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#filterRow .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.f;
        render();
      });
    });
    document.getElementById('markAllBtn').addEventListener('click', () => {
      NOTIFS.forEach(g => g.items.forEach(i => { i.unread = false; persistRead(i.id,true); }));
      render(); toast('All marked as read');
    });
    document.addEventListener('click', () => closeAllMenus());
    const settingsSheet = document.getElementById('settingsSheet');
    function openSettings() { renderSettings(); settingsSheet.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeSettings() { settingsSheet.classList.remove('open'); document.body.style.overflow = ''; }
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('settingsClose').addEventListener('click', closeSettings);
    settingsSheet.addEventListener('click', e => { if (e.target === settingsSheet) closeSettings(); });
  }
  const SETTINGS_KEY = 'dro_notif_settings';
  const DEFAULT_SETTINGS = { all:true, activity:true, stories:true, community:true, revenue:true, system:true, quiet:false, email:true, quietStart:'23:00', quietEnd:'04:00' };
  function loadSettings(){ try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')); } catch(e){ return {...DEFAULT_SETTINGS}; } }
  function saveSettings(s){ try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e){} }
  function isReader(){
    try {
      const u = JSON.parse(localStorage.getItem('aurum_user')||localStorage.getItem('droboard_user')||localStorage.getItem('aurum_user')||'{}');
      if (u && u.role) return String(u.role).toLowerCase()==='reader';
      if (u && typeof u.isWriter==='boolean') return !u.isWriter;
      // demo fallback: check DemoData current user handle
      if (window.DemoData && DemoData.USERS && DemoData.USERS['You_Reader']) return true;
    } catch(e){}
    return false;
  }
  function getQuietHoursDuration(start, end){
    const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
    let s=toMin(start), e=toMin(end); let diff=e-s; if(diff<0) diff+=24*60; return diff/60;
  }
  function renderSettings(){
    const s = loadSettings();
    const reader = isReader();
    const mount = document.getElementById('settingsMount');
    if (!mount) return;
    mount.innerHTML = `
      <div class="settings-section"><div class="settings-label">Push notifications</div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">All notifications</div><div class="settings-desc">Master switch for push alerts</div></div><div class="toggle ${s.all?'on':''}" data-key="all"></div></div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Activity</div><div class="settings-desc">Likes, comments, mentions</div></div><div class="toggle ${s.activity?'on':''}" data-key="activity"></div></div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Stories</div><div class="settings-desc">New chapters, rankings, reviews</div></div><div class="toggle ${s.stories?'on':''}" data-key="stories"></div></div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Community</div><div class="settings-desc">Follows, replies, group activity</div></div><div class="toggle ${s.community?'on':''}" data-key="community"></div></div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Revenue</div><div class="settings-desc">Coins, tips, payouts</div></div><div class="toggle ${s.revenue?'on':''}" data-key="revenue"></div></div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">System</div><div class="settings-desc">${reader ? 'Security, rewards only' : 'Contracts, security, rewards'}</div></div><div class="toggle ${s.system?'on':''}" data-key="system"></div></div>
      </div>
      <div class="settings-section"><div class="settings-label">Preferences</div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Quiet hours</div><div class="settings-desc">Mute alerts for a window (max 5h)</div></div><div class="toggle ${s.quiet?'on':''}" data-key="quiet"></div></div>
        <div id="quietTimeRow" style="display:${s.quiet?'flex':'none'};gap:8px;align-items:center;padding:10px 0 6px">
          <input type="time" id="quietStart" value="${s.quietStart}" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px;font-size:13px">
          <span style="font-size:12px;color:var(--muted)">to</span>
          <input type="time" id="quietEnd" value="${s.quietEnd}" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px;font-size:13px">
          <span id="quietHint" style="font-size:11px;color:var(--pink);display:none">Max 5h</span>
        </div>
        <div class="settings-row"><div class="settings-info"><div class="settings-name">Email digest</div><div class="settings-desc">Daily summary of unread activity</div></div><div class="toggle ${s.email?'on':''}" data-key="email"></div></div>
      </div>`;
    // re-bind toggles after render
    mount.querySelectorAll('.toggle').forEach(t=>{
      t.addEventListener('click', ()=>{
        const key=t.dataset.key;
        const cur=loadSettings();
        const isOn=t.classList.contains('on');
        const nextOn=!isOn;
        if (key==='all') {
          ['all','activity','stories','community','revenue','system'].forEach(k=> cur[k]=nextOn);
          saveSettings(cur); renderSettings(); toast(nextOn?'All notifications on':'All notifications off'); return;
        }
        cur[key]=nextOn; saveSettings(cur);
        if (key==='quiet') {
          document.getElementById('quietTimeRow').style.display = nextOn ? 'flex' : 'none';
        }
        t.classList.toggle('on', nextOn);
        // if any sub toggled off, master off; if all on, master on
        if (['activity','stories','community','revenue','system'].includes(key)) {
          const allOn = ['activity','stories','community','revenue','system'].every(k=> cur[k]);
          cur.all = allOn; saveSettings(cur);
          const master = mount.querySelector('[data-key="all"]');
          if (master) master.classList.toggle('on', allOn);
        }
      });
    });
    // quiet time change handlers
    const qs=document.getElementById('quietStart'), qe=document.getElementById('quietEnd'), hint=document.getElementById('quietHint');
    function validateQuiet(){
      const dur=getQuietHoursDuration(qs.value, qe.value);
      if (dur>5) { hint.style.display=''; hint.textContent='Max 5h — selected '+dur.toFixed(1)+'h'; qs.style.borderColor='var(--pink)'; qe.style.borderColor='var(--pink)'; return false; }
      hint.style.display='none'; qs.style.borderColor='var(--border)'; qe.style.borderColor='var(--border)';
      const cur=loadSettings(); cur.quietStart=qs.value; cur.quietEnd=qe.value; saveSettings(cur); return true;
    }
    if(qs) qs.addEventListener('change', validateQuiet);
    if(qe) qe.addEventListener('change', validateQuiet);
  }

  async function init() {
    NOTIFS = await loadNotifs();
    render();
    renderSettings();
    bindEvents();
  }
  window.NotifPageService = { init: init };
})();
