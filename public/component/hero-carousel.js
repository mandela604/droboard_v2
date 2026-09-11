/**
 * component/hero-carousel.js — Droboard "Discover" hero carousel
 * ─────────────────────────────────────────────────────────────
 * Full-bleed hero slider (~220px) with badge, title, author, tags,
 * and dot navigation. Self-contained CSS + API — same pattern as
 * component/promo-slider.js, but a separate component since the
 * two are visually/structurally unrelated (this is not a scaled
 * copy of the promo slider).
 *
 *   <div id="heroMount"></div>
 *   <script src="component/hero-carousel.js"></script>
 *
 *   DroboardHeroCarousel.mount('#heroMount', {
 *     slides: [
 *       { title, author, img, tags: [...], badge? , id? },
 *       ...
 *     ],
 *     interval: 4500,
 *     onSelect: (slide) => { ... },
 *   });
 *
 * Theme-agnostic (dark scrim over any image); dot row renders below
 * the hero, same as the original discover.html markup.
 */
(function () {
  'use strict';
  if (window.__droboardHeroCarousel) return;
  window.__droboardHeroCarousel = true;

  const CSS = `
    .dhc-wrap{padding:0 16px;margin-bottom:8px}
    .dhc-hero{position:relative;border-radius:16px;overflow:hidden;height:220px;background:#1a0a12;cursor:pointer}
    .dhc-img{position:absolute;inset:0;background-size:cover;background-position:center 20%}
    .dhc-scrim{
      position:absolute;inset:0;
      background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.35) 50%,rgba(0,0,0,.15) 100%);
    }
    .dhc-body{position:absolute;left:16px;right:16px;bottom:16px;z-index:2}
    .dhc-badge{
      display:inline-flex;align-items:center;gap:4px;
      background:var(--dhc-accent,#ff2d55);color:#fff;font-size:10px;font-weight:700;
      padding:3px 8px;border-radius:6px;margin-bottom:8px;letter-spacing:.3px;
    }
    .dhc-title{
      font-size:26px;font-weight:800;color:#fff;line-height:1.15;
      margin-bottom:4px;text-shadow:0 2px 12px rgba(0,0,0,.4);
      font-family:'Inter',-apple-system,sans-serif;
    }
    .dhc-title em{font-style:italic;color:#ff8fab;font-weight:700}
    .dhc-author{font-size:12px;color:rgba(255,255,255,.8);margin-bottom:8px}
    .dhc-author i{color:#3b82f6;font-size:11px;margin-left:3px}
    .dhc-tags{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
    .dhc-tag{
      font-size:10px;font-weight:600;padding:3px 9px;border-radius:12px;
      background:rgba(255,255,255,.15);color:#fff;backdrop-filter:blur(4px);
    }
    .dhc-dots{display:flex;justify-content:center;gap:5px;margin:10px 0 6px}
    .dhc-dot{width:6px;height:6px;border-radius:50%;background:#d1d1d6;transition:.2s;cursor:pointer}
    .dhc-dot.on{width:16px;border-radius:3px;background:var(--dhc-accent,#ff2d55)}
  `;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ensureStyle() {
    if (document.getElementById('dhc-style')) return;
    const style = document.createElement('style');
    style.id = 'dhc-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /**
   * @param {string|Element} mount
   * @param {{ slides: Array, interval?: number, onSelect?: Function, badgeText?: string, accent?: string }} opts
   */
  function mount(mount, opts) {
    _ensureStyle();
    const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!root) return null;

    const slides = (opts && opts.slides) || [];
    const interval = (opts && opts.interval) || 4500;
    const onSelect = opts && opts.onSelect;
    const badgeText = (opts && opts.badgeText) || 'TRENDING';
    const accent = (opts && opts.accent) || '#ff2d55';

    if (!slides.length) {
      root.innerHTML = '';
      return null;
    }

    root.style.setProperty('--dhc-accent', accent);

    root.innerHTML = `
      <div class="dhc-wrap">
        <div class="dhc-hero" id="dhcHero">
          <div class="dhc-img" id="dhcImg"></div>
          <div class="dhc-scrim"></div>
          <div class="dhc-body">
            <div class="dhc-badge"><i class="fas fa-fire" style="font-size:9px"></i> ${_esc(badgeText)}</div>
            <div class="dhc-title" id="dhcTitle"></div>
            <div class="dhc-author" id="dhcAuthor"></div>
            <div class="dhc-tags" id="dhcTags"></div>
          </div>
        </div>
      </div>
      <div class="dhc-dots" id="dhcDots">
        ${slides.map((_, i) => `<div class="dhc-dot${i === 0 ? ' on' : ''}" data-dhc-dot="${i}"></div>`).join('')}
      </div>`;

    const heroEl = root.querySelector('#dhcHero');
    const imgEl = root.querySelector('#dhcImg');
    const titleEl = root.querySelector('#dhcTitle');
    const authorEl = root.querySelector('#dhcAuthor');
    const tagsEl = root.querySelector('#dhcTags');
    const dots = root.querySelectorAll('.dhc-dot');

    let index = 0;
    let timer = null;

    function render(i) {
      index = (i + slides.length) % slides.length;
      const s = slides[index];
      imgEl.style.backgroundImage = `url('${_esc(s.img || '')}')`;
      titleEl.innerHTML = s.title || '';
      authorEl.innerHTML = s.author ? _esc(s.author) + ' <i class="fas fa-circle-check"></i>' : '';
      tagsEl.innerHTML = (s.tags || []).map(t => `<span class="dhc-tag">${_esc(t)}</span>`).join('');
      dots.forEach((d, di) => d.classList.toggle('on', di === index));
    }

    function start() {
      stop();
      if (slides.length < 2) return;
      timer = setInterval(() => render(index + 1), interval);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    heroEl.addEventListener('click', () => {
      if (typeof onSelect === 'function') onSelect(slides[index], index);
    });

    dots.forEach(d => {
      d.addEventListener('click', (e) => {
        e.stopPropagation();
        render(Number(d.dataset.dhcDot));
        start();
      });
    });

    heroEl.addEventListener('mouseenter', stop);
    heroEl.addEventListener('mouseleave', start);

    render(0);
    start();

    return { goTo: render, start, stop, getIndex: () => index };
  }

  window.DroboardHeroCarousel = { mount };
})();