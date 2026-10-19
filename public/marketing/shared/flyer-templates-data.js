/**
 * flyer-templates-data.js — Fixed Master Templates for Creator Launch Kit
 * Marketing owns these. The PRODUCT, not AI one-offs.
 * Each template declares: size, ratio, variables needed, layout blocks.
 * Edits made on marketing/templates.html persist to localStorage
 * (droboard_flyer_templates_v1) so the Author Center sees the same list.
 * Going live: swap localStorage for /api/flyer-templates with the same shape.
 */
(function(global){
'use strict';

var STORAGE_KEY='droboard_flyer_templates_v1';

const VARS = {
  authorPhoto: { label:'Author photo', type:'image' },
  cover:       { label:'Book cover',   type:'image' },
  userPhoto:   { label:'Your photo',   type:'image' },
  title:       { label:'Story title',  type:'text'  },
  hook:        { label:'Hook / excerpt', type:'text' },
  bio:         { label:'Bio / About you', type:'text', note:'Short bio — anything the writer wants to say' },
  authorName:  { label:'Author name',  type:'text'  },
  handle:      { label:'Handle / @username', type:'text' },
  genre:       { label:'Genre',        type:'text'  },
  link:        { label:'DroBoard link',type:'url', note:'Paste the link you copied from the platform — the CTA button will carry it' },
  storeUrl:    { label:'Store link (optional)', type:'url', note:'Direct link to Store — shown as a second CTA when set' },
  platformTag: { label:'Platform tagline', type:'text' },
  ctaText:     { label:'CTA text',     type:'text', note:'Edit the button text, e.g. Read Now, Follow Me, Join DroBoard' },
  accent:      { label:'Accent color', type:'color', note:'Change the flyer accent color' },
  // ── Editable copy (was hardcoded in the renderer) ──
  headline:    { label:'Headline (use | to split two lines)', type:'text' },
  chatTime:    { label:'Chat time',    type:'text'  },
  chatName:    { label:'Chat name',    type:'text'  },
  chatText:    { label:'Chat message', type:'textarea' },
  watchText:   { label:'Watch line',   type:'text', note:'Line above "DroBoard" on the CTA row' },
  tagline:     { label:'Tagline (use | for line breaks)', type:'text' },
  scriptText:  { label:'Script title (blank = story title, use | for break)', type:'text' },
  kicker:      { label:'Kicker line',  type:'text'  },
  badge:       { label:'Badge label',  type:'text'  },
  pill:        { label:'Corner pill label', type:'text' },
  // ── Editable profile stats ──
  statsReads:    { label:'Reads stat',     type:'text' },
  statsFollowers:{ label:'Followers stat', type:'text' },
  statsBooks:    { label:'Books stat',     type:'text' },
  hoursRead:     { label:'Hours read stat', type:'text' },
  booksRead:     { label:'Books read stat', type:'text' },
  streak:        { label:'Streak (days)',   type:'text' },
};

const DEFAULT_TEMPLATES = [
  { id:'tmpl_main', category:'writer', name:'Main Announcement — Instagram / Facebook', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Hero cover + headline. First thing readers see on feed.', accent:'#ff0050', icon:'fa-image',
    vars:['cover','title','authorName','handle','hook','genre','link','storeUrl','ctaText','accent','headline','chatTime','chatName','chatText','watchText','tagline','scriptText'], blocks:['heroCover','headline','title','author','hook','cta','link','logo'] },
  { id:'tmpl_wa_status', category:'writer', name:'WhatsApp Status', size:'9:16', px:'1080 × 1920', ratio:'9:16',
    desc:'Vertical, high contrast — held on a phone, one thumb tap.', accent:'#25d366', icon:'fa-whatsapp',
    vars:['cover','authorPhoto','title','authorName','hook','link','storeUrl','ctaText','accent','kicker'], blocks:['heroCover','authorRow','headline','title','hook','cta','link','logo'] },
  { id:'tmpl_wa_share', category:'writer', name:'WhatsApp Share Flyer', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Minimal, readable when forwarded. No clutter.', accent:'#128c7e', icon:'fa-share-nodes',
    vars:['cover','title','authorName','hook','link','storeUrl','ctaText','accent'], blocks:['heroCover','title','hook','cta','link','logo'] },
  { id:'tmpl_teaser', category:'writer', name:'Story Teaser', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Hook-first — one emotional line + title.', accent:'#7c3aed', icon:'fa-wand-magic-sparkles',
    vars:['cover','title','authorName','handle','hook','genre','link','storeUrl','ctaText','accent','headline','chatTime','chatName','chatText','watchText','tagline','scriptText'], blocks:['heroCover','hook','title','cta','link','logo'] },
  { id:'tmpl_drop', category:'writer', name:'New Chapter Drop', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'"New Chapter Out Now" — reuse every drop.', accent:'#f59e0b', icon:'fa-fire',
    vars:['cover','title','authorName','hook','link','storeUrl','ctaText','accent','badge'], blocks:['badge','heroCover','title','hook','cta','link','logo'] },
  { id:'tmpl_tiktok', category:'writer', name:'TikTok / Reels Cover', size:'9:16', px:'1080 × 1920', ratio:'9:16',
    desc:'Vertical cover for short video. Safe-area aware.', accent:'#000000', icon:'fa-tiktok',
    vars:['cover','title','authorName','hook','link','storeUrl','ctaText','accent','pill'], blocks:['heroCover','title','hook','cta','link','logo'] },
  { id:'tmpl_spotlight', category:'writer', name:'Author Spotlight', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'All about the author — bio, stats, handle. CTA: Follow Me.', accent:'#a78bfa', icon:'fa-user-pen',
    vars:['userPhoto','authorName','handle','bio','link','storeUrl','ctaText','accent','statsReads','statsFollowers','statsBooks'], blocks:['authorHero','authorName','bio','handle','cta','link','logo'] },
  { id:'tmpl_follow_me', category:'writer', name:'Follow Me on DroBoard', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Your photo + handle. Ask readers to follow you.', accent:'#ff0050', icon:'fa-user-plus',
    vars:['userPhoto','handle','authorName','genre','hook','link','storeUrl','ctaText','accent','statsReads','statsFollowers','statsBooks'], blocks:['userHero','handle','hook','cta','link','logo'] },
  // ── Platform promo flyers ──
  { id:'tmpl_platform_invite', category:'platform', published:true, name:'Invite Friends to DroBoard', size:'9:16', px:'1080 × 1920', ratio:'9:16',
    desc:'Add your photo — invite anyone to follow you on DroBoard.', accent:'#ff0050', icon:'fa-user-plus',
    vars:['userPhoto','handle','authorName','link','storeUrl','platformTag','ctaText','accent'], blocks:['userHero','handle','platformTag','cta','link'] },
  { id:'tmpl_platform_reader', category:'platform', name:'Reader Profile — Follow Me', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Reader stats: hours read, books read, streak. Ask to follow.', accent:'#0ea5e9', icon:'fa-book-reader',
    vars:['userPhoto','handle','authorName','bio','link','storeUrl','ctaText','accent','hoursRead','booksRead','streak'], blocks:['userHero','handle','bio','cta','link','logo'] },
  { id:'tmpl_platform_promo', category:'platform', published:true, name:'Platform Promo — Featured / Seasonal', size:'1:1', px:'1080 × 1080', ratio:'1:1',
    desc:'Seasonal or feature promo (e.g. Top Romance Week).', accent:'#7c3aed', icon:'fa-bullhorn',
    vars:['cover','title','hook','genre','link','storeUrl','ctaText','accent','badge'], blocks:['heroCover','headline','hook','cta','link','logo'] },
  { id:'tmpl_platform_countdown', category:'platform', name:'Platform Countdown — 7-Day Launch', size:'9:16', px:'1080 × 1920', ratio:'9:16',
    desc:'7-day launch countdown. Pick the day — flyer updates. Used for platform launch.', accent:'#f59e0b', icon:'fa-hourglass-half',
    vars:['title','hook','link','storeUrl','ctaText','accent'], blocks:['countBadge','headline','title','hook','cta','link','logo'],
    variants:['7 days to go','6 days to go','5 days to go','4 days to go','3 days to go','2 days to go','Tomorrow','Live Now'] },
];

// ── Persistence: marketing edits (create/edit/delete) survive reloads and are
// visible to the Author Center, which reads this same file. ──
function readSaved(){
  try{
    var raw=global.localStorage&&global.localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    var list=JSON.parse(raw);
    return (Array.isArray(list)&&list.length)?list:null;
  }catch(e){ return null; }
}
function stripHeavy(t){
  var c=Object.assign({},t);
  if(c.defaults){
    c.defaults=Object.assign({},c.defaults);
    Object.keys(c.defaults).forEach(function(k){
      var v=c.defaults[k];
      // uploaded photos can be huge data: URLs — keep them out of storage
      if(typeof v==='string'&&v.indexOf('data:')===0&&v.length>20000) delete c.defaults[k];
    });
  }
  return c;
}
function writeSaved(list){
  try{ global.localStorage.setItem(STORAGE_KEY, JSON.stringify((list||[]).map(stripHeavy))); return true; }
  catch(e){ return false; }
}
function resetSaved(){ try{ global.localStorage.removeItem(STORAGE_KEY); }catch(e){} }

var TEMPLATES = readSaved() || DEFAULT_TEMPLATES.slice();

global.FlyerTemplates = TEMPLATES.slice();
global.FlyerTemplateVars = VARS;
global.FlyerTemplateData = {
  TEMPLATES: DEFAULT_TEMPLATES.slice(),
  VARS: Object.assign({}, VARS),
  STORAGE_KEY: STORAGE_KEY,
  load: readSaved,
  save: writeSaved,
  reset: resetSaved,
};
})(window);
