/**
 * component/post-card.js — Droboard Feed Post Card
 * ─────────────────────────────────────────────────
 * Purpose-built for feed.html — covers exactly the post types the feed
 * renders (post, chapter-drop, ama, quote, repost, poll, debate, review,
 * recommendation, sponsored) using the SAME field shapes feed-data.js
 * already produces. No adapter/remapping needed.
 *
 * It reuses the host page's own CSS variables (--acc, --l1, --l2, --bd,
 * --tx-high, --tx-body, --tx-muted, --gold, --green, --purple, --blue,
 * --orange, --glow-sm) so it automatically matches feed.html's light/dark
 * theme — no separate [data-theme] override block needed here.
 *
 * USAGE (in feed.html):
 *
 *   <script src="component/post-card.js"></script>
 *   ...
 *   DroboardPostCard.attach(document.getElementById('feedList'), {
 *     getReactionHTML: (post) => DroboardReactionPicker.renderTrigger(post.id, { liked: post.liked, likeCount: post.likes }),
 *     renderSponsored: (post) => DroboardAdCard.renderNative(post.ad),
  *     onAvatarClick:  (post) => openStatusViewer(post),   // avatar → status
  *     onNameClick:    (post) => openProfile(post),     // username → profile
  *     onOpenPost:     (post) => openReader(post),      // post text tap → reader
  *     onComment:      (post) => toast('💬 Opening comments…'),
 *     onShare:        (post) => openShareModal({ ... }),
 *     onSave:         (post) => { ...open save-modal or toggle local bookmark... },
 *     onDots:         (post) => toast('More options…'),
 *     onJoinAma:      (post) => toast('🎙️ Joining AMA…'),
 *     onOpenLink:     (post) => toast('📖 Opening story…'),   // chapter-drop / repost / review / recommendation tap
  *     onPollVote:     (post, i) => { post.poll.opts[i].v++; post.poll.voted = i; DroboardPostCard.update(post); },
  *     onPredVote:     (post, i) => { post.prediction.opts[i].v++; post.prediction.voted = i; DroboardPostCard.update(post); },
  *     onDebateVote:   (post, side) => { ...; DroboardPostCard.update(post); },
 *   });
 *
 *   DroboardPostCard.setPosts(FEED_POSTS);   // full render
 *   DroboardPostCard.update(post);           // re-render one card in place (after a vote, a like, etc.)
 *
 * Sponsored posts (post.type === 'sponsored') are NOT rendered by this
 * component's own markup — it calls hooks.renderSponsored(post) and drops
 * the returned HTML in directly, same as feed.html's original DroboardAdCard
 * delegation. If renderSponsored isn't supplied, sponsored posts are skipped.
 */
(function () {
  'use strict';

  if (window.__droboardPostCardV2) return;
  window.__droboardPostCardV2 = true;

  // ══════════════════════════════════════════════════════════════════════
  // CSS — pcc- prefixed, reuses the host page's own CSS custom properties
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
    .pcc-post{width:100%;padding:14px 16px;border-bottom:8px solid var(--bg);background:var(--l1)}
    .pcc-post:last-child{border-bottom:none}

    .pcc-head{display:flex;align-items:center;gap:10px;margin-bottom:11px}
    .pcc-avatar-wrap{position:relative;flex-shrink:0}
    .pcc-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;display:block;cursor:pointer}
    .pcc-avatar-wrap.live .pcc-avatar{padding:2px;border:2px solid var(--acc);box-sizing:border-box}
    .pcc-avatar-wrap.viewed .pcc-avatar{padding:2px;border:2px solid var(--tx-faint,#9a9aa2);box-sizing:border-box}
    .pcc-pin-badge{position:absolute;top:-3px;left:-3px;width:16px;height:16px;border-radius:50%;background:var(--gold);color:#08090c;display:flex;align-items:center;justify-content:center;font-size:8px;border:2px solid var(--l1)}
    /* Verified badge — Twitter/X shape + color (#1d9bf0 scalloped seal), sitting
       in the avatar circle's bottom-right corner (not beside the name). The
       ring border matches the card background so it "cuts into" the avatar
       the same way platform verified badges do. */
    .pcc-verified-badge{position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;border-radius:50%;background:var(--l1);display:flex;align-items:center;justify-content:center;padding:1px;box-sizing:border-box}
    .pcc-verified-badge svg{width:100%;height:100%;display:block}
    .pcc-meta{flex:1;min-width:0}
    .pcc-name-row{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
    .pcc-name{font-size:14px;font-weight:700;color:var(--tx-high);cursor:pointer}
    .pcc-rank{font-size:9px;font-weight:800;color:var(--acc);background:rgba(255,0,80,.08);border:1px solid var(--bd-acc);padding:1px 7px;border-radius:8px;margin-left:2px}
    .pcc-time{font-size:11.5px;color:var(--tx-muted);margin-top:1px}
    .pcc-dots{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--tx-muted);cursor:pointer;flex-shrink:0;background:transparent;border:none;font-size:14px}
    .pcc-dots:active{background:rgba(127,127,127,.12)}

    .pcc-pill{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:800;letter-spacing:.01em;padding:5px 10px;border-radius:20px;margin-bottom:10px;border:1px solid}
    .pcc-pill i{font-size:10px}
    .pcc-pill-chapter{background:rgba(167,139,250,.08);color:var(--purple);border-color:rgba(167,139,250,.25)}
    .pcc-pill-ama{background:rgba(255,0,80,.08);color:var(--acc);border-color:var(--bd-acc)}
    .pcc-pill-quote{background:rgba(251,191,36,.08);color:#b57e00;border-color:rgba(251,191,36,.25)}
    .pcc-pill-repost{background:rgba(56,189,248,.08);color:#0284c7;border-color:rgba(56,189,248,.25)}
    .pcc-pill-poll{background:rgba(52,211,153,.08);color:#0d9668;border-color:rgba(52,211,153,.25)}
    .pcc-pill-prediction{background:rgba(167,139,250,.08);color:var(--purple);border-color:rgba(167,139,250,.25)}
    .pcc-pill-debate{background:rgba(251,146,60,.08);color:#c2610a;border-color:rgba(251,146,60,.25)}
    .pcc-pill-post{background:rgba(255,0,80,.08);color:var(--acc);border-color:var(--bd-acc)}
    .pcc-pill-review{background:rgba(251,191,36,.08);color:#b57e00;border-color:rgba(251,191,36,.25)}
    .pcc-pill-recommend{background:rgba(52,211,153,.08);color:#0d9668;border-color:rgba(52,211,153,.25)}

    .pcc-heading{font-size:15px;font-weight:700;color:var(--tx-high);line-height:1.35;margin-bottom:6px}
    .pcc-text{font-size:14px;line-height:1.55;margin-bottom:11px;color:var(--tx-body);white-space:pre-line}
    .pcc-text[data-pcc-openpost],.pcc-quote-text[data-pcc-openpost]{cursor:pointer}
    .pcc-text.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:normal}
    .pcc-readmore{font-size:13px;font-weight:700;color:var(--acc);cursor:pointer;margin:-6px 0 11px;display:inline-block;background:none;border:none;padding:0;font-family:inherit}
    .pcc-image{width:100%;border-radius:12px;margin-bottom:11px;max-height:160px;object-fit:cover;border:1px solid var(--bd);display:block;cursor:pointer}

    /* Shared horizontal story card (recommendation / chapter-drop / repost) */
    .pcc-story-card{display:flex;gap:12px;background:linear-gradient(135deg,rgba(52,211,153,.05),rgba(56,189,248,.04));border:1px solid rgba(52,211,153,.22);border-radius:13px;padding:11px;margin-bottom:4px;cursor:pointer}
    .pcc-story-card.chapter{background:linear-gradient(135deg,rgba(167,139,250,.06),rgba(255,0,80,.04));border-color:rgba(167,139,250,.25)}
    .pcc-story-card.repost{background:linear-gradient(135deg,rgba(56,189,248,.05),rgba(167,139,250,.04));border-color:rgba(56,189,248,.22)}
    .pcc-story-cover{width:58px;height:78px;border-radius:8px;flex-shrink:0;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,.1)}
    .pcc-story-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}
    .pcc-story-badge{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
    .pcc-story-badge.rec{color:#0d9668}
    /* Recommendation card — compact story promo (cover + genre + hook + author) */
    .pcc-rec-card{display:flex;gap:12px;background:#eef2f6;border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:12px;margin-bottom:4px;cursor:pointer}
    [data-theme="dark"] .pcc-rec-card{background:#121318;border-color:rgba(255,255,255,.08)}
    .pcc-rec-cover{width:56px;height:80px;border-radius:8px;flex-shrink:0;object-fit:cover}
    .pcc-rec-body{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}
    .pcc-rec-cat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#0d9668}
    .pcc-rec-text{font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:700;line-height:1.35;color:var(--tx-high);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .pcc-rec-by{font-size:12px;color:var(--tx-muted);font-weight:600}
    .pcc-story-badge.ch{color:var(--purple)}
    .pcc-story-badge.rp{color:#0284c7}
    .pcc-story-title{font-family:'Playfair Display',serif;font-size:13px;font-weight:700;line-height:1.3;color:var(--tx-high);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .pcc-story-author{font-size:10.5px;color:var(--tx-muted);font-weight:600}

    /* Chapter drop — now uses shared story-card shape */
    /* Quote */
    .pcc-quote{background:linear-gradient(135deg,rgba(255,0,80,.05),rgba(167,139,250,.05));border:1px solid var(--bd-acc);border-radius:14px;padding:20px 16px 16px;margin-bottom:11px;position:relative}
    .pcc-quote-mark{position:absolute;top:6px;left:14px;font-family:'Playfair Display',serif;font-size:38px;font-weight:900;color:var(--acc);opacity:.25;line-height:1}
    .pcc-quote-text{font-family:'Playfair Display',serif;font-style:italic;font-size:14.5px;font-weight:700;color:var(--tx-high);line-height:1.55;margin:10px 0 8px 8px}
    .pcc-quote-caption{font-size:11.5px;color:var(--tx-muted);font-weight:600;margin-left:8px}

    /* AMA */
    .pcc-ama{border-radius:14px;overflow:hidden;margin-bottom:11px;background:linear-gradient(135deg,rgba(255,0,80,.08),rgba(167,139,250,.05));border:1px solid var(--bd-acc);padding:16px}
    .pcc-ama-live-row{display:flex;align-items:center;gap:7px;margin-bottom:10px}
    .pcc-ama-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px var(--acc);animation:pccPulse 1.4s infinite}
    .pcc-ama-live-text{font-size:10px;font-weight:800;color:var(--acc);text-transform:uppercase;letter-spacing:.06em}
    .pcc-ama-viewers{font-size:10px;color:var(--tx-muted);margin-left:auto;font-weight:600;display:flex;align-items:center;gap:4px}
    .pcc-ama-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:var(--tx-high);margin-bottom:4px}
    .pcc-ama-meta{font-size:12px;color:var(--tx-body);line-height:1.5;margin-bottom:12px}
    .pcc-ama-join{background:var(--acc);color:#fff;border:none;padding:9px 16px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 0 14px var(--glow-sm);font-family:inherit}
    @keyframes pccPulse{0%,100%{opacity:1}50%{opacity:.3}}

    /* ── Engagement widgets (poll / prediction / debate) — mirrors the
       reader page's ReaderEngagement UI, but always expanded (no accordion).
       Uses the host page's CSS variables so it auto-themes light/dark. ── */
    .pcc-eng{border:1px solid var(--bd);border-radius:14px;overflow:hidden;margin-bottom:11px;background:var(--l2)}
    .pcc-eng-hdr{display:flex;align-items:center;gap:8px;padding:12px 14px}
    .pcc-eng-hdr-ico{font-size:14px;line-height:1}
    .pcc-eng-hdr-body{flex:1;min-width:0}
    .pcc-eng-hdr-title{font-size:12px;font-weight:800;color:var(--tx-high)}
    .pcc-eng-hdr-sub{font-size:10px;color:var(--tx-muted);margin-top:1px}
    .pcc-eng-panel{display:block;border-top:1px solid var(--bd)}
    .pcc-eng-q{padding:10px 14px 8px;font-size:13px;font-weight:700;color:var(--tx-high)}
    .pcc-eng-opts{padding:0 14px 6px}

    /* Poll */
    .pcc-eng-opt{position:relative;border-radius:10px;padding:10px 12px;overflow:hidden;border:1.5px solid var(--bd);margin-bottom:7px;cursor:pointer;transition:border-color .2s;user-select:none}
    .pcc-eng-opt:last-child{margin-bottom:0}
    .pcc-eng-opt.voted{border-color:#ff0050}
    .pcc-eng-opt-bar{position:absolute;left:0;top:0;bottom:0;background:rgba(255,0,80,.09);transition:width .6s cubic-bezier(.4,0,.2,1);z-index:0}
    .pcc-eng-opt-row{position:relative;z-index:1;display:flex;justify-content:space-between;gap:8px}
    .pcc-eng-opt-txt{font-size:12px;font-weight:600;color:var(--tx-body)}
    .pcc-eng-opt-pct{font-size:11px;font-weight:800;color:var(--acc)}
    .pcc-eng-opt-mine{color:var(--acc);font-weight:700}

    /* Prediction — purple accent */
    .pcc-eng.pred .pcc-eng-opt.voted{border-color:var(--purple)}
    .pcc-eng.pred .pcc-eng-opt-bar{background:rgba(167,139,250,.12)}
    .pcc-eng.pred .pcc-eng-opt-pct,.pcc-eng.pred .pcc-eng-opt-mine{color:var(--purple)}

    .pcc-eng-foot{padding:8px 14px;font-size:10px;color:var(--tx-muted);display:flex;justify-content:space-between;align-items:center}
    .pcc-eng-foot-link{color:var(--acc);font-weight:800;cursor:pointer}

    /* Debate — two side cards with bars + checkmark */
    .pcc-eng-deb-sides{display:flex;gap:8px;padding:0 14px 6px}
    .pcc-eng-deb-side{flex:1;position:relative;border-radius:12px;padding:10px 8px;text-align:center;border:2px solid var(--bd);cursor:pointer;overflow:hidden;transition:all .2s;user-select:none;display:flex;flex-direction:column}
    .pcc-eng-deb-side.for.chosen{border-color:#0d9668;background:rgba(52,211,153,.06)}
    .pcc-eng-deb-side.against.chosen{border-color:var(--acc);background:rgba(255,0,80,.06)}
    .pcc-eng-deb-check{position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:#0d9668;color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center}
    .pcc-eng-deb-side.against .pcc-eng-deb-check{background:var(--acc)}
    .pcc-eng-deb-em{font-size:20px;margin-bottom:4px;flex-shrink:0}
    .pcc-eng-deb-lbl{font-size:11px;font-weight:800;line-height:1.35;min-height:30px;display:flex;align-items:center;justify-content:center;margin-bottom:6px;flex:1}
    .pcc-eng-deb-side.for .pcc-eng-deb-lbl{color:#0d9668}
    .pcc-eng-deb-side.against .pcc-eng-deb-lbl{color:var(--acc)}
    .pcc-eng-deb-barwrap{height:4px;background:var(--bd);border-radius:4px;overflow:hidden;margin-bottom:5px}
    .pcc-eng-deb-bar{height:100%;border-radius:4px;transition:width .6s ease}
    .pcc-eng-deb-side.for .pcc-eng-deb-bar{background:#0d9668}
    .pcc-eng-deb-side.against .pcc-eng-deb-bar{background:var(--acc)}
    .pcc-eng-deb-pct{font-size:14px;font-weight:900;color:var(--tx-high)}
    .pcc-eng-deb-cnt{font-size:10px;color:var(--tx-muted);margin-top:2px}

    /* Review */
    .pcc-review{border:1px solid var(--bd);border-radius:13px;padding:12px;margin-bottom:11px;background:var(--l2)}
    .pcc-review-top{display:flex;gap:10px;margin-bottom:10px;cursor:pointer}
    .pcc-review-cover{width:40px;height:54px;border-radius:6px;flex-shrink:0;object-fit:cover}
    .pcc-review-storyinfo{flex:1;min-width:0}
    .pcc-review-storytitle{font-size:12px;font-weight:700;color:var(--tx-high);line-height:1.3;margin-bottom:3px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
    .pcc-review-author{font-size:10px;color:var(--tx-faint);margin-bottom:4px}
    .pcc-review-stars{display:flex;align-items:center;gap:2px}
    .pcc-review-stars i{font-size:11px;color:var(--gold)}
    .pcc-review-stars i.empty{color:var(--bd)}
    .pcc-review-score{font-size:11px;font-weight:800;color:#b57e00;margin-left:4px}
    .pcc-review-body{font-size:13px;line-height:1.55;color:var(--tx-body)}

    /* Actions */
    .pcc-actions{display:flex;align-items:center;justify-content:space-between;padding-top:11px;border-top:1px solid var(--bd)}
    .pcc-action-group{display:flex;align-items:center;gap:8px}
    .pcc-action{display:flex;align-items:center;gap:6px;color:var(--tx-muted);cursor:pointer;background:var(--bg);border:none;font-family:inherit;padding:6px 11px;border-radius:20px}
    .pcc-action:active{background:var(--l4,#e8e8e8)}
    [data-theme="dark"] .pcc-action:active{background:var(--l2)}
    .pcc-action i{font-size:16px}
    .pcc-action span{font-size:12.5px;font-weight:600}
    .pcc-action.liked{color:var(--acc)}
    .pcc-action.liked i{color:var(--acc)}
    .pcc-save{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--tx-muted);cursor:pointer;background:none;border:none;font-size:15px}
    .pcc-save.on{color:var(--gold)}
  .pcc-actions .drp-trigger{background:none;padding:0;color:var(--tx-muted);font-size:12.5px;font-weight:600}
  .pcc-actions .drp-trigger i{font-size:16px}
  .pcc-actions .drp-like-count{font-size:12.5px;font-weight:600}
  .pcc-actions .drp-trigger.liked,.pcc-actions .drp-trigger.liked .drp-like{color:var(--acc,#ff0050)}
    .pcc-actions .drp-trigger:active{background:none}
    .pcc-actions .drp-like{display:inline-flex;align-items:center;gap:5px;background:var(--bg);padding:6px 11px;border-radius:20px}
    .pcc-actions .drp-like:active{background:var(--l4,#e8e8e8)}
  `;

  // ══════════════════════════════════════════════════════════════════════
  // Utils
  // ══════════════════════════════════════════════════════════════════════
  function fmtN(n) {
    if (typeof n === 'string') return n;
    return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n || 0);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escAttr(s) { return String(s == null ? '' : s).replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }
  function starsHTML(score) {
    const full = Math.round(score || 0);
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<i class="fas fa-star${i > full ? ' empty' : ''}"></i>`;
    return h;
  }

  // Twitter/X-style verified seal: scalloped blue badge + white check.
  // Same path Twitter/X ships in its own verified badge asset.
  const VERIFIED_BADGE_SVG = `<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
    <path fill="#1d9bf0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.885-1.687-.47-.449-1.053-.756-1.687-.887-.634-.132-1.291-.084-1.898.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568-.54.354-.972.853-1.245 1.44-.607-.223-1.264-.272-1.898-.14-.635.13-1.218.437-1.687.886-.449.47-.754 1.053-.885 1.687-.132.633-.084 1.29.14 1.897-.587.274-1.086.705-1.44 1.246-.354.541-.55 1.17-.568 1.816.017.647.213 1.276.567 1.817.354.541.853.972 1.44 1.246-.224.606-.272 1.263-.14 1.897.13.634.435 1.217.884 1.686.47.449 1.053.756 1.687.887.634.132 1.29.084 1.898-.14.274.587.705 1.086 1.246 1.44s1.167.55 1.813.568c.646-.018 1.276-.213 1.817-.568s.972-.853 1.245-1.44c.607.224 1.264.273 1.898.14.634-.13 1.217-.437 1.687-.886.448-.47.754-1.052.885-1.686.132-.634.084-1.291-.14-1.898.586-.274 1.084-.705 1.438-1.246.354-.541.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
  </svg>`;

  // ══════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════
  let _root = null;
  let _hooks = {};
  let _posts = [];

  function _findPost(id) { return _posts.find(p => p.id === id); }

  // ══════════════════════════════════════════════════════════════════════
  // Shared header / actions
  // ══════════════════════════════════════════════════════════════════════
  function _head(post) {
    let ring = post.avatarRing === 'viewed' ? ' viewed' : post.avatarRing ? ' live' : '';
    const ringKey = post.handle || post.name || '';
    // Seen-state is global (StatusStore) — a post avatar is "live" only when
    // that author still has an unseen status, grey once every status is seen.
    try {
      if (window.StatusStore && ringKey && StatusStore.ringOf) {
        const r = StatusStore.ringOf(ringKey);
        if (r === 'ring-viewed') ring = ' viewed';
        else if (r === 'ring-has' || r === 'ring-live') ring = ' live';
      }
    } catch (e) {}
    return `
      <div class="pcc-head">
        <div class="pcc-avatar-wrap${ring}" data-status-ring="${escAttr(ringKey)}">
          <img class="pcc-avatar" src="${post.avatar}" alt="${escAttr(post.name)}" data-pcc-avatar>
          ${post.pinned ? `<div class="pcc-pin-badge"><i class="fas fa-thumbtack"></i></div>` : ''}
          ${post.verified ? `<div class="pcc-verified-badge" title="Verified">${VERIFIED_BADGE_SVG}</div>` : ''}
        </div>
        <div class="pcc-meta">
          <div class="pcc-name-row">
            <span class="pcc-name" data-pcc-name>${esc(post.name)}</span>
            ${post.rank ? `<span class="pcc-rank">${esc(post.rank)}</span>` : ''}
          </div>
          <div class="pcc-time">${esc(post.time)}${post.pinned ? ' · 📌 Pinned' : ''}</div>
        </div>
        <button class="pcc-dots" data-pcc-dots><i class="fas fa-ellipsis"></i></button>
      </div>`;
  }

  function _actions(post) {
    const reactionHTML = typeof _hooks.getReactionHTML === 'function'
      ? _hooks.getReactionHTML(post)
      : `<button class="pcc-action${post.liked ? ' liked' : ''}" data-pcc-like><i class="${post.liked ? 'fas' : 'far'} fa-heart"></i><span>${fmtN(post.likes)}</span></button>`;
    return `
      <div class="pcc-actions">
        <div class="pcc-action-group">
          ${reactionHTML}
          <button class="pcc-action" data-pcc-comment><i class="far fa-comment"></i><span>${fmtN(post.comments)}</span></button>
          <button class="pcc-action" data-pcc-share><i class="fas fa-share-nodes"></i><span>Share</span></button>
        </div>
        <button class="pcc-save${post.saved ? ' on' : ''}" data-pcc-save><i class="${post.saved ? 'fas' : 'far'} fa-bookmark"></i></button>
      </div>`;
  }

  function _pill(type) {
    switch (type) {
      case 'chapter-drop': return `<span class="pcc-pill pcc-pill-chapter"><i class="fas fa-book-open"></i>Chapter Drop</span>`;
      case 'ama': return `<span class="pcc-pill pcc-pill-ama"><i class="fas fa-microphone"></i>Live AMA</span>`;
      case 'quote': return `<span class="pcc-pill pcc-pill-quote"><i class="fas fa-quote-right"></i>Quote</span>`;
      case 'repost': return `<span class="pcc-pill pcc-pill-repost"><i class="fas fa-retweet"></i>Repost</span>`;
      case 'poll': return `<span class="pcc-pill pcc-pill-poll"><i class="fas fa-chart-bar"></i>Poll</span>`;
      case 'prediction': return `<span class="pcc-pill pcc-pill-prediction"><i class="fas fa-crystal-ball"></i>Prediction</span>`;
      case 'debate': return `<span class="pcc-pill pcc-pill-debate"><i class="fas fa-gavel"></i>Debate</span>`;
      case 'review': return `<span class="pcc-pill pcc-pill-review"><i class="fas fa-star"></i>Review</span>`;
      case 'recommendation': return `<span class="pcc-pill pcc-pill-recommend"><i class="fas fa-thumbs-up"></i>Recommendation</span>`;
      default: return ''; // no pill for plain author posts
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Engagement widgets (poll / prediction / debate) — mirrors the
  // reader page's ReaderEngagement UI, always expanded (no accordion).
  // ══════════════════════════════════════════════════════════════════════
  function _engShell(icon, title, sub, bodyHtml) {
    return `<div class="pcc-eng" data-pcc-eng>
      <div class="pcc-eng-hdr">
        <span class="pcc-eng-hdr-ico">${icon}</span>
        <div class="pcc-eng-hdr-body">
          <div class="pcc-eng-hdr-title">${esc(title)}</div>
          <div class="pcc-eng-hdr-sub">${sub}</div>
        </div>
      </div>
      <div class="pcc-eng-panel">${bodyHtml}</div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // TYPE RENDERERS — each returns the body HTML between head and actions
  // ══════════════════════════════════════════════════════════════════════
  const RENDERERS = {

    'ama': (post) => {
      const a = post.amaData || {};
      return `${_pill('ama')}
        <div class="pcc-ama">
          <div class="pcc-ama-live-row">
            <div class="pcc-ama-dot"></div>
            <div class="pcc-ama-live-text">Live now</div>
            <div class="pcc-ama-viewers"><i class="far fa-eye"></i> ${fmtN(a.viewers)} watching</div>
          </div>
          <div class="pcc-ama-title">${esc(a.title)}</div>
          <div class="pcc-ama-meta">${esc(a.meta)}</div>
          <button class="pcc-ama-join" data-pcc-join><i class="fas fa-microphone"></i> Join AMA</button>
        </div>`;
    },

    /* Chapter drop — same horizontal shape as recommendation */
    'chapter-drop': (post) => {
      const c = post.chapterRef || {};
      return `${_pill('chapter-drop')}
        ${post.text ? `<div class="pcc-text" data-pcc-openpost>${esc(post.text)}</div>` : ''}
        <div class="pcc-story-card chapter" data-pcc-open>
          <img class="pcc-story-cover" src="${c.cover || ''}" alt="">
          <div class="pcc-story-body">
            <div class="pcc-story-badge ch">${esc(c.ch || 'Chapter Drop')}</div>
            <div class="pcc-story-title">${esc(c.title)}</div>
            <div class="pcc-story-author">${esc(c.cat || '')}</div>
          </div>
        </div>`;
    },

    'quote': (post) => {
      const bgStyle = post.quoteBgCss ? ` style="background:${post.quoteBgCss}"` : '';
      const isDark = post.quoteBg === 'dark';
      const textStyle = isDark ? ' style="color:#ffffff;white-space:pre-wrap"' : ' style="white-space:pre-wrap"';
      const capStyle = isDark ? ' style="color:rgba(255,255,255,.7)"' : '';
      const markStyle = isDark ? ' style="color:rgba(255,255,255,.35)"' : '';
      const quoteHtml = esc(post.quote).replace(/\n/g,'<br>');
      return `${_pill('quote')}
      <div class="pcc-quote"${bgStyle}>
        <div class="pcc-quote-mark"${markStyle}>&ldquo;</div>
        <div class="pcc-quote-text" data-pcc-openpost${textStyle}>&ldquo;${quoteHtml}&rdquo;</div>
        <div class="pcc-quote-caption"${capStyle}>${esc(post.caption)}</div>
      </div>`;
    },

    /* Repost — same horizontal shape as recommendation */
    'repost': (post) => {
      const o = post.original || {};
      return `${_pill('repost')}
        ${post.note ? `<div class="pcc-text" data-pcc-openpost>${esc(post.note)}</div>` : ''}
        <div class="pcc-story-card repost" data-pcc-open>
          <img class="pcc-story-cover" src="${o.cover || o.avatar || ''}" alt="">
          <div class="pcc-story-body">
            <div class="pcc-story-badge rp">Repost</div>
            <div class="pcc-story-title">${esc(o.title || o.text || '')}</div>
            <div class="pcc-story-author">by @${esc(o.name || '')}</div>
          </div>
        </div>`;
    },

    'recommendation': (post) => {
      const s = post.storyRef || {};
      return `${_pill('recommendation')}
        ${post.note ? `<div class="pcc-text" data-pcc-openpost>${esc(post.note)}</div>` : ''}
        <div class="pcc-rec-card" data-pcc-open title="${escAttr(s.title || '')}">
          ${s.cover ? `<img class="pcc-rec-cover" src="${s.cover}" alt="">` : ''}
          <div class="pcc-rec-body">
            <div class="pcc-rec-cat">${esc(s.cat || 'Recommended read')}</div>
            <div class="pcc-rec-text">${esc(s.title || '')}</div>
            <div class="pcc-rec-by">by @${esc(s.author || s.writer || '')}</div>
          </div>
        </div>`;
    },

    'review': (post) => {
      const s = post.storyRef || {};
      return `${_pill('review')}
        <div class="pcc-review">
          <div class="pcc-review-top" data-pcc-open>
            <img class="pcc-review-cover" src="${s.cover || ''}" alt="">
            <div class="pcc-review-storyinfo">
              <div class="pcc-review-storytitle">${esc(s.title)}</div>
              <div class="pcc-review-author">by @${esc(s.author || s.writer || '')}</div>
              <div class="pcc-review-stars">${starsHTML(post.score)}<span class="pcc-review-score">${esc(post.score)}.0</span></div>
            </div>
          </div>
          <div class="pcc-review-body">${esc(post.reviewText)}</div>
        </div>`;
    },

    'poll': (post) => {
      const pl = post.poll || { opts: [], total: 0, voted: -1 };
      const total = pl.total || pl.opts.reduce((a, o) => a + o.v, 0) || 1;
      const opts = pl.opts.map((o, i) => {
        const pct = Math.round((o.v / total) * 100) || 0;
        const voted = pl.voted === i;
        return `
          <div class="pcc-eng-opt${voted ? ' voted' : ''}" data-pcc-poll-opt="${i}">
            <div class="pcc-eng-opt-bar" style="width:${pct}%"></div>
            <div class="pcc-eng-opt-row"><span class="pcc-eng-opt-txt">${esc(o.label || o.t)}${voted ? ' <span class="pcc-eng-opt-mine">· your vote</span>' : ''}</span><span class="pcc-eng-opt-pct">${pct}%</span></div>
          </div>`;
      }).join('');
      const body = `${post.image ? `<img class="pcc-image" src="${esc(post.image)}" alt="" data-pcc-open style="margin:10px 14px 0">` : ''}
        <div class="pcc-eng-q">${esc(pl.question || pl.q)}</div>
        <div class="pcc-eng-opts">${opts}</div>
        <div class="pcc-eng-foot"><span>${pl.voted >= 0 ? 'Thanks for voting' : 'Tap an option to vote'}</span><span>${fmtN(total)} votes</span></div>`;
      return `${_pill('poll')}${_engShell('📊', 'Poll', `${fmtN(total)} votes`, body)}`;
    },

    'prediction': (post) => {
      const pr = post.prediction || { opts: [], total: 0, voted: -1 };
      const total = pr.total || pr.opts.reduce((a, o) => a + (o.v || 0), 0) || 1;
      const opts = (pr.opts || []).map((o, i) => {
        const pct = Math.round(((o.v || 0) / total) * 100) || 0;
        const voted = pr.voted === i;
        return `
          <div class="pcc-eng-opt${voted ? ' voted' : ''}" data-pcc-pred-opt="${i}">
            <div class="pcc-eng-opt-bar" style="width:${pct}%"></div>
            <div class="pcc-eng-opt-row"><span class="pcc-eng-opt-txt">${esc(o.label || o.t || o.text)}${voted ? ' <span class="pcc-eng-opt-mine">· your pick</span>' : ''}</span><span class="pcc-eng-opt-pct">${pct}%</span></div>
          </div>`;
      }).join('');
      const body = `<div class="pcc-eng-q">${esc(pr.question || pr.q)}</div>
        <div class="pcc-eng-opts">${opts}</div>
        <div class="pcc-eng-foot"><span>${pr.voted >= 0 ? 'Prediction locked in' : 'Tap an option to predict'}</span><span>${fmtN(total)} predicts</span></div>`;
      return `${_pill('prediction')}${_engShell('🔮', 'Prediction', `${fmtN(total)} predicts`, body)}`;
    },

    'debate': (post) => {
      const d = post.debateData || {};
      const f = d.forV || 0, a = d.agV || 0, tot = (f + a) || 1;
      const fp = Math.round(f / tot * 100), ap = 100 - fp;
      const voted = d.userVote || null;
      const side = (s, lbl, cnt, em, cls, pct) => `
        <div class="pcc-eng-deb-side ${cls}${voted === s ? ' chosen' : ''}" data-pcc-debate="${s}">
          ${voted === s ? `<div class="pcc-eng-deb-check"><i class="fas fa-check"></i></div>` : ''}
          <div class="pcc-eng-deb-em">${em}</div>
          <div class="pcc-eng-deb-lbl">${esc(lbl)}</div>
          <div class="pcc-eng-deb-barwrap"><div class="pcc-eng-deb-bar" style="width:${pct}%"></div></div>
          <div class="pcc-eng-deb-pct">${pct}%</div>
          <div class="pcc-eng-deb-cnt">${fmtN(cnt)} votes</div>
        </div>`;
      const body = `${d.prompt ? `<div class="pcc-eng-q" style="padding-bottom:0;font-weight:600;color:var(--tx-muted);font-size:12px">${esc(d.prompt)}</div>` : ''}
        <div class="pcc-eng-q">${esc(d.motion || d.question)}</div>
        ${post.text ? `<div class="pcc-text" style="margin-top:6px" data-pcc-openpost>${esc(post.text)}</div>` : ''}
        <div class="pcc-eng-deb-sides">${side('for', d.forText || 'For', f, '✅', 'for', fp)}${side('against', d.againstText || 'Against', a, '❌', 'against', ap)}</div>
        <div class="pcc-eng-foot"><span>${fmtN(f + a)} joined the discussion</span><span class="pcc-eng-foot-link" data-pcc-debate-open>View full debate <i class="fas fa-chevron-right"></i></span></div>`;
      return `${_pill('debate')}${_engShell('⚖️', 'Debate', `${fmtN(f + a)} takes`, body)}`;
    },

    /* Plain author post — no type pill, optional heading, 3-line clamp + Read more, shorter image */
    'default': (post) => {
      const hasLongText = post.text && post.text.split(/\n/).length > 3 || (post.text && post.text.length > 160);
      return `
        ${post.heading ? `<div class="pcc-heading">${esc(post.heading)}</div>` : ''}
        ${post.text ? `<div class="pcc-text clamp" data-pcc-text>${esc(post.text)}</div>` : ''}
        ${post.text && hasLongText ? `<button class="pcc-readmore" data-pcc-readmore>Read more</button>` : ''}
        ${post.image ? `<img class="pcc-image" src="${post.image}" alt="" data-pcc-open>` : ''}`;
    },
  };

  // Alias: droboard-page seed uses type 'forum-poll' — same poll UI.
  RENDERERS['forum-poll'] = RENDERERS['poll'];

  // ══════════════════════════════════════════════════════════════════════
  // Card render
  // ══════════════════════════════════════════════════════════════════════
  function renderCard(post) {
    if (post.type === 'sponsored') {
      if (typeof _hooks.renderSponsored === 'function') {
        const html = _hooks.renderSponsored(post);
        if (html) return html;
      }
      // Hard fallback so sponsored slots NEVER disappear
      const a = post.ad || {};
      const title = a.heading || a.title || a.brand || 'Sponsored';
      const body = a.body || a.desc || a.description || '';
      return `<div class="pc-ad-wrap" data-adid="${escAttr(a.id || post.id)}" style="padding:14px 16px;background:var(--l1);border-bottom:8px solid var(--bg)">
        <div style="font-size:10px;font-weight:800;color:var(--acc);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">Sponsored</div>
        <div style="font-size:15px;font-weight:800;color:var(--tx-high);margin-bottom:6px">${esc(title)}</div>
        ${body ? `<div style="font-size:13px;color:var(--tx-body);line-height:1.5;margin-bottom:10px">${esc(body)}</div>` : ''}
        <div style="display:inline-block;background:var(--acc);color:#fff;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:800">${esc(a.cta || 'Learn more')}</div>
      </div>`;
    }
    const body = (RENDERERS[post.type] || RENDERERS.default)(post);
    return `<div class="pcc-post" data-pcc-id="${escAttr(post.id)}">${_head(post)}${body}${_actions(post)}</div>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // Full render pass / single-card update
  // ══════════════════════════════════════════════════════════════════════
  function setPosts(posts) {
    _posts = posts || [];
    if (!_root) return;
    _root.innerHTML = _posts.map(renderCard).join('');
    try { if (window.StatusStore && StatusStore.applyAll) StatusStore.applyAll(_root); } catch (e) {}
  }

  function update(post) {
    if (!_root) return;
    const idx = _posts.findIndex(p => p.id === post.id);
    if (idx > -1) _posts[idx] = post; else _posts.push(post);
    const el = _root.querySelector(`[data-pcc-id="${CSS.escape ? CSS.escape(post.id) : post.id}"]`);
    const html = renderCard(post);
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const next = tmp.firstElementChild;
    if (next) el.replaceWith(next);
    try { if (window.StatusStore && StatusStore.applyAll) StatusStore.applyAll(_root); } catch (e) {}
  }

  // ══════════════════════════════════════════════════════════════════════
  // Event delegation — bound once on the root container. Sponsored cards
  // (renderSponsored markup) are NOT touched here — the host wires those
  // up separately (e.g. DroboardAdCard.attach), same as before.
  // ══════════════════════════════════════════════════════════════════════
  function _bind() {
    _root.addEventListener('click', (e) => {
      const card = e.target.closest('.pcc-post');
      if (!card) return;
      const post = _findPost(card.dataset.pccId);
      if (!post) return;

      // Read more toggle for author posts
      const readMoreBtn = e.target.closest('[data-pcc-readmore]');
      if (readMoreBtn) {
        const textEl = card.querySelector('[data-pcc-text]');
        if (textEl) {
          textEl.classList.toggle('clamp');
          readMoreBtn.textContent = textEl.classList.contains('clamp') ? 'Read more' : 'Show less';
        }
        return;
      }

      if (e.target.closest('[data-pcc-avatar]')) { _hooks.onAvatarClick && _hooks.onAvatarClick(post); return; }
      if (e.target.closest('[data-pcc-name]')) { _hooks.onNameClick && _hooks.onNameClick(post); return; }
      if (e.target.closest('[data-pcc-like]')) { _hooks.onLike && _hooks.onLike(post); return; }
      if (e.target.closest('[data-pcc-comment]')) { _hooks.onComment && _hooks.onComment(post); return; }
      if (e.target.closest('[data-pcc-share]')) { _hooks.onShare && _hooks.onShare(post); return; }
      if (e.target.closest('[data-pcc-save]')) { _hooks.onSave && _hooks.onSave(post); return; }
      const dotsEl = e.target.closest('[data-pcc-dots]');
      if (dotsEl) { _hooks.onDots && _hooks.onDots(post, dotsEl); return; }
      if (e.target.closest('[data-pcc-join]')) { _hooks.onJoinAma && _hooks.onJoinAma(post); return; }
      if (e.target.closest('[data-pcc-open]')) { _hooks.onOpenLink && _hooks.onOpenLink(post); return; }

      const pollRow = e.target.closest('[data-pcc-poll-opt]');
      if (pollRow) { _hooks.onPollVote && _hooks.onPollVote(post, parseInt(pollRow.dataset.pccPollOpt, 10)); return; }

      const predRow = e.target.closest('[data-pcc-pred-opt]');
      if (predRow) { _hooks.onPredVote && _hooks.onPredVote(post, parseInt(predRow.dataset.pccPredOpt, 10)); return; }

      const debateOpt = e.target.closest('[data-pcc-debate]');
      if (debateOpt) { _hooks.onDebateVote && _hooks.onDebateVote(post, debateOpt.dataset.pccDebate); return; }

      const debateOpen = e.target.closest('[data-pcc-debate-open]');
      if (debateOpen) { _hooks.onOpenDebate && _hooks.onOpenDebate(post); return; }

      // Text tap → open the post reader (deliberate reading action only —
      // empty padding taps do nothing, links/inputs are never hijacked)
      if (!e.target.closest('a,button,input,textarea,select')) {
        if (e.target.closest('[data-pcc-openpost]')) { _hooks.onOpenPost && _hooks.onOpenPost(post); return; }
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════
  function attach(rootEl, hooks) {
    if (!document.getElementById('pcc-style')) {
      const style = document.createElement('style');
      style.id = 'pcc-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    _root = rootEl;
    _hooks = hooks || {};
    _bind();
  }

  function registerType(name, rendererFn) {
    RENDERERS[name] = rendererFn;
  }

  window.DroboardPostCard = {
    attach,
    setPosts,
    update,
    render: renderCard,
    findPost: _findPost,
    registerType,
  };

})();
