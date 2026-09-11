cat > /home/workdir/artifacts/component/ad-card.js << 'ENDOFFILE'
/**
 * ad-card.js — Droboard Reusable Ad Cards
 * Formats:
 *   renderNative(ad)       — third-party business ads
 *   renderPlatform(ad)     — DroBoard Premium / Coins / Studio self-promo
 *   renderStoryPromo(ad)   — writer-promoted stories (rich card)
 *   renderFollowPromo(ad)  — boost a writer/account
 *   renderFullscreen(ad)   — full-bleed snap ads
 *   renderBanner(ad)       — compact horizontal banners
 *
 * List-feed formats (Discover "More Stories" + browse genre list):
 *   renderListPlatform(ad) — house ad as a list row (gold fill + CTA)
 *   renderListBook(ad)     — writer-promoted book as a list row (gold border)
 *
 * Platform ads can also be rendered via renderNative if brand starts with
 * "DroBoard" — prefer renderPlatform for the dedicated Premium/Coins look.
 */
(function () {
  'use strict';
  if (window.__droboardAdCard) return;
  window.__droboardAdCard = true;

  const CSS = `
    /* ── shared ── */
    .dac-native,.dac-platform,.dac-promo,.dac-follow,.dac-full,.dac-banner,
    .dac-list-platform,.dac-list-book{
      font-family:'Inter','DM Sans',system-ui,-apple-system,sans-serif;box-sizing:border-box;
    }
    .dac-native *,.dac-platform *,.dac-promo *,.dac-follow *,.dac-full *,.dac-banner *,
    .dac-list-platform *,.dac-list-book *{box-sizing:border-box}

    /* ═══════════════ NATIVE (business) ═══════════════ */
    .dac-native{
      background:#0a0a0c;border-bottom:8px solid #111;padding:14px 14px 12px;cursor:pointer;
      transition:background .2s;
    }
    .dac-native-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
    .dac-logo-mark{
      width:36px;height:36px;border-radius:10px;flex-shrink:0;
      background:linear-gradient(135deg,#3b82f6,#6366f1);
      display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800;
    }
    .dac-brand-wrap{flex:1;min-width:0}
    .dac-brand{font-size:13.5px;font-weight:700;color:#e8e8e8;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dac-sp-flag{font-size:10px;color:#888;font-weight:600}
    .dac-native-menu{color:#888;font-size:14px;padding:4px;border:none;background:none;cursor:pointer}
    .dac-heading{font-size:15px;font-weight:800;color:#f0f0f0;line-height:1.35;margin-bottom:6px}
    .dac-text{font-size:13px;line-height:1.5;color:#a8a8b0;margin-bottom:4px}
    .dac-trunc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .dac-more,.dac-less{font-size:11px;font-weight:700;color:#3b82f6;cursor:pointer;display:inline-block;margin-bottom:10px}
    .dac-img{width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin:8px 0 10px;border:1px solid rgba(255,255,255,.06);display:block}
    .dac-native-footer{display:flex;align-items:center;gap:18px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
    .dac-act{display:flex;align-items:center;gap:6px;color:#888;font-size:12.5px;font-weight:600;cursor:pointer;background:none;border:none;font-family:inherit;padding:0}
    .dac-act i{font-size:15px}
    .dac-liked,.dac-liked i{color:#ff0050}
    .dac-native-cta{
      margin-left:auto;background:#3b82f6;color:#fff;border:none;padding:7px 14px;border-radius:10px;
      font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;
    }

    /* ═══════════════ PLATFORM (DroBoard Premium / Coins / Studio) ═══════════════ */
    .dac-platform{
      margin:0;background:linear-gradient(145deg,#120818 0%,#1a0a14 50%,#0c0c12 100%);
      border:1px solid rgba(255,0,80,.22);border-radius:16px;overflow:hidden;
      box-shadow:0 6px 24px rgba(255,0,80,.08);cursor:pointer;
    }
    .dac-plat-top{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 0}
    .dac-plat-badge{
      display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;
      background:rgba(255,0,80,.12);border:1px solid rgba(255,0,80,.2);color:#ff0050;
      font-size:9px;font-weight:800;letter-spacing:.03em;
    }
    .dac-plat-sp{font-size:9px;color:#888;font-weight:600}
    .dac-plat-main{padding:12px 14px 14px;display:flex;gap:14px;align-items:flex-start}
    .dac-plat-icon{
      width:52px;height:52px;border-radius:14px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:22px;
      background:linear-gradient(135deg,rgba(255,0,80,.2),rgba(167,139,250,.15));
      border:1px solid rgba(255,0,80,.25);color:#ff0050;
    }
    .dac-plat-icon.coins{color:#fbbf24;background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(255,0,80,.1));border-color:rgba(251,191,36,.3)}
    .dac-plat-icon.studio{color:#a78bfa;background:linear-gradient(135deg,rgba(167,139,250,.2),rgba(255,0,80,.1));border-color:rgba(167,139,250,.3)}
    .dac-plat-body{flex:1;min-width:0}
    .dac-plat-brand{font-size:10px;font-weight:800;color:#ff0050;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
    .dac-plat-heading{font-size:15px;font-weight:800;color:#f2f2f4;line-height:1.3;margin-bottom:6px}
    .dac-plat-text{font-size:12px;line-height:1.45;color:#9a9aa3;margin-bottom:12px}
    .dac-plat-cta{
      display:inline-flex;align-items:center;gap:6px;background:#ff0050;color:#fff;border:none;
      padding:9px 16px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;
      font-family:inherit;box-shadow:0 4px 14px rgba(255,0,80,.28);
    }
    .dac-plat-foot{padding:8px 14px;border-top:1px solid rgba(255,255,255,.06);font-size:9px;color:#777;font-weight:600}

    /* ═══════════════ STORY PROMO ═══════════════ */
    .dac-promo{
      width:100%;background:#0a0a0c;border:1px solid rgba(255,0,80,.18);border-left:3px solid #ff0050;
      border-radius:15px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,.18);cursor:pointer;
    }
    .dac-promo-top{display:flex;align-items:center;justify-content:space-between;padding:10px 11px 7px}
    .dac-promo-badge{
      display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:20px;
      background:rgba(255,0,80,.07);border:1px solid rgba(255,0,80,.14);color:#ff0050;
      font-size:8px;font-weight:800;letter-spacing:.02em;
    }
    .dac-promo-sp{display:flex;align-items:center;gap:7px;color:#999;font-size:8px;font-weight:600}
    .dac-promo-menu{width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:#999;border-radius:50%;border:none;background:none;cursor:pointer}
    .dac-promo-main{display:flex;gap:12px;padding:3px 11px 11px}
    .dac-promo-cover-wrap{width:88px;height:116px;flex-shrink:0;border-radius:9px;overflow:hidden;position:relative;background:#222;box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .dac-promo-cover{width:100%;height:100%;object-fit:cover;display:block}
    .dac-promo-cover-wrap::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,transparent 55%,rgba(0,0,0,.42));pointer-events:none}
    .dac-promo-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between}
    .dac-promo-cat{color:#ff0050;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
    .dac-promo-title{font-family:'Playfair Display',Georgia,serif;color:#e8e8e8;font-size:15px;line-height:1.27;font-weight:700;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
    .dac-promo-desc{color:#8a8a92;font-size:10px;line-height:1.4;margin-top:5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
    .dac-promo-author{display:flex;align-items:center;gap:6px;margin-top:7px}
    .dac-promo-av{width:19px;height:19px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.12)}
    .dac-promo-aname{font-size:9px;color:#bbb;font-weight:700}
    .dac-promo-verified{color:#38a9ff;font-size:8px}
    .dac-promo-stats{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}
    .dac-promo-stat{display:flex;align-items:center;gap:3px;color:#999;font-size:8px;font-weight:600}
    .dac-promo-stat i{font-size:8px}
    .dac-promo-stat .heart{color:#ff0050}
    .dac-promo-action{display:flex;align-items:center;justify-content:flex-end;margin-top:7px}
    .dac-promo-cta{border:0;background:#ff0050;color:#fff;border-radius:9px;padding:6px 12px;font-size:9px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 3px 9px rgba(255,0,80,.18);display:inline-flex;align-items:center;gap:4px}
    .dac-promo-bottom{border-top:1px solid rgba(255,255,255,.06);padding:7px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .dac-promo-tags{display:flex;gap:5px;overflow:hidden}
    .dac-promo-tag{flex-shrink:0;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.06);color:#999;font-size:7px;font-weight:700}
    .dac-promo-promoted{color:#777;font-size:7px;white-space:nowrap}

    /* ═══════════════ FOLLOW (promote author) ═══════════════ */
    .dac-follow{
      background:#0a0a0c;border:1px solid rgba(167,139,250,.25);border-left:3px solid #a78bfa;
      border-radius:15px;padding:14px;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.15);
    }
    .dac-follow-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .dac-follow-badge{
      display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:20px;
      background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.22);color:#a78bfa;
      font-size:8px;font-weight:800;letter-spacing:.02em;
    }
    .dac-follow-sp{font-size:8px;color:#888;font-weight:600}
    .dac-follow-row{display:flex;align-items:center;gap:12px}
    .dac-follow-av{
      width:56px;height:56px;border-radius:50%;object-fit:cover;flex-shrink:0;
      border:2px solid rgba(167,139,250,.4);box-shadow:0 0 0 3px rgba(167,139,250,.1);
    }
    .dac-follow-info{flex:1;min-width:0}
    .dac-follow-name{font-size:14.5px;font-weight:800;color:#f0f0f0;display:flex;align-items:center;gap:5px}
    .dac-follow-handle{font-size:11px;color:#888;font-weight:600;margin-top:2px}
    .dac-follow-tagline{font-size:11.5px;color:#a0a0a8;line-height:1.4;margin-top:6px}
    .dac-follow-cta{
      margin-top:12px;width:100%;background:#a78bfa;color:#0a0a0c;border:none;padding:10px 14px;
      border-radius:12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;
      display:flex;align-items:center;justify-content:center;gap:6px;
    }

    /* ═══════════════ FULLSCREEN ═══════════════ */
    .dac-full{position:relative;min-height:360px;background:#111;border-radius:0;overflow:hidden;cursor:pointer}
    .dac-full-bg{position:absolute;inset:0;background-size:cover;background-position:center}
    .dac-full-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.35) 45%,transparent 100%)}
    .dac-full-flag{position:absolute;top:14px;left:0;right:0;display:flex;justify-content:center;z-index:2}
    .dac-full-flag-inner{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);color:#fff;font-size:9px;font-weight:800;letter-spacing:.08em;padding:5px 12px;border-radius:20px}
    .dac-full-flag-dot{width:5px;height:5px;border-radius:50%;background:#ff0050}
    .dac-full-body{position:absolute;left:16px;right:16px;bottom:20px;z-index:2}
    .dac-full-brand{font-size:11px;font-weight:800;color:rgba(255,255,255,.85);margin-bottom:6px;display:flex;align-items:center;gap:8px}
    .dac-full-headline{font-size:20px;font-weight:800;color:#fff;line-height:1.25;margin-bottom:8px}
    .dac-full-sub{font-size:12.5px;color:rgba(255,255,255,.75);line-height:1.45;margin-bottom:14px}
    .dac-full-cta{background:#ff0050;color:#fff;border:none;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(255,0,80,.35)}

    /* ═══════════════ BANNER ═══════════════ */
    .dac-banner{
      display:flex;align-items:center;gap:12px;padding:12px 14px;background:#121214;
      border:1px solid rgba(255,255,255,.07);border-radius:14px;cursor:pointer;margin:4px 0;
    }
    .dac-banner-mark{
      width:40px;height:40px;border-radius:11px;flex-shrink:0;
      background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:14px;font-weight:800;
    }
    .dac-banner-body{flex:1;min-width:0}
    .dac-banner-brand{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.03em}
    .dac-banner-headline{font-size:13px;font-weight:800;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dac-banner-sub{font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dac-banner-cta{background:#3b82f6;color:#fff;border:none;padding:8px 12px;border-radius:10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0}

    /* ═══════════════ LIST PLATFORM (Discover / browse feed) ═══════════════
       Light-theme list row: gold fill, cover + sponsor + title + CTA.
       Same shape as a story list item so it sits cleanly in #moreList. */
    .dac-list-platform{
      display:flex;gap:12px;padding:12px;margin:6px 0;position:relative;
      border:1.5px solid #c9a227;border-radius:12px;background:#fdf7e6;cursor:pointer;
    }
    .dac-list-platform .dac-lp-cover{
      width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;
      background:#e8e8ed;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative;
      border:1.5px solid #c9a227;
    }
    .dac-list-platform .dac-lp-cover img{width:100%;height:100%;display:block;object-fit:cover}
    .dac-list-platform .dac-lp-tag{
      position:absolute;top:6px;left:6px;z-index:2;
      font-size:7px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;
      padding:2px 6px;border-radius:4px;background:#c9a227;color:#fff;
    }
    .dac-list-platform .dac-lp-body{
      flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px;
    }
    .dac-list-platform .dac-lp-sponsor{
      font-size:9px;font-weight:800;color:#c9a227;text-transform:uppercase;letter-spacing:.05em;
    }
    .dac-list-platform .dac-lp-title{
      font-size:13.5px;font-weight:700;line-height:1.3;color:#1a1a1a;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .dac-list-platform .dac-lp-cta{
      align-self:flex-start;margin-top:4px;font-size:10.5px;font-weight:800;
      color:#fff;background:#c9a227;padding:5px 12px;border-radius:14px;border:none;
      font-family:inherit;cursor:pointer;
    }

    /* ═══════════════ LIST BOOK (Discover / browse feed) ═══════════════
       Writer-promoted story as a list row: gold border + Promoted tag.
       Looks like a normal story list item. */
    .dac-list-book{
      display:flex;gap:12px;padding:10px;margin:4px 0;position:relative;
      border:1.5px solid #c9a227;border-radius:12px;background:#fff;cursor:pointer;
    }
    .dac-list-book .dac-lb-cover-link{display:block;flex-shrink:0}
    .dac-list-book .dac-lb-cover{
      width:76px;height:102px;border-radius:9px;overflow:hidden;
      background:#e8e8ed;box-shadow:0 2px 8px rgba(0,0,0,.08);position:relative;
    }
    .dac-list-book .dac-lb-cover img{width:100%;height:100%;display:block;object-fit:cover}
    .dac-list-book .dac-lb-tag{
      position:absolute;top:6px;left:6px;z-index:2;
      font-size:7px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;
      padding:2px 6px;border-radius:4px;background:#c9a227;color:#fff;
    }
    .dac-list-book .dac-lb-body{
      flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px;
    }
    .dac-list-book .dac-lb-genre{
      font-size:9px;font-weight:800;color:#ff2d55;text-transform:uppercase;letter-spacing:.05em;
    }
    .dac-list-book .dac-lb-title-link{display:block;cursor:pointer}
    .dac-list-book .dac-lb-title{
      font-size:13.5px;font-weight:700;line-height:1.3;color:#1a1a1a;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .dac-list-book .dac-lb-preview{
      font-size:11.5px;color:#8e8e93;line-height:1.45;
      display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    }
    .dac-list-book .dac-lb-foot{
      display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap;
    }
    .dac-list-book .dac-lb-stat{
      display:flex;align-items:center;gap:3px;font-size:10px;color:#8e8e93;font-weight:600;
    }
    .dac-list-book .dac-lb-author{color:#ff2d55;font-weight:800;cursor:pointer;text-decoration:none}

    /* ═══════════════ LIGHT THEME ═══════════════ */
    [data-theme="light"] .dac-native{background:#fff;border-bottom-color:#f0f0f0}
    [data-theme="light"] .dac-brand,[data-theme="light"] .dac-heading{color:#161616}
    [data-theme="light"] .dac-text{color:#555}
    [data-theme="light"] .dac-native-footer{border-top-color:#eee}
    [data-theme="light"] .dac-act{color:#777}

    [data-theme="light"] .dac-platform{background:linear-gradient(145deg,#fff5f8 0%,#fff 60%);border-color:rgba(255,0,80,.2);box-shadow:0 6px 20px rgba(255,0,80,.06)}
    [data-theme="light"] .dac-plat-heading{color:#161616}
    [data-theme="light"] .dac-plat-text{color:#666}
    [data-theme="light"] .dac-plat-foot{border-top-color:#f0e8ec;color:#999}

    [data-theme="light"] .dac-promo{background:#fff;border-color:#eadfe3;box-shadow:0 5px 20px rgba(0,0,0,.07)}
    [data-theme="light"] .dac-promo-title{color:#202024}
    [data-theme="light"] .dac-promo-desc{color:#707078}
    [data-theme="light"] .dac-promo-aname{color:#555}
    [data-theme="light"] .dac-promo-bottom{border-top-color:#f0edf0}
    [data-theme="light"] .dac-promo-tag{background:#f5f5f7;color:#777}

    [data-theme="light"] .dac-follow{background:#fff;border-color:rgba(167,139,250,.3);box-shadow:0 5px 18px rgba(0,0,0,.06)}
    [data-theme="light"] .dac-follow-name{color:#161616}
    [data-theme="light"] .dac-follow-tagline{color:#666}

    [data-theme="light"] .dac-banner{background:#fff;border-color:#eee}
    [data-theme="light"] .dac-banner-headline{color:#161616}
  `;

  let _root = null;
  let _hooks = {};
  let _hrefs = {
    storyHref: function (s) {
      const id = s.id || _slugify(s.title);
      return 'bridge.html?id=' + encodeURIComponent(id);
    },
    profileHref: function (author) {
      const handle = (author || '').replace('@', '');
      return 'profile.html?u=' + encodeURIComponent(handle);
    },
  };

  function _esc(s) {
    return (s == null ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _slugify(str) {
    return (str || '').toString().toLowerCase()
      .replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  function _fmtN(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function _findAd(all, id) {
    return (all || []).find(a => String(a.id) === String(id));
  }
  function _initials(brand) {
    return (brand || 'Ad').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
  function _injectStyles() {
    if (document.getElementById('dac-style')) return;
    const style = document.createElement('style');
    style.id = 'dac-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function _platformKind(ad) {
    const s = ((ad.brand || '') + ' ' + (ad.heading || '')).toLowerCase();
    if (s.includes('coin')) return 'coins';
    if (s.includes('studio') || s.includes('write')) return 'studio';
    return 'premium';
  }
  function _platformIcon(kind) {
    if (kind === 'coins') return 'fa-solid fa-coins';
    if (kind === 'studio') return 'fa-solid fa-pen-nib';
    return 'fa-solid fa-crown';
  }
  function _platformCta(ad, kind) {
    if (ad.cta) return ad.cta;
    if (kind === 'coins') return 'Get Coins';
    if (kind === 'studio') return 'Start Writing';
    return 'Go Premium';
  }

  // ── Type 1: Native business ad ──
  function renderNative(ad) {
    _injectStyles();
    if ((ad.brand || '').toLowerCase().includes('droboard')) {
      return renderPlatform(ad);
    }
    const logoHtml = ad.logo
      ? `<img class="dac-logo-mark" src="${ad.logo}" alt="" style="object-fit:cover;padding:0"/>`
      : `<div class="dac-logo-mark">${_esc(_initials(ad.brand))}</div>`;
    return `<div class="dac-native" data-adid="${ad.id}" data-adtype="native">
      <div class="dac-native-top">
        ${logoHtml}
        <div class="dac-brand-wrap">
          <span class="dac-brand">${_esc(ad.brand)}</span>
          <span class="dac-sp-flag">Sponsored</span>
        </div>
        <button type="button" class="dac-native-menu" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button>
      </div>
      <div class="dac-body" data-open="1">
        <div class="dac-heading">${_esc(ad.heading)}</div>
        <div class="dac-text dac-trunc" id="dac-txt-${ad.id}">${_esc(ad.body)}</div>
        <span class="dac-more" data-more="${ad.id}">See more <i class="fas fa-chevron-down" style="font-size:8px"></i></span>
        ${ad.image ? `<img class="dac-img" src="${ad.image}" loading="lazy" alt=""/>` : ''}
      </div>
      <div class="dac-native-footer">
        <div class="dac-act dac-like${ad.liked ? ' dac-liked' : ''}" data-like="${ad.id}">
          <i class="${ad.liked ? 'fas' : 'far'} fa-heart"></i><span class="dac-like-ct">${_fmtN(ad.likes)}</span>
        </div>
        <div class="dac-act" data-comment="${ad.id}"><i class="fas fa-comment-dots"></i><span>${_fmtN(ad.comments)}</span></div>
        <div class="dac-act" data-share="${ad.id}" data-adtype="native"><i class="fas fa-share-nodes"></i></div>
        <button type="button" class="dac-native-cta" data-cta="${ad.id}" data-adtype="native">${_esc(ad.cta || 'Learn more')}</button>
      </div>
    </div>`;
  }

  // ── Type 1b: DroBoard platform (Premium / Coins / Studio) ──
  function renderPlatform(ad) {
    _injectStyles();
    const kind = _platformKind(ad);
    const icon = _platformIcon(kind);
    const cta = _platformCta(ad, kind);
    return `<div class="dac-platform" data-adid="${ad.id}" data-adtype="platform" data-open="1">
      <div class="dac-plat-top">
        <div class="dac-plat-badge"><i class="fa-solid fa-bolt"></i> DroBoard</div>
        <span class="dac-plat-sp">Sponsored</span>
      </div>
      <div class="dac-plat-main">
        <div class="dac-plat-icon ${kind}"><i class="${icon}"></i></div>
        <div class="dac-plat-body">
          <div class="dac-plat-brand">${_esc(ad.brand || 'DroBoard')}</div>
          <div class="dac-plat-heading">${_esc(ad.heading)}</div>
          <div class="dac-plat-text">${_esc(ad.body)}</div>
          <button type="button" class="dac-plat-cta" data-cta="${ad.id}" data-adtype="platform">
            ${_esc(cta)} <i class="fa-solid fa-arrow-right" style="font-size:10px"></i>
          </button>
        </div>
      </div>
      <div class="dac-plat-foot">Promoted by DroBoard · Tap to learn more</div>
    </div>`;
  }

  // ── Type 2: Story promo ──
  function renderStoryPromo(ad) {
    _injectStyles();
    const cat = ad.cat || ad.genre || 'Story';
    const desc = ad.desc || ad.description || ad.body || '';
    const author = ad.authorName || ad.author || ad.handle || '';
    const av = ad.authorAv || ad.userAvatar || ad.avatar || '';
    const views = ad.views || '';
    const likes = ad.likes != null && ad.likes !== '' ? ad.likes : '';
    const chapters = ad.chapters || ad.ch || '';
    const rating = ad.rating || '';
    const tags = Array.isArray(ad.tags) ? ad.tags : (ad.tag ? [ad.tag] : ['Featured Story']);
    const cta = ad.cta || 'Read Now';
    const cover = ad.cover || ad.img || '';

    const statsBits = [];
    if (views) statsBits.push(`<span class="dac-promo-stat"><i class="fa-solid fa-eye"></i> ${_esc(String(views))}</span>`);
    if (likes !== '') statsBits.push(`<span class="dac-promo-stat"><i class="fa-solid fa-heart heart"></i> ${_esc(String(likes))}</span>`);
    if (chapters) statsBits.push(`<span class="dac-promo-stat"><i class="fa-solid fa-book-open"></i> ${_esc(String(chapters))}${String(chapters).toLowerCase().includes('ch') ? '' : ' ch'}</span>`);
    if (rating) statsBits.push(`<span class="dac-promo-stat"><i class="fa-solid fa-star"></i> ${_esc(String(rating))}</span>`);

    const authorHtml = author ? `
      <div class="dac-promo-author">
        ${av ? `<img class="dac-promo-av" src="${av}" loading="lazy" alt=""/>` : ''}
        <span class="dac-promo-aname">${author.startsWith('@') ? _esc(author) : '@' + _esc(author)}</span>
        ${ad.verified !== false ? '<i class="fa-solid fa-circle-check dac-promo-verified"></i>' : ''}
      </div>` : '';

    return `<div class="dac-promo" data-adid="${ad.id}" data-adtype="storyPromo" data-open="1">
      <div class="dac-promo-top">
        <div class="dac-promo-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> Sponsored Story</div>
        <div class="dac-promo-sp">Sponsored <button type="button" class="dac-promo-menu" data-ad-menu="${ad.id}" aria-label="More"><i class="fa-solid fa-ellipsis"></i></button></div>
      </div>
      <div class="dac-promo-main">
        <div class="dac-promo-cover-wrap"><img class="dac-promo-cover" src="${cover}" loading="lazy" alt=""/></div>
        <div class="dac-promo-body">
          <div>
            <div class="dac-promo-cat">${_esc(cat)}</div>
            <div class="dac-promo-title">${_esc(ad.title || '')}</div>
            ${desc ? `<div class="dac-promo-desc">${_esc(desc)}</div>` : ''}
            ${authorHtml}
            ${statsBits.length ? `<div class="dac-promo-stats">${statsBits.join('')}</div>` : ''}
          </div>
          <div class="dac-promo-action">
            <button type="button" class="dac-promo-cta" data-cta="${ad.id}" data-adtype="storyPromo"><i class="fa-solid fa-book-open-reader"></i> ${_esc(cta)}</button>
          </div>
        </div>
      </div>
      <div class="dac-promo-bottom">
        <div class="dac-promo-tags">${tags.slice(0, 3).map(tg => `<span class="dac-promo-tag">${_esc(tg)}</span>`).join('')}</div>
        <span class="dac-promo-promoted">Promoted by author</span>
      </div>
    </div>`;
  }

  // ── Type 2b: Follow / promote author ──
  function renderFollowPromo(ad) {
    _injectStyles();
    const name = ad.userName || ad.name || 'Writer';
    const handle = ad.handle || name.replace(/\s+/g, '_');
    const av = ad.userAvatar || ad.avatar || '';
    const tagline = ad.tagline || ad.bio || '';
    const cta = ad.cta || 'Follow';
    return `<div class="dac-follow" data-adid="${ad.id}" data-adtype="follow" data-open="1">
      <div class="dac-follow-top">
        <div class="dac-follow-badge"><i class="fa-solid fa-user-plus"></i> Suggested Writer</div>
        <span class="dac-follow-sp">Sponsored</span>
      </div>
      <div class="dac-follow-row">
        <img class="dac-follow-av" src="${av}" loading="lazy" alt=""/>
        <div class="dac-follow-info">
          <div class="dac-follow-name">${_esc(name)} <i class="fa-solid fa-circle-check" style="color:#38a9ff;font-size:11px"></i></div>
          <div class="dac-follow-handle">@${_esc(handle.replace(/^@/, ''))}</div>
          ${tagline ? `<div class="dac-follow-tagline">${_esc(tagline)}</div>` : ''}
        </div>
      </div>
      <button type="button" class="dac-follow-cta" data-cta="${ad.id}" data-adtype="follow">
        <i class="fa-solid fa-user-plus"></i> ${_esc(cta)}
      </button>
    </div>`;
  }

  // ── Type 3: Fullscreen ──
  function renderFullscreen(ad) {
    _injectStyles();
    return `<div class="dac-full" data-adid="${ad.id}" data-adtype="fullscreen" data-open="1">
      <div class="dac-full-bg" style="background-image:url('${ad.bg || ''}')"></div>
      <div class="dac-full-grad"></div>
      <div class="dac-full-flag"><div class="dac-full-flag-inner"><div class="dac-full-flag-dot"></div>SPONSORED AD<div class="dac-full-flag-dot"></div></div></div>
      <div class="dac-full-body">
        <div class="dac-full-brand">${_esc(ad.brand)}</div>
        <div class="dac-full-headline">${_esc(ad.headline)}</div>
        <div class="dac-full-sub">${_esc(ad.sub)}</div>
        <button type="button" class="dac-full-cta" data-cta="${ad.id}" data-adtype="fullscreen">${_esc(ad.cta || 'Learn more')} <i class="fas fa-arrow-right" style="font-size:10px"></i></button>
      </div>
    </div>`;
  }

  // ── Type 4: Banner ──
  function renderBanner(ad) {
    _injectStyles();
    return `<div class="dac-banner" data-adid="${ad.id}" data-adtype="banner" data-open="1">
      <div class="dac-banner-mark">${_esc(_initials(ad.brand))}</div>
      <div class="dac-banner-body">
        <div class="dac-banner-brand">${_esc(ad.brand)}</div>
        <div class="dac-banner-headline">${_esc(ad.headline)}</div>
        <div class="dac-banner-sub">${_esc(ad.sub)}</div>
      </div>
      <button type="button" class="dac-banner-cta" data-cta="${ad.id}" data-adtype="banner">${_esc(ad.cta || 'Go')}</button>
    </div>`;
  }

  /**
   * List-feed platform (house) ad — Discover "More Stories" / browse genre list.
   * Shape accepts either Discover demo ads or richer platform ads:
   *   { id, title|heading, sponsor|brand, cta, img|image }
   */
  function renderListPlatform(ad) {
    _injectStyles();
    ad = ad || {};
    const title = ad.title || ad.heading || '';
    const sponsor = ad.sponsor || ad.brand || 'DroBoard';
    const cta = ad.cta || 'Learn More';
    const img = ad.img || ad.image || '';
    return (
      '<div class="dac-list-platform" data-adid="' + _esc(ad.id || '') + '" data-adtype="listPlatform" data-ad="platform">' +
        '<div class="dac-lp-cover">' +
          '<span class="dac-lp-tag">Ad</span>' +
          (img ? '<img src="' + _esc(img) + '" loading="lazy" alt=""/>' : '') +
        '</div>' +
        '<div class="dac-lp-body">' +
          '<div class="dac-lp-sponsor">' + _esc(sponsor) + '</div>' +
          '<div class="dac-lp-title">' + _esc(title) + '</div>' +
          '<button type="button" class="dac-lp-cta" data-cta="' + _esc(ad.id || '') + '" data-adtype="listPlatform">' +
            _esc(cta) +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  /**
   * List-feed book ad — writer-promoted story in Discover / browse list.
   * Shape accepts Discover bookAds or story-promo fields:
   *   { id, title, author, img|cover, genre|cat, preview|desc, rating, chapters }
   */
  function renderListBook(ad) {
    _injectStyles();
    ad = ad || {};
    const href = _hrefs.storyHref(ad);
    const img = ad.img || ad.cover || '';
    const genre = ad.genre || ad.cat || '';
    const preview = ad.preview || ad.desc || ad.description || '';
    const author = ad.author || ad.authorName || '';
    return (
      '<div class="dac-list-book" data-adid="' + _esc(ad.id || '') + '" data-adtype="listBook" data-ad="book">' +
        '<a class="dac-lb-cover-link" href="' + _esc(href) + '">' +
          '<div class="dac-lb-cover">' +
            '<span class="dac-lb-tag">Promoted</span>' +
            (img ? '<img src="' + _esc(img) + '" loading="lazy" alt=""/>' : '') +
          '</div>' +
        '</a>' +
        '<div class="dac-lb-body">' +
          (genre ? '<div class="dac-lb-genre">' + _esc(genre) + '</div>' : '') +
          '<a class="dac-lb-title-link" href="' + _esc(href) + '">' +
            '<div class="dac-lb-title">' + _esc(ad.title || '') + '</div>' +
          '</a>' +
          (preview ? '<div class="dac-lb-preview">' + _esc(preview) + '</div>' : '') +
          '<div class="dac-lb-foot">' +
            (author
              ? '<a class="dac-lb-stat dac-lb-author" href="' + _esc(_hrefs.profileHref(author)) +
                '" onclick="event.stopPropagation()">' + _esc(author) + '</a>'
              : '') +
            (ad.rating
              ? '<div class="dac-lb-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ' +
                _esc(String(ad.rating)) + '</div>'
              : '') +
            (ad.chapters
              ? '<div class="dac-lb-stat"><i class="fas fa-book-open"></i> ' +
                ad.chapters + ' ch</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function configure(opts) {
    opts = opts || {};
    if (typeof opts.storyHref === 'function') _hrefs.storyHref = opts.storyHref;
    if (typeof opts.profileHref === 'function') _hrefs.profileHref = opts.profileHref;
  }

  function attach(rootEl, hooks) {
    _injectStyles();
    _root = rootEl;
    _hooks = hooks || {};

    _root.addEventListener('click', (e) => {
      const ads = typeof _hooks.getAds === 'function' ? _hooks.getAds() : [];

      const more = e.target.closest('[data-more]');
      if (more) {
        e.stopPropagation();
        const txt = document.getElementById('dac-txt-' + more.dataset.more);
        if (txt) {
          const expanded = !txt.classList.contains('dac-trunc');
          if (expanded) {
            txt.classList.add('dac-trunc');
            more.className = 'dac-more';
            more.innerHTML = 'See more <i class="fas fa-chevron-down" style="font-size:8px"></i>';
          } else {
            txt.classList.remove('dac-trunc');
            more.className = 'dac-less';
            more.innerHTML = 'See less <i class="fas fa-chevron-up" style="font-size:8px"></i>';
          }
        }
        return;
      }

      const like = e.target.closest('[data-like]');
      if (like) {
        e.stopPropagation();
        const ad = _findAd(ads, like.dataset.like);
        if (ad && typeof _hooks.onLike === 'function') _hooks.onLike(ad);
        return;
      }

      const comment = e.target.closest('[data-comment]');
      if (comment) {
        e.stopPropagation();
        const ad = _findAd(ads, comment.dataset.comment);
        if (ad && typeof _hooks.onComment === 'function') _hooks.onComment(ad);
        return;
      }

      const share = e.target.closest('[data-share]');
      if (share) {
        e.stopPropagation();
        const ad = _findAd(ads, share.dataset.share);
        if (ad && typeof _hooks.onShare === 'function') _hooks.onShare(ad, share.dataset.adtype);
        return;
      }

      const cta = e.target.closest('[data-cta]');
      if (cta) {
        e.stopPropagation();
        const ad = _findAd(ads, cta.dataset.cta);
        if (ad && typeof _hooks.onCta === 'function') _hooks.onCta(ad, cta.dataset.adtype);
        return;
      }

      const openable = e.target.closest('[data-open], .dac-full, .dac-banner, .dac-platform, .dac-follow, .dac-promo, .dac-list-platform, .dac-list-book');
      if (openable) {
        const card = openable.closest('[data-adid]') || openable;
        if (!card || !card.dataset.adid) return;
        const ad = _findAd(ads, card.dataset.adid);
        if (ad && typeof _hooks.onOpen === 'function') _hooks.onOpen(ad, card.dataset.adtype);
      }
    });
  }

  window.DroboardAdCard = {
    attach,
    configure,
    renderNative,
    renderPlatform,
    renderStoryPromo,
    renderFollowPromo,
    renderFullscreen,
    renderBanner,
    renderListPlatform,
    renderListBook,
  };
})();
ENDOFFILE