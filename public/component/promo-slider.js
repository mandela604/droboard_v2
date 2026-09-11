/**
 * component/promo-slider.js — Droboard promo / story carousel
 * ─────────────────────────────────────────────────────────────
 * Library-style horizontal slider (~87px). Self-contained CSS + API.
 *
 *   <div id="promoMount"></div>
 *   <script src="component/promo-slider.js"></script>
 *
 *   DroboardPromoSlider.mount('#promoMount', {
 *     slides: [
 *       { title, author, cta, img, id? },
 *       ...
 *     ],
 *     interval: 3200,
 *     onSelect: (slide) => { ... },
 *   });
 *
 * Theme follows <html data-theme>. Width respects parent (.phone).
 */
(function () {
  'use strict';
  if (window.__droboardPromoSlider) return;
  window.__droboardPromoSlider = true;

  const CSS = `
    .dps-row{padding:10px 14px 8px;background:var(--l1,#08090c)}
    .dps-slider{
      position:relative;width:100%;height:87px;border-radius:14px;
      overflow:hidden;background:var(--l2,#0e0f13);
    }
    .dps-track{
      display:flex;width:100%;height:100%;will-change:transform;
      transition:transform .45s cubic-bezier(.4,0,.2,1);
    }
    .dps-slide{
      flex:0 0 100%;width:100%;height:100%;min-width:0;position:relative;
      display:flex;align-items:center;gap:10px;padding:0 12px;
      background-size:cover;background-position:center;cursor:pointer;
    }
    .dps-scrim{
      position:absolute;inset:0;
      background:linear-gradient(90deg,rgba(10,6,14,.82) 0%,rgba(10,6,14,.45) 58%,rgba(10,6,14,.08) 100%);
    }
    .dps-text{position:relative;z-index:2;min-width:0;flex:1}
    .dps-eyebrow{
      font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
      color:#ff9db8;margin-bottom:3px;
    }
    .dps-title{
      font-size:12.5px;font-weight:700;color:#fff;line-height:1.28;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      font-family:'DM Sans',system-ui,sans-serif;
    }
    .dps-author{
      font-size:10px;color:rgba(255,255,255,.72);margin-top:2px;font-weight:500;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .dps-cta{
      position:relative;z-index:2;flex-shrink:0;background:#fff;color:#ff0050;
      font-size:10px;font-weight:800;padding:7px 13px;border-radius:16px;
      white-space:nowrap;border:none;cursor:pointer;font-family:inherit;
      box-shadow:0 2px 10px rgba(0,0,0,.2);
    }
    .dps-dots{
      position:absolute;bottom:7px;right:10px;z-index:3;display:flex;gap:4px;
    }
    .dps-dot{
      width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.45);transition:.25s;
    }
    .dps-dot.on{width:12px;border-radius:3px;background:#fff}

    [data-theme="light"] .dps-row{background:var(--l1,#fff)}
    [data-theme="light"] .dps-slider{background:var(--l2,#f1f1f1)}
  `;

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _ensureStyle() {
    if (document.getElementById('dps-style')) return;
    const style = document.createElement('style');
    style.id = 'dps-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /**
   * @param {string|Element} mount
   * @param {{ slides: Array, interval?: number, onSelect?: Function, eyebrow?: string }} opts
   */
  function mount(mount, opts) {
    _ensureStyle();
    const root = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!root) return null;

    const slides = (opts && opts.slides) || [];
    const interval = (opts && opts.interval) || 3200;
    const onSelect = opts && opts.onSelect;
    const eyebrow = (opts && opts.eyebrow) || 'Promoted';

    if (!slides.length) {
      root.innerHTML = '';
      return null;
    }

    root.innerHTML = `
      <div class="dps-row">
        <div class="dps-slider">
          <div class="dps-track">
            ${slides.map((s, i) => `
              <div class="dps-slide" data-dps-i="${i}" style="background-image:url('${_esc(s.img || s.cover || '')}')">
                <div class="dps-scrim"></div>
                <div class="dps-text">
                  <div class="dps-eyebrow">${_esc(s.eyebrow || eyebrow)}</div>
                  <div class="dps-title">${_esc(s.title || '')}</div>
                  <div class="dps-author">${s.author ? 'by ' + _esc(s.author) : ''}</div>
                </div>
                <button type="button" class="dps-cta" data-dps-cta="${i}">${_esc(s.cta || 'Read Now')}</button>
              </div>
            `).join('')}
          </div>
          <div class="dps-dots">
            ${slides.map((_, i) => `<div class="dps-dot${i === 0 ? ' on' : ''}" data-dps-dot="${i}"></div>`).join('')}
          </div>
        </div>
      </div>`;

    const slider = root.querySelector('.dps-slider');
    const track = root.querySelector('.dps-track');
    const dots = root.querySelectorAll('.dps-dot');
    let index = 0;
    let timer = null;

    function go(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('on', di === index));
    }

    function start() {
      stop();
      if (slides.length < 2) return;
      timer = setInterval(() => go(index + 1), interval);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    slider.addEventListener('click', (e) => {
      const cta = e.target.closest('[data-dps-cta]');
      const slideEl = e.target.closest('.dps-slide');
      if (!slideEl) return;
      const i = Number(cta ? cta.dataset.dpsCta : slideEl.dataset.dpsI);
      if (typeof onSelect === 'function') onSelect(slides[i], i);
    });

    let startX = 0, deltaX = 0, dragging = false;
    slider.addEventListener('touchstart', (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
      stop();
    }, { passive: true });
    slider.addEventListener('touchmove', (e) => {
      if (dragging) deltaX = e.touches[0].clientX - startX;
    }, { passive: true });
    slider.addEventListener('touchend', () => {
      if (Math.abs(deltaX) > 40) go(index + (deltaX < 0 ? 1 : -1));
      dragging = false;
      deltaX = 0;
      start();
    });
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', start);

    go(0);
    start();

    return { go, start, stop, getIndex: () => index };
  }

  window.DroboardPromoSlider = { mount };
})();
