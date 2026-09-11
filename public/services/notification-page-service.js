/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION PAGE SERVICE
   All logic for notifications.html.
   Data from DemoData.NOTIFS (central-demo-data.js).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__notifPageService) return;
  window.__notifPageService = true;

  let NOTIFS;
  let activeFilter = 'all';
  let openMenuId = null;

  function avatarHTML(n) {
    if (n.avatar) {
      return `<div class="n-avatar ${n.cover ? 'cover' : ''}"><img src="${n.avatar}" alt="" loading="lazy"/></div>`;
    }
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
    for (const g of NOTIFS) {
      const n = g.items.find(i => i.id === id);
      if (n) return n;
    }
    return null;
  }

  function updateBadges() {
    const counts = { all: 0, activity: 0, stories: 0, community: 0, revenue: 0, system: 0 };
    NOTIFS.forEach(g => g.items.forEach(i => {
      if (i.unread) {
        counts.all++;
        if (counts[i.cat] !== undefined) counts[i.cat]++;
      }
    }));
    Object.keys(counts).forEach(k => {
      const el = document.getElementById('b-' + k);
      if (!el) return;
      if (counts[k] > 0) { el.textContent = counts[k]; el.style.display = ''; }
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
    NOTIFS.forEach(group => {
      const items = activeFilter === 'all'
        ? group.items
        : group.items.filter(i => i.cat === activeFilter);
      if (!items.length) return;
      html += `<div class="day-label">${group.day}</div>`;
      html += items.map(cardHTML).join('');
    });
    document.getElementById('feed').innerHTML = html || '<div class="empty">No notifications in this category</div>';
    updateBadges();
    bindMenus();
  }

  function bindMenus() {
    document.querySelectorAll('.n-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = +btn.dataset.menu;
        const menu = document.getElementById('menu-' + id);
        if (!menu) return;
        const wasOpen = menu.classList.contains('open');
        closeAllMenus();
        if (!wasOpen) {
          menu.classList.add('open');
          openMenuId = id;
        }
      });
    });
    document.querySelectorAll('.card-menu-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const menu = item.closest('.card-menu');
        const id = +menu.dataset.id;
        const act = item.dataset.act;
        const n = findNotif(id);
        if (!n) return;
        if (act === 'read') n.unread = false;
        if (act === 'unread') n.unread = true;
        if (act === 'delete') {
          NOTIFS.forEach(g => { g.items = g.items.filter(i => i.id !== id); });
        }
        if (act === 'mute') {
          item.textContent = ' Muted';
        }
        closeAllMenus();
        render();
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
      NOTIFS.forEach(g => g.items.forEach(i => { i.unread = false; }));
      render();
    });

    document.addEventListener('click', () => closeAllMenus());

    const settingsSheet = document.getElementById('settingsSheet');
    function openSettings() { settingsSheet.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeSettings() { settingsSheet.classList.remove('open'); document.body.style.overflow = ''; }
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('settingsClose').addEventListener('click', closeSettings);
    settingsSheet.addEventListener('click', e => { if (e.target === settingsSheet) closeSettings(); });

    document.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', () => t.classList.toggle('on'));
    });
  }

  function init() {
    NOTIFS = (window.DemoData && DemoData.NOTIFS) || [];
    render();
    bindEvents();
  }

  window.NotifPageService = { init: init };
})();
