/**
 * campaign-wizard.js — Droboard Campaign Setup Wizard (reusable component)
 * ─────────────────────────────────────────────────────────────────────
 * A self-contained, step-by-step modal for creating/editing a marketing
 * campaign, with audience targeting and a live estimated-audience panel.
 * Import this ONE file anywhere you need to set up a campaign and call:
 *
 *   CampaignWizard.open({
 *     mode: 'create' | 'edit',
 *     campaign: existingCampaignObjectOrNull,
 *     placements: [{ id, label, icon, desc }, ...],   // surfaces list
 *     storyLibrary: [{ id, title, author, genre, cover }, ...],
 *     onSubmit: (payload) => { ... },   // called with the full campaign payload
 *     onCancel: () => { ... },          // optional
 *   });
 *
 * Steps:
 *   1. Campaign Setup — name, objective, story (if applicable), surfaces,
 *      budget, duration.
 *   2. Audience Targeting — searchable interest dropdown (with live
 *      audience-size stats per interest) plus dropdown-based basic/advanced
 *      targeting filters (no stats — these aren't measurable the same way),
 *      with a live "Estimated Audience" panel that updates as you toggle
 *      filters.
 *   3. Review & Estimate — full summary + final estimated-audience readout
 *      before submitting.
 *
 * The payload passed to onSubmit looks like:
 *   {
 *     type: 'story' | 'business', objective, name, placements: [...],
 *     startDate, endDate, hasBudget, budget, spent, owner: '',
 *     description: '',
 *     // story objective only:
 *     storyId, storyTitle, storyAuthor, storyGenre, storyCover,
 *     // business/brand-awareness objective only:
 *     advertiserName, advertiserEmail,
 *     audienceTargeting: { ...see buildDefaultTargeting() below }
 *   }
 */

(function () {
  'use strict';

  if (window.__campaignWizard) return;
  window.__campaignWizard = true;

  /* ══════════════════════════════════════════════════════════════════
     Static option lists
  ══════════════════════════════════════════════════════════════════ */
  const OBJECTIVES = [
    { id: 'followers',       label: 'Followers',        icon: 'fa-user-plus',   desc: 'Grow an author or platform follower base', needsStory: false },
    { id: 'story-reads',     label: 'Story Reads',      icon: 'fa-book-open',   desc: 'Drive chapter reads for a specific story', needsStory: true },
    { id: 'inner-circle',    label: 'Inner Circle',     icon: 'fa-star',        desc: 'Convert readers into paying Inner Circle members', needsStory: true },
    { id: 'tips-support',    label: 'Tips & Support',   icon: 'fa-heart',       desc: 'Encourage tipping/support on a story or author', needsStory: true },
    { id: 'engagement',      label: 'Engagement',       icon: 'fa-comments',    desc: 'Boost likes, comments and shares', needsStory: true },
    { id: 'brand-awareness', label: 'Brand Awareness',  icon: 'fa-briefcase',   desc: 'For an outside advertiser reaching Droboard readers', needsStory: false, isBusiness: true },
  ];
  const OBJ_MAP = {}; OBJECTIVES.forEach(o => OBJ_MAP[o.id] = o);

  /* Interests now carry an audience-size stat (shown in the dropdown option
     AND on the selected tag once chosen), sourced from platform analytics.
     Numbers are demo figures — wire up to your real interest-audience
     endpoint when available. */
  const INTERESTS_DATA = [
    { name: 'Romance',              count: 428000 },
    { name: 'Fantasy',              count: 312500 },
    { name: 'Horror',               count: 154200 },
    { name: 'Mafia & Urban',        count: 201800 },
    { name: 'Historical & Regency', count: 98700  },
    { name: 'Campus & Revenge',     count: 176300 },
    { name: 'Werewolf',             count: 264900 },
    { name: 'Billionaire & CEO',    count: 349100 },
    { name: 'Heartbreak & Elegy',   count: 132400 },
    { name: 'Twist & Drama',        count: 187600 },
    { name: 'Comedy',               count: 121900 },
    { name: 'Dark Fiction',         count: 88300  },
    { name: 'Spiritual',            count: 54200  },
  ];
  const INTERESTS = INTERESTS_DATA.map(i => i.name); // flat names, kept for backward compat

  const COUNTRIES = ['All Countries', 'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United States', 'United Kingdom', 'Canada', 'India', 'Philippines'];
  const LANGUAGES = ['All Languages', 'English', 'French', 'Yoruba', 'Hausa', 'Igbo', 'Swahili', 'Pidgin'];

  /* Basic + advanced targeting filters are picked from a dropdown, same
     interaction pattern as interests, but WITHOUT stats — these describe
     behavioral filters, not a fixed audience segment size. `extra` flags
     an option that needs an inline follow-up input once selected. */
  const BASIC_TARGETING_OPTIONS = [
    { id: 'similarStories',             label: '📚 Readers of Similar Stories',        desc: "Reach readers who engage with stories like the one you're promoting." },
    { id: 'tippedLast30Days',           label: '❤️ Readers Who Tipped in Last 30 Days', desc: 'Recently active tippers/supporters.' },
    { id: 'unlockedChapters',           label: '💰 Readers Who Unlocked ≥ X Chapters',  desc: 'Paying readers past a chapter threshold.', extra: 'unlockedChapters' },
    { id: 'readTime',                   label: '⏱️ Read Time',                          desc: 'e.g. 2+ hours read this month.', extra: 'readTime' },
    { id: 'followersOfSimilarAuthors',  label: '👥 Followers of Similar Authors',       desc: "Lookalike audience from comparable authors' followers." },
    { id: 'age',                        label: '📱 Age Range',                          desc: 'Only if you collect reader age.', extra: 'age' },
  ];

  const ADVANCED_TARGETING_OPTIONS = [
    { id: 'boughtCoinsRecently',      label: '🎁 Bought Coins Recently' },
    { id: 'innerCircleMembers',       label: '⭐ Inner Circle Members' },
    { id: 'highlyActiveReaders',      label: '🔥 Highly Active Readers' },
    { id: 'inactiveReaders',          label: '😴 Inactive Readers', desc: 'Re-engagement.' },
    { id: 'finishedSimilarBooks',     label: '📖 Readers Who Finished Similar Books' },
    { id: 'genreHubMembers',          label: '🏷️ Genre Hub Members' },
    { id: 'followingSpecificAuthors', label: '📋 Readers Following Specific Authors', extra: 'followingAuthors' },
  ];

  /* ══════════════════════════════════════════════════════════════════
     CSS (cwz- prefixed, self-contained)
  ══════════════════════════════════════════════════════════════════ */
  const CSS = `
  .cwz-overlay{position:fixed;inset:0;background:rgba(10,6,25,.55);z-index:2000;opacity:0;pointer-events:none;
    transition:opacity .2s;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;
    font-family:'Inter',system-ui,sans-serif;}
  .cwz-overlay.open{opacity:1;pointer-events:auto;}
  .cwz-box{background:var(--card,#fff);border-radius:18px;width:100%;max-width:640px;box-shadow:0 30px 80px rgba(0,0,0,.32);
    transform:translateY(14px) scale(.98);opacity:0;transition:.2s;max-height:90vh;display:flex;flex-direction:column;margin:auto;}
  .cwz-overlay.open .cwz-box{transform:translateY(0) scale(1);opacity:1;}
  .cwz-box *, .cwz-box *::before, .cwz-box *::after{box-sizing:border-box;}
  .cwz-box{color:var(--text,#14151b);}

  .cwz-head{padding:20px 22px 0;flex-shrink:0;}
  .cwz-head-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;}
  .cwz-head-top h3{font-size:16px;font-weight:800;margin:0;}
  .cwz-head-top p{font-size:11.5px;color:var(--text-faint,#9aa2b1);margin-top:3px;}
  .cwz-close{width:28px;height:28px;border-radius:8px;border:1px solid var(--input-border,#e5e8ee);background:var(--input-bg,#f7f8fa);
    color:var(--text,#14151b);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;flex-shrink:0;}

  .cwz-steps{display:flex;gap:6px;padding-bottom:16px;}
  .cwz-step-pill{flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:var(--table-head,#f3f4f7);
    font-size:10.5px;font-weight:700;color:var(--text-faint,#9aa2b1);display:flex;flex-direction:column;align-items:center;gap:3px;}
  .cwz-step-pill .cwz-step-num{width:20px;height:20px;border-radius:50%;background:var(--input-bg,#f7f8fa);
    display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;}
  .cwz-step-pill.on{background:var(--accent-bg,rgba(255,0,80,.09));color:var(--accent,#ff0050);}
  .cwz-step-pill.on .cwz-step-num{background:var(--accent,#ff0050);color:#fff;}
  .cwz-step-pill.done .cwz-step-num{background:var(--green,#1c9d5b);color:#fff;}
  .cwz-step-pill.done{color:var(--green,#1c9d5b);}

  .cwz-body{padding:6px 22px 20px;overflow-y:auto;flex:1;}
  .cwz-section-lbl{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--text-faint,#9aa2b1);
    margin:16px 0 9px;display:flex;align-items:center;gap:6px;}
  .cwz-section-lbl:first-child{margin-top:2px;}

  .cwz-field{margin-bottom:14px;}
  .cwz-field label{font-size:10.5px;font-weight:700;color:var(--text-muted,#5b6472);text-transform:uppercase;
    letter-spacing:.03em;display:block;margin-bottom:6px;}
  .cwz-field input[type=text], .cwz-field input[type=number], .cwz-field input[type=date],
  .cwz-field input[type=email], .cwz-field select, .cwz-field textarea{
    width:100%;border:1px solid var(--input-border,#e5e8ee);background:var(--input-bg,#f7f8fa);border-radius:9px;
    padding:9px 11px;font-size:13px;font-family:inherit;color:var(--text,#14151b);resize:vertical;}
  .cwz-field textarea{min-height:60px;}
  .cwz-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .cwz-hint{font-size:10.5px;color:var(--text-faint,#9aa2b1);margin-top:6px;line-height:1.4;}

  /* Objective grid */
  .cwz-obj-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .cwz-obj-opt{border:1.5px solid var(--input-border,#e5e8ee);border-radius:11px;padding:10px 11px;cursor:pointer;transition:.14s;}
  .cwz-obj-opt.on{border-color:var(--accent,#ff0050);background:var(--accent-bg,rgba(255,0,80,.06));}
  .cwz-obj-opt b{font-size:11.5px;font-weight:800;display:flex;align-items:center;gap:6px;}
  .cwz-obj-opt span{font-size:9.5px;color:var(--text-faint,#9aa2b1);display:block;margin-top:3px;line-height:1.35;}

  /* Story picker */
  .cwz-story-pick-results{border:1px solid var(--input-border,#e5e8ee);border-radius:9px;margin-top:6px;max-height:170px;
    overflow-y:auto;display:none;}
  .cwz-story-pick-results.show{display:block;}
  .cwz-story-pick-row{display:flex;align-items:center;gap:9px;padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border,#eef0f5);}
  .cwz-story-pick-row:last-child{border-bottom:none;}
  .cwz-story-pick-row:hover{background:var(--hover,#fafbfc);}
  .cwz-story-pick-row img{width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0;}
  .cwz-story-pick-row-txt b{font-size:11.5px;font-weight:700;display:block;line-height:1.3;}
  .cwz-story-pick-row-txt span{font-size:9.5px;color:var(--text-faint,#9aa2b1);}
  .cwz-selected-story{display:flex;align-items:center;gap:10px;border:1px solid var(--accent,#ff0050);
    background:var(--accent-bg,rgba(255,0,80,.05));border-radius:10px;padding:9px 11px;}
  .cwz-selected-story img{width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;}
  .cwz-selected-story-txt{flex:1;min-width:0;}
  .cwz-selected-story-txt b{font-size:12px;font-weight:700;display:block;line-height:1.3;}
  .cwz-selected-story-txt span{font-size:10px;color:var(--text-faint,#9aa2b1);}
  .cwz-selected-story-clear{width:24px;height:24px;border-radius:50%;border:none;background:var(--input-bg,#f7f8fa);
    color:var(--text-faint,#9aa2b1);cursor:pointer;flex-shrink:0;}

  /* Surfaces / placements */
  .cwz-placement-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .cwz-placement-opt{display:flex;align-items:flex-start;gap:9px;border:1.5px solid var(--input-border,#e5e8ee);
    border-radius:10px;padding:9px 10px;cursor:pointer;transition:.14s;}
  .cwz-placement-opt.on{border-color:var(--accent,#ff0050);background:var(--accent-bg,rgba(255,0,80,.05));}
  .cwz-placement-opt input{margin-top:2px;accent-color:var(--accent,#ff0050);flex-shrink:0;}
  .cwz-placement-opt-txt b{font-size:11px;font-weight:700;display:block;}
  .cwz-placement-opt-txt span{font-size:9.5px;color:var(--text-faint,#9aa2b1);line-height:1.35;}

  .cwz-budget-toggle-row{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;cursor:pointer;}
  .cwz-budget-toggle-row input{accent-color:var(--accent,#ff0050);width:16px;height:16px;}
  .cwz-budget-fields{display:none;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}
  .cwz-budget-fields.show{display:grid;}

  /* ── Multiselect dropdown (interests + targeting filters) ── */
  .cwz-ms{position:relative;}
  .cwz-ms-control{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--input-border,#e5e8ee);
    background:var(--input-bg,#f7f8fa);border-radius:10px;padding:7px 9px;cursor:text;min-height:42px;transition:border-color .13s;}
  .cwz-ms-control:focus-within{border-color:var(--accent,#ff0050);}
  .cwz-ms-tag{display:flex;align-items:center;gap:6px;background:var(--accent,#ff0050);color:#fff;font-size:11px;font-weight:700;
    padding:4px 6px 4px 10px;border-radius:20px;white-space:nowrap;max-width:100%;}
  .cwz-ms-tag-lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px;}
  .cwz-ms-tag-stat{background:rgba(255,255,255,.28);font-size:9px;font-weight:800;padding:2px 6px;border-radius:10px;flex-shrink:0;}
  .cwz-ms-tag-x{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.25);border:none;color:#fff;
    display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:8px;flex-shrink:0;padding:0;}
  .cwz-ms-tag-x:hover{background:rgba(255,255,255,.42);}
  .cwz-ms-input{flex:1;min-width:120px;border:none;background:none;outline:none;font-size:12.5px;font-family:inherit;
    color:var(--text,#14151b);padding:4px 2px;}
  .cwz-ms-input::placeholder{color:var(--text-faint,#9aa2b1);}
  .cwz-ms-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--card,#fff);
    border:1px solid var(--input-border,#e5e8ee);border-radius:11px;box-shadow:0 14px 40px rgba(20,10,50,.16);
    max-height:220px;overflow-y:auto;z-index:60;display:none;padding:6px;}
  .cwz-ms-panel.open{display:block;}
  .cwz-ms-option{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;}
  .cwz-ms-option:hover{background:var(--hover,#fafbfc);}
  .cwz-ms-option-txt{min-width:0;}
  .cwz-ms-option-txt b{font-size:12px;font-weight:700;display:block;line-height:1.35;}
  .cwz-ms-option-txt span{font-size:10px;color:var(--text-faint,#9aa2b1);line-height:1.35;display:block;margin-top:1px;}
  .cwz-ms-option-stat{font-size:10px;font-weight:800;color:var(--accent,#ff0050);background:var(--accent-bg,rgba(255,0,80,.08));
    padding:3px 9px;border-radius:10px;white-space:nowrap;flex-shrink:0;}
  .cwz-ms-empty{padding:12px 10px;font-size:11.5px;color:var(--text-faint,#9aa2b1);text-align:center;}
  .cwz-ms-extras{margin-top:8px;display:flex;flex-direction:column;gap:6px;}
  .cwz-ms-extra-row{display:flex;align-items:center;gap:8px;background:var(--table-head,#f3f4f7);border-radius:9px;
    padding:8px 10px;font-size:11.5px;color:var(--text-muted,#5b6472);flex-wrap:wrap;}
  .cwz-ms-extra-row b{color:var(--text,#14151b);font-weight:700;margin-right:2px;white-space:nowrap;}
  .cwz-ms-extra-row input{border:1px solid var(--input-border,#e5e8ee);background:var(--card,#fff);border-radius:7px;
    padding:5px 8px;font-size:11.5px;font-family:inherit;color:var(--text,#14151b);max-width:100px;}
  .cwz-ms-extra-row input.wide{max-width:none;flex:1;min-width:160px;}

  .cwz-advanced-toggle{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--accent,#ff0050);
    cursor:pointer;padding:8px 0;user-select:none;}
  .cwz-advanced-body{display:none;}
  .cwz-advanced-body.show{display:block;}

  /* Estimate panel */
  .cwz-estimate{border-radius:13px;background:linear-gradient(135deg,var(--accent,#ff0050),#7a0030);color:#fff;
    padding:16px 18px;margin-top:6px;}
  .cwz-estimate-top{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
  .cwz-estimate-ico{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.18);display:flex;
    align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .cwz-estimate-count{font-size:20px;font-weight:800;line-height:1.1;}
  .cwz-estimate-lbl{font-size:10px;opacity:.85;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
  .cwz-estimate-stats{display:flex;gap:18px;flex-wrap:wrap;}
  .cwz-estimate-stat b{font-size:12.5px;display:block;}
  .cwz-estimate-stat span{font-size:9.5px;opacity:.8;text-transform:uppercase;font-weight:700;letter-spacing:.03em;}

  /* Review step */
  .cwz-review-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;}
  .cwz-review-item{background:var(--table-head,#f3f4f7);border-radius:9px;padding:10px 12px;}
  .cwz-review-lbl{font-size:9px;font-weight:700;color:var(--text-faint,#9aa2b1);text-transform:uppercase;letter-spacing:.04em;}
  .cwz-review-val{font-size:13px;font-weight:800;margin-top:2px;line-height:1.3;}
  .cwz-review-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
  .cwz-review-tag{font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;background:var(--table-head,#f3f4f7);
    color:var(--text-muted,#5b6472);}
  .cwz-review-tag.empty{color:var(--text-faint,#9aa2b1);font-weight:600;font-style:italic;}

  .cwz-error{font-size:11.5px;color:var(--red,#e0293e);background:var(--red-bg,#fdeaec);border-radius:8px;
    padding:8px 10px;display:none;margin-top:4px;}
  .cwz-error.show{display:block;}

  .cwz-foot{display:flex;gap:8px;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--border,#eef0f5);flex-shrink:0;}
  .cwz-foot-left, .cwz-foot-right{display:flex;gap:8px;}
  .cwz-btn{padding:10px 18px;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;
    border:1px solid var(--input-border,#e5e8ee);background:var(--input-bg,#f7f8fa);color:var(--text-muted,#5b6472);
    display:flex;align-items:center;gap:6px;}
  .cwz-btn.primary{background:var(--accent,#ff0050);border-color:transparent;color:#fff;}
  .cwz-btn.primary:hover{opacity:.9;}
  .cwz-btn:disabled{opacity:.5;cursor:not-allowed;}

  @media (max-width:640px){
    .cwz-obj-grid, .cwz-placement-grid, .cwz-row2, .cwz-review-grid{grid-template-columns:1fr;}
    .cwz-budget-fields.show{grid-template-columns:1fr;}
    .cwz-step-pill span.cwz-step-label{display:none;}
  }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'cwz-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ══════════════════════════════════════════════════════════════════
     Helpers
  ══════════════════════════════════════════════════════════════════ */
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtNum(n) { n = n || 0; return n.toLocaleString('en-US'); }
  function fmtCompact(n) {
    n = n || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }

  function buildDefaultTargeting() {
    return {
      interests: [],
      similarStories: false,
      tippedLast30Days: false,
      unlockedChapters: { enabled: false, min: 5 },
      readTime: { enabled: false, hours: 2 },
      followersOfSimilarAuthors: false,
      country: 'All Countries',
      language: 'All Languages',
      age: { enabled: false, min: 18, max: 45 },
      advanced: {
        boughtCoinsRecently: false,
        innerCircleMembers: false,
        highlyActiveReaders: false,
        inactiveReaders: false,
        finishedSimilarBooks: false,
        genreHubMembers: false,
        followingSpecificAuthors: { enabled: false, authors: [] },
      },
    };
  }

  /* Reads/writes the flat "is this basic filter on?" list against the
     nested targeting shape, so the dropdown can treat them uniformly. */
  function getBasicSelectedIds(t) {
    const ids = [];
    if (t.similarStories) ids.push('similarStories');
    if (t.tippedLast30Days) ids.push('tippedLast30Days');
    if (t.unlockedChapters.enabled) ids.push('unlockedChapters');
    if (t.readTime.enabled) ids.push('readTime');
    if (t.followersOfSimilarAuthors) ids.push('followersOfSimilarAuthors');
    if (t.age.enabled) ids.push('age');
    return ids;
  }
  function setBasicEnabled(t, id, val) {
    if (id === 'similarStories') t.similarStories = val;
    else if (id === 'tippedLast30Days') t.tippedLast30Days = val;
    else if (id === 'unlockedChapters') t.unlockedChapters.enabled = val;
    else if (id === 'readTime') t.readTime.enabled = val;
    else if (id === 'followersOfSimilarAuthors') t.followersOfSimilarAuthors = val;
    else if (id === 'age') t.age.enabled = val;
  }
  function getAdvancedSelectedIds(t) {
    const a = t.advanced, ids = [];
    if (a.boughtCoinsRecently) ids.push('boughtCoinsRecently');
    if (a.innerCircleMembers) ids.push('innerCircleMembers');
    if (a.highlyActiveReaders) ids.push('highlyActiveReaders');
    if (a.inactiveReaders) ids.push('inactiveReaders');
    if (a.finishedSimilarBooks) ids.push('finishedSimilarBooks');
    if (a.genreHubMembers) ids.push('genreHubMembers');
    if (a.followingSpecificAuthors.enabled) ids.push('followingSpecificAuthors');
    return ids;
  }
  function setAdvancedEnabled(t, id, val) {
    const a = t.advanced;
    if (id === 'followingSpecificAuthors') a.followingSpecificAuthors.enabled = val;
    else a[id] = val;
  }

  /* Mock — but reactive — audience estimate calculation */
  function estimateAudience(t) {
    const BASE = 250000;
    let mult = 1;
    let activeFilters = 0;

    if (t.interests.length) { mult *= Math.min(0.9, 0.3 + t.interests.length * 0.12); activeFilters++; }
    if (t.similarStories) { mult *= 0.35; activeFilters++; }
    if (t.tippedLast30Days) { mult *= 0.18; activeFilters++; }
    if (t.unlockedChapters.enabled) { mult *= Math.max(0.15, Math.min(0.6, 1 - (t.unlockedChapters.min || 0) / 50)); activeFilters++; }
    if (t.readTime.enabled) { mult *= Math.max(0.2, Math.min(0.7, 1 - (t.readTime.hours || 0) / 20)); activeFilters++; }
    if (t.followersOfSimilarAuthors) { mult *= 0.45; activeFilters++; }
    if (t.country && t.country !== 'All Countries') { mult *= 0.45; activeFilters++; }
    if (t.language && t.language !== 'All Languages') { mult *= 0.6; activeFilters++; }
    if (t.age.enabled) { mult *= 0.55; activeFilters++; }

    const a = t.advanced;
    if (a.boughtCoinsRecently) { mult *= 0.3; activeFilters++; }
    if (a.innerCircleMembers) { mult *= 0.15; activeFilters++; }
    if (a.highlyActiveReaders) { mult *= 0.35; activeFilters++; }
    if (a.inactiveReaders) { mult *= 0.5; activeFilters++; }
    if (a.finishedSimilarBooks) { mult *= 0.4; activeFilters++; }
    if (a.genreHubMembers) { mult *= 0.45; activeFilters++; }
    if (a.followingSpecificAuthors.enabled) { mult *= 0.5; activeFilters++; }

    const count = Math.max(800, Math.round(BASE * mult));
    const reach = count > 50000 ? 'Very High' : count > 20000 ? 'High' : count > 8000 ? 'Medium' : count > 2000 ? 'Low' : 'Very Low';
    const competition = activeFilters <= 2 ? 'Low' : activeFilters <= 5 ? 'Medium' : 'High';
    return { count, reach, competition, activeFilters };
  }

  /* ══════════════════════════════════════════════════════════════════
     Reusable searchable multiselect dropdown
     Used for: Interests (with stats) and Basic/Advanced Targeting
     (no stats). Selected items render as removable tags inside the
     control; typing filters the option panel below it.
  ══════════════════════════════════════════════════════════════════ */
  function createMultiSelect(root, cfg) {
    // cfg: { options:[{id,label,desc?,stat?}], getSelected(), onAdd(id), onRemove(id), showStats, placeholder }
    let query = '';
    let panelOpen = false;

    function render() {
      const selectedIds = cfg.getSelected();
      const selectedOpts = cfg.options.filter(o => selectedIds.includes(o.id));
      const q = query.trim().toLowerCase();
      const availableOpts = cfg.options.filter(o =>
        !selectedIds.includes(o.id) && (!q || o.label.toLowerCase().includes(q))
      );

      root.innerHTML = `
        <div class="cwz-ms-control" data-role="control">
          ${selectedOpts.map(o => `
            <span class="cwz-ms-tag" data-id="${esc(o.id)}">
              <span class="cwz-ms-tag-lbl">${esc(o.label)}</span>
              ${cfg.showStats && o.stat != null ? `<span class="cwz-ms-tag-stat">${fmtCompact(o.stat)}</span>` : ''}
              <button type="button" class="cwz-ms-tag-x" data-remove="${esc(o.id)}" aria-label="Remove"><i class="fas fa-xmark"></i></button>
            </span>`).join('')}
          <input type="text" class="cwz-ms-input" placeholder="${esc(cfg.placeholder || 'Search…')}" value="${esc(query)}"/>
        </div>
        <div class="cwz-ms-panel${panelOpen ? ' open' : ''}">
          ${availableOpts.length ? availableOpts.map(o => `
            <div class="cwz-ms-option" data-add="${esc(o.id)}">
              <div class="cwz-ms-option-txt"><b>${esc(o.label)}</b>${o.desc ? `<span>${esc(o.desc)}</span>` : ''}</div>
              ${cfg.showStats && o.stat != null ? `<span class="cwz-ms-option-stat">${fmtCompact(o.stat)} readers</span>` : ''}
            </div>`).join('') : `<div class="cwz-ms-empty">No matches${q ? ` for "${esc(query)}"` : ''}.</div>`}
        </div>
      `;

      const input = root.querySelector('.cwz-ms-input');
      const control = root.querySelector('[data-role="control"]');

      control.addEventListener('mousedown', (e) => {
        if (e.target === input) return;
        e.preventDefault();
        input.focus();
      });
      input.addEventListener('focus', () => { panelOpen = true; root.querySelector('.cwz-ms-panel').classList.add('open'); });
      input.addEventListener('input', () => {
        query = input.value;
        panelOpen = true;
        render();
        const ni = root.querySelector('.cwz-ms-input');
        ni.focus();
        ni.selectionStart = ni.selectionEnd = ni.value.length;
      });

      root.querySelectorAll('[data-add]').forEach(el => {
        el.addEventListener('click', () => {
          cfg.onAdd(el.dataset.add);
          query = '';
          panelOpen = true;
          render();
          const ni = root.querySelector('.cwz-ms-input');
          if (ni) ni.focus();
        });
      });
      root.querySelectorAll('[data-remove]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          cfg.onRemove(el.dataset.remove);
          render();
        });
      });
    }

    render();

    const closeOnOutsideClick = (e) => {
      if (!root.contains(e.target)) {
        panelOpen = false;
        const panel = root.querySelector('.cwz-ms-panel');
        if (panel) panel.classList.remove('open');
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    root._cwzCleanup = () => document.removeEventListener('mousedown', closeOnOutsideClick);

    return { refresh: render };
  }

  /* ══════════════════════════════════════════════════════════════════
     Instance
  ══════════════════════════════════════════════════════════════════ */
  let _instanceCounter = 0;

  function open(options) {
    options = options || {};
    _injectStyles();

    const instId = 'cwz' + (++_instanceCounter);
    const placements = options.placements || [];
    const storyLibrary = options.storyLibrary || [];
    const mode = options.mode === 'edit' ? 'edit' : 'create';
    const existing = options.campaign || null;

    let step = 1;
    const state = {
      objective: 'story-reads',
      name: '',
      selectedStory: null,
      selectedPlacements: [],
      hasBudget: false,
      budget: '',
      spent: '',
      startDate: '',
      endDate: '',
      advertiserName: '',
      advertiserEmail: '',
      owner: options.defaultOwner || '',
      description: '',
      targeting: buildDefaultTargeting(),
    };

    /* ── Prefill from existing campaign (edit mode) ── */
    if (existing) {
      const isBusiness = existing.type === 'business';
      state.objective = existing.objective || (isBusiness ? 'brand-awareness' : 'story-reads');
      state.name = existing.name || '';
      state.selectedPlacements = (existing.placements || []).slice();
      state.hasBudget = !!existing.hasBudget;
      state.budget = existing.budget || '';
      state.spent = existing.spent || '';
      state.startDate = existing.startDate || '';
      state.endDate = existing.endDate || '';
      state.advertiserName = existing.advertiserName || '';
      state.advertiserEmail = existing.advertiserEmail || '';
      state.owner = existing.owner || '';
      state.description = existing.description || '';
      if (existing.storyId) {
        state.selectedStory = storyLibrary.find(s => s.id === existing.storyId) ||
          { id: existing.storyId, title: existing.storyTitle, author: existing.storyAuthor, genre: existing.storyGenre, cover: existing.storyCover };
      }
      if (existing.audienceTargeting) {
        state.targeting = Object.assign(buildDefaultTargeting(), JSON.parse(JSON.stringify(existing.audienceTargeting)));
      }
    }

    let advancedOpen = false;

    /* ── Overlay scaffold ── */
    const overlay = document.createElement('div');
    overlay.className = 'cwz-overlay';
    overlay.id = instId;
    overlay.innerHTML = `
      <div class="cwz-box">
        <div class="cwz-head">
          <div class="cwz-head-top">
            <div>
              <h3>${mode === 'edit' ? 'Edit Campaign' : 'New Campaign'}</h3>
              <p id="${instId}-subtitle"></p>
            </div>
            <button class="cwz-close" id="${instId}-close"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="cwz-steps" id="${instId}-steps"></div>
        </div>
        <div class="cwz-body" id="${instId}-body"></div>
        <div class="cwz-foot">
          <div class="cwz-foot-left"><button class="cwz-btn" id="${instId}-back"><i class="fas fa-arrow-left"></i> Back</button></div>
          <div class="cwz-foot-right">
            <button class="cwz-btn" id="${instId}-cancel">Cancel</button>
            <button class="cwz-btn primary" id="${instId}-next">Next <i class="fas fa-arrow-right"></i></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const bodyEl = () => document.getElementById(instId + '-body');
    const stepsEl = () => document.getElementById(instId + '-steps');

    /* ── Step indicator ── */
    function renderSteps() {
      const labels = ['Setup', 'Audience', 'Estimate'];
      stepsEl().innerHTML = labels.map((l, i) => {
        const n = i + 1;
        const cls = n === step ? 'on' : n < step ? 'done' : '';
        return `<div class="cwz-step-pill ${cls}">
          <div class="cwz-step-num">${n < step ? '<i class="fas fa-check"></i>' : n}</div>
          <span class="cwz-step-label">${l}</span>
        </div>`;
      }).join('');
      document.getElementById(instId + '-subtitle').textContent =
        step === 1 ? 'Name it, pick an objective, choose surfaces and duration.'
        : step === 2 ? 'Narrow down exactly who should see this campaign.'
        : 'Review everything before it goes live.';
    }

    /* ── STEP 1: Setup ── */
    function renderStepSetup() {
      const isBusiness = OBJ_MAP[state.objective] && OBJ_MAP[state.objective].isBusiness;
      const needsStory = OBJ_MAP[state.objective] && OBJ_MAP[state.objective].needsStory;

      bodyEl().innerHTML = `
        <div class="cwz-field">
          <label>Campaign Name</label>
          <input type="text" id="${instId}-name" placeholder="e.g. Summer Romance Push" value="${esc(state.name)}"/>
        </div>

        <div class="cwz-section-lbl"><i class="fas fa-bullseye"></i> Objective</div>
        <div class="cwz-obj-grid" id="${instId}-obj-grid">
          ${OBJECTIVES.map(o => `
            <div class="cwz-obj-opt${o.id === state.objective ? ' on' : ''}" data-obj="${o.id}">
              <b><i class="fas ${o.icon}" style="color:var(--accent,#ff0050)"></i>${o.label}</b>
              <span>${o.desc}</span>
            </div>`).join('')}
        </div>

        ${needsStory ? `
        <div class="cwz-field" style="margin-top:16px">
          <label>Story to Promote</label>
          <div id="${instId}-selected-story-wrap" style="${state.selectedStory ? '' : 'display:none'}">
            <div class="cwz-selected-story" id="${instId}-selected-story-card"></div>
          </div>
          <div id="${instId}-story-pick-wrap" style="${state.selectedStory ? 'display:none' : ''}">
            <input type="text" id="${instId}-story-search" placeholder="Search your story library…"/>
            <div class="cwz-story-pick-results" id="${instId}-story-results"></div>
          </div>
        </div>` : ''}

        ${isBusiness ? `
        <div class="cwz-row2" style="margin-top:16px">
          <div class="cwz-field" style="margin-bottom:0">
            <label>Advertiser / Brand Name</label>
            <input type="text" id="${instId}-advertiser" placeholder="e.g. PiggyVest" value="${esc(state.advertiserName)}"/>
          </div>
          <div class="cwz-field" style="margin-bottom:0">
            <label>Contact Email</label>
            <input type="email" id="${instId}-advertiser-email" placeholder="e.g. ads@brand.com" value="${esc(state.advertiserEmail)}"/>
          </div>
        </div>` : ''}

        <div class="cwz-section-lbl"><i class="fas fa-signal"></i> Surface(s)</div>
        <div class="cwz-placement-grid" id="${instId}-placement-grid">
          ${placements.map(p => `
            <label class="cwz-placement-opt${state.selectedPlacements.includes(p.id) ? ' on' : ''}" data-pid="${p.id}">
              <input type="checkbox" value="${p.id}" ${state.selectedPlacements.includes(p.id) ? 'checked' : ''}/>
              <div class="cwz-placement-opt-txt"><b><i class="fas ${p.icon}" style="margin-right:5px;color:var(--accent,#ff0050)"></i>${esc(p.label)}</b><span>${esc(p.desc)}</span></div>
            </label>`).join('')}
        </div>

        <div class="cwz-section-lbl"><i class="fas fa-sack-dollar"></i> Budget</div>
        <label class="cwz-budget-toggle-row"><input type="checkbox" id="${instId}-has-budget" ${state.hasBudget ? 'checked' : ''}/> This campaign has a budget</label>
        <div class="cwz-budget-fields${state.hasBudget ? ' show' : ''}" id="${instId}-budget-fields">
          <div class="cwz-field" style="margin-bottom:0"><label>Budget (USD)</label><input type="number" id="${instId}-budget" min="0" step="50" value="${esc(state.budget)}"/></div>
          <div class="cwz-field" style="margin-bottom:0"><label>Spent so far (USD)</label><input type="number" id="${instId}-spent" min="0" step="50" value="${esc(state.spent)}"/></div>
        </div>

        <div class="cwz-section-lbl"><i class="fas fa-calendar"></i> Duration</div>
        <div class="cwz-row2">
          <div class="cwz-field" style="margin-bottom:0"><label>Start Date</label><input type="date" id="${instId}-start" value="${esc(state.startDate)}"/></div>
          <div class="cwz-field" style="margin-bottom:0"><label>End Date</label><input type="date" id="${instId}-end" value="${esc(state.endDate)}"/></div>
        </div>

        <div class="cwz-error" id="${instId}-step1-error"></div>
      `;

      if (state.selectedStory) renderSelectedStory();

      document.querySelectorAll(`#${instId}-obj-grid .cwz-obj-opt`).forEach(el => {
        el.addEventListener('click', () => { state.objective = el.dataset.obj; renderStepSetup(); });
      });

      const searchInput = document.getElementById(instId + '-story-search');
      if (searchInput) {
        searchInput.addEventListener('input', renderStoryResults);
        searchInput.addEventListener('focus', renderStoryResults);
      }

      document.querySelectorAll(`#${instId}-placement-grid .cwz-placement-opt input`).forEach(inp => {
        inp.addEventListener('change', () => {
          const id = inp.value;
          if (inp.checked && !state.selectedPlacements.includes(id)) state.selectedPlacements.push(id);
          if (!inp.checked) state.selectedPlacements = state.selectedPlacements.filter(x => x !== id);
          inp.closest('.cwz-placement-opt').classList.toggle('on', inp.checked);
        });
      });

      const hasBudgetInp = document.getElementById(instId + '-has-budget');
      hasBudgetInp.addEventListener('change', () => {
        state.hasBudget = hasBudgetInp.checked;
        document.getElementById(instId + '-budget-fields').classList.toggle('show', state.hasBudget);
      });
    }

    function renderStoryResults() {
      const q = document.getElementById(instId + '-story-search').value.trim().toLowerCase();
      const box = document.getElementById(instId + '-story-results');
      const matches = storyLibrary.filter(s => !q || s.title.toLowerCase().includes(q) || s.author.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) {
        box.innerHTML = `<div style="padding:10px;font-size:11.5px;color:var(--text-faint,#9aa2b1)">No matching stories.</div>`;
        box.classList.add('show');
        return;
      }
      box.innerHTML = matches.map(s => `
        <div class="cwz-story-pick-row" data-sid="${esc(s.id)}">
          <img src="${esc(s.cover)}" alt=""/>
          <div class="cwz-story-pick-row-txt"><b>${esc(s.title)}</b><span>@${esc(s.author)} · ${esc(s.genre)}</span></div>
        </div>`).join('');
      box.classList.add('show');
      box.querySelectorAll('.cwz-story-pick-row').forEach(row => {
        row.addEventListener('click', () => {
          state.selectedStory = storyLibrary.find(x => x.id === row.dataset.sid);
          box.classList.remove('show');
          document.getElementById(instId + '-story-pick-wrap').style.display = 'none';
          document.getElementById(instId + '-selected-story-wrap').style.display = 'block';
          renderSelectedStory();
        });
      });
    }

    function renderSelectedStory() {
      const s = state.selectedStory;
      const card = document.getElementById(instId + '-selected-story-card');
      if (!card || !s) return;
      card.innerHTML = `
        <img src="${esc(s.cover)}" alt=""/>
        <div class="cwz-selected-story-txt"><b>${esc(s.title)}</b><span>@${esc(s.author)} · ${esc(s.genre)}</span></div>
        <button type="button" class="cwz-selected-story-clear" id="${instId}-clear-story"><i class="fas fa-xmark"></i></button>`;
      document.getElementById(instId + '-clear-story').addEventListener('click', () => {
        state.selectedStory = null;
        document.getElementById(instId + '-selected-story-wrap').style.display = 'none';
        document.getElementById(instId + '-story-pick-wrap').style.display = 'block';
        document.getElementById(instId + '-story-search').value = '';
      });
    }

    function collectStep1() {
      state.name = document.getElementById(instId + '-name').value.trim();
      const isBusiness = OBJ_MAP[state.objective] && OBJ_MAP[state.objective].isBusiness;
      if (isBusiness) {
        state.advertiserName = document.getElementById(instId + '-advertiser').value.trim();
        state.advertiserEmail = document.getElementById(instId + '-advertiser-email').value.trim();
      }
      state.hasBudget = document.getElementById(instId + '-has-budget').checked;
      state.budget = document.getElementById(instId + '-budget') ? document.getElementById(instId + '-budget').value : '';
      state.spent = document.getElementById(instId + '-spent') ? document.getElementById(instId + '-spent').value : '';
      state.startDate = document.getElementById(instId + '-start').value;
      state.endDate = document.getElementById(instId + '-end').value;
    }

    function validateStep1() {
      const errBox = document.getElementById(instId + '-step1-error');
      errBox.classList.remove('show');
      if (!state.name) { errBox.textContent = 'Please enter a campaign name.'; errBox.classList.add('show'); return false; }
      const objDef = OBJ_MAP[state.objective];
      if (objDef.needsStory && !state.selectedStory) { errBox.textContent = 'Please select a story to promote.'; errBox.classList.add('show'); return false; }
      if (objDef.isBusiness && !state.advertiserName) { errBox.textContent = 'Please enter the advertiser/brand name.'; errBox.classList.add('show'); return false; }
      if (!state.selectedPlacements.length) { errBox.textContent = 'Please select at least one placement surface.'; errBox.classList.add('show'); return false; }
      if (state.startDate && state.endDate && state.endDate < state.startDate) { errBox.textContent = "End date can't be before the start date."; errBox.classList.add('show'); return false; }
      return true;
    }

    /* ── STEP 2: Audience Targeting ──
       Interests: searchable dropdown, options + selected tags carry a
       reader-count stat. Basic/Advanced targeting: same dropdown pattern,
       but no stats since these are behavioral filters, not fixed segments.
       Selecting an option that needs extra input (min chapters, hours,
       age range, author names) reveals an inline field below the control. */
    function renderStepAudience() {
      const t = state.targeting;

      bodyEl().innerHTML = `
        <div class="cwz-section-lbl"><i class="fas fa-sliders"></i> Basic Targeting</div>

        <div class="cwz-field">
          <label>🎯 Interests</label>
          <div class="cwz-ms" id="${instId}-interest-ms"></div>
          <div class="cwz-hint">Search or pick from the list — each shows how many readers follow that interest.</div>
        </div>

        <div class="cwz-field">
          <label>🧭 Targeting Filters</label>
          <div class="cwz-ms" id="${instId}-basic-ms"></div>
          <div class="cwz-ms-extras" id="${instId}-basic-extras"></div>
        </div>

        <div class="cwz-row2">
          <div class="cwz-field" style="margin-bottom:0">
            <label>🌍 Country</label>
            <select id="${instId}-country">${COUNTRIES.map(c => `<option ${c === t.country ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="cwz-field" style="margin-bottom:0">
            <label>🗣️ Language</label>
            <select id="${instId}-language">${LANGUAGES.map(l => `<option ${l === t.language ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
        </div>

        <div class="cwz-advanced-toggle" id="${instId}-advanced-toggle" style="margin-top:14px">
          <i class="fas fa-chevron-${advancedOpen ? 'up' : 'down'}"></i> Advanced targeting (later)
        </div>
        <div class="cwz-advanced-body${advancedOpen ? ' show' : ''}" id="${instId}-advanced-body">
          <div class="cwz-field">
            <label>Advanced Filters</label>
            <div class="cwz-ms" id="${instId}-advanced-ms"></div>
            <div class="cwz-ms-extras" id="${instId}-advanced-extras"></div>
          </div>
        </div>

        <div class="cwz-section-lbl" style="margin-top:18px"><i class="fas fa-chart-simple"></i> Estimated Audience</div>
        <div class="cwz-estimate" id="${instId}-estimate"></div>
      `;

      /* Interests dropdown — carries stats */
      createMultiSelect(document.getElementById(instId + '-interest-ms'), {
        options: INTERESTS_DATA.map(i => ({ id: i.name, label: i.name, stat: i.count })),
        getSelected: () => t.interests,
        onAdd: (id) => { t.interests.push(id); renderEstimate(); },
        onRemove: (id) => { t.interests = t.interests.filter(x => x !== id); renderEstimate(); },
        showStats: true,
        placeholder: 'Search interests…',
      });

      /* Basic targeting dropdown — no stats */
      createMultiSelect(document.getElementById(instId + '-basic-ms'), {
        options: BASIC_TARGETING_OPTIONS,
        getSelected: () => getBasicSelectedIds(t),
        onAdd: (id) => { setBasicEnabled(t, id, true); renderBasicExtras(); renderEstimate(); },
        onRemove: (id) => { setBasicEnabled(t, id, false); renderBasicExtras(); renderEstimate(); },
        showStats: false,
        placeholder: 'Add a targeting filter…',
      });
      renderBasicExtras();

      /* Advanced targeting dropdown — no stats, revealed via toggle */
      createMultiSelect(document.getElementById(instId + '-advanced-ms'), {
        options: ADVANCED_TARGETING_OPTIONS,
        getSelected: () => getAdvancedSelectedIds(t),
        onAdd: (id) => { setAdvancedEnabled(t, id, true); renderAdvancedExtras(); renderEstimate(); },
        onRemove: (id) => { setAdvancedEnabled(t, id, false); renderAdvancedExtras(); renderEstimate(); },
        showStats: false,
        placeholder: 'Add an advanced filter…',
      });
      renderAdvancedExtras();

      document.getElementById(instId + '-country').addEventListener('change', (e) => { t.country = e.target.value; renderEstimate(); });
      document.getElementById(instId + '-language').addEventListener('change', (e) => { t.language = e.target.value; renderEstimate(); });

      document.getElementById(instId + '-advanced-toggle').addEventListener('click', () => {
        advancedOpen = !advancedOpen;
        document.getElementById(instId + '-advanced-body').classList.toggle('show', advancedOpen);
        document.querySelector(`#${instId}-advanced-toggle i`).className = `fas fa-chevron-${advancedOpen ? 'up' : 'down'}`;
      });

      renderEstimate();
    }

    /* Inline follow-up inputs for basic filters that need a value */
    function renderBasicExtras() {
      const t = state.targeting;
      const box = document.getElementById(instId + '-basic-extras');
      if (!box) return;
      const selectedWithExtra = getBasicSelectedIds(t).filter(id => BASIC_TARGETING_OPTIONS.find(o => o.id === id && o.extra));

      box.innerHTML = selectedWithExtra.map(id => {
        if (id === 'unlockedChapters') return `<div class="cwz-ms-extra-row"><b>💰 Min chapters unlocked:</b><input type="number" min="1" id="${instId}-ex-unlocked"/></div>`;
        if (id === 'readTime') return `<div class="cwz-ms-extra-row"><b>⏱️ Hours this month:</b><input type="number" min="1" id="${instId}-ex-readtime"/></div>`;
        if (id === 'age') return `<div class="cwz-ms-extra-row"><b>📱 Age range:</b><input type="number" min="13" id="${instId}-ex-age-min"/><span>to</span><input type="number" min="13" id="${instId}-ex-age-max"/></div>`;
        return '';
      }).join('');

      const um = document.getElementById(instId + '-ex-unlocked');
      if (um) { um.value = t.unlockedChapters.min; um.addEventListener('input', () => { t.unlockedChapters.min = parseInt(um.value, 10) || 0; renderEstimate(); }); }
      const rt = document.getElementById(instId + '-ex-readtime');
      if (rt) { rt.value = t.readTime.hours; rt.addEventListener('input', () => { t.readTime.hours = parseInt(rt.value, 10) || 0; renderEstimate(); }); }
      const amn = document.getElementById(instId + '-ex-age-min');
      const amx = document.getElementById(instId + '-ex-age-max');
      if (amn) { amn.value = t.age.min; amn.addEventListener('input', () => { t.age.min = parseInt(amn.value, 10) || 0; renderEstimate(); }); }
      if (amx) { amx.value = t.age.max; amx.addEventListener('input', () => { t.age.max = parseInt(amx.value, 10) || 0; renderEstimate(); }); }
    }

    /* Inline follow-up input for the advanced "following specific authors" filter */
    function renderAdvancedExtras() {
      const t = state.targeting;
      const box = document.getElementById(instId + '-advanced-extras');
      if (!box) return;
      const selectedWithExtra = getAdvancedSelectedIds(t).filter(id => ADVANCED_TARGETING_OPTIONS.find(o => o.id === id && o.extra));

      box.innerHTML = selectedWithExtra.map(id => {
        if (id === 'followingSpecificAuthors') return `<div class="cwz-ms-extra-row"><b>📋 Authors:</b><input type="text" class="wide" id="${instId}-ex-authors" placeholder="Author names, comma-separated"/></div>`;
        return '';
      }).join('');

      const fa = document.getElementById(instId + '-ex-authors');
      if (fa) {
        fa.value = (t.advanced.followingSpecificAuthors.authors || []).join(', ');
        fa.addEventListener('input', () => {
          t.advanced.followingSpecificAuthors.authors = fa.value.split(',').map(s => s.trim()).filter(Boolean);
        });
      }
    }

    function renderEstimate() {
      const est = estimateAudience(state.targeting);
      const el = document.getElementById(instId + '-estimate');
      if (!el) return;
      el.innerHTML = `
        <div class="cwz-estimate-top">
          <div class="cwz-estimate-ico"><i class="fas fa-users"></i></div>
          <div><div class="cwz-estimate-count">${fmtNum(est.count)} Readers</div><div class="cwz-estimate-lbl">Estimated Audience</div></div>
        </div>
        <div class="cwz-estimate-stats">
          <div class="cwz-estimate-stat"><b>${est.reach}</b><span>Potential Reach</span></div>
          <div class="cwz-estimate-stat"><b>${est.competition}</b><span>Competition</span></div>
        </div>`;
    }

    /* ── STEP 3: Review & Estimate ── */
    function renderStepReview() {
      const objDef = OBJ_MAP[state.objective];
      const est = estimateAudience(state.targeting);
      const t = state.targeting;

      const targetTags = [];
      if (t.interests.length) targetTags.push(`🎯 ${t.interests.join(', ')}`);
      if (t.similarStories) targetTags.push('📚 Similar Stories');
      if (t.tippedLast30Days) targetTags.push('❤️ Tipped (30d)');
      if (t.unlockedChapters.enabled) targetTags.push(`💰 ≥${t.unlockedChapters.min} Chapters`);
      if (t.readTime.enabled) targetTags.push(`⏱️ ${t.readTime.hours}+ hrs/mo`);
      if (t.followersOfSimilarAuthors) targetTags.push('👥 Similar Authors\' Followers');
      if (t.country !== 'All Countries') targetTags.push(`🌍 ${t.country}`);
      if (t.language !== 'All Languages') targetTags.push(`🗣️ ${t.language}`);
      if (t.age.enabled) targetTags.push(`📱 Age ${t.age.min}-${t.age.max}`);
      if (t.advanced.boughtCoinsRecently) targetTags.push('🎁 Bought Coins Recently');
      if (t.advanced.innerCircleMembers) targetTags.push('⭐ Inner Circle');
      if (t.advanced.highlyActiveReaders) targetTags.push('🔥 Highly Active');
      if (t.advanced.inactiveReaders) targetTags.push('😴 Inactive (Re-engage)');
      if (t.advanced.finishedSimilarBooks) targetTags.push('📖 Finished Similar Books');
      if (t.advanced.genreHubMembers) targetTags.push('🏷️ Genre Hub Members');
      if (t.advanced.followingSpecificAuthors.enabled) targetTags.push(`📋 Following: ${t.advanced.followingSpecificAuthors.authors.join(', ') || '—'}`);

      bodyEl().innerHTML = `
        <div class="cwz-section-lbl"><i class="fas fa-clipboard-check"></i> Campaign Setup</div>
        <div class="cwz-review-grid">
          <div class="cwz-review-item"><div class="cwz-review-lbl">Name</div><div class="cwz-review-val">${esc(state.name)}</div></div>
          <div class="cwz-review-item"><div class="cwz-review-lbl">Objective</div><div class="cwz-review-val">${esc(objDef.label)}</div></div>
          ${state.selectedStory ? `<div class="cwz-review-item"><div class="cwz-review-lbl">Story</div><div class="cwz-review-val">${esc(state.selectedStory.title)}</div></div>` : ''}
          ${objDef.isBusiness ? `<div class="cwz-review-item"><div class="cwz-review-lbl">Advertiser</div><div class="cwz-review-val">${esc(state.advertiserName)}</div></div>` : ''}
          <div class="cwz-review-item"><div class="cwz-review-lbl">Surfaces</div><div class="cwz-review-val">${state.selectedPlacements.length}</div></div>
          <div class="cwz-review-item"><div class="cwz-review-lbl">Budget</div><div class="cwz-review-val">${state.hasBudget ? '$' + fmtNum(parseFloat(state.budget) || 0) : 'None'}</div></div>
          <div class="cwz-review-item"><div class="cwz-review-lbl">Duration</div><div class="cwz-review-val" style="font-size:11.5px">${state.startDate || 'TBD'} → ${state.endDate || 'TBD'}</div></div>
        </div>

        <div class="cwz-section-lbl"><i class="fas fa-crosshairs"></i> Audience Targeting</div>
        <div class="cwz-review-tags">
          ${targetTags.length ? targetTags.map(tag => `<span class="cwz-review-tag">${esc(tag)}</span>`).join('') : '<span class="cwz-review-tag empty">No targeting filters — reaching all readers</span>'}
        </div>

        <div class="cwz-section-lbl" style="margin-top:18px"><i class="fas fa-chart-simple"></i> Estimated Audience</div>
        <div class="cwz-estimate">
          <div class="cwz-estimate-top">
            <div class="cwz-estimate-ico"><i class="fas fa-users"></i></div>
            <div><div class="cwz-estimate-count">${fmtNum(est.count)} Readers</div><div class="cwz-estimate-lbl">Estimated Audience</div></div>
          </div>
          <div class="cwz-estimate-stats">
            <div class="cwz-estimate-stat"><b>${est.reach}</b><span>Potential Reach</span></div>
            <div class="cwz-estimate-stat"><b>${est.competition}</b><span>Competition</span></div>
          </div>
        </div>

        <div class="cwz-field" style="margin-top:16px">
          <label>Description <span style="text-transform:none;font-weight:500;color:var(--text-faint,#9aa2b1)">(optional)</span></label>
          <textarea id="${instId}-desc" placeholder="What is this campaign for?">${esc(state.description)}</textarea>
        </div>
        <div class="cwz-field">
          <label>Owner <span style="text-transform:none;font-weight:500;color:var(--text-faint,#9aa2b1)">(optional)</span></label>
          <input type="text" id="${instId}-owner" placeholder="e.g. Tari Benson" value="${esc(state.owner)}"/>
        </div>
        <div class="cwz-error" id="${instId}-step3-error"></div>
      `;
    }

    function collectStep3() {
      const descEl = document.getElementById(instId + '-desc');
      const ownerEl = document.getElementById(instId + '-owner');
      if (descEl) state.description = descEl.value.trim();
      if (ownerEl) state.owner = ownerEl.value.trim();
    }

    /* ── Step navigation ── */
    function renderStep() {
      renderSteps();
      if (step === 1) renderStepSetup();
      else if (step === 2) renderStepAudience();
      else renderStepReview();

      document.getElementById(instId + '-back').style.visibility = step === 1 ? 'hidden' : 'visible';
      const nextBtn = document.getElementById(instId + '-next');
      nextBtn.innerHTML = step === 3
        ? `<i class="fas fa-bullseye"></i> ${mode === 'edit' ? 'Save Changes' : 'Launch Campaign'}`
        : `Next <i class="fas fa-arrow-right"></i>`;
      bodyEl().scrollTop = 0;
    }

    document.getElementById(instId + '-back').addEventListener('click', () => {
      if (step === 1) return;
      step--; renderStep();
    });

    document.getElementById(instId + '-next').addEventListener('click', () => {
      if (step === 1) {
        collectStep1();
        if (!validateStep1()) return;
        step = 2; renderStep(); return;
      }
      if (step === 2) { step = 3; renderStep(); return; }
      // step 3 → submit
      collectStep3();
      submit();
    });

    document.getElementById(instId + '-cancel').addEventListener('click', close);
    document.getElementById(instId + '-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function close() {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      if (typeof options.onCancel === 'function' && !overlay._submitted) options.onCancel();
    }

    function submit() {
      overlay._submitted = true;
      const objDef = OBJ_MAP[state.objective];
      const payload = {
        type: objDef.isBusiness ? 'business' : 'story',
        objective: state.objective,
        name: state.name,
        placements: state.selectedPlacements.slice(),
        startDate: state.startDate,
        endDate: state.endDate,
        hasBudget: state.hasBudget,
        budget: state.hasBudget ? (parseFloat(state.budget) || 0) : 0,
        spent: state.hasBudget ? (parseFloat(state.spent) || 0) : 0,
        owner: state.owner,
        description: state.description,
        audienceTargeting: JSON.parse(JSON.stringify(state.targeting)),
      };
      if (objDef.isBusiness) {
        payload.advertiserName = state.advertiserName;
        payload.advertiserEmail = state.advertiserEmail;
      } else if (state.selectedStory) {
        payload.storyId = state.selectedStory.id;
        payload.storyTitle = state.selectedStory.title;
        payload.storyAuthor = state.selectedStory.author;
        payload.storyGenre = state.selectedStory.genre;
        payload.storyCover = state.selectedStory.cover;
      }

      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      if (typeof options.onSubmit === 'function') options.onSubmit(payload);
    }

    renderStep();

    return { close };
  }

  window.CampaignWizard = { open, estimateAudience, OBJECTIVES, INTERESTS, INTERESTS_DATA, COUNTRIES, LANGUAGES };

})();