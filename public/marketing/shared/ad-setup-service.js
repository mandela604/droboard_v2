/* ===============================================================
   AD SETUP SERVICE — full-page ad setup (call-and-render).
   Page (ad-setup.html) is markup + mounts only; all logic lives here.
   Steps: 1 Format → 2 Creative → 3 Placement → 4 Audience →
   5 Schedule → 6 Review, with a sticky live preview fed by the same
   ad-card / promo-slider components client pages use.
   ?edit=<format>:<id> edits an existing ad. Save goes through
   MarketingData.saveAd (dro_ads_override in demo, API when live).
   =============================================================== */
(function () {
  'use strict';

  var STEPS = ['Goal', 'Creative', 'Placement', 'Audience', 'Schedule', 'Review'];
  var D = window.AdSetupData || {};
  var GOALS = D.GOALS || [];
  var FORMATS = D.FORMATS || [];
  var PAGES = D.PAGES || [];
  var FIELDS = D.FIELDS || {};
  var SEGMENTS = D.SEGMENTS || [];
  var GENRES = D.GENRES || [];
  var COUNTRIES = D.TRACKED_COUNTRIES || [];
  var SEG_MAP = {};
  SEGMENTS.forEach(function (s) { SEG_MAP[s.id] = s; });

  var _step = 0;
  var _draft = null;
  var _campaigns = [];
  var _editId = null;
  var _imgDataUrl = '';
  var _promoHandle = null;
  var _saving = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtN(n) { return Number(n || 0).toLocaleString('en-US'); }
  function $(id) { return document.getElementById(id); }
  function toast(m) {
    var t = $('suToast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function setErr(m) { var el = $('suErr'); if (el) el.textContent = m || ''; }
  function adTitleOf(f) { return (f && (f.title || f.heading || f.headline || f.brand || f.name)) || ''; }

  function blankDraft(format) {
    return {
      format: format || 'platform', fields: {}, campaign: '',
      pages: PAGES.map(function (p) { return p.id; }),
      segments: [], genres: [], countries: [], offerRef: null,
      startDate: '', endDate: '', active: true,
    };
  }
  function draftFromAd(ad, format) {
    var d = blankDraft(format);
    if (!ad) return d;
    (FIELDS[d.format] || []).forEach(function (f) {
      if (ad[f[0]] != null) d.fields[f[0]] = String(ad[f[0]]);
    });
    if (ad.url != null) d.fields.url = String(ad.url);
    d.campaign = ad.campaign || '';
    d.pages = Array.isArray(ad.pages) && ad.pages.length ? ad.pages.slice() : PAGES.map(function (p) { return p.id; });
    var aud = ad.audience || {};
    d.segments = Array.isArray(aud.segments) ? aud.segments.filter(function (id) { return !!SEG_MAP[id]; }) : [];
    d.genres = Array.isArray(aud.genres) ? aud.genres.slice() : [];
    d.countries = Array.isArray(aud.countries) ? aud.countries.slice() : [];
    d.offerRef = (ad.offerRef && ad.offerRef.id) ? { kind: ad.offerRef.kind || 'offer', id: String(ad.offerRef.id), name: ad.offerRef.name || ad.offerRef.id } : null;
    d.startDate = ad.startDate || '';
    d.endDate = ad.endDate || '';
    d.active = ad.active !== false;
    return d;
  }

  /* ── Step bodies ── */
  function bodyFormat() {
    return '<div class="fmt-grid">' + FORMATS.map(function (f) {
      return '<button type="button" class="fmt-card' + (_draft.format === f.id ? ' on' : '') + '" data-fmt="' + f.id + '">' +
        '<i class="fas ' + f.icon + '"></i>' +
        '<div><div class="fmt-t">' + esc(f.label) + '</div><div class="fmt-d">' + esc(f.desc) + '</div></div>' +
      '</button>';
    }).join('') + '</div>';
  }
  function bodyCreative() {
    var fmt = _draft.format;
    // Search boxes are tied to format: stories on book, offers on
    // platform, users on follow. Nothing else shows a search.
    var html = '';
    if (fmt === 'book') {
      html += '<label class="f-lbl">Promote a platform story (fills the form)' +
        '<input class="f-inp" id="suStorySearch" placeholder="Search title or author…" value=""/></label>' +
        '<div class="story-hits" id="suStoryHits"></div>';
    }
    if (fmt === 'platform') {
      html += '<label class="f-lbl">Promote a Finance offer (fills the form — coin package, bundle or subscription)' +
        '<input class="f-inp" id="suOfferPickSearch" placeholder="Search offers…" value=""/></label>' +
        '<div class="story-hits" id="suOfferPickHits"></div>';
    }
    if (fmt === 'follow') {
      html += '<label class="f-lbl">Promote a user (fills the form)' +
        '<input class="f-inp" id="suUserSearch" placeholder="Search name or handle…" value=""/></label>' +
        '<div class="story-hits" id="suUserHits"></div>';
    }
    html += (FIELDS[fmt] || []).map(function (f) {
      var key = f[0], label = f[1], type = f[2];
      var val = _draft.fields[key] || '';
      if (type === 'area') return '<label class="f-lbl">' + esc(label) + '<textarea class="f-inp" data-k="' + key + '" rows="2">' + esc(val) + '</textarea></label>';
      if (type === 'img') {
        return '<label class="f-lbl">' + esc(label) +
          '<input class="f-inp" data-k="' + key + '" value="' + esc(val) + '" placeholder="https://…"/>' +
          '<span class="f-row"><input type="file" id="suFile" accept="image/*" class="f-file"/>' +
          '<img id="suImgPreview" class="f-preview" src="' + esc(val) + '" style="' + (val ? '' : 'display:none') + '"/></span></label>';
      }
      return '<label class="f-lbl">' + esc(label) + '<input class="f-inp" data-k="' + key + '" value="' + esc(val) + '"/></label>';
    }).join('');
    html += '<label class="f-lbl">Destination URL — where readers go when they tap the card or CTA' +
      '<input class="f-inp" data-k="url" value="' + esc(_draft.fields.url || '') + '" placeholder="https://…"/></label>';
    if (fmt === 'embed') {
      html += '<div style="font-size:11px;line-height:1.5;color:#b45309;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:8px 10px;margin-top:8px">Only paste from ad networks you trust. Async tags work; legacy document.write tags do not.</div>' +
        '<div style="margin-top:10px"><div style="font-size:11px;font-weight:800;color:var(--text-muted);margin-bottom:6px">Live preview (sandboxed)</div>' +
        '<iframe id="suEmbedPreview" title="Ad preview" sandbox="allow-scripts" style="width:100%;min-height:120px;border:1px solid var(--input-border);border-radius:8px;background:#fff"></iframe></div>';
    }
    return html;
  }
  function bodyPlacement() {
    var html = '<label class="f-lbl">Campaign (optional)' +
      '<select class="f-inp" id="suCampaign"><option value="">No campaign</option>' +
      _campaigns.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(_draft.campaign || '') ? ' selected' : '') + '>' + esc(c.name || c.id) + '</option>';
      }).join('') + '</select></label>';
    html += '<div class="f-lbl" style="margin-bottom:6px">Shows on</div><div class="pg-row">' +
      PAGES.map(function (p) {
        return '<label class="pg-check"><input type="checkbox" data-pg="' + p.id + '"' + (_draft.pages.indexOf(p.id) !== -1 ? ' checked' : '') + '/> ' + esc(p.label) + '</label>';
      }).join('') + '</div>';
    return html;
  }
  function reachLabel(est) {
    var bits = [];
    if (est.sets) bits.push(est.sets + ' targeting set' + (est.sets === 1 ? '' : 's'));
    if (_draft.countries.length) bits.push(_draft.countries.join(', '));
    return 'Estimated reach' + (bits.length ? ' · ' + bits.join(' · ') : ' · everyone (no targeting)');
  }
  function bodyAudience() {
    var est = D.estimateAudience({ segments: _draft.segments, genres: _draft.genres, countries: _draft.countries });
    var html = '<div class="f-lbl" style="margin-bottom:6px">Behavior segments (multi-select)</div>' +
      '<div class="seg-grid">' + SEGMENTS.map(function (s) {
        var on = _draft.segments.indexOf(s.id) !== -1;
        return '<button type="button" class="seg-card' + (on ? ' on' : '') + '" data-seg="' + s.id + '">' +
          '<div class="seg-top"><i class="fas ' + s.icon + '" style="color:' + s.color + '"></i>' +
          '<span class="seg-t">' + esc(s.label) + '</span>' +
          '<span class="seg-r">~' + fmtN(s.reach) + '</span></div>' +
          '<div class="seg-d">' + esc(s.desc) + '</div>' +
        '</button>';
      }).join('') + '</div>';
    html += '<div class="f-lbl" style="margin:12px 0 6px">Genre audiences (multi-select, optional)</div>' +
      '<div class="chips">' + GENRES.map(function (g) {
        var on = _draft.genres.indexOf(g.name) !== -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-gen="' + esc(g.name) + '">' + esc(g.name) + ' · ' + fmtN(g.count) + '</button>';
      }).join('') + '</div>';
    html += '<div class="f-lbl" style="margin:12px 0 6px">Countries (tracked only — scales reach, empty = all)</div>' +
      '<div class="chips">' + COUNTRIES.map(function (c) {
        var on = _draft.countries.indexOf(c.code) !== -1;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-country="' + c.code + '">' + esc(c.name) + '</button>';
      }).join('') + '</div>';
    html += '<div class="f-lbl" style="margin:12px 0 6px">Promoted offer</div>' +
      '<div id="suOfferPicked">' + offerPickedHtml() + '</div>' +
      '<div style="font-size:10.5px;color:var(--text-faint);margin-top:2px">Offers attach in Step 2 Creative — bundles live under the Platform format, never here.</div>';
    html += '<div class="reach"><div class="reach-n">~' + fmtN(est.reach) + '</div>' +
      '<div class="reach-l">' + esc(reachLabel(est)) + '</div></div>';
    return html;
  }
  function offerPickedHtml() {
    var r = _draft.offerRef;
    if (!r) return '<div style="font-size:11px;color:var(--text-faint)">No offer attached — pick one in Step 2 (Platform format).</div>';
    return '<span class="picked-chip">' + esc(r.name) +
      ' <span style="opacity:.75">(' + esc(r.kind) + ')</span>' +
      ' <button type="button" data-offer-clear="1">Remove</button></span>';
  }
  function bodySchedule() {
    return '<div style="display:flex;gap:10px">' +
        '<label class="f-lbl" style="flex:1">Start date<input type="date" class="f-inp" id="suStart" value="' + esc(_draft.startDate) + '"/></label>' +
        '<label class="f-lbl" style="flex:1">End date<input type="date" class="f-inp" id="suEnd" value="' + esc(_draft.endDate) + '"/></label>' +
      '</div>' +
      '<label class="pg-check" style="margin-top:4px"><input type="checkbox" id="suActive"' + (_draft.active ? ' checked' : '') + '/> Live immediately</label>' +
      '<div style="font-size:11px;color:var(--text-faint);margin-top:8px">A dated schedule means “not live right now” — Live gets unchecked automatically.</div>';
  }
  function offerText() {
    var r = _draft.offerRef;
    if (!r) return 'None';
    return r.name + ' (' + r.kind + ')';
  }
  function bodyReview() {
    var f = { label: _draft.format };
    FORMATS.forEach(function (x) { if (x.id === _draft.format) f = x; });
    var title = adTitleOf(_draft.fields);
    var camp = '';
    _campaigns.forEach(function (c) { if (String(c.id) === String(_draft.campaign)) camp = c.name || c.id; });
    var est = D.estimateAudience({ segments: _draft.segments, genres: _draft.genres, countries: _draft.countries });
    var audLine = !_draft.segments.length && !_draft.genres.length
      ? 'Everyone (no targeting)'
      : _draft.segments.map(function (id) { return SEG_MAP[id] ? SEG_MAP[id].label : id; })
        .concat(_draft.genres.map(function (g) { return g + ' readers'; })).join(', ');
    if (_draft.countries.length) audLine += ' · ' + _draft.countries.join(', ');
    var sched = (_draft.startDate || _draft.endDate) ? ((_draft.startDate || '…') + ' → ' + (_draft.endDate || '…')) : 'Always on';
    return '<div class="rev">' +
      '<div><b>Format:</b> ' + esc(f.label) + '</div>' +
      '<div><b>Creative:</b> ' + esc(title || '(untitled)') + '</div>' +
      '<div><b>Destination:</b> ' + esc(_draft.fields.url || '—') + '</div>' +
      '<div><b>Shows on:</b> ' + esc(_draft.pages.join(', ') || '—') + '</div>' +
      '<div><b>Audience:</b> ' + esc(audLine) + ' (~' + fmtN(est.reach) + ')</div>' +
      '<div><b>Offer:</b> ' + esc(offerText()) + '</div>' +
      '<div><b>Campaign:</b> ' + esc(camp || 'None') + '</div>' +
      '<div><b>Schedule:</b> ' + esc(sched) + (_draft.active ? ' · Live' : ' · Off') + '</div>' +
    '</div>';
  }

  /* ── Live preview (sticky aside, updates on every change) ── */
  function esc2(s) { return esc(s == null ? '' : s); }
  function fallbackCard(ad, format) {
    var img = esc2(ad.img || ad.cover || ad.image || ad.avatar);
    var imgHtml = img ? '<img src="' + img + '" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover"/>' : '';
    var open = '<div style="display:flex;gap:12px;background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0">';
    if (format === 'book') {
      return '<div style="display:flex;gap:12px;background:#fdf7e6;border:1.5px solid #c9a227;border-radius:12px;padding:12px;margin:8px 0">' +
        '<div style="width:80px;height:110px;border-radius:8px;overflow:hidden;flex-shrink:0;border:1.5px solid #c9a227;background:#eee">' + imgHtml + '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0">' +
          '<div style="font-size:9px;font-weight:800;color:#c9a227;text-transform:uppercase">' + esc2(ad.genre || ad.cat || 'Story') + '</div>' +
          '<div style="font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.3">' + esc2(ad.title || 'Untitled') + '</div>' +
          (ad.preview ? '<div style="font-size:11px;color:#666">' + esc2(ad.preview) + '</div>' : '') +
          '<div style="font-size:10px;color:#888">by ' + esc2(ad.author || '') +
          (ad.rating ? ' · ★ ' + esc2(ad.rating) : '') + (ad.chapters ? ' · ' + esc2(ad.chapters) + ' ch' : '') + '</div>' +
          '<div><span style="display:inline-block;background:#c9a227;color:#fff;font-size:10px;font-weight:800;padding:6px 14px;border-radius:16px">' + esc2(ad.cta || 'Read Now') + '</span></div>' +
        '</div></div>';
    }
    if (format === 'platform') {
      return open +
        '<div style="width:76px;height:102px;border-radius:9px;overflow:hidden;flex-shrink:0;background:#f5f5f5;position:relative">' + imgHtml + '</div>' +
        '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0">' +
          '<div style="font-size:9px;font-weight:800;color:#999;text-transform:uppercase">' + esc2(ad.sponsor || 'DroBoard') + '</div>' +
          '<div style="font-size:13.5px;font-weight:700;color:#1a1a1a">' + esc2(ad.title || 'Untitled') + '</div>' +
          '<div><span style="display:inline-block;font-size:10.5px;font-weight:800;color:#fff;background:#ff2d55;padding:5px 12px;border-radius:14px">' + esc2(ad.cta || 'Learn More') + '</span></div>' +
        '</div></div>';
    }
    if (format === 'banner') {
      return '<div style="background:linear-gradient(135deg,#ff2d55,#d6165A);border-radius:12px;padding:16px;color:#fff;margin:8px 0">' +
        '<div style="font-size:10px;font-weight:800;opacity:.8;text-transform:uppercase;margin-bottom:6px">' + esc2(ad.brand || 'DroBoard') + '</div>' +
        '<div style="font-size:16px;font-weight:800;margin-bottom:4px">' + esc2(ad.headline || ad.title || 'Untitled') + '</div>' +
        (ad.sub ? '<div style="font-size:11px;opacity:.8;margin-bottom:12px">' + esc2(ad.sub) + '</div>' : '') +
        '<div><span style="display:inline-block;background:#fff;color:#d6165a;font-size:11px;font-weight:800;padding:8px 18px;border-radius:20px">' + esc2(ad.cta || 'Learn More') + '</span></div></div>';
    }
    if (format === 'follow') {
      var avHtml = '<div style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#eee">' + (ad.avatar ? '<img src="' + esc2(ad.avatar) + '" loading="lazy" alt="" style="width:100%;height:100%;object-fit:cover"/>' : '') + '</div>';
      var infoHtml = '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:#1a1a1a">' + esc2(ad.name || 'Untitled') + '</div>' +
        '<div style="font-size:10px;color:#888">' + esc2(ad.tagline || ad.handle || '') + '</div>' +
        (ad.headline ? '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-top:4px">' + esc2(ad.headline) + '</div>' : '') +
        (ad.body ? '<div style="font-size:11px;color:#666;margin-top:2px">' + esc2(ad.body) + '</div>' : '') + '</div>';
      var ctaHtml = '<div><span style="display:inline-block;background:#ff2d55;color:#fff;font-size:10px;font-weight:800;padding:6px 14px;border-radius:16px">' + esc2(ad.cta || 'Follow') + '</span></div>';
      if (ad.cover) {
        return '<div style="background:#fff;border:1px solid #e5e5ea;border-radius:12px;overflow:hidden;margin:8px 0">' +
          '<div style="height:110px;background-size:cover;background-position:center;background-color:#1a0a14;background-image:url(' + esc2(ad.cover) + ')"></div>' +
          '<div style="display:flex;gap:12px;padding:12px;align-items:center">' + avHtml + infoHtml + ctaHtml + '</div></div>';
      }
      return open + avHtml + infoHtml + ctaHtml + '</div>';
    }
    if (format === 'native') {
      return '<div style="background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin:8px 0">' +
        '<div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:8px">' + esc2(ad.brand || 'Sponsored') + '</div>' +
        (img && (ad.image || ad.img) ? '<div style="width:100%;height:180px;border-radius:8px;overflow:hidden;margin-bottom:10px;background:#f5f5f5">' + imgHtml + '</div>' : '') +
        '<div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:4px">' + esc2(ad.heading || ad.title || 'Untitled') + '</div>' +
        (ad.body ? '<div style="font-size:12px;color:#666;margin-bottom:10px">' + esc2(ad.body) + '</div>' : '') +
        '<div><span style="display:inline-block;background:#ff2d55;color:#fff;font-size:11px;font-weight:800;padding:8px 16px;border-radius:20px">' + esc2(ad.cta || 'Learn More') + '</span></div></div>';
    }
    if (format === 'promo') {
      return '<div style="position:relative;border-radius:14px;overflow:hidden;background-size:cover;background-position:center;background-color:#1a0a14' + (ad.img ? ';background-image:url(' + esc2(ad.img) + ')' : '') + '">' +
        '<div style="background:linear-gradient(90deg,rgba(10,6,14,.85) 0%,rgba(10,6,14,.45) 60%,rgba(10,6,14,.1) 100%);display:flex;align-items:center;gap:10px;padding:14px 12px">' +
        '<div style="flex:1;min-width:0"><div style="font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ff9db8;margin-bottom:3px">Promoted</div>' +
        '<div style="font-size:12.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc2(ad.title || 'Untitled') + '</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,.72)">' + (ad.author ? 'by ' + esc2(ad.author) : '') + '</div></div>' +
        '<div><span style="display:inline-block;background:#fff;color:#D6165A;font-size:10px;font-weight:800;padding:7px 13px;border-radius:16px">' + esc2(ad.cta || 'Read Now') + '</span></div>' +
        '</div></div>';
    }
    return '';
  }
  function previewCardHtml() {
    var ad = Object.assign({ id: 'su-preview' }, _draft.fields);
    var C = window.DroboardAdCard;
    var html = '';
    if (C && typeof C.renderBanner === 'function') {
      try {
        if (_draft.format === 'platform') html = C.renderPlatform(ad) || '';
        else if (_draft.format === 'book') html = C.renderListBook(ad) || '';
        else if (_draft.format === 'native') html = C.renderNative(ad) || '';
        else if (_draft.format === 'banner') html = C.renderBanner(ad) || '';
        else if (_draft.format === 'follow') html = C.renderFollowPromo(ad) || '';
        else if (_draft.format === 'embed') html = C.renderEmbed(ad) || '';
      } catch (e) { html = ''; }
    }
    if (!html && _draft.format !== 'promo') html = fallbackCard(ad, _draft.format);
    if (_draft.format === 'promo') html = '<div id="suPromoMount">' + fallbackCard(ad, 'promo') + '</div>';
    if (!html) html = '<div style="font-size:12px;color:#b91c1c">Nothing to preview yet.</div>';
    return html;
  }
  function forPillsHtml() {
    var bits = _draft.segments.map(function (id) { return SEG_MAP[id] ? SEG_MAP[id].label : id; })
      .concat((_draft.genres || []).map(function (g) { return g; }));
    var c = (_draft.countries || []).slice();
    return '<span class="pv-pill">For: ' + esc(bits.length ? bits.join(' · ') : 'Everyone') + '</span>' +
      (c.length ? ' <span class="pv-pill">' + esc(c.join(', ')) + '</span>' : '');
  }
  function updatePreview() {
    try {
      if (_promoHandle && _promoHandle.stop) { try { _promoHandle.stop(); } catch (e) {} _promoHandle = null; }
      var forEl = $('pvFor');
      if (forEl) forEl.innerHTML = forPillsHtml();
      var card = $('pvCard');
      if (!card) return;
      card.innerHTML = previewCardHtml();
      var C = window.DroboardAdCard;
      if (_draft.format === 'embed' && C && C.hydrateEmbeds) C.hydrateEmbeds(card);
      if (_draft.format === 'promo' && window.DroboardPromoSlider) {
        var ad = Object.assign({ id: 'su-preview' }, _draft.fields);
        var mount = document.getElementById('suPromoMount');
        if (mount) {
          _promoHandle = DroboardPromoSlider.mount('#suPromoMount', {
            slides: [{ title: ad.title || 'Untitled', author: ad.author || '', cta: ad.cta || 'Read Now', img: ad.img || '', eyebrow: 'Promoted' }],
            onSelect: function () {},
          });
        }
      }
      if (C && typeof C.attach === 'function') C.attach(card, { onCta: function () { openPreviewUrl(); } });
    } catch (err) {
      try { console.error('[AdSetup] preview failed:', err); } catch (e2) {}
    }
  }
  function openPreviewUrl() {
    var url = (_draft && _draft.fields && _draft.fields.url) || '';
    if (url) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} return; }
    try {
      var note = $('pvNote');
      if (note) note.textContent = 'Add a destination URL in Step 2 and this card will open it.';
    } catch (e2) {}
  }

  /* ── Finance offers + story library ── */
  function financeOffers() {
    var out = [];
    var seen = {};
    var push = function (kind, arr) {
      (arr || []).forEach(function (o) {
        if (!o || !o.id || seen[kind + ':' + o.id]) return;
        seen[kind + ':' + o.id] = true;
        var price = (o.prices && (o.prices.USD || o.prices.NGN || o.prices.GBP))
          || (o.priceUSD != null ? '$' + Number(o.priceUSD).toFixed(2) : null)
          || o.price || '';
        out.push({
          kind: kind, id: String(o.id),
          name: o.name || o.id,
          detail: [o.coins != null ? Number(o.coins).toLocaleString('en-US') + ' coins' : null,
                   o.durationDays ? o.durationDays + ' days' : null, price].filter(Boolean).join(' · '),
        });
      });
    };
    try {
      push('pack', JSON.parse(localStorage.getItem('dro_finance_packs') || '[]'));
      push('bundle', JSON.parse(localStorage.getItem('dro_finance_bundles') || '[]'));
      push('sub', JSON.parse(localStorage.getItem('dro_finance_subs') || '[]'));
    } catch (e) {}
    return out;
  }
  function storySource() {
    var d = window.DemoData || {};
    return Array.isArray(d.STORIES) ? d.STORIES : [];
  }
  function fillFromStory(s) {
    var set = function (key, val) {
      var el = document.querySelector('#suBody [data-k="' + key + '"]');
      if (el && val != null) el.value = val;
    };
    set('title', s.title);
    set('author', s.author);
    set('genre', (s.cat || s.genre || '').replace(/^[^\s]+\s/, ''));
    set('preview', s.desc || s.preview);
    set('chapters', s.chapters);
    set('img', s.cover);
    _imgDataUrl = '';
    collect();
    render();
  }
  function userSource() {
    var d = window.DemoData || {};
    var users = d.USERS || {};
    return Object.keys(users).map(function (k) {
      var u = users[k] || {};
      return { name: u.name || u.handle || k, handle: u.handle || ('@' + k), avatar: u.avatar || '', tagline: u.bio || '' };
    });
  }
  function fillFromUser(u) {
    var set = function (key, val) {
      var el = document.querySelector('#suBody [data-k="' + key + '"]');
      if (el && val != null) el.value = val;
    };
    set('name', u.name);
    set('handle', u.handle);
    set('tagline', (u.tagline || '').slice(0, 90));
    set('avatar', u.avatar);
    _imgDataUrl = '';
    collect();
    render();
  }
  function firstFieldKey(candidates) {
    var keys = (FIELDS[_draft.format] || []).map(function (f) { return f[0]; });
    for (var i = 0; i < candidates.length; i++) {
      if (keys.indexOf(candidates[i]) !== -1) return candidates[i];
    }
    return null;
  }
  function fillFromOffer(o) {
    // Coin/sub offers promote on PLATFORM format — never on a story card.
    if (_draft.format !== 'platform') {
      _draft.format = 'platform';
      toast('Switched to Platform format for this offer');
    }
    var set = function (key, val) {
      var el = document.querySelector('#suBody [data-k="' + key + '"]');
      if (el && val != null) el.value = val;
    };
    var titleKey = firstFieldKey(['title', 'heading', 'headline', 'name']);
    var detailKey = firstFieldKey(['preview', 'body', 'sub', 'tagline']);
    var ctaKey = firstFieldKey(['cta']);
    _draft.fields.sponsor = o.name;
    if (titleKey) _draft.fields[titleKey] = o.name;
    if (detailKey) _draft.fields[detailKey] = o.detail || '';
    if (ctaKey) _draft.fields[ctaKey] = 'Get Offer';
    _draft.fields.url = 'store.html';
    _draft.offerRef = { kind: o.kind, id: o.id, name: o.name };
    collect();
    render();
  }
  function renderHits(boxId, hits, kind) {
    var box = $(boxId);
    if (!box) return;
    box.innerHTML = hits.length ? hits.map(function (o, i) {
      var img = o.cover || o.avatar || '';
      var t = (kind === 'story' || kind === 'user')
        ? '<div style="font-size:12px;font-weight:800">' + esc(kind === 'story' ? o.title : o.name) + '</div>' +
          '<div style="font-size:10.5px;color:var(--text-faint)">' + esc(kind === 'story' ? (o.author || '') : (o.handle || '')) + '</div>'
        : '<div style="font-size:12px;font-weight:800">' + esc(o.name) + '</div>' +
          '<div style="font-size:10.5px;color:var(--text-faint)">' + esc(o.kind) + (o.detail ? ' · ' + esc(o.detail) : '') + '</div>';
      return '<button type="button" class="story-hit" data-hit="' + i + '">' +
        (img ? '<img src="' + esc(img) + '" loading="lazy" alt=""/>' : '') + '<div style="flex:1;min-width:0">' + t + '</div></button>';
    }).join('') : '<div style="font-size:11.5px;color:var(--text-faint);padding:6px 2px">No matches' +
      (kind !== 'story' && kind !== 'user' ? ' — create one in Finance → Coin Transactions.' : '.') + '</div>';
    box._hits = hits;
    box.querySelectorAll('[data-hit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hit = (box._hits || [])[+btn.dataset.hit];
        if (!hit) return;
        if (kind === 'story') { fillFromStory(hit); return; }
        if (kind === 'user') {
          fillFromUser(hit);
          var usi = $('suUserSearch');
          if (usi) usi.value = hit.name || '';
          var uob = $('suUserHits');
          if (uob) uob.innerHTML = '';
          return;
        }
        if (kind === 'attach') {
          _draft.offerRef = { kind: hit.kind, id: hit.id, name: hit.name };
          render();
          return;
        }
        fillFromOffer(hit);
        var si = $('suOfferPickSearch');
        if (si) si.value = hit.name || '';
        var ob = $('suOfferPickHits');
        if (ob) ob.innerHTML = '';
      });
    });
  }

  /* ── Render + wire ── */
  var BODIES = [bodyFormat, bodyCreative, bodyPlacement, bodyAudience, bodySchedule, bodyReview];
  function render() {
    $('suTitle').textContent = (_editId ? 'Edit ad' : 'New ad') + ' · ' + (_step + 1) + ' of ' + STEPS.length;
    $('suSteps').innerHTML = STEPS.map(function (s, i) {
      return '<div class="su-step' + (i === _step ? ' on' : '') + (i < _step ? ' done' : '') + '" data-goto="' + i + '">' + s + '</div>';
    }).join('');
    $('suSteps').querySelectorAll('[data-goto]').forEach(function (el) {
      el.addEventListener('click', function () {
        var t = +el.dataset.goto;
        if (t < _step) { collect(); _step = t; render(); }
        else if (t === _step + 1) next();
      });
    });
    $('suStepLbl').textContent = 'Step ' + (_step + 1) + ': ' + STEPS[_step];
    $('suBody').innerHTML = BODIES[_step]();
    $('suBackBtn').style.visibility = _step === 0 ? 'hidden' : 'visible';
    $('suNextBtn').textContent = _step === STEPS.length - 1 ? 'Save ad' : 'Continue';
    setErr('');
    wireStep();
    updatePreview();
  }
  function collect() {
    var body = $('suBody');
    if (_step === 1) {
      body.querySelectorAll('[data-k]').forEach(function (el) { _draft.fields[el.dataset.k] = el.value.trim(); });
    }
    if (_step === 2) {
      var camp = $('suCampaign');
      _draft.campaign = camp ? camp.value : '';
      _draft.pages = Array.prototype.map.call(
        body.querySelectorAll('[data-pg]:checked'), function (el) { return el.dataset.pg; });
    }
    if (_step === 4) {
      _draft.startDate = $('suStart').value || '';
      _draft.endDate = $('suEnd').value || '';
      _draft.active = $('suActive').checked;
    }
    // steps 0/3/5 mutate the draft live; nothing to collect.
  }
  function validate() {
    if (_step === 1 && !adTitleOf(_draft.fields)) { setErr('Give the ad a title first.'); return false; }
    if (_step === 2 && !_draft.pages.length) { setErr('Pick at least one surface.'); return false; }
    return true;
  }
  function next() {
    collect();
    if (!validate()) return;
    if (_step < STEPS.length - 1) { _step++; render(); return; }
    submit();
  }
  function submit() {
    if (_saving) return;
    _saving = true;
    var btn = $('suNextBtn');
    btn.textContent = 'Saving…';
    btn.disabled = true;
    var payload = {
      format: _draft.format,
      campaign: _draft.campaign || '',
      pages: _draft.pages.slice(),
      startDate: _draft.startDate,
      endDate: _draft.endDate,
      active: _draft.active,
      audience: { segments: _draft.segments.slice(), genres: _draft.genres.slice(), countries: (_draft.countries || []).slice() },
    };
    if (_draft.offerRef && _draft.offerRef.id) {
      payload.offerRef = { kind: _draft.offerRef.kind, id: _draft.offerRef.id, name: _draft.offerRef.name };
    }
    Object.keys(_draft.fields).forEach(function (k) { payload[k] = _draft.fields[k]; });
    var imgField = (FIELDS[_draft.format] || []).filter(function (f) { return f[2] === 'img'; })[0];
    if (imgField && _imgDataUrl) payload[imgField[0]] = _imgDataUrl;
    if (_draft.format === 'book') payload.isBook = true;
    if (_editId) payload.id = _editId;
    var reset = function () { _saving = false; btn.textContent = 'Save ad'; btn.disabled = false; };
    MarketingData.saveAd(payload.format, payload).then(function () {
      toast('✅ Ad saved — serving on client pages');
      setTimeout(function () { window.location.href = 'ad-manager.html'; }, 500);
    }).catch(function () {
      reset();
      setErr('Could not save ad.');
    });
  }

  function wireStep() {
    var body = $('suBody');
    if (_step === 0) {
      body.querySelectorAll('[data-fmt]').forEach(function (b) {
        b.addEventListener('click', function () {
          _draft.format = b.dataset.fmt;
          body.querySelectorAll('[data-fmt]').forEach(function (x) { x.classList.toggle('on', x === b); });
          updatePreview();
        });
      });
    }
    if (_step === 1) {
      body.querySelectorAll('[data-k]').forEach(function (el) {
        el.addEventListener('input', function () {
          _draft.fields[el.dataset.k] = el.value.trim();
          updatePreview();
          if (el.dataset.k === 'code') renderEmbedPreview();
        });
      });
      var si = $('suStorySearch');
      if (si) si.addEventListener('input', function () {
        var q = si.value.trim().toLowerCase();
        if (!q) { $('suStoryHits').innerHTML = ''; return; }
        renderHits('suStoryHits', storySource().filter(function (s) {
          return ((s.title || '').toLowerCase().indexOf(q) !== -1) || ((s.author || '').toLowerCase().indexOf(q) !== -1);
        }).slice(0, 6), 'story');
      });
      var opSi = $('suOfferPickSearch');
      if (opSi) opSi.addEventListener('input', function () {
        var q = opSi.value.trim().toLowerCase();
        if (!q) { $('suOfferPickHits').innerHTML = ''; return; }
        renderHits('suOfferPickHits', financeOffers().filter(function (o) {
          return o.name.toLowerCase().indexOf(q) !== -1 || o.id.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 6), 'offer');
      });
      var usSi = $('suUserSearch');
      if (usSi) usSi.addEventListener('input', function () {
        var q = usSi.value.trim().toLowerCase();
        if (!q) { $('suUserHits').innerHTML = ''; return; }
        renderHits('suUserHits', userSource().filter(function (u) {
          return ((u.name || '').toLowerCase().indexOf(q) !== -1) || ((u.handle || '').toLowerCase().indexOf(q) !== -1);
        }).slice(0, 6), 'user');
      });
      var file = $('suFile');
      if (file) file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          _imgDataUrl = r.result;
          var pv = $('suImgPreview');
          if (pv) { pv.src = r.result; pv.style.display = 'block'; }
          updatePreview();
        };
        r.readAsDataURL(f);
      });
      renderEmbedPreview();
    }
    if (_step === 3) {
      var toggle = function (list, v) {
        var i = list.indexOf(v);
        if (i === -1) list.push(v);
        else list.splice(i, 1);
        render();
      };
      body.querySelectorAll('[data-seg]').forEach(function (b) {
        b.addEventListener('click', function () { toggle(_draft.segments, b.dataset.seg); });
      });
      body.querySelectorAll('[data-gen]').forEach(function (b) {
        b.addEventListener('click', function () { toggle(_draft.genres, b.dataset.gen); });
      });
      body.querySelectorAll('[data-country]').forEach(function (b) {
        b.addEventListener('click', function () { toggle(_draft.countries, b.dataset.country); });
      });
      var clear = body.querySelector('[data-offer-clear]');
      if (clear) clear.addEventListener('click', function () {
        _draft.offerRef = null;
        render();
      });
    }
    if (_step === 4) {
      var syncLive = function () {
        var dated = !!($('suStart').value || $('suEnd').value);
        if (dated) $('suActive').checked = false;
      };
      $('suStart').addEventListener('change', syncLive);
      $('suEnd').addEventListener('change', syncLive);
    }
  }
  function renderEmbedPreview() {
    var codeArea = document.querySelector('#suBody textarea[data-k="code"]');
    var fr = $('suEmbedPreview');
    if (!codeArea || !fr) return;
    fr.srcdoc = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:8px;font-family:sans-serif}</style></head><body>' + (codeArea.value || '') + '</body></html>';
  }

  /* ── Boot ── */
  async function init() {
    if (window.MarketingSidebar) {
      MarketingSidebar.attach('#setupRoot', {
        activeItem: 'ad-manager',
        title: 'Ad setup',
        subtitle: 'Create or edit an ad — preview updates live',
        user: { name: 'Tari Benson', role: 'Marketing Lead', avatar: 'https://i.pravatar.cc/100?img=32' },
        notifCount: 5,
      });
    }
    try {
      var params = new URLSearchParams(location.search);
      var edit = params.get('edit') || '';
      var m = edit.match(/^([^:]+):(.+)$/);
      if (m) {
        var inv = await MarketingData.getAdInventory();
        var found = ((inv.pools || {})[m[1]] || []).find(function (a) { return String(a.id) === String(m[2]); });
        if (found) {
          _editId = found.id;
          _draft = draftFromAd(Object.assign({ format: m[1] }, JSON.parse(JSON.stringify(found))), m[1]);
        }
      }
    } catch (e) {}
    if (!_draft) {
      var fmt = 'platform';
      try {
        var f0 = new URLSearchParams(location.search).get('format');
        if (f0 && FIELDS[f0]) fmt = f0;
      } catch (e2) {}
      _draft = blankDraft(fmt);
    }
    try { _campaigns = await MarketingData.getCampaigns(); } catch (e3) { _campaigns = []; }
    render();
    $('suBackBtn').addEventListener('click', function () {
      collect();
      if (_step > 0) { _step--; render(); }
    });
    $('suCancelBtn').addEventListener('click', function () { window.location.href = 'ad-manager.html'; });
    $('suExitBtn').addEventListener('click', function () { window.location.href = 'ad-manager.html'; });
    $('suNextBtn').addEventListener('click', next);
    var veil = $('pvVeil');
    if (veil) veil.addEventListener('click', openPreviewUrl);
  }

  window.AdSetupPage = { init: init };
})();
