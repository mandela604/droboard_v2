/**
 * feed-data.js — Droboard Feed Data Service
 * ─────────────────────────────────────────────
 * Single place feed.html asks for organic feed content. Every call
 * tries the real API first (when CFG.USE_DEMO is false and
 * CFG.API_BASE is set), and falls back to the demo arrays below on
 * any failure — same shape either way, so the page never has to
 * branch on where the data came from.
 *
 *   const stories = await FeedData.getStories();
 *   const posts   = await FeedData.getFeedPosts();
 *   const slides  = await FeedData.getPromoSlides();
 *   const count   = await FeedData.getNotifCount();
 *
 * To go live: FeedData.configure({ USE_DEMO: false, API_BASE: '...' }).
 * Nothing in feed.html itself needs to change — this is the one place
 * that knows about demo vs. live.
 *
 * Ad content does NOT live here — feed.html mixes sponsored posts into
 * the feed itself (interleaveAds()), reading ad copy from ad-data.js's
 * window.AdData instead, so ad content only ever needs updating in one
 * place shared by every page that uses ad-card.js.
 *
 * This file is fully self-contained — DEMO_STORIES, DEMO_FEED_POSTS and
 * DEMO_PROMO_SLIDES all live below. It does NOT read window.FeedDemoSeed;
 * data/feed-demo-seed.js is not a dependency of this file.
 *
 * NOTE ON LIST LENGTH: DEMO_FEED_POSTS carries 28 organic posts (not
 * the smaller set from earlier builds). feed.html now cycles through
 * five ad formats (native, platform, story, follow, banner), and a
 * short post list meant some formats never got a turn before the list
 * ran out. 28 gives the ad cadence enough room to complete at least
 * one full pass through every format.
 */
(function () {
  'use strict';

  const CFG = { API_BASE: 'https://api.droboard.app', API_KEY: '', USE_DEMO: true };

  function configure(opts) { Object.assign(CFG, opts || {}); }

  async function apiFetch(endpoint) {
    if (CFG.USE_DEMO || !CFG.API_BASE) throw new Error('demo mode');
    const headers = { Accept: 'application/json' };
    if (CFG.API_KEY) headers.Authorization = `Bearer ${CFG.API_KEY}`;
    const res = await fetch(CFG.API_BASE + endpoint, { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  const YOU_AV = 'https://i.pravatar.cc/100?img=51';

  /* ══════════════════════════════════════════════════════════════════
     DEMO STORIES — each non-"you" entry carries the `statuses` array
     status-viewer.js expects (bg/quote/caption/time per slide), plus
     ring/likes/threads, so the stories row can open the shared status
     viewer instead of just toasting.
  ══════════════════════════════════════════════════════════════════ */
  const DEMO_STORIES = [
    { id: 'you', name: 'Your Story', you: true, avatar: YOU_AV },
    {
      id: 'luna-grey', name: 'Luna Grey', avatar: 'https://i.pravatar.cc/100?img=5',
      ring: 'ring-live', likes: 412, threads: 38,
      statuses: [
        { bg: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=900&fit=crop', quote: '"Chapter 21 is finally live — the truth comes out tonight."', caption: 'His Sweet Revenge · New chapter', time: '2h ago' },
        { bg: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', quote: '"I did not expect this ending. Neither will you."', caption: 'Behind the scenes', time: '1h ago' },
      ],
    },
    {
      id: 'ada-writes', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32',
      ring: 'ring-live', likes: 842, threads: 134,
      statuses: [
        { bg: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=500&h=900&fit=crop', quote: '"Writing at 2am has a different energy."', caption: 'Ada_Writes · Live now', time: '20m ago' },
      ],
    },
    {
      id: 'alex-pierce', name: 'Alex Pierce', avatar: 'https://i.pravatar.cc/100?img=12',
      ring: 'ring-has', likes: 120, threads: 9,
      statuses: [
        { bg: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', quote: '"Family secrets never stay buried."', caption: 'New series teaser', time: '4h ago' },
      ],
    },
    {
      id: 'mia-clark', name: 'Mia Clark', avatar: 'https://i.pravatar.cc/100?img=9',
      ring: 'ring-has', likes: 88, threads: 5,
      statuses: [
        { bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: '"Some letters are never meant to be sent."', caption: 'Elegy series', time: '6h ago' },
      ],
    },
    {
      id: 'sofia', name: 'Sofia', avatar: 'https://i.pravatar.cc/100?img=32',
      ring: 'ring-viewed', likes: 64, threads: 3,
      statuses: [
        { bg: 'https://i.postimg.cc/WF1j4Pnh/6.jpg', quote: '"Team Alex or Team Jaxon?"', caption: 'Poll live now', time: '5h ago' },
      ],
    },
    {
      id: 'jaxon', name: 'Jaxon', avatar: 'https://i.pravatar.cc/100?img=15',
      ring: 'ring-has', likes: 41, threads: 2,
      statuses: [
        { bg: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', quote: '"This story ruined my whole week (in the best way)."', caption: 'Recommending a read', time: '2h ago' },
      ],
    },
  ];

  /* ══════════════════════════════════════════════════════════════════
     DEMO PROMO SLIDES — same shape component/promo-slider.js's
     DroboardPromoSlider.mount() expects. Restored here so feed.html's
     mountPromo() has something to render — this function was missing
     from the self-contained rewrite of this file.
  ══════════════════════════════════════════════════════════════════ */
  const DEMO_PROMO_SLIDES = [
    {
      id: 'pr1',
      title: 'His Sweet Revenge',
      author: 'Luna Grey',
      cta: 'Read Now',
      img: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&h=200&fit=crop',
      eyebrow: 'Promoted',
    },
    {
      id: 'pr2',
      title: 'Season of Betrayal · Ch. 63',
      author: 'Ada_Writes',
      cta: 'Open',
      img: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
      eyebrow: 'Promoted',
    },
    {
      id: 'pr3',
      title: 'The letter folded inside his jacket',
      author: 'Efe_O',
      cta: 'Read Now',
      img: 'https://i.postimg.cc/N9jY0w4m/5.jpg',
      eyebrow: 'Promoted',
    },
    {
      id: 'pr4',
      title: 'Go Premium — unlock every chapter',
      author: 'DroBoard',
      cta: 'Go Premium',
      img: 'https://picsum.photos/seed/dropremium/800/200',
      eyebrow: 'DroBoard',
    },
  ];

  /* ══════════════════════════════════════════════════════════════════
     DEMO FEED POSTS — organic content only. No type:'sponsored' entries
     here — feed.html's interleaveAds() owns 100% of ad placement,
     reading from window.AdData, so there's exactly one mechanism
     deciding where ads land instead of two.
  ══════════════════════════════════════════════════════════════════ */
  const DEMO_FEED_POSTS = [
    {
      id: 'p1', type: 'ama', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '2h ago',
      amaData: { isLive: true, viewers: 847, title: 'Ask Ada_Writes Anything 🎙',
        meta: 'Writing process · Betrayal series secrets · Where Season 3 is going — bring your questions' },
      likes: 842, liked: false, comments: 134,
    },
    {
      id: 'p2', type: 'chapter-drop', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '5h ago',
      text: "Chapter 5 of Season 2 just dropped 🔥 I cried writing the last scene. You will cry reading it.",
      chapterRef: { cat: '💔 Betrayal', title: "I came home early and caught my husband kissing my late sister's photograph", ch: 'S2 · Chapter 5', cover: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg' },
      likes: 1240, liked: false, comments: 287,
    },
    {
      id: 'p3', type: 'review', name: 'BookLover_99', avatar: 'https://i.pravatar.cc/100?img=20',
      time: '40m ago',
      storyRef: { title: "The Billionaire's Regret", cover: 'https://i.postimg.cc/WF1j4Pnh/6.jpg', author: 'Sofia_Reads' },
      score: 4, reviewText: "The pacing dragged a little in the middle chapters, but the twist in chapter 18 completely redeemed it. Ugly-cried on the bus. Worth every chapter.",
      likes: 56, liked: false, comments: 14,
    },
    {
      id: 'p4', type: 'post', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '1d ago',
      text: "Writing at 2am has a different energy. The city is quiet. The grief is louder. That's where the best chapters come from. 🌙",
      image: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=900&q=80',
      likes: 612, liked: false, comments: 89,
    },
    {
      id: 'p5', type: 'recommendation', name: 'Jaxon', avatar: 'https://i.pravatar.cc/100?img=15',
      time: '2h ago',
      note: "If you haven't read this yet, drop what you're doing. This story ruined my whole week (in the best way).",
      storyRef: { cat: '🌙 Elegy', title: 'The letter folded inside his jacket pocket — he died before sending it', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg', author: 'Efe_O' },
      likes: 203, liked: false, comments: 38,
    },
    {
      id: 'p6', type: 'quote', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '1d ago',
      quote: '"She didn\'t ask for an explanation. She just picked up her bag, pressed her lips together so her voice wouldn\'t shake, and walked out like she had planned it for years."',
      caption: '— Chapter 3, Season 2 of The Runaway Bride',
      likes: 3200, liked: true, comments: 412,
    },
    {
      id: 'p7', type: 'repost', name: 'Emily Carter', avatar: 'https://i.pravatar.cc/100?img=16',
      time: '15m ago',
      note: 'This chapter just broke me! Luna Grey never disappoints.',
      original: { name: 'Luna Grey', avatar: 'https://i.pravatar.cc/100?img=5', time: '2h ago',
        text: 'Chapter 21 of "His Sweet Revenge" is live. Everything changes when she discovers the truth he tried so hard to hide.',
        cover: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=500&h=650&fit=crop', title: 'His Sweet Revenge' },
      likes: 98, liked: false, comments: 27,
    },
    {
      id: 'p8', type: 'poll', name: 'Sofia_Reads', avatar: 'https://i.pravatar.cc/100?img=32',
      time: '5h ago',
      poll: { question: 'Team Alex or Team Jaxon in "His Sweet Revenge"?',
        opts: [{ label: 'Team Alex', v: 118 }, { label: 'Team Jaxon', v: 85 }], total: 203, voted: -1 },
      likes: 44, liked: false, comments: 19,
    },
    {
      id: 'p9', type: 'debate', name: 'Droboard', avatar: 'https://i.pravatar.cc/100?img=68',
      time: '3h ago',
      debateData: { question: 'Should villains get redemption?', prompt: 'Share your thoughts and join the debate!',
        forText: 'Yes, everyone deserves a second chance.', againstText: 'No, some actions are unforgivable.',
        forV: 264, agV: 164, userVote: null },
      likes: 0, liked: false, comments: 0,
    },
    {
      id: 'p10', type: 'review', name: 'BookAddict', avatar: 'https://i.pravatar.cc/100?img=25',
      time: '6h ago',
      storyRef: { title: 'Burn For Me, Elsa', cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=200&h=260&fit=crop', author: 'Kemi_A' },
      score: 5, reviewText: "Just finished this masterpiece! The ending genuinely surprised me — recommend it to everyone who loves a slow-burn.",
      likes: 82, liked: false, comments: 19,
    },
    {
      id: 'p11', type: 'post', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '3d ago', pinned: true,
      text: "For everyone asking: yes, Season 3 of the Betrayal series is coming. Dropping next Friday. Midnight. Set your alarms.",
      likes: 2100, liked: false, comments: 567,
    },
    {
      id: 'p12', type: 'chapter-drop', name: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=2',
      verified: true, time: '9h ago',
      text: '',
      chapterRef: { cat: 'Billionaire', title: 'Devil in a Suit', ch: 'Chapter 55', cover: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg' },
      likes: 780, liked: true, comments: 90,
    },
    {
      id: 'p13', type: 'post', name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=7',
      time: '10h ago',
      text: 'Editing Chapter 12 and I keep crying at my own draft. Is that normal 😭',
      likes: 501, liked: false, comments: 88,
    },
    {
      id: 'p14', type: 'recommendation', name: 'Dami_Cole', avatar: 'https://i.pravatar.cc/100?img=9',
      time: '11h ago',
      note: 'If you loved "Married to the Enemy," you need to read this next.',
      storyRef: { title: 'Contract Without Love', author: 'Dami_Cole', cat: 'Billionaire', cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg' },
      likes: 356, liked: false, comments: 19,
    },
    {
      id: 'p15', type: 'debate', name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48',
      time: '12h ago',
      debateData: { question: 'Should love triangles be banned from romance fiction?', prompt: 'This one\u2019s been heating up the comments all week.', forText: 'Yes, they\u2019re overused', againstText: 'No, done well they work', forV: 612, agV: 745, userVote: null },
      likes: 140, liked: false, comments: 210,
    },
    {
      id: 'p16', type: 'quote', name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22',
      time: '13h ago',
      quote: '"He wasn\u2019t her plan. He was the thing that happened while she was busy making one."',
      caption: 'From Chapter 8 — The Billionaire Never Forgets',
      likes: 421, liked: false, comments: 33,
    },
    {
      id: 'p17', type: 'post', name: 'Bode_Ilo', avatar: 'https://i.pravatar.cc/100?img=15',
      time: '14h ago',
      text: 'Trying a new update schedule — 3 chapters a week starting Monday. Let me know what you think.',
      likes: 190, liked: false, comments: 54,
    },
    {
      id: 'p18', type: 'review', name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=25',
      time: '15h ago',
      storyRef: { title: 'Fangs & Fortune', author: 'Ese_Uyi', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg' },
      score: 4, reviewText: 'Dark, atmospheric, and the world-building is dense in the best way. Took a couple chapters to click but stuck the landing.',
      likes: 145, liked: false, comments: 9,
    },
    {
      id: 'p19', type: 'post', name: 'Alex Pierce', avatar: 'https://i.pravatar.cc/100?img=12',
      time: '16h ago',
      text: 'Family secrets never stay buried — teaser for the new series drops this weekend. Who’s ready?',
      likes: 233, liked: false, comments: 41,
    },
    {
      id: 'p20', type: 'chapter-drop', name: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53',
      verified: true, time: '17h ago',
      text: 'The altar scene. In socked feet. You asked, I delivered.',
      chapterRef: { cat: '✨ Twist', title: 'The Runaway Bride', ch: 'Chapter 9', cover: 'https://i.postimg.cc/tY7KnJyr/images.jpg' },
      likes: 967, liked: false, comments: 152,
    },
    {
      id: 'p21', type: 'poll', name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=7',
      time: '18h ago',
      poll: { question: 'Should slow-burn romances update faster?',
        opts: [{ label: 'Yes, I need my fix', v: 302 }, { label: 'No, let it breathe', v: 214 }], total: 516, voted: -1 },
      likes: 71, liked: false, comments: 26,
    },
    {
      id: 'p22', type: 'recommendation', name: 'Mia Clark', avatar: 'https://i.pravatar.cc/100?img=9',
      time: '19h ago',
      note: 'Some letters are never meant to be sent — read this one with tissues nearby.',
      storyRef: { cat: '🌙 Elegy', title: 'The Letter Never Sent', cover: 'https://i.postimg.cc/N9jY0w4m/5.jpg', author: 'Efe_O' },
      likes: 178, liked: false, comments: 22,
    },
    {
      id: 'p23', type: 'quote', name: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=2',
      verified: true, time: '20h ago',
      quote: '"He built an empire on silence. She was the only person who made him speak."',
      caption: '— His Cold Empire, Chapter 14',
      likes: 890, liked: false, comments: 61,
    },
    {
      id: 'p24', type: 'post', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', avatarRing: true,
      verified: true, rank: '#1 This Week', time: '21h ago',
      text: 'Voice chat is live now — come hang out while I outline next week\u2019s chapter. Link in stories.',
      likes: 455, liked: false, comments: 73,
    },
    {
      id: 'p25', type: 'review', name: 'Sofia_Reads', avatar: 'https://i.pravatar.cc/100?img=32',
      time: '22h ago',
      storyRef: { title: 'The Alpha\u2019s Obsession', author: 'Ifeanyi_Story', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg' },
      score: 5, reviewText: 'A werewolf romance that actually respects its own lore. The pack politics alone are worth the read.',
      likes: 214, liked: false, comments: 37,
    },
    {
      id: 'p26', type: 'debate', name: 'Chidi_Omega', avatar: 'https://i.pravatar.cc/100?img=55',
      time: '23h ago',
      debateData: { question: 'Do enemies-to-lovers arcs need a redemption scene?', prompt: 'Weigh in below.',
        forText: 'Yes, it earns the ending', againstText: 'No, chemistry is enough', forV: 388, agV: 271, userVote: null },
      likes: 95, liked: false, comments: 118,
    },
    {
      id: 'p27', type: 'chapter-drop', name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47',
      verified: true, time: '1d ago',
      text: 'The will names someone no one in the family has ever heard of. Chapter 6 is up.',
      chapterRef: { cat: '👑 Family', title: "Grandmother's Hidden Will", ch: 'Chapter 6', cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg' },
      likes: 704, liked: false, comments: 96,
    },
    {
      id: 'p28', type: 'repost', name: 'Jaxon', avatar: 'https://i.pravatar.cc/100?img=15',
      time: '2h ago',
      note: 'Alex Pierce is cooking with this one — read the teaser.',
      original: { name: 'Alex Pierce', avatar: 'https://i.pravatar.cc/100?img=12', time: '4h ago',
        text: 'Family secrets never stay buried. New series teaser is up now — first chapter drops Friday.',
        cover: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', title: 'New Series Teaser' },
      likes: 63, liked: false, comments: 11,
    },
  ];

  /* ══════════════════════════════════════════════════════════════════
     Public service functions — same shape whether it came from the
     API or the demo fallback.
  ══════════════════════════════════════════════════════════════════ */
  async function getStories() {
    try { return await apiFetch('/v1/feed/stories'); }
    catch (e) { return DEMO_STORIES; }
  }

  async function getFeedPosts() {
    try { return await apiFetch('/v1/feed'); }
    catch (e) { return DEMO_FEED_POSTS; }
  }

  async function getPromoSlides() {
    try { return await apiFetch('/v1/feed/promo'); }
    catch (e) { return DEMO_PROMO_SLIDES; }
  }

  async function getNotifCount() {
    try { const d = await apiFetch('/v1/notifications/unread-count'); return d.count; }
    catch (e) { return 6; }
  }

  window.FeedData = { configure, getStories, getFeedPosts, getPromoSlides, getNotifCount, YOU_AV };
})();