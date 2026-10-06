/**
 * drawer-service.js — Shared drawer / theme / toast for author center.
 * Pages should call AuthorDrawer.render(activeHref) and AuthorDrawer.bind().
 */
(function () {
  'use strict';
  if (window.AuthorDrawer) return;

  function getTheme() { try { return localStorage.getItem('droboardTheme') || 'light'; } catch (e) { return 'light'; } }
  function setTheme(t) { try { localStorage.setItem('droboardTheme', t); } catch (e) {} document.documentElement.setAttribute('data-theme', t); }

  function getMenuSections(activeHref) {
    var params = new URLSearchParams(location.search);
    var bookId = params.get('book');
    var page = (location.pathname.split('/').pop() || '').split('?')[0];
    var BOOK_PAGES = ['book-workspace.html', 'characters.html', 'plotting.html', 'book-overview.html', 'edit-chapter.html'];
    // Book pages always show book submenu even if ?book= missing (fallback b1)
    if (!bookId && BOOK_PAGES.indexOf(page) !== -1) bookId = 'b1';
    if (!bookId && activeHref && BOOK_PAGES.indexOf(activeHref) !== -1) bookId = 'b1';
    var BOOK_WORKSPACE_ITEMS = [
      { label: 'Chapters', icon: 'fa-list-ul', href: 'book-workspace.html' },
      { label: 'Characters', icon: 'fa-user-group', href: 'characters.html' },
      { label: 'Plotting', icon: 'fa-diagram-project', href: 'plotting.html' }
    ];
    var sections = [
      { title: 'Author Center', items: [{ label: 'Dashboard', icon: 'fa-gauge', href: 'author-center.html' }] },
      { title: 'Applications', items: [
        { label: 'Contracts', icon: 'fa-file-signature', href: 'apply-contract.html' },
        { label: 'Completion', icon: 'fa-flag-checkered', href: 'apply-completion.html' },
        { label: 'Chapter Review', icon: 'fa-pen-to-square', href: 'request-chapter-review.html' },
        { label: 'Series Changes', icon: 'fa-book-open', href: 'request-series-change.html' },
        { label: 'VIP Application', icon: 'fa-crown', href: 'apply-vip.html' }
      ]},
      { title: 'Finance', items: [
        { label: 'Earnings', icon: 'fa-sack-dollar', href: 'earnings.html' },
        { label: 'Transactions', icon: 'fa-receipt', href: 'transaction-history.html' },
        { label: 'Payment Details', icon: 'fa-credit-card', href: 'payment-details.html' }
      ]},
      { title: 'Communication', items: [
        { label: 'Messages', icon: 'fa-comment-dots', href: '../Pages/chat.html' },
        { label: 'Notifications', icon: 'fa-bell', href: '../Pages/notifications.html' }
      ]},
      { title: 'Settings', items: [{ label: 'Settings', icon: 'fa-gear', href: '#' }] }
    ];
    if (bookId) sections.splice(1, 0, { title: 'Book Workspace', items: BOOK_WORKSPACE_ITEMS.map(function (it) { return { label: it.label, icon: it.icon, href: it.href + '?book=' + bookId }; }) });
    if (activeHref) sections.forEach(function (s) { s.items.forEach(function (it) { if (it.href.split('?')[0] === activeHref) it.active = true; }); });
    return sections;
  }

  function render(activeHref) {
    var body = document.getElementById('drawerBody');
    if (!body) return;
    body.innerHTML = getMenuSections(activeHref).map(function (sec) {
      return '<div class="drawer-section"><div class="drawer-section-title">' + sec.title + '</div>' +
        sec.items.map(function (it) {
          return '<a class="drawer-item' + (it.active ? ' active' : '') + '" href="' + it.href + '"><i class="fas ' + it.icon + '"></i>' + it.label + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  function bind() {
    var menuBtn = document.getElementById('menuBtn'), drawer = document.getElementById('drawer'),
        overlay = document.getElementById('drawerOverlay'), close = document.getElementById('drawerClose');
    function open() { if (drawer) drawer.classList.add('open'); if (overlay) overlay.classList.add('open'); }
    function shut() { if (drawer) drawer.classList.remove('open'); if (overlay) overlay.classList.remove('open'); }
    if (menuBtn) menuBtn.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    if (overlay) overlay.addEventListener('click', shut);
  }

  function toast(m) {
    var t = document.getElementById('toastEl') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toastEl', className: 'toast' }));
    if (!document.querySelector('style[data-toast]')) {
      var s = document.createElement('style'); s.setAttribute('data-toast', '1');
      s.textContent = '.toast{position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(14px);background:rgba(26,26,46,.95);color:#fff;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;z-index:900;opacity:0;transition:.25s;pointer-events:none;white-space:nowrap}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
      document.head.appendChild(s);
    }
    t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  window.AuthorDrawer = { render: render, bind: bind, toast: toast, getTheme: getTheme, setTheme: setTheme, getMenuSections: getMenuSections };
})();
