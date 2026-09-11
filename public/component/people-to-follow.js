(function () {
  'use strict';

  /* ─── CONFIG ─────────────────────────────────────────────── */

  /**
   * Default people data.
   * Replace this array — or pass your own via options.people — to feed
   * real data from your API. Each object supports:
   *   id         {string}  unique id — REQUIRED if you want status-ring / viewer support
   *   name       {string}  display name / handle (without @)
   *   av         {string}  avatar image URL (alias: `avatar` also accepted)
   *   verified   {boolean} show blue verified tick
   *   rank       {string}  small label shown under name (e.g. "#1 This Week")
   *   following  {boolean} initial follow state
   *   profileUrl {string}  where tapping the avatar navigates when there's no status to show
   *                        (default: profile.html)
   *
   *   ring       {string}  'ring-has' | 'ring-live' | 'ring-viewed' | 'ring-none'
   *                        Drawn as a colored ring around the avatar, same visual
   *                        language as WRITER_STATUSES in post-data.js. Optional —
   *                        defaults to 'ring-none' if `statuses` has entries, else no ring.
   *   isLive     {boolean} shows a pulsing live dot on the avatar
   *   statuses   {array}   same shape status-viewer.js expects:
   *                        [{ bg, quote, caption, time }, ...]
   *                        If present and non-empty, tapping the avatar opens
   *                        openStatusViewer() instead of navigating to a profile.
   */
  const DEFAULT_PEOPLE = [
    { name:'Ada_Writes',   av:'https://i.pravatar.cc/100?img=32', verified:true,  rank:'#1 This Week', following:false, profileUrl:'profile.html' },
    { name:'Ifeanyi_Story',av:'https://i.pravatar.cc/100?img=53', verified:true,  rank:'#2 This Week', following:false, profileUrl:'profile.html' },
    { name:'Chiamaka_N',   av:'https://i.pravatar.cc/100?img=43', verified:false, rank:'Rising',        following:false, profileUrl:'profile.html' },
    { name:'Efe_O',        av:'https://i.pravatar.cc/100?img=22', verified:true,  rank:'Top Elegy',     following:false, profileUrl:'profile.html' },
    { name:'Zara_M',       av:'https://i.pravatar.cc/100?img=16', verified:false, rank:'🔥 Hot',         following:false, profileUrl:'profile.html' },
    { name:'CampusQueen',  av:'https://i.pravatar.cc/100?img=12', verified:false, rank:'Campus',         following:false, profileUrl:'profile.html' },
    { name:'Dami_Cole',    av:'https://i.pravatar.cc/100?img=64', verified:false, rank:'New',            following:false, profileUrl:'profile.html' },
    { name:'Kemi_A',       av:'https://i.pravatar.cc/100?img=28', verified:false, rank:'💔 Heartbreak',  following:false, profileUrl:'profile.html' },
  ];

  /* ─── STYLES ──────────────────────────────────────────────── */
  const CSS = `
.ptf-wrap{padding:14px 14px 12px;background:var(--l1,#08090c);border-top:1px solid var(--bd,rgba(255,255,255,.07));border-bottom:1px solid var(--bd,rgba(255,255,255,.07))}
.ptf-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ptf-title{font-size:10px;font-weight:800;color:var(--tx-muted,#71717a);text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;gap:5px;font-family:'DM Sans',sans-serif}
.ptf-see-all{font-size:10px;font-weight:700;color:var(--acc3,#ff7a9a);cursor:pointer;padding:3px 8px;border-radius:10px;background:rgba(255,0,80,.06);border:1px solid rgba(255,0,80,.18);font-family:'DM Sans',sans-serif;transition:.15s}
.ptf-see-all:active{background:rgba(255,0,80,.14)}
.ptf-row{display:flex;gap:16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}
.ptf-row::-webkit-scrollbar{display:none}
.ptf-person{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;min-width:56px;font-family:'DM Sans',sans-serif}

/* ── Avatar + status ring ── */
.ptf-av-wrap{position:relative;width:52px;height:52px}
.ptf-ring{width:100%;height:100%;border-radius:50%;padding:2.2px;box-sizing:border-box;transition:background .2s}
 .ptf-ring.ring-has{background:conic-gradient(var(--acc,#ff0050),var(--acc2,#ff4d7a),var(--acc3,#ff7a9a),var(--acc,#ff0050))}
.ptf-ring.ring-live{background:conic-gradient(var(--acc,#ff0050),var(--acc2,#ff4d7a),var(--acc3,#ff7a9a),var(--acc,#ff0050))}
.ptf-ring.ring-viewed{background:var(--tx-faint,#3f3f46)}
.ptf-ring.ring-none{background:var(--l3,#13141a)}
.ptf-ring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:var(--bg,#000)}
.ptf-av{width:100%;height:100%;object-fit:cover;display:block;cursor:pointer;border-radius:50%}
.ptf-av-initial{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--acc3,#ff7a9a);background:rgba(255,0,80,.1);cursor:pointer}
.ptf-live-dot{position:absolute;bottom:0;right:0;width:14px;height:14px;border-radius:50%;background:var(--acc,#ff0050);border:2.5px solid var(--bg,#000);display:flex;align-items:center;justify-content:center;font-size:6px;color:#fff;animation:ptfPulse 1.4s ease-in-out infinite;pointer-events:none}
@keyframes ptfPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
.ptf-verified{position:absolute;top:-1px;right:-1px;width:15px;height:15px;border-radius:50%;background:#38bdf8;border:2px solid var(--bg,#000);display:flex;align-items:center;justify-content:center;font-size:6px;color:#fff;font-weight:900;pointer-events:none}

.ptf-name{font-size:9.5px;font-weight:700;color:var(--tx-muted,#71717a);text-align:center;max-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ptf-rank{font-size:8px;font-weight:600;color:var(--tx-faint,#3f3f46);text-align:center;max-width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ptf-btn{font-size:8px;font-weight:800;color:var(--acc,#ff0050);background:rgba(255,0,80,.08);border:1px solid rgba(255,0,80,.2);border-radius:8px;padding:3px 8px;cursor:pointer;white-space:nowrap;transition:.15s;font-family:'DM Sans',sans-serif}
.ptf-btn:active{transform:scale(.93)}
.ptf-btn.ptf-following{background:rgba(255,255,255,.05);border-color:var(--bd,rgba(255,255,255,.07));color:var(--tx-muted,#71717a)}
`;

  /* ─── TOAST (shared if page has one; fallback if not) ─────── */
  function _toast(msg) {
    // Re-use the page's existing toast if available
    const existing = document.getElementById('toast');
    if (existing) {
      existing.textContent = msg;
      existing.classList.add('show');
      clearTimeout(existing._ptft);
      existing._ptft = setTimeout(() => existing.classList.remove('show'), 2500);
      return;
    }
    // Fallback: create a minimal one-off toast
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#13141a;color:#e0e0e0;padding:8px 18px;border-radius:28px;font-size:12px;font-weight:600;z-index:9999;border:1px solid rgba(255,255,255,.08);font-family:"DM Sans",sans-serif;pointer-events:none;opacity:0;transition:.28s';
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2400);
  }

  /* ─── INJECT STYLES (once per page) ──────────────────────── */
  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'ptf-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ─── HELPERS ─────────────────────────────────────────────── */
  function _avatarUrl(p) {
    return p.av || p.avatar || null;
  }

  function _hasStatuses(p) {
    return Array.isArray(p.statuses) && p.statuses.length > 0;
  }

  function _ringClass(p) {
    if (p.ring) return p.ring;
    return _hasStatuses(p) ? 'ring-has' : 'ring-none';
  }

  /* ─── BUILD HTML ──────────────────────────────────────────── */
  function _buildAvatar(p, i) {
    const av = _avatarUrl(p);
    const ring = _ringClass(p);
    const inner = av
      ? `<img class="ptf-av" src="${av}" loading="lazy" alt="${p.name}"/>`
      : `<div class="ptf-av-initial">${(p.name || '?')[0].toUpperCase()}</div>`;

    return `
      <div class="ptf-av-wrap" data-ptf-avatar="${i}">
        <div class="ptf-ring ${ring}">
          <div class="ptf-ring-inner">${inner}</div>
        </div>
        ${p.isLive ? '<div class="ptf-live-dot"><i class="fas fa-signal" style="font-size:5px"></i></div>' : ''}
        ${p.verified ? '<div class="ptf-verified"><i class="fas fa-check"></i></div>' : ''}
      </div>`;
  }

  function _buildHTML(people, options) {
    const title  = options.title    || 'People to Follow';
    const seeAll = options.seeAllUrl || null;
    const max    = options.maxVisible || people.length;
    const visible = people.slice(0, max);

    const cards = visible.map((p, i) => `
      <div class="ptf-person" data-ptf-index="${i}">
        ${_buildAvatar(p, i)}
        <div class="ptf-name" onclick="location.href='${p.profileUrl || ('profile.html?u=' + encodeURIComponent(p.name || ''))}'">@${p.name}</div>
        ${p.rank ? `<div class="ptf-rank">${p.rank}</div>` : ''}
        <button class="ptf-btn${p.following ? ' ptf-following' : ''}"
                data-ptf-follow="${i}">
          ${p.following ? 'Following' : '+ Follow'}
        </button>
      </div>`).join('');

    const seeAllBtn = seeAll
      ? `<button class="ptf-see-all" onclick="location.href='${seeAll}'">See all</button>`
      : '';

    return `
      <div class="ptf-wrap">
        <div class="ptf-header">
          <div class="ptf-title">
            <i class="fas fa-user-plus" style="color:var(--acc,#ff0050);font-size:10px"></i>
            ${title}
          </div>
          ${seeAllBtn}
        </div>
        <div class="ptf-row">${cards}</div>
      </div>`;
  }

  /* ─── ATTACH EVENTS ───────────────────────────────────────── */
  function _attachEvents(container, people, options) {
    // Avatar tap → open status viewer if this person has statuses,
    // otherwise fall back to profile navigation.
    container.querySelectorAll('[data-ptf-avatar]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const i = +el.dataset.ptfAvatar;
        const p = people[i];
        if (!p) return;

        if (_hasStatuses(p) && typeof window.openStatusViewer === 'function') {
          // Pass the full people list so the viewer can page between writers,
          // just like it does with WRITER_STATUSES on the feed.
          window.openStatusViewer(people, p.id);
          if (typeof options.onOpenStatus === 'function') options.onOpenStatus(p);
          return;
        }

  
      });
    });

    // Follow button
    container.querySelectorAll('[data-ptf-follow]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const i = +btn.dataset.ptfFollow;
        const p = people[i];
        if (!p) return;
        p.following = !p.following;
        btn.textContent = p.following ? 'Following' : '+ Follow';
        btn.classList.toggle('ptf-following', p.following);
        _toast(p.following ? `✅ Following @${p.name}` : `Unfollowed @${p.name}`);

        // Fire a custom event so the host page can react (e.g. update its own state)
        document.dispatchEvent(new CustomEvent('ptf:follow', {
          detail: { name: p.name, following: p.following, index: i, person: p }
        }));

        // Call optional onFollow callback
        if (typeof options.onFollow === 'function') {
          options.onFollow({ name: p.name, following: p.following, index: i, person: p });
        }
      });
    });
  }

  /* ─── STATUS-VIEWER SYNC ──────────────────────────────────────
     status-viewer.js marks a writer as viewed by calling the global
     window.onStatusViewerChange(wid, ring). We chain onto whatever
     handler is already there (e.g. one set by feed.html) so both the
     page's own status rings AND this component's rings stay in sync,
     without either overwriting the other. */
  function _wireStatusSync(people, container) {
    const prevHandler = window.onStatusViewerChange;

    window.onStatusViewerChange = function (wid, ring) {
      if (typeof prevHandler === 'function') prevHandler(wid, ring);

      const idx = people.findIndex(p => p.id === wid);
      if (idx === -1) return;

      people[idx].ring = ring;

      const wrapEl = container.querySelector(`[data-ptf-avatar="${idx}"] .ptf-ring`);
      if (wrapEl) {
        wrapEl.className = 'ptf-ring ' + _ringClass(people[idx]);
      }
    };

    return prevHandler; // so destroy() can restore it
  }

  /* ─── RENDER ──────────────────────────────────────────────── */
  /**
   * Render the component into a target element.
   *
   * @param {string|HTMLElement} target
   *   CSS selector string OR a DOM element.
   *   The component's HTML is injected as the CONTENTS of this element.
   *
   * @param {object} [options]
   * @param {Array}   options.people       Override the default people array.
   *                                       Items may include id/ring/isLive/statuses
   *                                       to enable the status-ring + viewer behavior.
   * @param {string}  options.title        Section heading (default: "People to Follow")
   * @param {string}  options.seeAllUrl    If set, shows a "See all" button linking here
   * @param {number}  options.maxVisible   Cap how many people are shown (default: all)
   * @param {string}  options.profileUrl   Fallback profile URL used when a person has
   *                                       no `statuses` and no own `profileUrl`
   * @param {Function} options.onFollow    Callback fired on follow/unfollow
   * @param {Function} options.onOpenStatus Callback fired when an avatar with statuses is tapped
   *
   * @returns {object} A small control object { refresh, destroy, getPeople }
   */
  function render(target, options) {
    options = options || {};

    _injectStyles();

    // Resolve target element
    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!container) {
      console.warn('[PeopleToFollow] Target not found:', target);
      return null;
    }

    const people = (options.people || DEFAULT_PEOPLE).map(p => Object.assign({}, p));

    // Write HTML
    container.innerHTML = _buildHTML(people, options);

    // Attach follow-button + avatar-tap events
    _attachEvents(container, people, options);

    // Keep ring state in sync with the shared status viewer
    const prevStatusHandler = _wireStatusSync(people, container);

    /* ── Public control object ── */
    return {

      /**
       * Re-render with updated people data.
       * Useful after an API call returns fresh data.
       * @param {Array} [newPeople]
       */
      refresh(newPeople) {
        if (newPeople) people.splice(0, people.length, ...newPeople.map(p => Object.assign({}, p)));
        container.innerHTML = _buildHTML(people, options);
        _attachEvents(container, people, options);
      },

      /**
       * Remove the component and clean up.
       */
      destroy() {
        container.innerHTML = '';
        window.onStatusViewerChange = prevStatusHandler;
      },

      /** Read current follow/ring states */
      getPeople() {
        return people.slice();
      },
    };
  }

  /* ─── PUBLIC API ──────────────────────────────────────────── */
  window.DroboardPeopleToFollow = { render, DEFAULT_PEOPLE };

  /*
  ─── USAGE ────────────────────────────────────────────────────

  1. Load status-viewer.js BEFORE this file if you want avatar taps
     to open statuses (optional — falls back to profile links otherwise):

       <script src="status-viewer.js"></script>
       <script src="people-to-follow.js"></script>

  2. Put a placeholder element wherever you want the component:

       <div id="ptf-placeholder"></div>

  3. Call render() after the DOM is ready:

       const ptf = DroboardPeopleToFollow.render('#ptf-placeholder');

  ── DRIVING IT FROM post-data.js's WRITER_STATUSES ─────────────

  post-data.js is NOT modified — WRITER_STATUSES already has
  id / ring / statuses. Just map its fields onto the shape this
  component expects (av, name, following, rank...) and pass the
  extra fields straight through:

       const people = WRITER_STATUSES
         .filter(w => !w.isYou)              // skip the "Your Story" entry
         .map(w => ({
           id:         w.id,
           name:       w.name,
           av:         w.avatar,
           ring:       w.ring,
           isLive:     w.isLive || false,
           statuses:   w.statuses,
           verified:   false,
           rank:       w.isLive ? '🔴 Live now' : null,
           following:  false,
           profileUrl: 'profile.html',
         }));

       DroboardPeopleToFollow.render('#ptf-placeholder', { people });

  Now tapping an avatar with statuses calls:
       openStatusViewer(people, person.id)
  exactly like the status-rings row does, and when status-viewer.js
  marks that writer's ring as 'ring-viewed', this component's own
  ring updates automatically (no page code required).

  ── OPTIONS ───────────────────────────────────────────────────

       DroboardPeopleToFollow.render('#ptf-placeholder', {

         // Swap in your own array (from an API, for example)
         people: myApiData,

         // Heading text
         title: 'Writers You Might Like',

         // Adds a "See all" button
         seeAllUrl: '/people.html',

         // Show only the first N people
         maxVisible: 5,

         // Fallback profile URL for people without statuses
         profileUrl: 'profile.html',

         // Called whenever someone follows or unfollows
         onFollow({ name, following, person }) {
           console.log(following ? 'Followed' : 'Unfollowed', name);
         },

         // Called whenever an avatar with statuses is tapped
         onOpenStatus(person) {
           console.log('Opened status for', person.name);
         },
       });

  ── CUSTOM EVENT ──────────────────────────────────────────────

       // Listen globally instead of (or in addition to) onFollow:
       document.addEventListener('ptf:follow', e => {
         const { name, following } = e.detail;
         myState.updateFollow(name, following);
       });

  ── REFRESHING AFTER AN API CALL ──────────────────────────────

       const ptf = DroboardPeopleToFollow.render('#ptf-placeholder');

       fetch('/api/suggested-writers')
         .then(r => r.json())
         .then(data => ptf.refresh(data));

  ── MULTIPLE INSTANCES ON ONE PAGE ────────────────────────────

       // Sidebar — compact, 4 people max
       DroboardPeopleToFollow.render('#sidebar-ptf', { maxVisible: 4 });

       // Mid-feed injection — full list
       DroboardPeopleToFollow.render('#feed-ptf', { title: 'Suggested for You' });

  ─────────────────────────────────────────────────────────────
  */

}());