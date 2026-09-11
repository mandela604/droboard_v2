/* ═══════════════════════════════════════════════════════════════
   HOME DEMO SEED
   Raw demo content for index.html, split out of the page the same
   way feed-demo-seed.js / genre-demo-seed.js / profile-demo-seed.js
   are — so index.html can go through services/home-data.js instead
   of hand-rolling arrays inline like the old version did.
═══════════════════════════════════════════════════════════════ */
(function () {
  const COVERS = [
    'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
    'https://i.postimg.cc/fkdXzjSj/wife.jpg',
    'https://i.postimg.cc/ftRZbhKx/3.jpg',
    'https://i.postimg.cc/N9jY0w4m/5.jpg',
    'https://i.postimg.cc/JDzmhWqj/2.jpg',
    'https://i.postimg.cc/DJwFzKgd/4.jpg',
    'https://i.postimg.cc/cgLZJNmC/8.jpg',
    'https://i.postimg.cc/0MyxNqfz/7.jpg',
    'https://i.postimg.cc/WF1j4Pnh/6.jpg',
    'https://i.postimg.cc/xqmHfyNR/wolf2.jpg',
    'https://i.postimg.cc/fkdXzjS8/wolf.jpg',
    'https://i.postimg.cc/tY7KnJyr/images.jpg',
    'https://i.postimg.cc/YGCkSw-33/1.jpg',
    'https://i.postimg.cc/23WvkFLH/images-(2).jpg',
  ];
  const c = i => COVERS[i % COVERS.length];

  const HERO_STORIES = [
    { id: 'h1', cover: c(0), genre: '💔 Betrayal', rating: '4.8', reads: '171k', chapter: 'Chapter 9',
      title: "I Came Home Early and Caught My Husband Kissing My Late Sister's Photograph",
      author: 'Ada_Writes', authorAv: 'https://i.pravatar.cc/100?img=32', verified: true,
      synopsis: 'A woman returns home early to find her husband in an intimate moment with a photograph of her deceased sister — revealing a love triangle she never knew existed.',
      tags: ['Betrayal', 'Family'] },
    { id: 'h2', cover: c(12), genre: '✨ Twist', rating: '4.9', reads: '312k', chapter: 'Chapter 15',
      title: 'The Runaway Bride — I Left the Altar in My Socked Feet',
      author: 'Ifeanyi_Story', authorAv: 'https://i.pravatar.cc/100?img=53', verified: true,
      synopsis: 'In front of four hundred guests, a bride does the unthinkable — and discovers that the moment everyone thought would ruin her was the moment her real life began.',
      tags: ['Twist', 'Romance'] },
    { id: 'h3', cover: c(10), genre: '👑 Family', rating: '4.7', reads: '204k', chapter: 'Chapter 22',
      title: "My Grandmother's Will Revealed I Wasn't Her Blood",
      author: 'Chiamaka_N', authorAv: 'https://i.pravatar.cc/100?img=47', verified: false,
      synopsis: "At the reading of a grandmother's will, a young woman discovers a truth that redefines her identity — and finds something more powerful than blood waiting at the end.",
      tags: ['Family', 'Drama'] },
    { id: 'h4', cover: c(11), genre: '🔥 Revenge', rating: '4.8', reads: '192k', chapter: 'Chapter 6',
      title: 'My Stepmother Stole My University Fund',
      author: 'Zara_M', authorAv: 'https://i.pravatar.cc/100?img=16', verified: true,
      synopsis: 'After years of silent suffering, a girl discovers her stepmother is not who she says she is — and uses patience and the law to reclaim everything taken from her.',
      tags: ['Revenge', 'Family'] },
    { id: 'h5', cover: c(4), genre: '🌙 Elegy', rating: '4.9', reads: '218k', chapter: 'Chapter 31',
      title: 'The Letter He Never Sent',
      author: 'Efe_O', authorAv: 'https://i.pravatar.cc/100?img=22', verified: true,
      synopsis: 'A year after losing her first love, a woman discovers an unsent letter that explains the cruelty of his final months — and finds it heals her, even from the other side.',
      tags: ['Elegy', 'Romance'] },
  ];

  const CONTINUE_READING = [
    { id: 'cr1', cover: c(3), title: "The Alpha's Obsession", ch: 'Chapter 18', pct: 43 },
    { id: 'cr2', cover: c(1), title: 'Falling for My Fake Husband', ch: 'Chapter 12', pct: 25 },
    { id: 'cr3', cover: c(0), title: "The Mafia's Secret Wife", ch: 'Chapter 24', pct: 60 },
    { id: 'cr4', cover: c(4), title: 'His Ruthless Obsession', ch: 'Chapter 31', pct: 78 },
    { id: 'cr5', cover: c(7), title: "My Uncle's Stolen Will", ch: 'Chapter 8', pct: 19 },
  ];

  const TRENDING_GENRES = [
    { icon: '💔', name: 'Betrayal', count: '1.2k' },
    { icon: '🎓', name: 'Campus', count: '890' },
    { icon: '👑', name: 'Family', count: '740' },
    { icon: '🔥', name: 'Revenge', count: '620' },
    { icon: '✨', name: 'Twist', count: '580' },
    { icon: '🌙', name: 'Elegy', count: '310' },
    { icon: '💍', name: 'Romance', count: '950' },
  ];

  const CHAPTER_DROPS = [
    { id: 'cd1', cover: c(0), title: 'His Sweet Revenge — Chapter 21', author: 'Luna Grey', time: '2h ago' },
    { id: 'cd2', cover: c(9), title: 'Forbidden Hearts — Chapter 9', author: 'Mia Clark', time: '4h ago' },
    { id: 'cd3', cover: c(7), title: "My Uncle's Stolen Will — Chapter 8", author: 'Chiamaka_N', time: '6h ago' },
    { id: 'cd4', cover: c(14), title: "Best Friend's Ring — Chapter 4", author: 'Kemi_A', time: '9h ago' },
    { id: 'cd5', cover: c(4), title: 'The Letter He Never Sent — Chapter 3', author: 'Efe_O', time: '12h ago' },
    { id: 'cd6', cover: c(11), title: "Stepmother's Secret — Chapter 6", author: 'Zara_M', time: '1d ago' },
    { id: 'cd7', cover: c(12), title: 'The Runaway Bride — Chapter 5', author: 'Ifeanyi_Story', time: '1d ago' },
    { id: 'cd8', cover: c(10), title: "Grandmother's Will — Chapter 13", author: 'Chiamaka_N', time: '2d ago' },
  ];

  const WRITERS_TO_FOLLOW = [
    { name: 'Ada_Writes', meta: '12.4k followers', av: 'https://i.pravatar.cc/100?img=32' },
    { name: 'Ifeanyi_Story', meta: '31.7k followers', av: 'https://i.pravatar.cc/100?img=53' },
    { name: 'Chiamaka_N', meta: '19.2k followers', av: 'https://i.pravatar.cc/100?img=47' },
    { name: 'Zara_M', meta: '14.8k followers', av: 'https://i.pravatar.cc/100?img=16' },
    { name: 'Efe_O', meta: '22.3k followers', av: 'https://i.pravatar.cc/100?img=22' },
  ];

  const STATUSES = [
    { id: 'you', isYou: true, name: 'Your Story' },
    { id: 'w1', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', ring: 'ring-live', isLive: true },
    { id: 'w5', name: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53', ring: 'ring-has' },
    { id: 'w2', name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=12', ring: 'ring-has' },
    { id: 'w7', name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', ring: 'ring-viewed' },
    { id: 'w4', name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28', ring: 'ring-viewed' },
    { id: 'w3', name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47', ring: 'ring-none' },
  ];

  const EVENT = {
    badge: 'Reading Challenge',
    title: 'Summer Reading Challenge',
    sub: 'Read for 30 minutes a day this week and unlock a free coin bundle plus a limited badge for your profile.',
    progressLabel: '3/7 days',
    progressPct: 42,
  };

  const ANNOUNCEMENT = {
    badge: 'Droboard News',
    time: '2d ago',
    title: 'Reading Streaks are here 🔥',
    text: 'Track your daily reading, earn badges, and keep your streak alive. Plus: a redesigned chapter reader with adjustable fonts and themes just shipped.',
  };

  /* Ad slots — same shapes DroboardAdCard already knows how to render
     (renderStoryPromo / renderPlatform), so index.html can reuse that
     component instead of hand-rolling ad slide markup. */
  const ADS = {
    dropAd: {
      id: 'home_drop_ad_1', title: 'Bound to the Ruthless CEO', cat: 'Romance · Billionaire',
      cover: c(6), desc: 'A deal. A marriage. A love she never saw coming.',
      authorName: 'Ava Winters', authorAv: 'https://i.pravatar.cc/100?img=61',
      views: '410k', likes: '38k', chapters: 40, rating: '4.7', cta: 'Read Now',
    },
    promoSlides: [
      { id: 'home_promo_1', title: 'Go Premium — Read Without Limits', sub: 'Unlimited chapters, early access, ad-free.', img: c(2), cta: 'Try Premium Free' },
      { id: 'home_promo_2', title: 'Married to the Enemy', sub: 'She married him for the family name.', img: c(11), cta: 'Read Now' },
      { id: 'home_promo_3', title: 'Invite Friends, Earn Coins', sub: 'You both earn 50 coins when they start reading.', img: c(8), cta: 'Invite Now' },
    ],
  };

  window.HomeDemoSeed = {
    COVERS, c,
    HERO_STORIES, CONTINUE_READING, TRENDING_GENRES, CHAPTER_DROPS,
    WRITERS_TO_FOLLOW, STATUSES, EVENT, ANNOUNCEMENT, ADS,
  };
})();