/* ═══════════════════════════════════════════════════════════════
   HOME PAGE SERVICE — call-and-render only for Pages/index.html
   Pages/index.html owns markup only. This file owns fetch + render.
   Demo data lives in data/central-demo-data.js (via HomeData).
   Ads render via component/ad-card.js + services/ad-service.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function toast(m, d) {
    d = d || 2200;
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, d);
  }
  window.toast = toast;

  function handleSaveClick(btn, item) {
    event.stopPropagation();
    if (window.DroboardSave && typeof DroboardSave.toggle === 'function') {
      var saved = DroboardSave.toggle(item);
      btn.classList.toggle('saved', saved);
      var icon = btn.querySelector('i');
      if (icon) icon.className = saved ? 'fas fa-bookmark' : 'far fa-bookmark';
      toast(saved ? '📌 Saved to library' : 'Removed from library');
    } else {
      toast('📌 Saved to library');
    }
  }
  window.handleSaveClick = handleSaveClick;

  function isItemSaved(id) {
    return !!(window.DroboardSave && typeof DroboardSave.isSaved === 'function' && DroboardSave.isSaved(id));
  }

  /* ── Status Row ── */
  function renderStatusRow(statuses) {
    var STATUSES = statuses || [];
    document.getElementById('statusRow').innerHTML = STATUSES.map(function (s) {
      if (s.isYou) return '<div class="s-item" onclick="toast(\'✏️ Add to your story\')">' +
        '<div class="s-ring ring-none" style="position:relative">' +
        '<div class="s-inner"><i class="fas fa-plus s-add-icon"></i></div>' +
        '</div>' +
        '<div class="s-name">You</div>' +
        '</div>';
      var live = s.isLive ? '<div class="s-live-dot"><i class="fas fa-signal"></i></div>' : '';
      return '<div class="s-item" data-status-id="' + s.id + '">' +
        '<div class="s-ring ' + s.ring + '" style="position:relative">' +
        '<div class="s-inner"><img src="' + s.avatar + '" loading="lazy" alt=""/></div>' + live +
        '</div>' +
        '<div class="s-name">@' + s.name.split('_')[0] + '</div>' +
        '</div>';
    }).join('');

    document.querySelectorAll('#statusRow [data-status-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var wid = el.dataset.statusId;
        if (typeof window.openStatusViewer === 'function') {
          openStatusViewer(statuses.filter(function (s) { return !s.isYou; }), wid);
        } else {
          toast('👁 Viewing status…');
        }
      });
    });
  }
  window.onStatusViewerChange = function (wid, ring) {
    // re-render on viewer change — keep statuses in closure via DOM re-read
    var cur = window.__homeStatuses || [];
    var w = cur.find(function (s) { return s.id === wid; });
    if (w) w.ring = ring;
    renderStatusRow(cur);
  };

  /* ── Hero slides — stories + FULLSCREEN swipe ads via ad-card ── */
  function heroSlideHTML(s) {
    // ad-droboard → FULLSCREEN swipe slide (gradient + icon), not small banner card
    if (s.type === 'ad-droboard') {
      if (window.AdService) AdService.track(s.id || s.headline, 'impression');
      // still use ad-card helper for esc consistency if needed, but layout is fullscreen hero-slide
      var esc = (window.AdCard && AdCard.esc) ? AdCard.esc : function(v){ return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
      return '<div class="hero-slide ad-drobrand-slide" onclick="if(window.AdService)AdService.track(\''+esc(s.id||'ad-droboard')+'\',\'click\');toast(\'🌟 Opening Droboard Premium…\')">' +
        '<div class="ad-drobrand-glow1"></div><div class="ad-drobrand-glow2"></div>' +
        '<div class="hero-badges-top"><span class="badge-ad">Ad · Droboard</span><span></span></div>' +
        '<div class="hero-content" style="display:flex;flex-direction:column;align-items:flex-start">' +
        '<div class="ad-drobrand-icon"><i class="fas ' + (s.icon||'fa-crown') + '"></i></div>' +
        '<div class="hero-title" style="font-size:25px">' + esc(s.headline) + '</div>' +
        '<div class="hero-synopsis" style="-webkit-line-clamp:3">' + esc(s.sub) + '</div>' +
        '<div class="hero-cta-row"><button class="btn-start" onclick="event.stopPropagation();if(window.AdService)AdService.track(\''+esc(s.id||'ad-droboard')+'\',\'click\');toast(\'🌟 Here we go!\')"><i class="fas fa-arrow-right" style="font-size:12px"></i> ' + esc(s.cta) + '</button></div>' +
        '</div></div>';
    }
    // ad-story → FULLSCREEN swipe slide (cover + scrim + badges), book ad rendered fullscreen, not small dac-story-promo card
    if (s.type === 'ad-story') {
      if (window.AdService) AdService.track(s.id || s.brand, 'impression');
      var esc2 = (window.AdCard && AdCard.esc) ? AdCard.esc : function(v){ return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
      var href = (window.AdCard && AdCard.storyHref) ? AdCard.storyHref({id:s.brand,title:s.brand}) : 'bridge.html?id='+encodeURIComponent(s.brand||'');
      return '<div class="hero-slide ad-frame" style="background-image:url(\'' + esc2(s.cover) + '\')" onclick="if(window.AdService)AdService.track(\''+esc2(s.id||s.brand)+'\',\'click\');location.href=\''+href+'\'">' +
        '<div class="hero-scrim"></div>' +
        '<div class="hero-badges-top"><span class="badge-ad">Ad</span><span class="badge-genre">' + esc2(s.genre) + '</span></div>' +
        '<div class="hero-content">' +
        '<div class="hero-title">' + esc2(s.brand) + '</div>' +
        '<div class="hero-author-row"><span class="hero-author-name">By ' + esc2(s.author) + '</span></div>' +
        '<div class="hero-synopsis">' + esc2(s.sub) + '</div>' +
        '<div class="hero-cta-row"><button class="btn-start" onclick="event.stopPropagation();if(window.AdService)AdService.track(\''+esc2(s.id||s.brand)+'\',\'click\');location.href=\''+href+'\'"><i class="fas fa-book-open" style="font-size:12px"></i> Read Now</button></div>' +
        '</div></div>';
    }
    var saved = isItemSaved(s.id);
    return '<div class="hero-slide" style="background-image:url(\'' + s.cover + '\')" onclick="toast(\'📖 Opening chapter…\')">' +
      '<div class="hero-scrim"></div>' +
      '<div class="hero-badges-top"><span class="badge-genre">' + s.genre + '</span></div>' +
      '<div class="hero-content">' +
      '<div class="hero-stats-row">' +
      '<span class="hero-stat rating"><i class="fas fa-star"></i> ' + s.rating + '</span>' +
      '<span class="hero-stat"><i class="far fa-eye"></i> ' + s.reads + ' reads</span>' +
      '<span class="hero-stat chapter"><i class="fas fa-bookmark"></i> ' + s.chapter + '</span>' +
      '</div>' +
      '<div class="hero-title">' + s.title + '</div>' +
      '<div class="hero-author-row">' +
      '<img class="hero-av" src="' + s.authorAv + '" loading="lazy" alt=""/>' +
      '<span class="hero-author-name">@' + s.author + (s.verified ? ' <i class="fas fa-circle-check"></i>' : '') + '</span>' +
      '</div>' +
      '<div class="hero-synopsis">' + s.synopsis + '</div>' +
      '<div class="hero-cta-row">' +
      '<button class="btn-start" onclick="event.stopPropagation();toast(\'📖 Opening chapter…\')"><i class="fas fa-play" style="font-size:12px"></i> Start Reading</button>' +
      '<button class="btn-icon-only' + (saved ? ' saved' : '') + '" onclick=\'handleSaveClick(this,' + JSON.stringify({ id: s.id, title: s.title, cover: s.cover, author: s.author }) + ')\'><i class="' + (saved ? 'fas' : 'far') + ' fa-bookmark"></i></button>' +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function renderHero(heroStories) {
    var dotsEl = document.getElementById('swipeDots');
    dotsEl.innerHTML = heroStories.map(function (_, i) {
      return '<div class="swipe-dot' + (i === 0 ? ' on' : '') + '"></div>';
    }).join('');
    document.getElementById('heroSlides').innerHTML = heroStories.map(heroSlideHTML).join('');
    // impressions tracked inside heroSlideHTML per ad slide via AdService.track
  }

  function bindHeroScroll() {
    var heroScroll = document.getElementById('heroScroll');
    if (!heroScroll) return;
    var heroTicking = false;
    heroScroll.addEventListener('scroll', function () {
      if (heroTicking) return;
      heroTicking = true;
      requestAnimationFrame(function () {
        var idx = Math.round(heroScroll.scrollTop / heroScroll.clientHeight);
        document.querySelectorAll('.swipe-dot').forEach(function (d, i) {
          d.classList.toggle('on', i === idx);
        });
        heroTicking = false;
      });
    }, { passive: true });
  }

  /* ── Public init — call-and-render only ── */
  async function init() {
    if (window.DroboardNav) DroboardNav.configure({ active: 'home', localTheme: 'dark' });
    var data = await HomeData.getHomeData();
    window.__homeStatuses = data.statuses || [];
    window.__homeHero = data.heroStories || [];
    renderStatusRow(window.__homeStatuses);
    renderHero(window.__homeHero);
    bindHeroScroll();
    // badge count from service if needed
    var nc = data.notifCount;
    var el = document.querySelector('.notif-count');
    if (el && typeof nc === 'number') el.textContent = nc;
  }

  window.HomePageService = { init, renderStatusRow, renderHero, heroSlideHTML };
  // auto-init when DOM ready (Pages/index.html just includes this file)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
