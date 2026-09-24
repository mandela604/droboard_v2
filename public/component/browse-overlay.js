/**
 * browse-overlay.js — Droboard Browse / "View All" Overlay (v2, simplified)
 * ─────────────────────────────────────────────────────────────────────────
 * <script src="component/browse-overlay.js"></script>  (after Font Awesome)
 *
 * TWO MODES — this is the whole point of the rebuild:
 *
 *   "genre"   → opened from a genre tab / genre tile / the ⊞ "All Stories" icon.
 *               Shows ONE horizontal row of genre filter pills, content
 *               renders as a LIST. No genre label is repeated on
 *               each card — the overlay title already says which genre this is.
 *               A one-time "Top Writers" row (plain avatars, no card frame)
 *               is inserted near the top of the list.
 *
 *   "section" → opened from a "View All ›" link on a feed section
 *               (Trending, Top Romance, Continue Reading, New Releases…).
 *               NO genre pills. The overlay title is just that section's
 *               name. Content renders as a LIST.
 *
 * Both modes render as a LIST (not grid) for consistent browsing.
 * Both modes show the same promoted-story slider pinned to the top of the
 * overlay (identical slider used on the Library page), and both infinite-
 * scroll with two kinds of ad mixed in every ~6 stories:
 *   - "bookAd"     → a writer promoting their own book. Looks exactly like a
 *                    normal story card (cover, author, rating, chapters) but
 *                    with a gold border + "Promoted" tag.
 *   - "platformAd" → a DroBoard house ad (filled gold-tint card + CTA button).
 *   Roughly 4 out of every 5 ad slots are book ads, 1 is a platform ad.
 *
 * Every story card/list-item's author name is a clickable link to
 * profile.html?u=&lt;handle&gt;.
 *
 * ── OPEN PROGRAMMATICALLY ───────────────────────────────────────────────
 *   BrowseOverlay.open({ title: 'Romance',        mode: 'genre',   filter: 'romance' });
 *   BrowseOverlay.open({ title: 'All Stories',     mode: 'genre',   filter: 'all' });
 *   BrowseOverlay.open({ title: 'Trending Today',  mode: 'section' });
 *   BrowseOverlay.close();
 *   BrowseOverlay.isOpen();
 *
 * ── ZERO-JS TRIGGERS ─────────────────────────────────────────────────────
 *   Genre tab / genre tile:
 *     <div data-browse-trigger data-browse-mode="genre"
 *          data-browse-title="Werewolf" data-browse-filter="werewolf">Werewolf</div>
 *
 *   "View All" on a feed section (no filter → grid, no genre pills):
 *     <button data-browse-trigger data-browse-mode="section"
 *             data-browse-title="Trending Today">View All ›</button>
 *
 *   If data-browse-mode is omitted, the component infers "genre" when
 *   data-browse-filter is present, otherwise "section".
 *
 * ── REAL DATA ────────────────────────────────────────────────────────────
 *   BrowseOverlay.configure({
 *     stories: [ { id, img, title, author, genre, badge, rating, chapters, preview } ],
 *     onOpenStory: story => location.href = `bridge.html?id=${story.id}`,
 *   });
 */

(function () {
  'use strict';
  if (window.__droboardBrowseOverlay) return;
  window.__droboardBrowseOverlay = true;

  /* ═══════════════════════ STYLES (light theme only) ═══════════════════ */
  const CSS = `
    .bro-root{
      --bro-bg:#f7f7f8; --bro-card:#fff; --bro-topbar:rgba(247,247,248,.97);
      --bro-border:#ebebed; --bro-text:#1a1a1a; --bro-muted:#8e8e93;
      --bro-faint:#c7c7cc; --bro-acc:#ff2d55; --bro-acc-soft:rgba(255,45,85,.08);
      --bro-acc-border:rgba(255,45,85,.2); --bro-surface:#f0f0f2;
      --bro-shadow:rgba(0,0,0,.08); --bro-gold:#c9a227; --bro-gold-soft:#fdf7e6;
      position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:420px;height:100dvh;z-index:4000;background:var(--bro-bg);color:var(--bro-text);
      font-family:'Inter','DM Sans',system-ui,sans-serif;display:none;flex-direction:column;overflow:hidden;box-shadow:0 0 50px rgba(0,0,0,.10);
    }
    .bro-root.open{display:flex}
    .bro-root *,.bro-root *::before,.bro-root *::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .bro-root img{display:block;object-fit:cover}
    .bro-root button{font-family:inherit;cursor:pointer;border:none;background:none}
    .bro-root ::-webkit-scrollbar{display:none}

    .bro-topbar{position:sticky;top:0;z-index:20;flex-shrink:0;background:var(--bro-topbar);
      backdrop-filter:blur(16px);border-bottom:1px solid var(--bro-border);
      padding:calc(env(safe-area-inset-top,0px) + 10px) 16px 10px;}
    .bro-toprow{display:flex;align-items:center;gap:10px}
    .bro-back{width:34px;height:34px;border-radius:50%;background:var(--bro-surface);
      border:1px solid var(--bro-border);display:flex;align-items:center;justify-content:center;
      font-size:14px;color:var(--bro-text);flex-shrink:0}
    .bro-back:active{transform:scale(.9);background:var(--bro-acc-soft);color:var(--bro-acc)}
    .bro-title{flex:1;font-size:17px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis}

    .bro-genre-bar{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:10px 16px 4px}
    .bro-genre-pill{flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:11.5px;font-weight:700;
      cursor:pointer;border:1.5px solid var(--bro-border);color:var(--bro-muted);background:transparent;
      transition:all .15s;white-space:nowrap}
    .bro-genre-pill.on{background:var(--bro-acc-soft);color:var(--bro-acc);border-color:var(--bro-acc-border)}

    /* ── promo slider (same design as Library page) ── */
    .bro-promo-row{padding:12px 16px 2px}
    .bro-promo{position:relative;width:100%;height:96px;border-radius:14px;overflow:hidden;background:var(--bro-surface)}
    .bro-promo-track{display:flex;width:100%;height:100%;will-change:transform;transition:transform .45s cubic-bezier(.4,0,.2,1)}
    .bro-promo-slide{flex:0 0 100%;width:100%;height:100%;min-width:0;position:relative;display:flex;
      align-items:center;gap:10px;padding:0 14px;background-size:cover;background-position:center;cursor:pointer}
    .bro-promo-scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,6,14,.82) 0%,rgba(10,6,14,.45) 58%,rgba(10,6,14,.08) 100%)}
    .bro-promo-text{position:relative;z-index:2;min-width:0;flex:1}
    .bro-promo-eyebrow{font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ff9db8;margin-bottom:3px}
    .bro-promo-title{font-size:13px;font-weight:700;color:#fff;line-height:1.28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bro-promo-author{font-size:10.5px;color:rgba(255,255,255,.72);margin-top:2px;font-weight:500}
    .bro-promo-cta{position:relative;z-index:2;flex-shrink:0;background:#fff;color:#c2185b;font-size:10px;
      font-weight:800;padding:7px 13px;border-radius:16px;white-space:nowrap}
    .bro-promo-dots{position:absolute;bottom:7px;right:10px;z-index:3;display:flex;gap:4px}
    .bro-promo-dot{width:4px;height:4px;border-radius:50%;background:rgba(255,255,255,.45);transition:.25s}
    .bro-promo-dot.on{width:12px;border-radius:3px;background:#fff}

    .bro-scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain}

    /* ── grid (unused, kept for compatibility) ── */
    .bro-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 10px;padding:14px 16px}
    .bro-card{cursor:pointer}
    .bro-card:active{opacity:.82}
    .bro-card-cover{position:relative;width:100%;aspect-ratio:110/148;border-radius:10px;overflow:hidden;
      background:var(--bro-surface);margin-bottom:7px;box-shadow:0 2px 10px var(--bro-shadow)}
    .bro-card-cover img{width:100%;height:100%}
    .bro-card-badge{position:absolute;top:5px;left:5px;z-index:2;font-size:7px;font-weight:800;padding:2px 5px;
      border-radius:4px;text-transform:uppercase;letter-spacing:.2px;background:var(--bro-acc);color:#fff}
    .bro-card-title{font-size:11px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden;margin-bottom:2px}
    .bro-card-author{font-size:10px;color:var(--bro-muted);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

    /* ── list (always used) ── */
    .bro-list{display:flex;flex-direction:column;padding:4px 16px}
    .bro-list-item{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--bro-border);cursor:pointer}
    .bro-list-item:active{opacity:.85}
    .bro-list-cover{width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;
      background:var(--bro-surface);box-shadow:0 2px 8px var(--bro-shadow)}
    .bro-list-cover img{width:100%;height:100%}
    .bro-list-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}
    .bro-list-genre{font-size:9px;font-weight:800;color:var(--bro-gold);text-transform:uppercase;letter-spacing:.05em}
    .bro-list-title{font-size:13.5px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;
      -webkit-box-orient:vertical;overflow:hidden}
    .bro-list-preview{font-size:11.5px;color:var(--bro-muted);line-height:1.45;display:-webkit-box;
      -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .bro-list-foot{display:flex;align-items:center;gap:10px;margin-top:2px;flex-wrap:wrap}
    .bro-list-stat{display:flex;align-items:center;gap:3px;font-size:10px;color:var(--bro-muted);font-weight:600}
    .bro-list-author{color:var(--bro-acc);font-weight:800}

    /* ── platform ad — DroBoard house ad, neutral styling ── */
    .bro-list-item.bro-ad{border:1px solid var(--bro-border);border-radius:12px;background:var(--bro-card);
      padding:12px;margin:6px 0}
    .bro-ad-tag{position:absolute;top:6px;left:6px;z-index:2;font-size:7px;font-weight:800;letter-spacing:.3px;
      text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#999;color:#fff}
    .bro-ad .bro-list-cover{position:relative;border:1px solid var(--bro-border)}
    .bro-ad-cta{align-self:flex-start;margin-top:4px;font-size:10.5px;font-weight:800;color:#fff;
      background:var(--bro-acc);padding:5px 12px;border-radius:14px}

    /* ── book ad — writer's promoted book, golden background ── */
    .bro-list-item.bro-book-ad{border:1.5px solid var(--bro-gold);border-radius:12px;background:var(--bro-gold-soft);padding:10px;margin:4px 0;border-bottom:1.5px solid var(--bro-gold)}
    .bro-list-item.bro-book-ad .bro-list-cover{position:relative}
    .bro-card.bro-gold-border{position:relative;background:var(--bro-gold-soft);border:1.5px solid var(--bro-gold);border-radius:12px;padding:10px}
    .bro-card.bro-gold-border .bro-card-cover{border:2px solid var(--bro-gold)}
    .bro-card-badge.bro-badge-gold{background:var(--bro-gold)}

    /* ── top writers row (no card frame, just avatars) ── */
    .bro-writers-row{padding:14px 0 8px;border-bottom:1px solid var(--bro-border);margin-bottom:4px}
    .bro-writers-head{font-size:12.5px;font-weight:800;margin-bottom:10px}
    .bro-writers-scroll{display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .bro-writers-scroll::-webkit-scrollbar{display:none}
    .bro-writer{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;width:64px;text-align:center}
    .bro-writer-avatar{width:52px;height:52px;border-radius:50%;object-fit:cover}
    .bro-writer-name{font-size:10.5px;font-weight:600;color:var(--bro-text);white-space:nowrap;overflow:hidden;
      text-overflow:ellipsis;width:100%}

    .bro-loader{display:flex;align-items:center;justify-content:center;gap:8px;padding:20px 16px;
      font-size:12px;color:var(--bro-muted)}
    .bro-loader.hidden{display:none}
    .bro-spinner{width:16px;height:16px;border-radius:50%;border:2px solid var(--bro-border);
      border-top-color:var(--bro-acc);animation:broSpin .7s linear infinite;flex-shrink:0}
    @keyframes broSpin{to{transform:rotate(360deg)}}
    .bro-sentinel{height:1px}

    .bro-empty{display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;
      padding:60px 28px;text-align:center;min-height:280px}
    .bro-empty.show{display:flex}
    .bro-empty-icon{font-size:34px}
    .bro-empty-title{font-size:16px;font-weight:800}
    .bro-empty-body{font-size:12.5px;color:var(--bro-muted);line-height:1.6;max-width:240px}

    @keyframes broIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .bro-card,.bro-list-item{animation:broIn .2s ease both}
  `;

  /* ═══════════════════════ DATA ═══════════════════════ */
  const GENRES = [
    { id: 'all', label: '🔥 All' },
    { id: 'romance', label: '❤️ Romance' },
    { id: 'werewolf', label: '🐺 Werewolf' },
    { id: 'mafia', label: '🔫 Mafia' },
    { id: 'fantasy', label: '✨ Fantasy' },
    { id: 'campus', label: '🎓 Campus' },
    { id: 'revenge', label: '🔥 Revenge' },
    { id: 'drama', label: '🎭 Drama' },
    { id: 'billionaire', label: '💼 Billionaire' },
    { id: 'mystery', label: '🔍 Mystery' },
    { id: 'horror', label: '👻 Horror' },
  ];

  const COVERS = [
    'https://i.postimg.cc/vDn9YLx5/wife2.jpg', 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    'https://i.postimg.cc/ftRZbhKx/3.jpg', 'https://i.postimg.cc/N9jY0w4m/5.jpg',
    'https://i.postimg.cc/JDzmhWqj/2.jpg', 'https://i.postimg.cc/DJwFzKgd/4.jpg',
    'https://i.postimg.cc/cgLZJNmC/8.jpg', 'https://i.postimg.cc/0MyxNqfz/7.jpg',
    'https://i.postimg.cc/WF1j4Pnh/6.jpg', 'https://i.postimg.cc/fkdXzjSj/wife.jpg',
  ];
  const c = i => COVERS[Math.abs(i) % COVERS.length];

  // Base pool — 10 stories. Looped + reshuffled with new covers/ids to fill a page.
  const STORIES_BASE = [
    { id: 's1', title: 'His Sweet Revenge', author: '@Luna_Grey', genre: 'mafia', badge: 'hot', rating: '4.8', chapters: 21, preview: 'Everything changes when she discovers the truth he tried so hard to hide.' },
    { id: 's2', title: 'The Runaway Bride', author: '@Ifeanyi_Story', genre: 'romance', badge: 'hot', rating: '4.9', chapters: 8, preview: 'Four hundred guests. One pastor. She chose to speak, and nothing was the same after.' },
    { id: 's3', title: "The Alpha's Obsession", author: '@Ifeanyi_Story', genre: 'werewolf', badge: '', rating: '4.7', chapters: 18, preview: 'He claimed her as his mate. She refused to accept it — until the full moon.' },
    { id: 's4', title: 'The Fantasy Kingdom', author: '@Chiamaka_N', genre: 'fantasy', badge: 'new', rating: '4.8', chapters: 27, preview: 'She had lived as a seamstress for twenty years. The soldiers recognized her instantly.' },
    { id: 's5', title: 'The Campus Queen', author: '@CampusQueen', genre: 'campus', badge: 'new', rating: '4.5', chapters: 9, preview: 'Social hierarchy runs this campus like a government. So why was she always near me?' },
    { id: 's6', title: 'Her Name Was Vengeance', author: '@Zara_M', genre: 'revenge', badge: '', rating: '4.8', chapters: 14, preview: 'They took her family and her name, but left her alive. Their first mistake.' },
    { id: 's7', title: "Grandmother's Hidden Will", author: '@Kemi_A', genre: 'drama', badge: '', rating: '4.6', chapters: 13, preview: 'The lawyer said a name no one in the family recognized, then everything changed.' },
    { id: 's8', title: 'Bound to the Ruthless CEO', author: '@Ava_Winters', genre: 'billionaire', badge: '', rating: '4.7', chapters: 14, preview: 'One year, no feelings. The contract was perfect — until neither wanted to leave.' },
    { id: 's9', title: 'The Quiet Twin', author: '@Efe_O', genre: 'mystery', badge: '', rating: '4.7', chapters: 13, preview: 'One twin died. One twin lived. The living one started answering to her name.' },
    { id: 's10', title: 'The House on Willow Lane', author: '@Dami_Cole', genre: 'horror', badge: 'new', rating: '4.4', chapters: 5, preview: 'The house had been empty for twelve years. The new tenants lasted three nights.' },
  ];

  // Platform (DroBoard house) ads — filled gold box, CTA button, no author/rating.
  const PLATFORM_ADS = [
    { title: 'DroBoard Premium — Read Ad-Free', sponsor: 'DroBoard', cta: 'Upgrade Now' },
    { title: 'Get 3 Months of Unlimited Coins', sponsor: 'DroBoard Coins', cta: 'Claim Offer' },
    { title: 'Write Your Own Story Today', sponsor: 'DroBoard Studio', cta: 'Start Writing' },
  ];

  // Book ads — a writer promoting their own book. Renders exactly like a normal
  // story card (cover, title, author, rating, chapters) but with a gold border
  // and a "Promoted" tag so it reads as sponsored, not organic.
  const BOOK_ADS = [
    { title: 'Crowned in Sin', author: '@Nkemdilim_R', genre: 'mafia', rating: '4.9', chapters: 32, preview: 'An indie mafia romance climbing the charts — read the debut everyone is talking about.' },
    { title: 'Werewolf King, Human Queen', author: '@Tobenna_K', genre: 'werewolf', rating: '4.6', chapters: 19, preview: 'A new voice in werewolf romance. Chapter one is free for the next 48 hours.' },
    { title: 'The Billionaire Never Forgets', author: '@Sarah_Odum', genre: 'billionaire', rating: '4.7', chapters: 24, preview: 'Self-published and rising fast — a slow-burn billionaire romance readers can\u2019t put down.' },
    { title: 'Campus Chaos', author: '@Bode_Ilo', genre: 'campus', rating: '4.5', chapters: 16, preview: 'A campus rom-com getting buzz this month. New chapters every Friday.' },
    { title: 'Fangs & Fortune', author: '@Ese_Uyi', genre: 'fantasy', rating: '4.8', chapters: 29, preview: 'Dark fantasy romance from an indie author breaking into the charts.' },
  ];

  // Top writers — shown as one avatar row inserted near the top of the list.
  const TOP_WRITERS = [
    { name: 'Ifeanyi Story', handle: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53' },
    { name: 'Ada Writes', handle: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32' },
    { name: 'Luna Grey', handle: 'Luna_Grey', avatar: 'https://i.pravatar.cc/100?img=25' },
    { name: 'Zara M', handle: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=16' },
    { name: 'Chiamaka N', handle: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47' },
    { name: 'Kemi A', handle: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28' },
  ];

  // Promoted-story slider — same content shape as the Library page's promo slider.
  const PROMO = [
    { title: 'Bound to the Ruthless CEO', author: 'Ava Winters', cta: 'Read Now', img: c(3) },
    { title: 'His Sweet Revenge', author: 'Luna Grey', cta: 'New Chapter', img: c(0) },
    { title: "The Alpha's Obsession", author: 'Ifeanyi Story', cta: 'Trending', img: c(2) },
    { title: 'Devil in a Suit', author: 'Zara M', cta: "Editor's Pick", img: c(8) },
  ];

  const PAGE_SIZE = 15;      // infinite-scroll page size
  const POOL_SIZE = 42;      // looped stories per open (~40-45)
  const AD_INTERVAL = 6;     // insert an ad slot every N stories (both list and grid modes)

  /* ═══════════════════════ STATE ═══════════════════════ */
  let _built = false, _isOpen = false;
  let _root, _scrollEl, _listEl, _genreBarEl, _titleEl, _loaderEl, _sentinelEl, _emptyEl;
  let _observer = null;
  let _promoIndex = 0, _promoTimer = null;

  let _mode = 'section';   // 'genre' | 'section' | 'collections'
  let _title = 'Browse';
  let _filter = 'all';
  let _pool = [];
  let _page = 1, _hasMore = true, _loading = false;

  let _stories = STORIES_BASE.slice();
  let _hooks = {
    onOpenStory: () => {},
    onAdClick: () => {},
  };

  function configure(opts) {
    opts = opts || {};
    if (Array.isArray(opts.stories)) _stories = opts.stories;
    if (typeof opts.onOpenStory === 'function') _hooks.onOpenStory = opts.onOpenStory;
    if (typeof opts.onAdClick === 'function') _hooks.onAdClick = opts.onAdClick;
  }

  function _esc(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function _injectStyles() {
    if (document.getElementById('bro-styles')) return;
    const el = document.createElement('style');
    el.id = 'bro-styles'; el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ═══════════════════════ POOL BUILDING ═══════════════════════ */
  // Every AD_INTERVAL stories gets one ad slot. Of every 5 ad slots, 4 are book
  // ads (a writer promoting their own title) and 1 is a DroBoard platform ad.
  const AD_CYCLE = ['book', 'book', 'book', 'book', 'platform'];

  function _buildPool() {
    // collections mode: pool is collections, no ads/writers, via CollectionData or DemoData
    if (_mode === 'collections') {
      var cols = (window.CollectionData && typeof CollectionData.getCollections === 'function')
        ? null // async — handled in open() via async fetch, fallback sync below
        : (window.DemoData && DemoData.COLLECTIONS ? DemoData.COLLECTIONS : []);
      if (cols) return cols.map(function(col){ return Object.assign({ type:'collection' }, col); });
      return [];
    }
    // continueReading mode: pool is CONTINUE_READING with progress
    if (_mode === 'continueReading') {
      var cr = (window.DemoData && DemoData.CONTINUE_READING ? DemoData.CONTINUE_READING : []);
      if (cr && cr.length) return cr.map(function(it){ return Object.assign({ type:'continue' }, it); });
      return [];
    }
    let expanded = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const base = _stories[i % _stories.length];
      expanded.push(Object.assign({ type: 'story' }, base, { id: base.id + '-' + i, img: c(i) }));
    }
    if (_mode === 'genre' && _filter !== 'all') {
      expanded = expanded.filter(s => s.genre === _filter);
    }

    const withExtras = [];
    let adI = 0;
    let writerRowPlaced = false;
    expanded.forEach((s, i) => {
      withExtras.push(s);

      // One top-writers row, inserted once near the top of the list view.
      if (!writerRowPlaced && i === 3) {
        withExtras.push({ type: 'writers', id: 'writers-row' });
        writerRowPlaced = true;
      }

      if ((i + 1) % AD_INTERVAL === 0) {
        const kind = AD_CYCLE[adI % AD_CYCLE.length];
        if (kind === 'platform') {
          const ad = PLATFORM_ADS[adI % PLATFORM_ADS.length];
          withExtras.push(Object.assign({ type: 'platformAd', id: 'pad-' + adI, img: c(adI + 2) }, ad));
        } else {
          const ad = BOOK_ADS[adI % BOOK_ADS.length];
          withExtras.push(Object.assign({ type: 'bookAd', id: 'bad-' + adI, img: c(adI + 7) }, ad));
        }
        adI++;
      }
    });
    return withExtras;
  }

  /* ═══════════════════════ CARD MARKUP ═══════════════════════ */
  // Grid mode (section browsing) — story / bookAd / platformAd tiles.
  function _gridCardHTML(item) {
    if (item.type === 'platformAd') {
      return `<div class="bro-card bro-gold-border" data-bro-ad='${_esc(JSON.stringify(item))}'>
        <div class="bro-card-cover"><span class="bro-card-badge bro-badge-gold">Ad</span><img src="${_esc(item.img)}" loading="lazy" alt=""/></div>
        <div class="bro-card-title">${_esc(item.title)}</div>
        <div class="bro-card-author">${_esc(item.sponsor || 'DroBoard')}</div>
      </div>`;
    }
    const isBookAd = item.type === 'bookAd';
    const badge = isBookAd
      ? `<span class="bro-card-badge bro-badge-gold">Promoted</span>`
      : (item.badge ? `<span class="bro-card-badge">${_esc(item.badge)}</span>` : '');
    return `<div class="bro-card${isBookAd ? ' bro-gold-border' : ''}" data-bro-story='${_esc(JSON.stringify(item))}'>
      <div class="bro-card-cover"><img src="${_esc(item.img)}" loading="lazy" alt=""/>${badge}</div>
      <div class="bro-card-title">${_esc(item.title)}</div>
      <div class="bro-card-author">${_esc(item.author || '')}</div>
    </div>`;
  }

  // List mode (genre browsing) — story / bookAd / platformAd / writers-row.
  function _authorLink(item) {
    const handle = (item.author || '').replace('@', '');
    return `<a class="bro-list-stat bro-list-author" href="profile.html?u=${_esc(handle)}" onclick="event.stopPropagation()">${_esc(item.author || '')}</a>`;
  }

  function _platformAdHTML(item) {
    return `<div class="bro-list-item bro-ad" data-bro-ad='${_esc(JSON.stringify(item))}'>
      <div class="bro-list-cover"><span class="bro-ad-tag">Ad</span><img src="${_esc(item.img)}" loading="lazy" alt=""/></div>
      <div class="bro-list-body">
        <div class="bro-list-genre">${_esc(item.sponsor || 'DroBoard')}</div>
        <div class="bro-list-title">${_esc(item.title)}</div>
        <div class="bro-ad-cta">${_esc(item.cta || 'Learn More')}</div>
      </div>
    </div>`;
  }

  function _writersRowHTML() {
    return `<div class="bro-writers-row">
      <div class="bro-writers-head">Top Writers</div>
      <div class="bro-writers-scroll">
        ${TOP_WRITERS.map(w => `<a class="bro-writer" href="profile.html?u=${_esc(w.handle)}">
          <img class="bro-writer-avatar" src="${_esc(w.avatar)}" loading="lazy" alt=""/>
          <div class="bro-writer-name">${_esc(w.name)}</div>
        </a>`).join('')}
      </div>
    </div>`;
  }

  function _collectionHTML(item) {
    // covers comes from DemoData.COLLECTIONS.covers (array of 4 urls) — fallback to cover single
    var covers = item.covers || item.coverGrid || (item.cover ? [item.cover] : []);
    if (covers.length === 1 && item.covers && item.covers.length === 1) { /* keep single handling */ }
    var covHtml = '';
    if (!covers.length) covHtml = '<div class="dcc-cov empty" style="background:#f3f1f5;height:110px"></div>';
    else if (covers.length === 1) covHtml = '<div class="dcc-cov single"><img src="'+_esc(covers[0])+'" loading="lazy" alt=""/></div>';
    else covHtml = covers.slice(0,4).map(function(c){ return '<div class="dcc-cov"><img src="'+_esc(c)+'" loading="lazy" alt=""/></div>'; }).join('');
    var priv = (item.privacy||'Public').toLowerCase();
    var cnt = item.stories || item.storyList || item.count;
    if (Array.isArray(cnt)) cnt = cnt.length;
    return '<div class="dcc-card" data-bro-collection=\''+_esc(JSON.stringify(item))+'\' style="cursor:pointer">' +
      '<div class="dcc-covers">'+covHtml+'</div>' +
      '<div class="dcc-info"><div class="dcc-name">'+_esc(item.title||item.name||'')+'</div>' +
      '<div class="dcc-meta"><span>'+_esc((cnt||0)+' stories')+'</span><span class="dcc-priv '+priv+'">'+_esc(item.privacy||'Public')+'</span></div></div></div>';
  }

  function _continueHTML(item){
    return '<div class="bro-list-item" data-bro-story=\''+_esc(JSON.stringify({id:item.id,title:item.title}))+'\' style="cursor:pointer">' +
      '<div class="bro-list-cover" style="position:relative"><img src="'+_esc(item.cover||item.img||'')+'" loading="lazy" alt=""/><div style="position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.2)"><div style="height:100%;background:#ff2d55;width:'+(item.pct||0)+'%"></div></div></div>' +
      '<div class="bro-list-body"><div class="bro-list-title">'+_esc(item.title||'')+'</div><div class="bro-list-preview">'+_esc((item.ch||'')+' · '+(item.pct||0)+'%')+'</div></div></div>';
  }

  function _listItemHTML(item) {
    if (item.type === 'continue') return _continueHTML(item);
    if (item.type === 'collection') return _collectionHTML(item);
    if (item.type === 'writers') return _writersRowHTML();
    if (item.type === 'platformAd') return _platformAdHTML(item);

    const isBookAd = item.type === 'bookAd';
    return `<div class="bro-list-item${isBookAd ? ' bro-book-ad' : ''}" data-bro-story='${_esc(JSON.stringify(item))}'>
      <div class="bro-list-cover">${isBookAd ? '<span class="bro-ad-tag">Promoted</span>' : ''}<img src="${_esc(item.img)}" loading="lazy" alt=""/></div>
      <div class="bro-list-body">
        <div class="bro-list-title">${_esc(item.title)}</div>
        ${item.preview ? `<div class="bro-list-preview">${_esc(item.preview)}</div>` : ''}
        <div class="bro-list-foot">
          ${_authorLink(item)}
          ${item.rating ? `<div class="bro-list-stat"><i class="fas fa-star" style="color:#f59e0b"></i> ${_esc(item.rating)}</div>` : ''}
          ${item.chapters ? `<div class="bro-list-stat"><i class="fas fa-book-open"></i> ${item.chapters} ch</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ═══════════════════════ PROMO SLIDER ═══════════════════════ */
  function _renderPromo() {
    const track = _root.querySelector('#broPromoTrack');
    const dots = _root.querySelector('#broPromoDots');
    track.innerHTML = PROMO.map(s => `
      <div class="bro-promo-slide" style="background-image:url('${_esc(s.img)}')">
        <div class="bro-promo-scrim"></div>
        <div class="bro-promo-text">
          <div class="bro-promo-eyebrow">Promoted</div>
          <div class="bro-promo-title">${_esc(s.title)}</div>
          <div class="bro-promo-author">by ${_esc(s.author)}</div>
        </div>
        <div class="bro-promo-cta">${_esc(s.cta)}</div>
      </div>`).join('');
    dots.innerHTML = PROMO.map((_, i) => `<div class="bro-promo-dot${i === 0 ? ' on' : ''}"></div>`).join('');
  }
  function _goPromo(i) {
    const n = PROMO.length; if (!n) return;
    _promoIndex = (i + n) % n;
    _root.querySelector('#broPromoTrack').style.transform = `translateX(-${_promoIndex * 100}%)`;
    _root.querySelectorAll('.bro-promo-dot').forEach((d, idx) => d.classList.toggle('on', idx === _promoIndex));
  }
  function _startPromo() { _stopPromo(); _promoTimer = setInterval(() => _goPromo(_promoIndex + 1), 3400); }
  function _stopPromo() { if (_promoTimer) clearInterval(_promoTimer); }

  /* ═══════════════════════ BUILD (once) ═══════════════════════ */
  function _build() {
    if (_built) return;
    _built = true;
    _injectStyles();

    _root = document.createElement('div');
    _root.className = 'bro-root';
    _root.innerHTML = `
      <div class="bro-topbar">
        <div class="bro-toprow">
          <button class="bro-back" aria-label="Close"><i class="fas fa-arrow-left"></i></button>
          <div class="bro-title" id="broTitle">Browse</div>
        </div>
      </div>
      <div class="bro-scroll" id="broScroll">
        <div class="bro-promo-row">
          <div class="bro-promo" id="broPromo">
            <div class="bro-promo-track" id="broPromoTrack"></div>
            <div class="bro-promo-dots" id="broPromoDots"></div>
          </div>
        </div>
        <div class="bro-genre-bar" id="broGenreBar">
          ${GENRES.map(g => `<button class="bro-genre-pill${g.id === 'all' ? ' on' : ''}" data-bro-genre="${g.id}">${g.label}</button>`).join('')}
        </div>
        <div id="broContent"></div>
        <div class="bro-empty" id="broEmpty">
          <div class="bro-empty-icon">📚</div>
          <div class="bro-empty-title">No stories found</div>
          <div class="bro-empty-body">Try a different genre to find something you'll love.</div>
        </div>
        <div class="bro-loader hidden" id="broLoader"><div class="bro-spinner"></div> Loading more…</div>
        <div class="bro-sentinel" id="broSentinel"></div>
      </div>
    `;
    document.body.appendChild(_root);

    _scrollEl = _root.querySelector('#broScroll');
    _listEl = _root.querySelector('#broContent');
    _genreBarEl = _root.querySelector('#broGenreBar');
    _titleEl = _root.querySelector('#broTitle');
    _loaderEl = _root.querySelector('#broLoader');
    _sentinelEl = _root.querySelector('#broSentinel');
    _emptyEl = _root.querySelector('#broEmpty');

    _renderPromo();
    _bindEvents();
  }

  function _bindEvents() {
    _root.querySelector('.bro-back').addEventListener('click', close);

    _genreBarEl.addEventListener('click', e => {
      const pill = e.target.closest('[data-bro-genre]');
      if (!pill) return;
      _setFilter(pill.dataset.broGenre);
    });

    _listEl.addEventListener('click', e => {
      const collEl = e.target.closest('[data-bro-collection]');
      if (collEl) { try { var col = JSON.parse(collEl.dataset.broCollection); location.href = 'collection.html?id=' + encodeURIComponent(col.id); } catch (_) {} return; }
      const storyEl = e.target.closest('[data-bro-story]');
      if (storyEl) { try { _hooks.onOpenStory(JSON.parse(storyEl.dataset.broStory)); } catch (_) {} return; }
      const adEl = e.target.closest('[data-bro-ad]');
      if (adEl) { try { _hooks.onAdClick(JSON.parse(adEl.dataset.broAd)); } catch (_) {} }
    });

    // rootMargin lets the next page start fetching before the user hits bottom.
    _observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) _loadNext();
    }, { root: null, rootMargin: '0px 0px 600px 0px', threshold: 0 });
    _observer.observe(_sentinelEl);

    const promoEl = _root.querySelector('#broPromo');
    promoEl.addEventListener('mouseenter', _stopPromo);
    promoEl.addEventListener('mouseleave', _startPromo);
    let startX = 0, deltaX = 0;
    promoEl.addEventListener('touchstart', e => { _stopPromo(); startX = e.touches[0].clientX; }, { passive: true });
    promoEl.addEventListener('touchmove', e => { deltaX = e.touches[0].clientX - startX; }, { passive: true });
    promoEl.addEventListener('touchend', () => {
      if (Math.abs(deltaX) > 40) _goPromo(_promoIndex + (deltaX < 0 ? 1 : -1));
      deltaX = 0; _startPromo();
    });

    let touchStartY = 0;
    _scrollEl.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
    _scrollEl.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dy > 80 && _scrollEl.scrollTop === 0) close();
    }, { passive: true });
  }

  function _setFilter(g) {
    if (g === _filter) return;
    _filter = g;
    _genreBarEl.querySelectorAll('[data-bro-genre]').forEach(p => p.classList.toggle('on', p.dataset.broGenre === g));
    _reset();
  }

  /* ═══════════════════════ PAGINATION / INFINITE SCROLL ═══════════════════════ */
  function _reset() {
    _page = 1; _loading = false;
    _listEl.className = _mode === 'collections' ? 'dcc-grid' : 'bro-list';
    // inject collection grid CSS once when needed
    if (_mode === 'collections' && !document.getElementById('dcc-style')) {
      var s = document.createElement('style'); s.id='dcc-style';
      s.textContent='.dcc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px}.dcc-card{background:#fff;border:1px solid #ebebed;border-radius:14px;overflow:hidden;cursor:pointer}.dcc-covers{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;height:110px;padding:8px 8px 0}.dcc-cov{border-radius:6px;overflow:hidden;background:#f3f1f5}.dcc-cov img{width:100%;height:100%;object-fit:cover}.dcc-cov.single{grid-column:1/-1;grid-row:1/-1}.dcc-cov.empty{background:#f3f1f5}.dcc-info{padding:10px 12px 12px}.dcc-name{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dcc-meta{font-size:10px;color:#8e8e93;display:flex;gap:6px}.dcc-priv{font-size:8px;font-weight:700;padding:2px 6px;border-radius:6px;text-transform:uppercase}.dcc-priv.public{background:rgba(52,211,153,.1);color:#0d9668}.dcc-priv.private{background:rgba(255,0,80,.08);color:#ff2d55}';
      document.head.appendChild(s);
    }
    _listEl.innerHTML = '';
    _emptyEl.classList.remove('show');
    _loaderEl.classList.add('hidden');
    // collections is async via CollectionData — fetch then continue
    if (_mode === 'collections' && window.CollectionData && typeof CollectionData.getCollections === 'function') {
      CollectionData.getCollections().then(function(cols){
        _pool = (cols||[]).map(function(c){ return Object.assign({type:'collection'}, c); });
        _hasMore = _pool.length > 0;
        _loadNext();
      });
      _pool = []; _hasMore = false; return;
    }
    _pool = _buildPool();
    _hasMore = _pool.length > 0;
    _loadNext();
  }

  async function _loadNext() {
    if (_loading || !_hasMore) return;
    _loading = true;
    _loaderEl.classList.remove('hidden');
    _loaderEl.innerHTML = '<div class="bro-spinner"></div> Loading more…';

    // Simulated background fetch — the IntersectionObserver rootMargin means
    // this typically starts well before the user reaches the bottom.
    await new Promise(r => setTimeout(r, 450));

    const start = (_page - 1) * PAGE_SIZE;
    const items = _pool.slice(start, start + PAGE_SIZE);
    _page++;
    _hasMore = start + PAGE_SIZE < _pool.length;

    if (_page === 2 && items.length === 0) {
      _emptyEl.classList.add('show');
      _loaderEl.classList.add('hidden');
      _loading = false;
      return;
    }

    const html = items.map(s => _listItemHTML(s)).join('');
    _listEl.insertAdjacentHTML('beforeend', html);

    if (!_hasMore) {
      _loaderEl.innerHTML = "✓ You've seen everything here";
    } else {
      _loaderEl.classList.add('hidden');
    }
    _loading = false;
  }

  /* ═══════════════════════ PUBLIC API ═══════════════════════ */
  function open(opts) {
    opts = opts || {};
    _build();

    if (opts.mode === 'collections' || opts.mode === 'continueReading') _mode = opts.mode;
    else _mode = opts.mode === 'genre' ? 'genre' : (opts.mode === 'section' ? 'section' : (opts.filter ? 'genre' : 'section'));
    _title = opts.title || (_mode === 'genre' ? 'Browse Stories' : 'Browse');
    _filter = _mode === 'genre' ? (opts.filter || 'all') : 'all';

    _titleEl.textContent = _title;
    _genreBarEl.style.display = 'none';
    _genreBarEl.querySelectorAll('[data-bro-genre]').forEach(p => p.classList.toggle('on', p.dataset.broGenre === _filter));

    _root.classList.add('open');
    document.body.style.overflow = 'hidden';
    _isOpen = true;

    _goPromo(0);
    _startPromo();
    _reset();
  }

  function close() {
    if (!_built) return;
    _root.classList.remove('open');
    document.body.style.overflow = '';
    _isOpen = false;
    _stopPromo();
  }

  function isOpen() { return _isOpen; }

  window.BrowseOverlay = { open, close, isOpen, configure };

  /* ═══════════════════════ ZERO-JS TRIGGER ═══════════════════════ */
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-browse-trigger]');
    if (!trigger) return;
    e.preventDefault();
    const mode = trigger.dataset.browseMode || (trigger.dataset.browseFilter ? 'genre' : 'section');
    open({
      title: trigger.dataset.browseTitle || '',
      mode,
      filter: trigger.dataset.browseFilter || 'all',
    });
  });
})();

/* ─── HTML ATTRIBUTE REFERENCE ────────────────────────────────────────────
  Genre tab / genre tile / "All Stories" grid icon:
    data-browse-trigger data-browse-mode="genre"
    data-browse-title="Werewolf" data-browse-filter="werewolf"

  "View All ›" link on a feed section (Trending, Romance, Continue Reading…):
    data-browse-trigger data-browse-mode="section"
    data-browse-title="Trending Today"

  NOTE: All views now render as a list (not grid) for consistent browsing.
─────────────────────────────────────────────────────────────────────────── */