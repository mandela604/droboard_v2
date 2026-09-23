/* ═══════════════════════════════════════════════════════════════
   CENTRAL DEMO DATA
   Single source of truth for all demo data across the app.
   Import this file before any page-specific scripts.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── COVER IMAGES ── */
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

  /* ── USERS / AUTHORS ── */
  const USERS = {
    Ada_Writes: {
      handle: 'Ada_Writes',
      name: 'Ada Writes',
      avatar: 'https://i.pravatar.cc/200?img=32',
      cover: COVERS[1],
      verified: true,
      isWriter: true,
      bio: 'Writing messy love, power, and the kind of endings that keep you up. Betrayal series updates every Friday.',
      statuses: [
        { bg: 'linear-gradient(135deg,#ff0050,#7a0030)', quote: 'Chapter 63 drops Friday midnight.', caption: 'She finally opens the letter.', time: '2h' },
        { bg: 'linear-gradient(135deg,#7c3aed,#2e1065)', quote: '1M reads on Season of Betrayal.', caption: 'Thank you for every single one.', time: '1d' },
        { bg: 'linear-gradient(135deg,#0ea5e9,#0c2a4a)', quote: 'Writing sprint: 2,000 words today.', caption: 'No distractions.', time: '3d' },
      ],
      readingStats: { hoursRead: 1320, booksFinished: 214, dayStreak: 46, weeklyGoalDays: 5, avgSessionMin: 38 },
      tips: {
        received: [
          { from: 'Sarah_Odum', amount: 200, note: 'For that Friday cliffhanger!', time: '2d' },
          { from: 'Luna_Grey', amount: 50, note: 'Chapter 63 broke me.', time: '5d' },
          { from: 'CampusQueen', amount: 100, note: 'Keep them coming!', time: '1w' },
        ],
        sent: [],
      },
      genres: ['romance', 'betrayal', 'mafia', 'drama'],
      location: 'Lagos, Nigeria',
      joinedLabel: 'Joined March 2023',
      stats: {
        following: 128,
        followers: 48200,
        books: 3,
        reads: 1280000,
        likes: 214000,
        saved: 0,
        reactions: 0,
        comments: 0,
      },
      achievements: [
        { label: 'Top Romance 2025', cls: 'gold' },
        { label: '1M+ Reads', cls: 'red' },
        { label: 'Verified Writer', cls: 'blue' },
        { label: 'Weekly Streak', cls: 'purple' },
      ],
      books: [
        { id: 'b1', title: 'Season of Betrayal', cat: 'Romance · Drama', cover: COVERS[1], reads: '820k', likes: '94k', rating: '4.9', chapters: 62 },
        { id: 'b2', title: 'Crowned in Sin', cat: 'Mafia', cover: COVERS[2], reads: '310k', likes: '41k', rating: '4.7', chapters: 48 },
        { id: 'b3', title: 'Until You Regret', cat: 'Revenge · Romance', cover: COVERS[4], reads: '150k', likes: '22k', rating: '4.8', chapters: 35 },
      ],
      collections: [
        { name: 'Slow Burn Favorites', count: 12, privacy: 'Public', covers: [COVERS[3], COVERS[5], COVERS[6], COVERS[7]] },
        { name: 'Draft Moodboards', count: 4, privacy: 'Private', covers: [COVERS[8], COVERS[2], COVERS[1], COVERS[4]] },
      ],
      following: [
        { name: 'Sarah_Odum', av: 'https://i.pravatar.cc/100?img=48', meta: 'Billionaire romance · 2.1M reads', following: true },
        { name: 'Bode_Ilo', av: 'https://i.pravatar.cc/100?img=12', meta: 'Campus comedies', following: true },
        { name: 'Luna_Grey', av: 'https://i.pravatar.cc/100?img=15', meta: 'Fantasy & fangs', following: false },
        { name: 'Zara_M', av: 'https://i.pravatar.cc/100?img=9', meta: 'Verified · Devil in a Suit', following: true },
      ],
      posts: [
        {
          id: 'pp1', type: 'chapter-drop', time: '2h', pinned: true, liked: false, likes: 1840, comments: 226, saved: false,
          text: 'Chapter 63 is live. She finally opens the letter.',
          chapterRef: { title: 'Season of Betrayal', ch: 'Chapter 63', cat: 'Romance · Drama', cover: COVERS[1] },
        },
        {
          id: 'pp2', type: 'ama', time: 'Yesterday', pinned: false, liked: true, likes: 920, comments: 410, saved: false,
          amaData: { title: 'AMA: Writing the Betrayal ending', meta: 'Ask about plot twists, characters, and Friday drops.', viewers: 3200 },
        },
        {
          id: 'pp3', type: 'quote', time: '3d', pinned: false, liked: false, likes: 540, comments: 48, saved: false,
          quote: 'Love is not the opposite of power. It is the only thing that survives it.',
          caption: '— from Season of Betrayal, Ch. 41',
        },
      ],
      about: {
        favoriteGenres: ['romance', 'betrayal', 'mafia', 'drama'],
        extra: [
          { icon: 'fa-globe', label: 'Website', value: 'ada.writes' },
          { icon: 'fa-book', label: 'Currently writing', value: 'Season of Betrayal · S3' },
          { icon: 'fa-heart', label: 'Favorite trope', value: 'Enemies to lovers' },
        ],
      },
    },

    Sarah_Odum: {
      handle: 'Sarah_Odum',
      name: 'Sarah Odum',
      avatar: 'https://i.pravatar.cc/200?img=48',
      cover: COVERS[3],
      verified: true,
      isWriter: true,
      bio: 'Billionaire romance. New chapters weekly. Soft on the outside, plot twist on the inside.',
      genres: ['billionaire', 'romance', 'drama'],
      location: 'Abuja, Nigeria',
      joinedLabel: 'Joined June 2022',
      stats: { following: 89, followers: 91000, books: 2, reads: 2100000, likes: 340000, saved: 0, reactions: 0, comments: 0 },
      achievements: [
        { label: '2M+ Reads', cls: 'gold' },
        { label: 'Verified Writer', cls: 'blue' },
      ],
      books: [
        { id: 'sb1', title: 'The Billionaire Never Forgets', cat: 'Billionaire', cover: COVERS[3], reads: '1.4M', likes: '180k', rating: '4.8', chapters: 71 },
        { id: 'sb2', title: 'Contract of Hearts', cat: 'Romance', cover: COVERS[5], reads: '620k', likes: '71k', rating: '4.6', chapters: 44 },
      ],
      collections: [
        { name: 'Boardroom Romance', count: 8, privacy: 'Public', covers: [COVERS[3], COVERS[5], COVERS[6], COVERS[1]] },
      ],
      following: [
        { name: 'Ada_Writes', av: 'https://i.pravatar.cc/100?img=32', meta: 'Betrayal series', following: true },
      ],
      posts: [
        {
          id: 'sp1', type: 'chapter-drop', time: '5h', pinned: true, liked: false, likes: 2100, comments: 301, saved: false,
          text: 'New chapter is up — the contract gets real.',
          chapterRef: { title: 'The Billionaire Never Forgets', ch: 'Chapter 72', cat: 'Billionaire', cover: COVERS[3] },
        },
      ],
      about: {
        favoriteGenres: ['billionaire', 'romance'],
        extra: [{ icon: 'fa-pen', label: 'Writing schedule', value: 'New chapter every Monday' }],
      },
    },

    You_Reader: {
      handle: 'You_Reader',
      name: 'Jordan Blake',
      avatar: 'https://i.pravatar.cc/200?img=11',
      cover: COVERS[6],
      verified: false,
      isWriter: false,
      bio: 'Here for the plot twists. Currently drowning in campus romance and werewolf arcs.',
      statuses: [
        { bg: 'linear-gradient(135deg,#16a34a,#052e22)', quote: 'Finished Season of Betrayal Ch. 40 at 2am.', caption: 'No regrets.', time: '5h' },
        { bg: 'linear-gradient(135deg,#f59e0b,#451a03)', quote: '20-story reading goal: 14/20.', caption: 'Almost there.', time: '2d' },
      ],
      readingStats: { hoursRead: 96, booksFinished: 14, dayStreak: 12, weeklyGoalDays: 4, avgSessionMin: 27 },
      tips: {
        received: [],
        sent: [
          { to: 'Ada_Writes', amount: 50, note: 'That plot twist deserved it.', time: '3d' },
          { to: 'Luna_Grey', amount: 25, note: 'Full moon chapter!', time: '1w' },
        ],
      },
      genres: ['campus', 'werewolf', 'romance'],
      location: 'Ibadan, Nigeria',
      joinedLabel: 'Joined January 2025',
      stats: {
        following: 42,
        followers: 18,
        books: 0,
        reads: 0,
        likes: 0,
        saved: 14,
        reactions: 86,
        comments: 31,
      },
      achievements: [
        { label: 'Early Supporter', cls: 'green' },
        { label: '50 Reactions', cls: 'purple' },
      ],
      books: [],
      library: [
        { title: 'Season of Betrayal', cat: 'Romance', author: 'Ada_Writes', cover: COVERS[1], ch: 'Ch. 40', badge: 'hot' },
        { title: 'Werewolf King, Human Queen', cat: 'Werewolf', author: 'Luna_Grey', cover: COVERS[2], ch: 'Ch. 12', badge: 'new' },
        { title: 'Campus Chaos', cat: 'Campus', author: 'Bode_Ilo', cover: COVERS[6], ch: 'Ch. 8', badge: '' },
      ],
      collections: [
        { name: 'Late Night Reads', count: 6, privacy: 'Private', covers: [COVERS[1], COVERS[2], COVERS[6], COVERS[7]] },
      ],
      following: [
        { name: 'Ada_Writes', av: 'https://i.pravatar.cc/100?img=32', meta: 'Betrayal series · 1.2M reads', following: true },
        { name: 'Sarah_Odum', av: 'https://i.pravatar.cc/100?img=48', meta: 'Billionaire romance', following: true },
      ],
      posts: [
        {
          id: 'rp1', type: 'repost', time: '1d', pinned: false, liked: false, likes: 12, comments: 2, saved: false,
          note: 'This arc wrecked me.',
          storyRef: { title: 'Season of Betrayal', cat: 'Romance', author: 'Ada_Writes', cover: COVERS[1] },
        },
      ],
      about: {
        favoriteGenres: ['campus', 'werewolf', 'romance'],
        extra: [{ icon: 'fa-bookmark', label: 'Reading goal', value: '20 stories this year' }],
      },
    },

    Luna_Grey: {
      handle: 'Luna_Grey',
      name: 'Luna Grey',
      avatar: 'https://i.pravatar.cc/100?img=15',
      cover: COVERS[7],
      verified: true,
      isWriter: true,
      bio: 'Fantasy, werewolves, and the stories that bite back.',
      genres: ['fantasy', 'werewolf'],
      location: 'Port Harcourt, Nigeria',
      joinedLabel: 'Joined January 2024',
      stats: { following: 67, followers: 28500, books: 2, reads: 890000, likes: 156000, saved: 0, reactions: 0, comments: 0 },
      achievements: [
        { label: 'Fantasy Star 2025', cls: 'purple' },
        { label: 'Verified Writer', cls: 'blue' },
      ],
      books: [
        { id: 'lb1', title: 'Werewolf King, Human Queen', cat: 'Werewolf', cover: COVERS[7], reads: '410k', likes: '67k', rating: '4.7', chapters: 52 },
        { id: 'lb2', title: 'Fangs & Fortune', cat: 'Fantasy', cover: COVERS[8], reads: '190k', likes: '28k', rating: '4.5', chapters: 31 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['fantasy', 'werewolf'],
        extra: [],
      },
    },

    Ifeanyi_Story: {
      handle: 'Ifeanyi_Story',
      name: 'Ifeanyi Story',
      avatar: 'https://i.pravatar.cc/100?img=53',
      cover: COVERS[12],
      verified: true,
      isWriter: true,
      bio: 'Twist endings that make you reread chapter one.',
      genres: ['twist', 'drama', 'romance'],
      location: 'Enugu, Nigeria',
      joinedLabel: 'Joined September 2023',
      stats: { following: 45, followers: 31700, books: 1, reads: 620000, likes: 98000, saved: 0, reactions: 0, comments: 0 },
      achievements: [
        { label: 'Top Twist Writer', cls: 'gold' },
      ],
      books: [
        { id: 'ib1', title: 'The Runaway Bride', cat: 'Twist', cover: COVERS[12], reads: '312k', likes: '45k', rating: '4.9', chapters: 28 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['twist', 'drama'],
        extra: [],
      },
    },

    Chiamaka_N: {
      handle: 'Chiamaka_N',
      name: 'Chiamaka Nwosu',
      avatar: 'https://i.pravatar.cc/100?img=47',
      cover: COVERS[10],
      verified: false,
      isWriter: true,
      bio: 'Family drama and stories that feel like home.',
      genres: ['family', 'drama', 'betrayal'],
      location: 'Owerri, Nigeria',
      joinedLabel: 'Joined May 2024',
      stats: { following: 34, followers: 19200, books: 1, reads: 420000, likes: 67000, saved: 0, reactions: 0, comments: 0 },
      achievements: [],
      books: [
        { id: 'cb1', title: "My Uncle's Stolen Will", cat: 'Family', cover: COVERS[7], reads: '138k', likes: '21k', rating: '4.7', chapters: 44 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['family', 'drama'],
        extra: [],
      },
    },

    Zara_M: {
      handle: 'Zara_M',
      name: 'Zara Mohammed',
      avatar: 'https://i.pravatar.cc/100?img=16',
      cover: COVERS[4],
      verified: true,
      isWriter: true,
      bio: 'Revenge plots and the women who execute them.',
      genres: ['revenge', 'betrayal', 'romance'],
      location: 'Kano, Nigeria',
      joinedLabel: 'Joined August 2023',
      stats: { following: 56, followers: 14800, books: 1, reads: 340000, likes: 52000, saved: 0, reactions: 0, comments: 0 },
      achievements: [],
      books: [
        { id: 'zb1', title: 'My Stepmother Stole My University Fund', cat: 'Revenge', cover: COVERS[4], reads: '192k', likes: '29k', rating: '4.8', chapters: 38 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['revenge', 'betrayal'],
        extra: [],
      },
    },

    Efe_O: {
      handle: 'Efe_O',
      name: 'Efe Okoro',
      avatar: 'https://i.pravatar.cc/100?img=22',
      cover: COVERS[9],
      verified: true,
      isWriter: true,
      bio: 'Elegy and romance. The stories that stay.',
      genres: ['elegy', 'romance', 'drama'],
      location: 'Benin City, Nigeria',
      joinedLabel: 'Joined November 2023',
      stats: { following: 78, followers: 22300, books: 1, reads: 510000, likes: 78000, saved: 0, reactions: 0, comments: 0 },
      achievements: [],
      books: [
        { id: 'eb1', title: 'The Letter He Never Sent', cat: 'Elegy', cover: COVERS[9], reads: '218k', likes: '34k', rating: '4.9', chapters: 24 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['elegy', 'romance'],
        extra: [],
      },
    },

    Kemi_A: {
      handle: 'Kemi_A',
      name: 'Kemi Adeyemi',
      avatar: 'https://i.pravatar.cc/100?img=28',
      cover: COVERS[5],
      verified: false,
      isWriter: true,
      bio: 'Campus stories and the chaos of growing up.',
      genres: ['campus', 'romance', 'drama'],
      location: 'Ibadan, Nigeria',
      joinedLabel: 'Joined February 2024',
      stats: { following: 23, followers: 8900, books: 1, reads: 180000, likes: 28000, saved: 0, reactions: 0, comments: 0 },
      achievements: [],
      books: [
        { id: 'kb1', title: 'Campus Chaos', cat: 'Campus', cover: COVERS[5], reads: '88k', likes: '14k', rating: '4.6', chapters: 22 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['campus', 'romance'],
        extra: [],
      },
    },

    Bode_Ilo: {
      handle: 'Bode_Ilo',
      name: 'Bode Ilo',
      avatar: 'https://i.pravatar.cc/100?img=12',
      cover: COVERS[6],
      verified: false,
      isWriter: true,
      bio: 'Campus comedies and the lighter side of student life.',
      genres: ['campus', 'comedy'],
      location: 'Lagos, Nigeria',
      joinedLabel: 'Joined April 2024',
      stats: { following: 45, followers: 12400, books: 1, reads: 260000, likes: 41000, saved: 0, reactions: 0, comments: 0 },
      achievements: [],
      books: [
        { id: 'bb1', title: 'Campus Chaos', cat: 'Campus', cover: COVERS[6], reads: '120k', likes: '18k', rating: '4.5', chapters: 28 },
      ],
      collections: [],
      following: [],
      posts: [],
      about: {
        favoriteGenres: ['campus', 'comedy'],
        extra: [],
      },
    },
  };

  /* ── STORIES (for collection, discover, etc.) ── */
  const STORIES = [
    {
      id: 'st1',
      cover: COVERS[0],
      badge: 'HOT', badgeClass: 'badge-hot', gbadge: 'hot', badgeIcon: 'fa-fire',
      title: 'Bound By Obsession',
      desc: 'He was supposed to destroy me, not become my greatest weakness.',
      chapters: 56, reads: '2.3M', likes: '189K', cat: '💔 Betrayal',
      author: 'Ada_Writes', authorAv: 'https://i.pravatar.cc/100?img=32', verified: true,
    },
    {
      id: 'st2',
      cover: COVERS[4],
      badge: 'NEW', badgeClass: 'badge-new', gbadge: 'new', badgeIcon: '',
      title: 'The Way You Stay',
      desc: 'Some hearts are meant to break, so others can learn to heal.',
      chapters: 38, reads: '1.8M', likes: '142K', cat: '💔 Heartbreak',
      author: 'Sarah_Odum', authorAv: 'https://i.pravatar.cc/100?img=48', verified: true,
    },
    {
      id: 'st3',
      cover: COVERS[7],
      badge: 'UPDATED', badgeClass: 'badge-updated', gbadge: 'updated', badgeIcon: '',
      title: 'Yours, Always',
      desc: 'No matter how far we drift, some love finds its way back.',
      chapters: 42, reads: '1.6M', likes: '118K', cat: '💍 Romance',
      author: 'Efe_O', authorAv: 'https://i.pravatar.cc/100?img=22', verified: true,
    },
    {
      id: 'st4',
      cover: COVERS[9],
      badge: 'FREE', badgeClass: 'badge-free', gbadge: 'free', badgeIcon: '',
      title: 'Until Forever',
      desc: 'Promises made at the right time change the meaning of forever.',
      chapters: 27, reads: '980K', likes: '96K', cat: '🌙 Elegy',
      author: 'Luna_Grey', authorAv: 'https://i.pravatar.cc/100?img=15', verified: true,
    },
    {
      id: 'st5',
      cover: COVERS[12],
      badge: 'HOT', badgeClass: 'badge-hot', gbadge: 'hot', badgeIcon: 'fa-fire',
      title: 'The Runaway Bride',
      desc: 'Everyone watched. Only she knew why.',
      chapters: 28, reads: '312K', likes: '45K', cat: '✨ Twist',
      author: 'Ifeanyi_Story', authorAv: 'https://i.pravatar.cc/100?img=53', verified: true,
    },
    {
      id: 'st6',
      cover: COVERS[10],
      badge: 'NEW', badgeClass: 'badge-new', gbadge: 'new', badgeIcon: '',
      title: "My Grandmother's Will",
      desc: 'A family legacy. A stolen document. A fight no one saw coming.',
      chapters: 44, reads: '204K', likes: '31K', cat: '👑 Family',
      author: 'Chiamaka_N', authorAv: 'https://i.pravatar.cc/100?img=47', verified: false,
    },
    {
      id: 'st7',
      cover: COVERS[11],
      badge: 'UPDATED', badgeClass: 'badge-updated', gbadge: 'updated', badgeIcon: '',
      title: 'My Stepmother Stole My Fund',
      desc: 'She took everything. Now it is time to take it back.',
      chapters: 38, reads: '192K', likes: '29K', cat: '🔥 Revenge',
      author: 'Zara_M', authorAv: 'https://i.pravatar.cc/100?img=16', verified: true,
    },
    {
      id: 'st8',
      cover: COVERS[7],
      badge: 'HOT', badgeClass: 'badge-hot', gbadge: 'hot', badgeIcon: 'fa-fire',
      title: "He Proposed With My Best Friend's Ring",
      desc: 'What happens when betrayal comes from both directions at once.',
      chapters: 42, reads: '96K', likes: '19K', cat: '💔 Heartbreak',
      author: 'Sarah_Odum', authorAv: 'https://i.pravatar.cc/100?img=48', verified: true,
    },
    {
      id: 'st9',
      cover: COVERS[1],
      badge: 'NEW', badgeClass: 'badge-new', gbadge: 'new', badgeIcon: '',
      title: 'The Wife Who Knew Too Much',
      desc: 'She saw the messages. She said nothing. She planned everything.',
      chapters: 34, reads: '780K', likes: '92K', cat: '💔 Betrayal',
      author: 'Ada_Writes', authorAv: 'https://i.pravatar.cc/100?img=32', verified: true,
    },
    {
      id: 'st10',
      cover: COVERS[5],
      badge: 'UPDATED', badgeClass: 'badge-updated', gbadge: 'updated', badgeIcon: '',
      title: 'His Secret Billionaire Life',
      desc: 'The man she married was not the man she thought she knew.',
      chapters: 51, reads: '1.1M', likes: '134K', cat: '💍 Romance',
      author: 'Sarah_Odum', authorAv: 'https://i.pravatar.cc/100?img=48', verified: true,
    },
    {
      id: 'st11',
      cover: COVERS[8],
      badge: 'HOT', badgeClass: 'badge-hot', gbadge: 'hot', badgeIcon: 'fa-fire',
      title: 'The Alpha\'s Rejected Mate',
      desc: 'She was meant to be his everything. He cast her aside.',
      chapters: 67, reads: '2.1M', likes: '245K', cat: '🐺 Werewolf',
      author: 'Luna_Grey', authorAv: 'https://i.pravatar.cc/100?img=15', verified: true,
    },
    {
      id: 'st12',
      cover: COVERS[3],
      badge: 'FREE', badgeClass: 'badge-free', gbadge: 'free', badgeIcon: '',
      title: 'Campus Lies',
      desc: 'Everyone has secrets. Hers could destroy them all.',
      chapters: 22, reads: '156K', likes: '28K', cat: '🎓 Campus',
      author: 'Bode_Ilo', authorAv: 'https://i.pravatar.cc/100?img=12', verified: false,
    },
    {
      id: 'st13',
      cover: COVERS[13],
      badge: 'NEW', badgeClass: 'badge-new', gbadge: 'new', badgeIcon: '',
      title: 'The Inheritance War',
      desc: 'Three siblings. One will. No one is safe.',
      chapters: 38, reads: '267K', likes: '41K', cat: '👑 Family',
      author: 'Chiamaka_N', authorAv: 'https://i.pravatar.cc/100?img=47', verified: false,
    },
    {
      id: 'st14',
      cover: COVERS[6],
      badge: 'UPDATED', badgeClass: 'badge-updated', gbadge: 'updated', badgeIcon: '',
      title: 'Her Sweet Revenge',
      desc: 'She lost everything. Now she will take it all back.',
      chapters: 45, reads: '890K', likes: '112K', cat: '🔥 Revenge',
      author: 'Zara_M', authorAv: 'https://i.pravatar.cc/100?img=16', verified: true,
    },
    {
      id: 'st15',
      cover: COVERS[10],
      badge: 'HOT', badgeClass: 'badge-hot', gbadge: 'hot', badgeIcon: 'fa-fire',
      title: 'The Doctor\'s Wife',
      desc: 'A perfect marriage. A deadly secret.',
      chapters: 55, reads: '1.4M', likes: '178K', cat: '✨ Twist',
      author: 'Ifeanyi_Story', authorAv: 'https://i.pravatar.cc/100?img=53', verified: true,
    },
    {
      id: 'st16',
      cover: COVERS[14],
      badge: 'NEW', badgeClass: 'badge-new', gbadge: 'new', badgeIcon: '',
      title: 'Queen of the Pack',
      desc: 'She was born to lead. He was born to challenge her.',
      chapters: 48, reads: '520K', likes: '76K', cat: '🐺 Werewolf',
      author: 'Luna_Grey', authorAv: 'https://i.pravatar.cc/100?img=15', verified: true,
    },
  ];

  /* ── COLLECTIONS ── */
  const COLLECTIONS = [
    {
      id: 'col1',
      cover: COVERS[0],
      title: 'Heartfelt Romance',
      sub: 'Love that heals, love that stays, love that changes everything.',
      author: 'Luna Vale',
      authorAv: 'https://i.pravatar.cc/100?img=32',
      verified: true,
      stories: 24,
      followers: '12.8k',
      visits: '2.4M',
      rating: '4.9',
      genres: ['💔 Heartbreak', '💍 Romance', '🔥 Slow Burn', '🌙 Second Chances'],
      about: 'Heartfelt Romance brings together twenty-four stories chosen for the way they linger — quiet heartbreaks, slow-burn reunions, and the kind of love that rebuilds what was broken.',
      storyList: STORIES.slice(0, 4),
    },
    {
      id: 'col2',
      cover: COVERS[12],
      title: 'Best of 2025',
      sub: 'The stories that defined the year.',
      author: 'Droboard Team',
      authorAv: 'https://i.pravatar.cc/100?img=11',
      verified: true,
      stories: 18,
      followers: '45.2k',
      visits: '8.1M',
      rating: '4.8',
      genres: ['💔 Betrayal', '✨ Twist', '🔥 Revenge'],
      about: 'Our editors handpicked the best stories of 2025 — the ones that broke records, started conversations, and kept readers up past midnight.',
      storyList: STORIES.slice(4, 8),
    },
    {
      id: 'col3',
      cover: COVERS[7],
      title: 'Dark Romance Essentials',
      sub: 'For readers who like their love stories dangerous.',
      author: 'Luna_Grey',
      authorAv: 'https://i.pravatar.cc/100?img=15',
      verified: true,
      stories: 32,
      followers: '28.7k',
      visits: '4.2M',
      rating: '4.7',
      genres: ['💔 Betrayal', '🔥 Revenge', '💍 Romance'],
      about: 'The darkest, most addictive romance stories — where love and danger walk hand in hand.',
      storyList: STORIES.slice(8, 12),
    },
    {
      id: 'col4',
      cover: COVERS[10],
      title: 'Family Secrets',
      sub: 'Every family has them. These stories expose them all.',
      author: 'Chiamaka_N',
      authorAv: 'https://i.pravatar.cc/100?img=47',
      verified: false,
      stories: 15,
      followers: '14.3k',
      visits: '1.8M',
      rating: '4.6',
      genres: ['👑 Family', '💔 Betrayal', '✨ Twist'],
      about: 'Inheritance battles, hidden wills, and the truths that tear families apart — then put them back together.',
      storyList: STORIES.slice(12, 16),
    },
  ];

  /* ── GENRES ── */
  const GENRES = [
    { id: 'romance', icon: '💍', name: 'Romance', count: '950', members: '92.1K', discussions: '8.4K', stories: '4.2K', tagline: 'Hearts, heat, and happy endings.' },
    { id: 'betrayal', icon: '💔', name: 'Betrayal', count: '1.2k', members: '67.3K', discussions: '5.1K', stories: '2.8K', tagline: 'Trust broken, lives shattered.' },
    { id: 'campus', icon: '🎓', name: 'Campus', count: '890', members: '34.5K', discussions: '2.8K', stories: '1.4K', tagline: 'College days and chaos.' },
    { id: 'family', icon: '👑', name: 'Family', count: '740', members: '28.9K', discussions: '2.1K', stories: '980', tagline: 'Blood ties and broken bonds.' },
    { id: 'revenge', icon: '🔥', name: 'Revenge', count: '620', members: '41.2K', discussions: '3.4K', stories: '1.6K', tagline: 'Payback served cold.' },
    { id: 'twist', icon: '✨', name: 'Twist', count: '580', members: '52.8K', discussions: '4.2K', stories: '2.1K', tagline: 'Stories that turn everything upside down.' },
    { id: 'elegy', icon: '🌙', name: 'Elegy', count: '310', members: '18.4K', discussions: '1.2K', stories: '540', tagline: 'Quiet stories that stay with you.' },
    { id: 'fantasy', icon: '🧙', name: 'Fantasy', count: '420', members: '45.7K', discussions: '3.2K', stories: '1.8K', tagline: 'Where imagination becomes legend.' },
    { id: 'werewolf', icon: '🐺', name: 'Werewolf', count: '380', members: '31.2K', discussions: '2.1K', stories: '980', tagline: 'Packs, mates, and moonlit chaos.' },
    { id: 'billionaire', icon: '💰', name: 'Billionaire', count: '680', members: '58.4K', discussions: '4.8K', stories: '2.4K', tagline: 'Wealth, power, and forbidden love.' },
    { id: 'mafia', icon: '🔫', name: 'Mafia', count: '520', members: '38.7K', discussions: '3.1K', stories: '1.5K', tagline: 'Dangerous men, dangerous love.' },
    { id: 'drama', icon: '🎭', name: 'Drama', count: '840', members: '62.1K', discussions: '5.6K', stories: '3.2K', tagline: 'Stories that hit different.' },
    { id: 'horror', icon: '👻', name: 'Horror', count: '290', members: '22.3K', discussions: '1.8K', stories: '720', tagline: 'Fear, suspense, and the unknown.' },
    { id: 'mystery', icon: '🔍', name: 'Mystery', count: '410', members: '35.8K', discussions: '2.9K', stories: '1.3K', tagline: 'Clues, secrets, and the truth.' },
    { id: 'historical', icon: '📜', name: 'Historical', count: '280', members: '19.6K', discussions: '1.4K', stories: '620', tagline: 'Stories from another time.' },
    { id: 'thriller', icon: '⚡', name: 'Thriller', count: '450', members: '42.5K', discussions: '3.6K', stories: '1.7K', tagline: 'Edge-of-your-seat tension.' },
    { id: 'comedy', icon: '😂', name: 'Comedy', count: '380', members: '28.9K', discussions: '2.4K', stories: '1.1K', tagline: 'Laughs, love, and happily ever after.' },
    { id: 'supernatural', icon: '🧚', name: 'Supernatural', count: '340', members: '31.2K', discussions: '2.2K', stories: '890', tagline: 'Beyond the mortal realm.' },
  ];

  /* ── HERO STORIES (for home page) ── */
  const S = [
    {id:'s1',cover:'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',genre:'💔 Betrayal',rating:'4.8',reads:'171k',chapter:'Chapter 9',
     title:"I Came Home Early and Caught My Husband Kissing My Late Sister's Photograph",
     author:'Ada_Writes',authorAv:'https://i.pravatar.cc/100?img=32',verified:true,
     synopsis:'A woman returns home early to find her husband in an intimate moment with a photograph of her deceased sister — revealing a love triangle she never knew existed.'},
    {id:'s2',cover:'https://i.postimg.cc/tY7KnJyr/images.jpg',genre:'✨ Twist',rating:'4.9',reads:'312k',chapter:'Chapter 15',
     title:'The Runaway Bride — I Left the Altar in My Socked Feet',
     author:'Ifeanyi_Story',authorAv:'https://i.pravatar.cc/100?img=53',verified:true,
     synopsis:'In front of four hundred guests, a bride does the unthinkable — and discovers that the moment everyone thought would ruin her was the moment her real life began.'},
    {id:'s3',cover:'https://i.postimg.cc/xqmHfyNR/wolf2.jpg',genre:'👑 Family',rating:'4.7',reads:'204k',chapter:'Chapter 22',
     title:"My Grandmother's Will Revealed I Wasn't Her Blood",
     author:'Chiamaka_N',authorAv:'https://i.pravatar.cc/100?img=47',verified:false,
     synopsis:"At the reading of a grandmother's will, a young woman discovers a truth that redefines her identity — and finds something more powerful than blood waiting at the end."},
    {id:'s4',cover:'https://i.postimg.cc/fkdXzjS8/wolf.jpg',genre:'🔥 Revenge',rating:'4.8',reads:'192k',chapter:'Chapter 6',
     title:'My Stepmother Stole My University Fund',
     author:'Zara_M',authorAv:'https://i.pravatar.cc/100?img=16',verified:true,
     synopsis:'After years of silent suffering, a girl discovers her stepmother is not who she says she is — and uses patience and the law to reclaim everything taken from her.'},
    {id:'s5',cover:'https://i.postimg.cc/N9jY0w4m/5.jpg',genre:'🌙 Elegy',rating:'4.9',reads:'218k',chapter:'Chapter 31',
     title:'The Letter He Never Sent',
     author:'Efe_O',authorAv:'https://i.pravatar.cc/100?img=22',verified:true,
     synopsis:'A year after losing her first love, a woman discovers an unsent letter that explains the cruelty of his final months — and finds it heals her, even from the other side.'},
    {id:'s6',cover:'https://i.postimg.cc/ftRZbhKx/3.jpg',genre:'🎓 Campus',rating:'4.6',reads:'134k',chapter:'Chapter 4',
     title:'The Richest Boy in School Started Sitting Beside Me Every Morning',
     author:'CampusQueen',authorAv:'https://i.pravatar.cc/100?img=12',verified:false,
     synopsis:'Everyone assumed he liked her. They had no idea what he whispered first — a secret that would define both their final years on campus.'},
    {id:'s7',cover:'https://i.postimg.cc/JDzmhWqj/2.jpg',genre:'💍 Marriage',rating:'4.7',reads:'88k',chapter:'Chapter 18',
     title:'She Found His Second Phone at Their Anniversary Dinner',
     author:'Ada_Writes',authorAv:'https://i.pravatar.cc/100?img=32',verified:true,
     synopsis:'One dinner. One notification. One decision that would unravel six years of marriage in front of the family that raised them both.'},
    {id:'s8',cover:'https://i.postimg.cc/0MyxNqfz/7.jpg',genre:'🏙️ Urban Love',rating:'4.7',reads:'22k',chapter:'Chapter 2',
     title:"She Rejected Me 3 Times. Now We Share a Mortgage and a Dog Named 'Finally'",
     author:'Dami_Cole',authorAv:'https://i.pravatar.cc/100?img=64',verified:true,
     synopsis:"Three rejections, one relocation, and a gallery opening later — sometimes the timeline just needed a little longer to catch up."},
    {id:'s9',cover:'https://i.postimg.cc/cgLZJNmC/8.jpg',genre:'👑 Family',rating:'4.8',reads:'138k',chapter:'Chapter 8',
     title:"My Uncle Claimed the Inheritance Using My Late Mother's Stolen Will",
     author:'Chiamaka_N',authorAv:'https://i.pravatar.cc/100?img=47',verified:false,
     synopsis:'Three seasons in and the family is still divided. This chapter goes further than any before it.'},
    {id:'s10',cover:'https://i.postimg.cc/23WvkFLH/images-(2).jpg',genre:'💔 Heartbreak',rating:'4.6',reads:'96k',chapter:'Chapter 4',
     title:"He Proposed With My Best Friend's Ring — and She Giggled Before He Even Knelt",
     author:'Kemi_A',authorAv:'https://i.pravatar.cc/100?img=28',verified:false,
     synopsis:'Three years and four months together. One box. One giggle. Everything she needed to know, in a single unguarded sound.'},
    {id:'s11',cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg',genre:'✨ Twist',rating:'4.9',reads:'218k',chapter:'Chapter 3',
     title:'The Letter Folded Inside His Jacket Pocket',
     author:'Efe_O',authorAv:'https://i.pravatar.cc/100?img=22',verified:true,
     synopsis:'He died before he could send it. A year later, his mother hands it to her through a car window — and everything she thought she knew rearranges itself.'},
    {id:'s12',cover:'https://i.postimg.cc/YGCkSw-33/1.jpg',genre:'👑 Family',rating:'4.7',reads:'96k',chapter:'Chapter 13',
     title:"Grandmother's Hidden Will",
     author:'Chiamaka_N',authorAv:'https://i.pravatar.cc/100?img=47',verified:false,
     synopsis:'The will named someone no one in the family had ever heard of. Finding her would unlock a secret older than the house itself.'},
    {id:'s13',cover:'https://i.postimg.cc/DJwFzKgd/4.jpg',genre:'🔥 Revenge',rating:'4.5',reads:'54k',chapter:'Chapter 12',
     title:'Boss Before Revealing',
     author:'Zara_M',authorAv:'https://i.pravatar.cc/100?img=16',verified:true,
     synopsis:'She worked under him for two years. He never knew she was the one he ruined — until the merger put her name on the board.'},
    {id:'s14',cover:'https://i.postimg.cc/vDn9YLx5/wife2.jpg',genre:'💔 Betrayal',rating:'4.8',reads:'171k',chapter:'Chapter 6',
     title:'Ruthless Desires — Season 2',
     author:'Ada_Writes',authorAv:'https://i.pravatar.cc/100?img=32',verified:true,
     synopsis:'The truth finally surfaces at the reading of the will — and no one in the family walks away unscathed.'},
    {id:'s15',cover:'https://i.postimg.cc/0MyxNqfz/7.jpg',genre:'🌙 Elegy',rating:'4.6',reads:'42k',chapter:'Chapter 2',
     title:'Deleted on Our Anniversary',
     author:'Kemi_A',authorAv:'https://i.pravatar.cc/100?img=28',verified:false,
     synopsis:'Every photo, every message, gone — on the day they were supposed to celebrate five years. She needed answers. He needed silence.'},
  ];

  const HOME_CD = [
    {id:'cd1',cover:'https://i.postimg.cc/cgLZJNmC/8.jpg',genre:'👑 Family',rating:'4.8',reads:'41k',chapter:'Chapter 8',
     title:"My Uncle's Stolen Will",
     author:'Chiamaka_N',authorAv:'https://i.pravatar.cc/100?img=47',verified:false,
     synopsis:'The lawyer opens the second envelope. What is inside changes who inherits the house — and who inherits the truth.'},
    {id:'cd2',cover:'https://i.postimg.cc/WF1j4Pnh/6.jpg',genre:'✨ Twist',rating:'4.9',reads:'35k',chapter:'Chapter 3',
     title:'The Letter Never Sent',
     author:'Efe_O',authorAv:'https://i.pravatar.cc/100?img=22',verified:true,
     synopsis:'The mother he never called has answers. The letter he wrote has a stamp but never the courage to send it — until now.'},
    {id:'cd3',cover:'https://i.postimg.cc/N9jY0w4m/5.jpg',genre:'💔 Betrayal',rating:'4.7',reads:'29k',chapter:'Chapter 6',
     title:'She Found His Second Phone',
     author:'Ada_Writes',authorAv:'https://i.pravatar.cc/100?img=32',verified:true,
     synopsis:'The dinner is over. The questions are just beginning. This chapter picks up exactly where the silence left off.'},
  ];

  const HOME_AD = [
    {type:'ad-story',cover:'https://i.postimg.cc/DJwFzKgd/4.jpg',brand:'Bound to the Ruthless CEO',genre:'Romance · Billionaire',
     sub:'A deal. A marriage. A love she never saw coming.',author:'Ava Winters'},
    {type:'ad-story',cover:'https://i.postimg.cc/fkdXzjSj/wife.jpg',brand:'Married to the Enemy',genre:'Mafia · Revenge',
     sub:'She married him for the family name. She stayed for reasons even she doesn\'t understand.',author:'Zara_M'},
  ];

  const HOME_HD = [
    {type:'ad-droboard',icon:'fa-crown',headline:'Go Premium. Read Without Limits.',
     sub:'Unlock unlimited stories, early chapter access and an ad-free reading experience — all for one low monthly price.',
     cta:'Try Premium Free'},
    {type:'ad-droboard',icon:'fa-user-friends',headline:'Invite Friends, Earn Coins',
     sub:'Every friend who joins with your link gets a free chapter — and you both earn 50 coins the moment they start reading.',
     cta:'Invite Now'},
  ];

  const HERO_STORIES = [
    S[0],S[1],S[2], HOME_CD[0],
    S[3],S[4],S[5], HOME_AD[0],
    S[6],S[7],S[8], HOME_HD[0],
    S[9],S[10],S[11], HOME_CD[1],
    S[12], HOME_AD[1],
    S[13], HOME_HD[1],
    S[14], HOME_CD[2],
  ];

  /* ── TRENDING GENRES (for home page) ── */
  const TRENDING_GENRES = [
    { icon: '💔', name: 'Betrayal', count: '1.2k' },
    { icon: '🎓', name: 'Campus', count: '890' },
    { icon: '👑', name: 'Family', count: '740' },
    { icon: '🔥', name: 'Revenge', count: '620' },
    { icon: '✨', name: 'Twist', count: '580' },
    { icon: '🌙', name: 'Elegy', count: '310' },
    { icon: '💍', name: 'Romance', count: '950' },
  ];

  /* ── CONTINUE READING ── */
  const CONTINUE_READING = [
    { id: 'cr1', cover: c(3), title: "The Alpha's Obsession", ch: 'Chapter 18', pct: 43 },
    { id: 'cr2', cover: c(1), title: 'Falling for My Fake Husband', ch: 'Chapter 12', pct: 25 },
    { id: 'cr3', cover: c(0), title: "The Mafia's Secret Wife", ch: 'Chapter 24', pct: 60 },
    { id: 'cr4', cover: c(4), title: 'His Ruthless Obsession', ch: 'Chapter 31', pct: 78 },
    { id: 'cr5', cover: c(7), title: "My Uncle's Stolen Will", ch: 'Chapter 8', pct: 19 },
    { id: 'cr6', cover: c(12), title: 'The Runaway Bride', ch: 'Chapter 15', pct: 55 },
    { id: 'cr7', cover: c(10), title: "Grandmother's Will", ch: 'Chapter 22', pct: 38 },
    { id: 'cr8', cover: c(5), title: 'His Secret Life', ch: 'Chapter 9', pct: 12 },
    { id: 'cr9', cover: c(9), title: 'The Letter He Never Sent', ch: 'Chapter 6', pct: 71 },
    { id: 'cr10', cover: c(11), title: "Stepmother's Secret", ch: 'Chapter 14', pct: 44 },
  ];

  /* ── CHAPTER DROPS ── */
  const CHAPTER_DROPS = [
    { id: 'cd1', cover: c(0), title: 'His Sweet Revenge — Chapter 21', author: 'Luna Grey', time: '2h ago' },
    { id: 'cd2', cover: c(9), title: 'Forbidden Hearts — Chapter 9', author: 'Mia Clark', time: '4h ago' },
    { id: 'cd3', cover: c(7), title: "My Uncle's Stolen Will — Chapter 8", author: 'Chiamaka_N', time: '6h ago' },
    { id: 'cd4', cover: c(14), title: "Best Friend's Ring — Chapter 4", author: 'Kemi_A', time: '9h ago' },
    { id: 'cd5', cover: c(4), title: 'The Letter He Never Sent — Chapter 3', author: 'Efe_O', time: '12h ago' },
    { id: 'cd6', cover: c(11), title: "Stepmother's Secret — Chapter 6", author: 'Zara_M', time: '1d ago' },
    { id: 'cd7', cover: c(12), title: 'The Runaway Bride — Chapter 5', author: 'Ifeanyi_Story', time: '1d ago' },
    { id: 'cd8', cover: c(10), title: "Grandmother's Will — Chapter 13", author: 'Chiamaka_N', time: '2d ago' },
    { id: 'cd9', cover: c(1), title: 'The Wife Who Knew — Chapter 11', author: 'Ada_Writes', time: '2d ago' },
    { id: 'cd10', cover: c(5), title: 'His Secret Life — Chapter 17', author: 'Sarah_Odum', time: '3d ago' },
    { id: 'cd11', cover: c(8), title: "Alpha's Mate — Chapter 28", author: 'Luna_Grey', time: '3d ago' },
    { id: 'cd12', cover: c(3), title: 'Campus Lies — Chapter 7', author: 'Bode_Ilo', time: '4d ago' },
    { id: 'cd13', cover: c(13), title: 'Inheritance War — Chapter 12', author: 'Chiamaka_N', time: '4d ago' },
    { id: 'cd14', cover: c(6), title: 'Her Sweet Revenge — Chapter 19', author: 'Zara_M', time: '5d ago' },
    { id: 'cd15', cover: c(10), title: "Doctor's Wife — Chapter 24", author: 'Ifeanyi_Story', time: '5d ago' },
    { id: 'cd16', cover: c(14), title: 'Queen of the Pack — Chapter 16', author: 'Luna_Grey', time: '6d ago' },
  ];

  /* ── WRITERS TO FOLLOW ── */
  const WRITERS_TO_FOLLOW = [
    { name: 'Ada_Writes', meta: '12.4k followers', av: 'https://i.pravatar.cc/100?img=32' },
    { name: 'Ifeanyi_Story', meta: '31.7k followers', av: 'https://i.pravatar.cc/100?img=53' },
    { name: 'Chiamaka_N', meta: '19.2k followers', av: 'https://i.pravatar.cc/100?img=47' },
    { name: 'Zara_M', meta: '14.8k followers', av: 'https://i.pravatar.cc/100?img=16' },
    { name: 'Efe_O', meta: '22.3k followers', av: 'https://i.pravatar.cc/100?img=22' },
    { name: 'Sarah_Odum', meta: '41.5k followers', av: 'https://i.pravatar.cc/100?img=48' },
    { name: 'Luna_Grey', meta: '28.1k followers', av: 'https://i.pravatar.cc/100?img=15' },
    { name: 'Kemi_A', meta: '8.9k followers', av: 'https://i.pravatar.cc/100?img=28' },
    { name: 'Bode_Ilo', meta: '12.4k followers', av: 'https://i.pravatar.cc/100?img=12' },
    { name: 'CampusQueen', meta: '15.7k followers', av: 'https://i.pravatar.cc/100?img=12' },
  ];

  /* ── STATUSES (for stories/status ring) ── */
  const STATUSES = [
    { id: 'you', isYou: true, name: 'Your Story' },
    { id: 'w1', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', ring: 'ring-live', isLive: true, likes: 243, threads: 18,
      statuses: [
        { bg: 'https://i.postimg.cc/MXBR6bfY/wolf3.jpg', quote: '"He never explained the photograph."', caption: 'Chapter 9 teaser', time: '2h ago' },
        { bg: 'https://i.postimg.cc/JDzmhWqj/2.jpg', quote: 'Some things you find out too late.', caption: '', time: '1h ago' }
      ]},
    { id: 'w5', name: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53', ring: 'ring-has', likes: 190, threads: 11,
      statuses: [
        { bg: 'https://i.postimg.cc/tY7KnJyr/images.jpg', quote: '"I left at the altar in my socked feet."', caption: 'The Runaway Bride', time: '5h ago' }
      ]},
    { id: 'w2', name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=12', ring: 'ring-has', likes: 88, threads: 6,
      statuses: [
        { bg: 'https://i.postimg.cc/ftRZbhKx/3.jpg', quote: 'He started sitting beside me every morning.', caption: 'New chapter tonight', time: '7h ago' }
      ]},
    { id: 'w7', name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', ring: 'ring-viewed', likes: 301, threads: 24,
      statuses: [
        { bg: 'https://i.postimg.cc/N9jY0w4m/5.jpg', quote: 'The letter he never sent.', caption: '', time: '11h ago' }
      ]},
    { id: 'w4', name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28', ring: 'ring-viewed', likes: 64, threads: 5,
      statuses: [
        { bg: 'https://i.postimg.cc/23WvkFLH/images-(2).jpg', quote: 'She giggled before he even knelt.', caption: '', time: '1d ago' }
      ]},
    { id: 'w3', name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47', ring: 'ring-none', likes: 142, threads: 9,
      statuses: [
        { bg: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', quote: "The will named someone I'd never heard of.", caption: '', time: '2d ago' }
      ]},
  ];

  /* ── SERIES DATA (for story management) ── */
  const SERIES = [
    {
      id: 's1',
      cover: COVERS[0],
      cat: '💔 Betrayal',
      title: "I came home early and caught my husband kissing my late sister's photograph",
      tagline: "A Lagos woman's quiet unravelling after an impossible discovery.",
      status: 'ongoing',
      seasons: 2,
      reads: '171k',
      likes: '24.3k',
      comments: '4.1k',
      saves: '6.8k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Morning Everything Changed', reads: 22400, status: 'published', date: 'Jan 12, 2025', words: 1840 },
        { id: 'c2', num: 2, title: "What the Photo Couldn't Explain", reads: 19200, status: 'published', date: 'Jan 19, 2025', words: 2100 },
        { id: 'c3', num: 3, title: 'She Asked Me Not to Ask', reads: 17800, status: 'published', date: 'Jan 26, 2025', words: 1960 },
        { id: 'c4', num: 4, title: 'The Third Drawer on the Left', reads: 15600, status: 'published', date: 'Feb 2, 2025', words: 2240 },
        { id: 'c5', num: 5, title: 'Season 2: I Packed One Bag', reads: 14100, status: 'published', date: 'Apr 5, 2025', words: 2050 },
        { id: 'c6', num: 6, title: 'His Mother Knew', reads: 12800, status: 'published', date: 'Apr 12, 2025', words: 1780 },
        { id: 'c7', num: 7, title: 'The Last Person I Called', reads: 0, status: 'scheduled', date: 'Jun 20, 2025', words: 900 },
        { id: 'c8', num: 8, title: 'What She Left Behind', reads: 0, status: 'draft', date: '—', words: 420 },
      ]
    },
    {
      id: 's2',
      cover: COVERS[14],
      cat: '💔 Heartbreak',
      title: "He proposed with my best friend's ring",
      tagline: 'What happens when betrayal comes from both directions at once.',
      status: 'ongoing',
      seasons: 1,
      reads: '96k',
      likes: '19.2k',
      comments: '2.9k',
      saves: '4.1k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Ring I Recognised', reads: 34500, status: 'published', date: 'Mar 1, 2025', words: 1620 },
        { id: 'c2', num: 2, title: "Adeola's Silence", reads: 28300, status: 'published', date: 'Mar 8, 2025', words: 1900 },
        { id: 'c3', num: 3, title: 'She Was in the Front Row', reads: 22100, status: 'published', date: 'Mar 15, 2025', words: 2010 },
        { id: 'c4', num: 4, title: 'The Last Bridesmaid', reads: 0, status: 'scheduled', date: 'Jun 14, 2025', words: 1540 },
      ]
    },
    {
      id: 's3',
      cover: COVERS[7],
      cat: '👑 Family',
      title: "My uncle claimed the inheritance using my late mother's stolen will",
      tagline: 'A family legacy. A stolen document. A fight no one saw coming.',
      status: 'ongoing',
      seasons: 3,
      reads: '138k',
      likes: '21k',
      comments: '3.6k',
      saves: '5.4k',
      chapters: [
        { id: 'c1', num: 1, title: 'After the Burial', reads: 19200, status: 'published', date: 'Dec 3, 2024', words: 1750 },
        { id: 'c2', num: 2, title: 'Uncle Chukwuma Smiled at the Lawyer', reads: 17800, status: 'published', date: 'Dec 10, 2024', words: 2000 },
        { id: 'c3', num: 3, title: 'The Original Is Missing', reads: 16400, status: 'published', date: 'Dec 17, 2024', words: 1820 },
        { id: 'c4', num: 4, title: 'Season 2: A Different Notary', reads: 15100, status: 'published', date: 'Feb 20, 2025', words: 2150 },
        { id: 'c5', num: 5, title: 'She Kept a Copy', reads: 13900, status: 'published', date: 'Feb 27, 2025', words: 1940 },
        { id: 'c6', num: 6, title: 'Season 3: Court Date', reads: 12200, status: 'published', date: 'May 10, 2025', words: 2260 },
        { id: 'c7', num: 7, title: "The Judge's Pause", reads: 0, status: 'draft', date: '—', words: 680 },
        { id: 'c8', num: 8, title: 'Closing Arguments', reads: 0, status: 'draft', date: '—', words: 0 },
      ]
    },
    {
      id: 's4',
      cover: COVERS[4],
      cat: '💔 Betrayal',
      title: 'She found his second phone at their anniversary dinner',
      tagline: 'He had a whole life she never knew about.',
      status: 'ongoing',
      seasons: 2,
      reads: '88k',
      likes: '14k',
      comments: '2.1k',
      saves: '3.9k',
      chapters: [
        { id: 'c1', num: 1, title: 'Table for Two, Life for Three', reads: 16200, status: 'published', date: 'Feb 5, 2025', words: 1700 },
        { id: 'c2', num: 2, title: 'The Password Hint Was Her Name', reads: 14800, status: 'published', date: 'Feb 12, 2025', words: 1880 },
        { id: 'c3', num: 3, title: 'I Finished My Dessert', reads: 13400, status: 'published', date: 'Feb 19, 2025', words: 2020 },
        { id: 'c4', num: 4, title: 'Season 2: What She Chose', reads: 11200, status: 'published', date: 'Apr 28, 2025', words: 1960 },
        { id: 'c5', num: 5, title: 'The Transfer Was Already Scheduled', reads: 0, status: 'scheduled', date: 'Jun 20, 2025', words: 1340 },
      ]
    },
    {
      id: 's5',
      cover: COVERS[1],
      cat: '✨ Twist',
      title: 'The runaway bride — I left at the altar in my socked feet',
      tagline: 'Everyone watched. Only she knew why.',
      status: 'complete',
      seasons: 1,
      reads: '312k',
      likes: '45k',
      comments: '8.7k',
      saves: '12.1k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Dress Fit Perfectly', reads: 58000, status: 'published', date: 'Sep 1, 2024', words: 1520 },
        { id: 'c2', num: 2, title: 'Something I Heard the Night Before', reads: 52400, status: 'published', date: 'Sep 8, 2024', words: 1800 },
        { id: 'c3', num: 3, title: 'The Walk Down Was the Easy Part', reads: 47300, status: 'published', date: 'Sep 15, 2024', words: 2100 },
        { id: 'c4', num: 4, title: 'My Socks Were the Last Thing They Expected', reads: 43200, status: 'published', date: 'Sep 22, 2024', words: 1940 },
        { id: 'c5', num: 5, title: 'The Voicemail I Left Him', reads: 38800, status: 'published', date: 'Sep 29, 2024', words: 2240 },
        { id: 'c6', num: 6, title: 'He Called Back', reads: 35100, status: 'published', date: 'Oct 6, 2024', words: 2080 },
        { id: 'c7', num: 7, title: 'What We Built Instead', reads: 29600, status: 'published', date: 'Oct 13, 2024', words: 1860 },
        { id: 'c8', num: 8, title: 'She Was Right About the Dress', reads: 26400, status: 'published', date: 'Oct 20, 2024', words: 2010 },
      ]
    },
    {
      id: 's6',
      cover: COVERS[5],
      cat: '💍 Romance',
      title: 'His Secret Billionaire Life',
      tagline: 'The man she married was not the man she thought she knew.',
      status: 'ongoing',
      seasons: 2,
      reads: '1.1M',
      likes: '134k',
      comments: '18.2k',
      saves: '22.5k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Wedding Night', reads: 45000, status: 'published', date: 'Jan 5, 2025', words: 1980 },
        { id: 'c2', num: 2, title: 'The Second Phone', reads: 41200, status: 'published', date: 'Jan 12, 2025', words: 2150 },
        { id: 'c3', num: 3, title: 'His Other Life', reads: 38900, status: 'published', date: 'Jan 19, 2025', words: 1870 },
        { id: 'c4', num: 4, title: 'The Truth About the Company', reads: 35600, status: 'published', date: 'Jan 26, 2025', words: 2040 },
        { id: 'c5', num: 5, title: 'Season 2: The Divorce Papers', reads: 32100, status: 'published', date: 'Mar 15, 2025', words: 2280 },
        { id: 'c6', num: 6, title: 'She Found the Account', reads: 28700, status: 'published', date: 'Mar 22, 2025', words: 1950 },
        { id: 'c7', num: 7, title: 'The Lawyer Called', reads: 0, status: 'scheduled', date: 'Jul 1, 2025', words: 1100 },
        { id: 'c8', num: 8, title: 'What She Does Next', reads: 0, status: 'draft', date: '—', words: 340 },
      ]
    },
    {
      id: 's7',
      cover: COVERS[8],
      cat: '🐺 Werewolf',
      title: "The Alpha's Rejected Mate",
      tagline: 'She was meant to be his everything. He cast her aside.',
      status: 'ongoing',
      seasons: 3,
      reads: '2.1M',
      likes: '245k',
      comments: '31.4k',
      saves: '42.8k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Rejection', reads: 67000, status: 'published', date: 'Oct 1, 2024', words: 1760 },
        { id: 'c2', num: 2, title: 'The Pack Council', reads: 62300, status: 'published', date: 'Oct 8, 2024', words: 1940 },
        { id: 'c3', num: 3, title: 'Herewolf Awakens', reads: 58100, status: 'published', date: 'Oct 15, 2024', words: 2180 },
        { id: 'c4', num: 4, title: 'The Rival Alpha', reads: 54200, status: 'published', date: 'Oct 22, 2024', words: 2020 },
        { id: 'c5', num: 5, title: 'Season 2: The Moon Ritual', reads: 49800, status: 'published', date: 'Dec 10, 2024', words: 2260 },
        { id: 'c6', num: 6, title: 'The Blood Bond', reads: 45600, status: 'published', date: 'Dec 17, 2024', words: 1890 },
        { id: 'c7', num: 7, title: 'Season 3: The War Begins', reads: 41200, status: 'published', date: 'Feb 28, 2025', words: 2340 },
        { id: 'c8', num: 8, title: 'The Final Challenge', reads: 0, status: 'draft', date: '—', words: 520 },
      ]
    },
    {
      id: 's8',
      cover: COVERS[3],
      cat: '🎓 Campus',
      title: 'Campus Lies',
      tagline: 'Everyone has secrets. Hers could destroy them all.',
      status: 'ongoing',
      seasons: 1,
      reads: '156k',
      likes: '28k',
      comments: '4.2k',
      saves: '6.1k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Freshman', reads: 28000, status: 'published', date: 'Feb 1, 2025', words: 1680 },
        { id: 'c2', num: 2, title: 'The Roommate', reads: 24500, status: 'published', date: 'Feb 8, 2025', words: 1820 },
        { id: 'c3', num: 3, title: 'The Party', reads: 21800, status: 'published', date: 'Feb 15, 2025', words: 1960 },
        { id: 'c4', num: 4, title: 'The Text Message', reads: 19200, status: 'published', date: 'Feb 22, 2025', words: 1740 },
        { id: 'c5', num: 5, title: 'The Truth Comes Out', reads: 16800, status: 'published', date: 'Mar 1, 2025', words: 2100 },
        { id: 'c6', num: 6, title: 'The Fallout', reads: 14500, status: 'published', date: 'Mar 8, 2025', words: 1880 },
        { id: 'c7', num: 7, title: 'The Confrontation', reads: 0, status: 'scheduled', date: 'Jun 15, 2025', words: 950 },
        { id: 'c8', num: 8, title: 'What Happens Now', reads: 0, status: 'draft', date: '—', words: 280 },
      ]
    },
    {
      id: 's9',
      cover: COVERS[13],
      cat: '👑 Family',
      title: 'The Inheritance War',
      tagline: 'Three siblings. One will. No one is safe.',
      status: 'ongoing',
      seasons: 2,
      reads: '267k',
      likes: '41k',
      comments: '6.8k',
      saves: '9.2k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Funeral', reads: 38000, status: 'published', date: 'Nov 1, 2024', words: 1920 },
        { id: 'c2', num: 2, title: 'The Will Reading', reads: 34500, status: 'published', date: 'Nov 8, 2024', words: 2080 },
        { id: 'c3', num: 3, title: 'The First Fight', reads: 31200, status: 'published', date: 'Nov 15, 2024', words: 1860 },
        { id: 'c4', num: 4, title: 'The Lawyer\'s Secret', reads: 28100, status: 'published', date: 'Nov 22, 2024', words: 2240 },
        { id: 'c5', num: 5, title: 'Season 2: The Court Date', reads: 25400, status: 'published', date: 'Jan 10, 2025', words: 2160 },
        { id: 'c6', num: 6, title: 'The Missing Document', reads: 22800, status: 'published', date: 'Jan 17, 2025', words: 1940 },
        { id: 'c7', num: 7, title: 'The Verdict', reads: 0, status: 'scheduled', date: 'Jul 20, 2025', words: 1200 },
        { id: 'c8', num: 8, title: 'The Aftermath', reads: 0, status: 'draft', date: '—', words: 450 },
      ]
    },
    {
      id: 's10',
      cover: COVERS[6],
      cat: '🔥 Revenge',
      title: 'Her Sweet Revenge',
      tagline: 'She lost everything. Now she will take it all back.',
      status: 'ongoing',
      seasons: 2,
      reads: '890k',
      likes: '112k',
      comments: '15.6k',
      saves: '18.9k',
      chapters: [
        { id: 'c1', num: 1, title: 'The Betrayal', reads: 52000, status: 'published', date: 'Dec 1, 2024', words: 1840 },
        { id: 'c2', num: 2, title: 'The Plan', reads: 48200, status: 'published', date: 'Dec 8, 2024', words: 2060 },
        { id: 'c3', num: 3, title: 'The First Move', reads: 44800, status: 'published', date: 'Dec 15, 2024', words: 1920 },
        { id: 'c4', num: 4, title: 'The Trap', reads: 41500, status: 'published', date: 'Dec 22, 2024', words: 2180 },
        { id: 'c5', num: 5, title: 'Season 2: The Fall', reads: 38200, status: 'published', date: 'Feb 15, 2025', words: 2040 },
        { id: 'c6', num: 6, title: 'The Rise', reads: 35100, status: 'published', date: 'Feb 22, 2025', words: 1880 },
        { id: 'c7', num: 7, title: 'The Final Act', reads: 0, status: 'scheduled', date: 'Aug 1, 2025', words: 1050 },
        { id: 'c8', num: 8, title: 'The New Beginning', reads: 0, status: 'draft', date: '—', words: 380 },
      ]
    },
  ];

  /* ── COMMENTS ── */
  const COMMENTS = [
    { id: 1, name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', verified: true, time: '2h ago', text: 'This chapter broke me. Ada is becoming my favorite character to write.', likes: 324, liked: false },
    { id: 2, name: 'Chioma_R', avatar: 'https://i.pravatar.cc/100?img=47', verified: false, time: '3h ago', text: "I'm on Team Ada all the way. The way she walked out in socked feet — I felt that.", likes: 156, liked: true },
    { id: 3, name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=43', verified: false, time: '5h ago', text: 'The line "I\'m still finding pieces of myself" — that hit hard. Beautiful writing.', likes: 78, liked: false },
    { id: 4, name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28', verified: false, time: '6h ago', text: 'Reading this at 2am and crying. This is why Droboard exists.', likes: 45, liked: false },
    { id: 5, name: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53', verified: true, time: '7h ago', text: "Every writer needs to read this. The courage to leave something that isn't serving you is the same courage it takes to write the hard scenes.", likes: 234, liked: false },
    { id: 6, name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', verified: true, time: '8h ago', text: 'This hit different. You can feel every word was earned. Thank you for sharing this with us.', likes: 189, liked: false },
    { id: 7, name: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=16', verified: false, time: '9h ago', text: 'The way you wrote that moment when she realized... I actually gasped out loud. In public.', likes: 167, liked: false },
    { id: 8, name: 'Dami_Cole', avatar: 'https://i.pravatar.cc/100?img=64', verified: false, time: '10h ago', text: 'This is the kind of story that makes you rethink everything you thought you knew about love.', likes: 92, liked: false },
    { id: 9, name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=12', verified: false, time: '11h ago', text: 'The way she just picked up her bag and walked out... I felt that in my soul.', likes: 210, liked: false },
    { id: 10, name: 'Emeka_T', avatar: 'https://i.pravatar.cc/100?img=15', verified: false, time: '12h ago', text: "I usually don't read romance but this one pulled me in. The writing is just... different.", likes: 56, liked: false },
    { id: 11, name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', verified: true, time: '13h ago', text: 'To everyone who has ever felt unseen — this chapter is for you. I wrote it with tears in my eyes.', likes: 512, liked: false },
    { id: 12, name: 'Chioma_R', avatar: 'https://i.pravatar.cc/100?img=47', verified: false, time: '14h ago', text: "I've read this three times already. Each time I notice something new. The details are insane.", likes: 78, liked: false },
    { id: 13, name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=43', verified: false, time: '15h ago', text: 'This chapter is giving me everything I needed. The emotional complexity is unmatched.', likes: 67, liked: false },
    { id: 14, name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28', verified: false, time: '16h ago', text: 'I was not ready for that ending. I actually gasped. Then I cried. Then I read it again.', likes: 156, liked: false },
    { id: 15, name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', verified: true, time: '17h ago', text: 'This is going to stay with me for a long time. I can already tell.', likes: 89, liked: false },
    { id: 16, name: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=16', verified: false, time: '18h ago', text: "The way you write pain is so raw and honest. It doesn't feel fictional at all.", likes: 123, liked: false },
    { id: 17, name: 'Dami_Cole', avatar: 'https://i.pravatar.cc/100?img=64', verified: false, time: '19h ago', text: "This story deserves all the recognition it's getting. So proud to be on this platform.", likes: 45, liked: false },
    { id: 18, name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=12', verified: false, time: '20h ago', text: 'The character development in just a few paragraphs is insane. How do you do this?', likes: 92, liked: false },
    { id: 19, name: 'Emeka_T', avatar: 'https://i.pravatar.cc/100?img=15', verified: false, time: '21h ago', text: "I don't usually cry at stories. This one got me. I need to go touch some grass.", likes: 210, liked: false },
    { id: 20, name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', verified: true, time: '22h ago', text: "I'm overwhelmed by the response to this chapter. Every comment means the world to me. Thank you all for reading.", likes: 421, liked: false },
  ];

  /* ── ADS ── */
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

  /* ── AD POOLS + PLACEMENTS ──
     Single source of ad inventory. services/ad-service.js serves these
     (demo) or /api/ads (live). marketing/ad-manager.html edits them. */
  const AD_POOLS = {
    platform: [
      { id: 'plat_premium', sponsor: 'DroBoard', title: 'DroBoard Premium — Read Ad-Free', cta: 'Upgrade Now', img: c(2), pages: ['discover', 'feed', 'genreHub', 'discussion'] },
      { id: 'plat_coins', sponsor: 'DroBoard Coins', title: 'Get 3 Months of Unlimited Coins', cta: 'Claim Offer', img: c(3), pages: ['discover', 'feed', 'genreHub'] },
      { id: 'plat_studio', sponsor: 'DroBoard Studio', title: 'Write Your Own Story Today', cta: 'Start Writing', img: c(4), pages: ['discover', 'feed', 'genreHub'] },
    ],
    book: [
      { id: 'book_betrayal', isBook: true, title: 'Season of Betrayal', author: 'Ada_Writes', authorName: 'Ada_Writes', authorAv: 'https://i.pravatar.cc/100?img=32', genre: 'Romance', cat: 'Romance', cover: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', img: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', desc: 'Featured in this hub.', views: '820k', likes: '94k', chapters: 62, rating: '4.9', tags: ['Featured', 'Romance'], cta: 'Read Now', pages: ['discover', 'feed', 'genreHub', 'discussion'], campaign: 'CMP-010' },
      { id: 'book_crowned', isBook: true, title: 'Crowned in Sin', author: '@Nkemdilim_R', genre: 'Mafia', rating: '4.9', chapters: 32, preview: 'An indie mafia romance climbing the charts.', img: c(7), pages: ['discover', 'feed', 'genreHub'], campaign: 'CMP-002' },
      { id: 'book_werewolf', isBook: true, title: 'Werewolf King, Human Queen', author: '@Tobenna_K', genre: 'Werewolf', rating: '4.6', chapters: 19, preview: 'A new voice in werewolf romance.', img: c(8), pages: ['discover', 'feed', 'genreHub'], campaign: 'CMP-004' },
      { id: 'book_billionaire', isBook: true, title: 'The Billionaire Never Forgets', author: '@Sarah_Odum', genre: 'Billionaire', rating: '4.7', chapters: 24, preview: 'A slow-burn billionaire romance.', img: c(9), pages: ['discover', 'feed', 'genreHub'], campaign: 'CMP-001' },
      { id: 'book_campus', isBook: true, title: 'Campus Chaos', author: '@Bode_Ilo', genre: 'Campus', rating: '4.5', chapters: 16, preview: 'A campus rom-com getting buzz.', img: c(0), pages: ['discover', 'feed', 'genreHub'] },
      { id: 'book_fangs', isBook: true, title: 'Fangs & Fortune', author: '@Ese_Uyi', genre: 'Fantasy', rating: '4.8', chapters: 29, preview: 'Dark fantasy romance from an indie author.', img: c(1), pages: ['discover', 'feed', 'genreHub'], campaign: 'CMP-004' },
    ],
    native: [
      { id: 'nat_ai_1', brand: 'SkillPath AI', heading: 'Learn AI automation in 7 days', body: 'No coding. Build workflows that save hours every week.', cta: 'Start free lesson', likes: 842, liked: false, comments: 63, image: 'https://picsum.photos/seed/aiauto/800/420', pages: ['feed', 'fullReader', 'scrollReader'] },
      { id: 'nat_pdf_1', brand: 'GuideForge', heading: 'Build a PDF guide with AI', body: 'Turn your notes into a polished digital guide in minutes.', cta: 'Make my guide', likes: 519, liked: false, comments: 41, image: 'https://picsum.photos/seed/pdfguide/800/420', pages: ['feed', 'fullReader', 'scrollReader'] },
      { id: 'nat_biz_1', brand: 'HustleClass', heading: 'Business training for creators', body: 'Pricing, funnels, and first sales for writers.', cta: 'Browse courses', likes: 1204, liked: false, comments: 98, image: 'https://picsum.photos/seed/biztrain/800/420', pages: ['feed', 'fullReader', 'scrollReader'] },
    ],
    follow: [
      { id: 'demo_follow_1', userName: 'Amina Okoro', name: 'Amina Okoro', handle: 'aminaokoro', avatar: 'https://i.pravatar.cc/150?img=32', tagline: 'Romance & family drama · 120k readers', cta: 'Follow', pages: ['feed'] },
    ],
    banner: [
      { id: 'demo_ban_1', brand: 'DroBoard Coins', headline: 'Top up coins — unlock bonus chapters', sub: 'Support writers instantly', cta: 'Get Coins', pages: ['feed', 'fullReader', 'scrollReader'] },
    ],
    /* Promo slider slides (library / genre-hub top sliders). `pages`
       decides where a slide shows; `genre` narrows hub slides. */
    promo: [
      { id: 'promo_lib_1', title: 'Bound to the Ruthless CEO', author: 'Ava Winters', cta: 'Read Now', img: c(3), pages: ['library'] },
      { id: 'promo_lib_2', title: 'His Sweet Revenge', author: 'Luna Grey', cta: 'New Chapter', img: c(0), pages: ['library'] },
      { id: 'promo_lib_3', title: "The Alpha's Obsession", author: 'Ifeanyi Story', cta: 'Trending', img: c(2), pages: ['library'] },
      { id: 'promo_lib_4', title: 'Devil in a Suit', author: 'Zara M', cta: "Editor's Pick", img: c(8), pages: ['library'] },
      { id: 'promo_lib_5', title: 'Burn For Me, Elsa', author: 'Ada Writes', cta: 'Completed', img: c(4), pages: ['library'] },
      { id: 'promo_home_1', title: 'Go Premium — Read Without Limits', sub: 'Unlimited chapters, early access, ad-free.', img: c(2), cta: 'Try Premium Free', pages: ['home'] },
      { id: 'promo_home_2', title: 'Married to the Enemy', sub: 'She married him for the family name.', img: c(11), cta: 'Read Now', pages: ['home'] },
      { id: 'promo_home_3', title: 'Invite Friends, Earn Coins', sub: 'You both earn 50 coins when they start reading.', img: c(8), cta: 'Invite Now', pages: ['home'] },
      { id: 'promo_hub_fp1', title: 'The Priory path', author: 'ShelfWitch', cta: 'Read', img: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=120&h=160&fit=crop', eyebrow: 'Fantasy picks', pages: ['genreHub'], genre: 'fantasy' },
      { id: 'promo_hub_fp2', title: 'Will of the Many', author: 'MapNerd', cta: 'Open', img: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120&h=160&fit=crop', eyebrow: 'Fantasy picks', pages: ['genreHub'], genre: 'fantasy' },
      { id: 'promo_hub_fp3', title: 'Season of Betrayal', author: 'Ada_Writes', cta: 'Read', img: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', eyebrow: 'Fantasy picks', pages: ['genreHub'], genre: 'fantasy' },
      { id: 'promo_hub_rp1', title: 'Season of Betrayal', author: 'Ada_Writes', cta: 'Read', img: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg', eyebrow: 'Romance picks', pages: ['genreHub'], genre: 'romance' },
      { id: 'promo_hub_rp2', title: 'The Billionaire Never Forgets', author: 'Sarah_Odum', cta: 'Read', img: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg', eyebrow: 'Romance picks', pages: ['genreHub'], genre: 'romance' },
      { id: 'promo_hub_wp1', title: 'Werewolf King, Human Queen', author: 'Luna_Grey', cta: 'Read', img: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg', eyebrow: 'Werewolf picks', pages: ['genreHub'], genre: 'werewolf' },
      { id: 'promo_hub_wp2', title: 'Fangs & Fortune', author: 'Ese_Uyi', cta: 'Open', img: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg', eyebrow: 'Werewolf picks', pages: ['genreHub'], genre: 'werewolf' },
    ],
  };

  const AD_PLACEMENTS = {
    discover: { interval: 6, cycle: ['book', 'book', 'book', 'book', 'platform'] },
    feed: { interval: 4 },
    genreHub: { interval: 3, topPromo: true },
    discussion: { slot: 'single' },
    series: { slot: 'single' },
    home: { interval: 5 },
    fullReader: { interval: 3 },
    scrollReader: { interval: 4 },
    library: { promoSlider: true },
  };

  /* ── EVENT & ANNOUNCEMENT ── */
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

  /* ── FULL STORY DATA (for reader page) ── */
  const FULL_STORY = {
    id: 'story-betrayal-1',
    title: 'The Letter She Never Sent',
    category: '💔 Betrayal',
    author: {
      name: 'Ada_Writes',
      avatar: 'https://i.pravatar.cc/100?img=32',
      handle: '@ada_writes'
    },
    unlockedThrough: 3,
    coinsBalance: 40,
    chapters: [
      {
        n: 1, title: 'The Envelope in the Drawer', words: 680,
        paras: [
          "I found it on a Tuesday, three months after she died. A cream envelope tucked beneath her winter sweaters in the bottom drawer of her wardrobe.",
          "The envelope was sealed. No name on the front. Just a single red rose drawn in the corner — her handwriting, the same looped curves I had seen on every birthday card she ever sent me.",
          "Inside were three things: a photograph of a man I did not recognise, a letter addressed to me but never sent, and a receipt for a hotel room in Abuja.",
          "I called my aunt in Enugu. She answered on the second ring, which was unusual for a woman who screened every call like a customs officer.",
          "I described the photograph first, because that felt safest. The blue shirt. The red car. The smile aimed at someone outside the frame.",
          "There was a long silence, and then she said, 'That is your father. Your real father. Your mother never told you because she made a promise, and promises outlive the people who make them.'",
          "I sat down on the bedroom floor with the phone pressed to my ear and the envelope in my lap, and I understood, all at once, why my mother had always gone quiet whenever anyone asked about the years before I was born.",
          "The letter I did not open. Not yet. Some doors should be knocked on before they are pushed, so I booked a bus ticket to Abuja for Friday morning and told no one where I was going.",
          "The hotel from the receipt still stood near the motor park, repainted a cheerful yellow that could not quite cover twenty years of weather. The receptionist was a young man with kind eyes who had not been born when the receipt was printed.",
          "I showed him the photograph. He studied it, then called an older cleaner from the back, a woman with grey threading through her braids, who took one look and said, 'Ah. The quiet man. Room twelve. He stayed three weeks and paid in cash and never once raised his voice.'",
          "Room twelve was occupied, so I stood in the corridor outside it for a long time, listening to a television murmuring through the door, trying to feel something monumental. Instead I felt ordinary grief, the everyday kind, for a man I had never met and a mother who had carried the whole weight of him alone.",
          "On the bus back to Lagos I finally opened the letter. It was short, and it ended with a sentence I have read every day since: whatever you decide to call me, please know that not a single day passed without you in it.",
          "That night I placed the photograph on my own dresser, next to my mother's, so the two of them could finally be in the same room. Then I sat down and began to write all of this out, because some inheritances are not money or houses but stories — and this one, at last, is mine to tell.",
        ]
      },
      {
        n: 2, title: 'The Man in the Photograph', words: 720,
        paras: [
          "I studied the photograph for an hour. It was old — the colours faded, the edges soft. A man in a blue shirt, standing beside a red car, smiling at someone just out of frame.",
          "I called my aunt in Enugu. She answered on the second ring, which was unusual.",
          "'That is your father,' she said finally. 'Your real father. Your mother never told you because she made a promise.'",
        ]
      },
      {
        n: 3, title: 'The Promise She Made', words: 740,
        paras: [
          "The letter explained everything. My mother had met my father when she was nineteen, a student at the University of Ibadan. He was older, married, with two children.",
          "'He wanted to be in your life,' she wrote. 'He begged me to let him. But I was young and proud and I did not want to share you.'",
          "I understood the fear. I did not know if I understood the choice. But I knew one thing for certain: I had to meet him.",
        ]
      },
    ],
    comments: [
      { name: 'Chioma_R', avatar: 'https://i.pravatar.cc/100?img=47', time: '2h', text: 'The box of letters destroyed me. My father did the same thing.', likes: 1200, liked: false },
      { name: 'Emeka_T', avatar: 'https://i.pravatar.cc/100?img=15', time: '4h', text: 'This is why I love Droboard — stories that hit different.', likes: 640, liked: false },
      { name: 'CampusQueen', avatar: 'https://i.pravatar.cc/100?img=12', time: '5h', text: 'Cried on the train. This is everything.', likes: 410, liked: true },
      { name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', time: '6h', text: 'Thank you all for reading. This story is close to my heart.', likes: 890, liked: false },
      { name: 'Ifeanyi_Story', avatar: 'https://i.pravatar.cc/100?img=53', time: '8h', text: 'The way you handle family secrets is unmatched. Beautiful work.', likes: 320, liked: false },
      { name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', time: '10h', text: 'I had to put my phone down after chapter 3. Too real.', likes: 275, liked: false },
    ],
    shares: 34000,
    tips: 1240,
    similar: [
      { id: 'story-2', cover: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=300&q=70', cat: '💔 Heartbreak', title: "He proposed with my best friend's ring", author: 'Kemi_A' },
      { id: 'story-3', cover: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=300&q=70', cat: '🔥 Revenge', title: 'My stepmother stole my university fund', author: 'Zara_M' },
      { id: 'story-5', cover: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=70', cat: '💔 Betrayal', title: 'Caught my husband kissing her photograph', author: 'Ada_Writes' },
      { id: 'story-6', cover: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=300&q=70', cat: '✨ Twist', title: 'The runaway bride', author: 'Ifeanyi_Story' },
      { id: 'story-7', cover: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=70', cat: '🐺 Werewolf', title: "The Alpha's rejected mate", author: 'Luna_Grey' },
      { id: 'story-8', cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&q=70', cat: '💍 Romance', title: 'His secret billionaire life', author: 'Sarah_Odum' },
    ],
  };

  /* ── READER PAGE DATA (teams, reactions for full-reader / scroll-reader) ── */
  const READER_TEAMS = [
    { id: 'a', icon: '💔', name: 'Team Ada',    col: '#ff0050', count: 2300 },
    { id: 'b', icon: '🔥', name: 'Team Emeka',  col: '#60a5fa', count: 890 },
    { id: 'c', icon: '🕊️', name: 'Team Forgive', col: '#34d399', count: 540 },
    { id: 'd', icon: '👀', name: 'Team Watching', col: '#a78bfa', count: 230 },
  ];

  const READER_REACTIONS = [
    { id: 'cry',      emoji: '😭', label: 'Crying',     count: 9200 },
    { id: 'broken',   emoji: '💔', label: 'Heartbroken', count: 7800 },
    { id: 'shock',    emoji: '😱', label: 'Shocked',    count: 4100 },
    { id: 'rage',     emoji: '😡', label: 'Rage',       count: 3300 },
    { id: 'emo',      emoji: '🥹', label: 'Emotional',  count: 5600 },
    { id: 'sus',      emoji: '👀', label: 'Suspicious', count: 2100 },
    { id: 'savage',   emoji: '🔥', label: 'Savage',     count: 1800 },
    { id: 'twist',    emoji: '🫢', label: 'Plot Twist', count: 2900 },
  ];

  /* ── LIBRARY PAGE DATA (promo slides live in AD_POOLS.promo) ── */
  const LIBRARY = [
    { id: 'lib1', title: "His Sweet Revenge", author: 'Luna Grey', preview: 'Everything changes when she discovers the truth he tried so hard to hide.', ch: 'Ch. 21 of 40', pct: 68, img: c(0), status: 'progress' },
    { id: 'lib2', title: 'Forbidden Hearts', author: 'Mia Clark', preview: "She promised herself she'd never fall for him again. That promise just broke.", ch: 'Ch. 9 of 28', pct: 42, img: c(1), status: 'progress' },
    { id: 'lib3', title: "The Alpha's Obsession", author: 'Ifeanyi Story', preview: 'He claimed her as his mate. She refused to accept it — until the full moon.', ch: 'Ch. 18 of 50', pct: 55, img: c(2), status: 'progress' },
    { id: 'lib4', title: 'Burn For Me, Elsa', author: 'Ada Writes', preview: 'A deal. A marriage. A love she never saw coming.', ch: 'Completed', pct: 100, img: c(4), status: 'finished' },
    { id: 'lib5', title: 'Bound to the Ruthless CEO', author: 'Ava Winters', preview: 'One year. No feelings. The contract was perfect — until neither wanted to leave.', ch: 'Ch. 14 of 36', pct: 31, img: c(3), status: 'progress' },
    { id: 'lib6', title: 'Claiming His Luna', author: 'Ifeanyi Story', preview: 'The pack called her luna. Under the full moon she learned she was neither.', ch: 'Ch. 7 of 32', pct: 22, img: c(5), status: 'progress' },
    { id: 'lib7', title: 'Until You Regret', author: 'Ada Writes', preview: 'She left without a word. Five years later, he found her — and the truth.', ch: 'Completed', pct: 100, img: c(6), status: 'finished' },
    { id: 'lib8', title: "The Mafia's Secret Wife", author: 'Chiamaka N', preview: 'A marriage of convenience. A secret that could destroy them both.', ch: 'Unread', pct: 0, img: c(7), status: 'unread' },
    { id: 'lib9', title: 'Devil in a Suit', author: 'Zara M', preview: 'He owned the city. She owned his attention — and that made her dangerous.', ch: 'Ch. 5 of 24', pct: 18, img: c(8), status: 'progress' },
    { id: 'lib10', title: 'Alpha Stefano', author: 'Ifeanyi Story', preview: 'He lost everything in one night. Then she found him — and the war found them.', ch: 'Completed', pct: 100, img: c(9), status: 'finished' },
  ];

  const SAVED = [
    { id: 'saved1', title: 'Married for Revenge', author: 'Ifeanyi Story', preview: 'She married him for revenge. He stayed for love. Neither expected the cost.', ch: 'Saved', pct: 0, img: c(2), status: 'saved' },
    { id: 'saved2', title: 'His Second Chance', author: 'Efe O', preview: 'Ten years later. Same city. One chance to make it right.', ch: 'Saved', pct: 0, img: c(5), status: 'saved' },
    { id: 'saved3', title: 'The Night She Returned', author: 'Kemi A', preview: 'She vanished on a Tuesday. Six months later the letter arrived.', ch: 'Saved', pct: 0, img: c(6), status: 'saved' },
    { id: 'saved4', title: 'Shadows of Desire', author: 'Ada Writes', preview: 'He built an empire on silence. She was the only one who made him speak.', ch: 'Saved', pct: 0, img: c(8), status: 'saved' },
    { id: 'saved5', title: 'Blood and Roses', author: 'Ada Writes', preview: 'The deal was clean on paper. In the room, nothing was.', ch: 'Saved', pct: 0, img: c(0), status: 'saved' },
  ];

  const HISTORY = [
    { id: 'hist1', title: "His Sweet Revenge", author: 'Luna Grey', preview: 'Last read · Chapter 21 · 2 hours ago', ch: 'Ch. 21', pct: 68, img: c(0), status: 'progress' },
    { id: 'hist2', title: 'Forbidden Hearts', author: 'Mia Clark', preview: 'Last read · Chapter 9 · Yesterday', ch: 'Ch. 9', pct: 42, img: c(1), status: 'progress' },
    { id: 'hist3', title: 'Burn For Me, Elsa', author: 'Ada Writes', preview: 'Finished · 3 days ago', ch: 'Completed', pct: 100, img: c(4), status: 'finished' },
    { id: 'hist4', title: "The Alpha's Obsession", author: 'Ifeanyi Story', preview: 'Last read · Chapter 18 · 4 days ago', ch: 'Ch. 18', pct: 55, img: c(2), status: 'progress' },
    { id: 'hist5', title: 'Until You Regret', author: 'Ada Writes', preview: 'Finished · 1 week ago', ch: 'Completed', pct: 100, img: c(6), status: 'finished' },
    { id: 'hist6', title: 'Devil in a Suit', author: 'Zara M', preview: 'Last read · Chapter 5 · 2 weeks ago', ch: 'Ch. 5', pct: 18, img: c(8), status: 'progress' },
  ];

  /* ── NOTIFICATIONS ── */
  const NOTIFS = [
    { day:'Today', items:[
      { id:1, type:'like', cat:'activity', accent:'pink', unread:true,
        avatar:'https://i.pravatar.cc/100?img=12', badge:'heart', badgeIcon:'fa-heart',
        title:'<b>John</b> and <b>12 others</b> liked your review',
        desc:"They liked your review on The Billionaire's Regret.",
        time:'2m ago' },
      { id:2, type:'chapter', cat:'stories', accent:'purple', unread:true,
        avatar:'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=120&h=160&fit=crop', cover:true, badge:'book', badgeIcon:'fa-book',
        title:'New chapter released',
        desc:'A new chapter of The Silent Bride is out now!',
        link:'Chapter 24: The Truth Unveiled',
        time:'15m ago',
        thumb:'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=120&h=120&fit=crop' },
      { id:3, type:'reply', cat:'community', accent:'blue', unread:true,
        avatar:'https://i.pravatar.cc/100?img=33', badge:'comment', badgeIcon:'fa-comment',
        title:'<b>Liam_07</b> replied to your comment',
        desc:'"I totally agree with your point about Jason..."',
        time:'32m ago' },
      { id:4, type:'mention', cat:'activity', accent:'blue', unread:true,
        avatar:'https://i.pravatar.cc/100?img=47', badge:'mention', badgeIcon:'fa-at',
        title:'<b>Sarah_K</b> mentioned you in a comment',
        desc:'"@you have to read this chapter — it\'s wild"',
        time:'48m ago' },
      { id:5, type:'coins', cat:'revenue', accent:'green', unread:true,
        iconBg:'var(--pink-soft)', iconColor:'var(--pink)', icon:'fa-dollar-sign', badge:'coin', badgeIcon:'fa-arrow-up',
        title:'You received 120 Coins',
        desc:'From reader @booklover_99',
        time:'1h ago' },
      { id:6, type:'follow', cat:'community', accent:'purple', unread:true,
        avatar:'https://i.pravatar.cc/100?img=32', badge:'follow', badgeIcon:'fa-user-plus',
        title:'<b>Ada_Writes</b> and <b>3 others</b> started following you',
        desc:'You have 4 new followers today.',
        time:'2h ago' },
      { id:7, type:'like', cat:'activity', accent:'pink', unread:true,
        avatar:'https://i.pravatar.cc/100?img=15', badge:'heart', badgeIcon:'fa-heart',
        title:'<b>Maya</b> and <b>28 others</b> liked your chapter',
        desc:'Chapter 12 of Bound By Obsession is getting love.',
        time:'3h ago' },
    ]},
    { day:'Yesterday', items:[
      { id:8, type:'rank', cat:'stories', accent:'orange', unread:true,
        iconBg:'#fff4e0', iconColor:'var(--orange)', icon:'fa-trophy', badge:'trophy', badgeIcon:'fa-star',
        title:'Your story entered Top 20',
        desc:"The Billionaire's Regret is now in Top 20",
        link:'Romance Stories', linkClass:'orange',
        time:'Yesterday, 9:41 PM' },
      { id:9, type:'contract', cat:'system', accent:'green', unread:true,
        iconBg:'#e9fbf0', iconColor:'var(--success)', icon:'fa-file-lines', badge:'check', badgeIcon:'fa-check',
        title:'Contract approved',
        desc:'Your publishing contract for The Silent Bride has been approved.',
        time:'Yesterday, 4:18 PM' },
      { id:10, type:'comment', cat:'community', accent:'blue', unread:true,
        avatar:'https://i.pravatar.cc/100?img=20', badge:'comment', badgeIcon:'fa-comment',
        title:'<b>Nora_Reads</b> and <b>5 others</b> commented on your post',
        desc:'Latest discussion is heating up in the comments.',
        time:'Yesterday, 1:05 PM' },
      { id:11, type:'tip', cat:'revenue', accent:'green', unread:false,
        iconBg:'#e9fbf0', iconColor:'var(--success)', icon:'fa-hand-holding-dollar', badge:'coin', badgeIcon:'fa-arrow-up',
        title:'You received a 50 Coin tip',
        desc:'From @nightowl_reader on Chapter 8',
        time:'Yesterday, 11:22 AM' },
    ]},
    { day:'Earlier This Week', items:[
      { id:12, type:'follow', cat:'community', accent:'purple', unread:true,
        avatar:'https://i.pravatar.cc/100?img=49', badge:'follow', badgeIcon:'fa-user-plus',
        title:'New follower',
        desc:'Emily Rose started following you.',
        time:'2 days ago' },
      { id:13, type:'review', cat:'stories', accent:'purple', unread:false,
        avatar:'https://i.pravatar.cc/100?img=25', badge:'book', badgeIcon:'fa-star',
        title:'<b>Chris_M</b> left a 5-star review',
        desc:"\"Couldn't put Bound By Obsession down. Masterpiece.\"",
        time:'3 days ago' },
      { id:14, type:'payout', cat:'revenue', accent:'green', unread:false,
        iconBg:'#e9fbf0', iconColor:'var(--success)', icon:'fa-building-columns', badge:'check', badgeIcon:'fa-check',
        title:'Payout processed',
        desc:'$128.40 has been sent to your bank account.',
        time:'3 days ago' },
    ]},
    { day:'Older', items:[
      { id:15, type:'reward', cat:'system', accent:'pink', unread:false,
        iconBg:'var(--pink-soft)', iconColor:'var(--pink)', icon:'fa-gift', badge:'gift', badgeIcon:'fa-gift',
        title:'Daily reward available!',
        desc:'Tap to claim your daily reward.',
        time:'5 days ago' },
      { id:16, type:'security', cat:'system', accent:'orange', unread:false,
        iconBg:'#fff4e0', iconColor:'var(--orange)', icon:'fa-shield-halved', badge:'check', badgeIcon:'fa-lock',
        title:'New login detected',
        desc:'A login from Lagos, Nigeria was successful.',
        time:'1 week ago' },
    ]},
  ];

  /* -- SERIES CATALOGUE (rich series records: polls, debates, teams) -- */
const SERIES_CATALOG = {
  's1': {
    id: 's1',
    title: "I came home early and caught my husband kissing my late sister's photograph",
    cat: '💔 Betrayal',
    status: 'ongoing',
    isContest: false,
    cover: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    synopsis: `A Lagos woman returns home early, a surprise dinner planned, only to find her husband in a moment of grief-laden intimacy with a framed photograph of her late sister — Adaeze. What unfolds is not a simple tale of infidelity, but a slow uncovering of a love triangle that existed long before the marriage began. As Ada pieces together the timeline, she must decide: is staying a form of courage, or a slow forgetting of herself? Set against the backdrop of Lagos traffic, late-night candles, and family silences, this is a story about grief wearing the face of betrayal, and betrayal wearing the face of love.`,
    writer: { id: 'w1', name: 'Ada_Writes', handle: '@ada_writes', avatar: 'https://i.pravatar.cc/100?img=32', followers: '12.4k', isFollowed: false },
    stats: { reads: '1.1M', likes: '24.3k', comments: '4.1k', saves: '6.2k', shares: '18.9k' },
    seasons: 2,
    totalChapters: 14,
    currentProgress: { season: 2, chapter: 4, chapterTitle: 'What she found in the wardrobe', percent: 60 },
    genres: ['💔 Betrayal', '👑 Family', '✨ Twist', '🏙️ Urban'],
    startDate: 'March 2024',
    lastUpdated: '2 days ago',
    completedDate: null,
    avgReadTime: '4 min/chapter',
    wordCount: '~62,000 words',
    hasTeams: true,
    teams: [
      { id: 'a', icon: '💔', name: 'Team Ada', color: '#ff0050', count: 8400 },
      { id: 'b', icon: '🕊️', name: 'Team Forgiveness', color: '#38bdf8', count: 3200 },
      { id: 'c', icon: '🔥', name: 'Team Leave Him', color: '#34d399', count: 5100 },
      { id: 'd', icon: '👀', name: 'Team Watching', color: '#a78bfa', count: 1800 },
    ],
    tips: [
      { from: 'Sarah_Odum', amount: 150, note: 'That wardrobe scene!', time: '1d' },
      { from: 'Zara_M', amount: 75, note: 'Team Ada forever.', time: '4d' },
    ],
    polls: [
      {
        id: 'p1', season: 1,
        question: "Did Ada's husband truly love Adaeze, or was it obsession? ",
        options: [
          { text: '💔 True love — just buried', votes: 9200 },
          { text: '🔒 Unhealthy obsession', votes: 4100 },
          { text: '🌊 Complicated grief', votes: 7300 },
        ],
        voted: -1
      },
      {
        id: 'p2', season: 2,
        question: 'Should Ada confront the truth publicly or keep it within the marriage?',
        options: [
          { text: '📢 Speak out — she deserves the world to know', votes: 6800 },
          { text: '🤫 Keep it private — protect the family', votes: 3200 },
          { text: '🚪 Leave quietly, no confrontation', votes: 5400 },
        ],
        voted: -1
      }
    ],
    predictions: [
      {
        id: 'pr1',
        question: 'How does Season 2 end for Ada?',
        options: [
          { em: '💪', text: 'She rebuilds alone, stronger', sub: '9.4k predict this', votes: 9400, picked: false },
          { em: '💍', text: 'They reconcile after therapy', sub: '4.2k predict this', votes: 4200, picked: false },
          { em: '🔥', text: 'A major twist changes everything', sub: '7.8k predict this', votes: 7800, picked: false },
          { em: '❓', text: 'Cliffhanger — season 3 needed', sub: '5.1k predict this', votes: 5100, picked: false },
        ]
      }
    ],
    debates: [
      {
        id: 'deb1',
        motion: 'Ada should leave her husband immediately — emotional betrayal is still betrayal.',
        forV: 14800, agV: 8200,
        userVote: null,
        comments: [
          { id: 'dc1', name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47', side: 'for', text: 'You cannot mourn someone in secret while lying next to their sister. That is not grief — that is a choice.', time: '2h', likes: 341, liked: false },
          { id: 'dc2', name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', side: 'against', text: 'Grief does not follow the rules we write in books. He never cheated with a living person. It deserves nuance.', time: '3h', likes: 212, liked: false },
          { id: 'dc3', name: 'Kemi_A', avatar: 'https://i.pravatar.cc/100?img=28', side: 'for', text: 'The cruelty is that she placed the photograph herself. She loved her sister. And he used that grief against her without knowing it.', time: '4h', likes: 489, liked: false },
        ]
      },
      {
        id: 'deb2',
        motion: 'The sister Adaeze is the true protagonist of this series.',
        forV: 7600, agV: 9400,
        userVote: null,
        comments: [
          { id: 'dc4', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', side: 'against', text: 'Adaeze exists in memory, not chapters. But I will say: she shapes every single decision Ada makes. 👀', time: '1h', likes: 1200, liked: false },
          { id: 'dc5', name: 'Zara_M', avatar: 'https://i.pravatar.cc/100?img=16', side: 'for', text: 'The dead character controls all the living ones. She is absolutely the centre of this story.', time: '2h', likes: 341, liked: false },
        ]
      }
    ],
    seasonData: [
      {
        season: 1, title: 'The Photograph', status: 'complete',
        chapters: [
          { n:1, title:"The surprise dinner that wasn't", reads:'88k', time:'4 min', state:'done', badges:['free'] },
          { n:2, title:'Six years and one photograph', reads:'79k', time:'3 min', state:'done', badges:[] },
          { n:3, title:'The name she used to say', reads:'71k', time:'4 min', state:'done', badges:[] },
          { n:4, title:"Adaeze's favourite dress", reads:'68k', time:'3 min', state:'done', badges:[] },
          { n:5, title:'The night I stopped sleeping next to him', reads:'74k', time:'5 min', state:'done', badges:[] },
          { n:6, title:'What my mother said when I called her at midnight', reads:'66k', time:'4 min', state:'done', badges:[] },
          { n:7, title:"He wept in the car and thought I couldn't hear", reads:'81k', time:'4 min', state:'done', badges:[] },
        ]
      },
      {
        season: 2, title: 'The Truth Under the House', status: 'ongoing',
        chapters: [
          { n:1, title:'The first night she slept in the spare room', reads:'61k', time:'4 min', state:'done', badges:[] },
          { n:2, title:'She found the letters he never sent Adaeze', reads:'58k', time:'5 min', state:'done', badges:[] },
          { n:3, title:'Therapy — and the thing he admitted first', reads:'54k', time:'4 min', state:'done', badges:[] },
          { n:4, title:'What she found in the wardrobe', reads:'49k', time:'4 min', state:'current', badges:['new'] },
          { n:5, title:'Season finale — coming Friday', reads:'–', time:'–', state:'locked', badges:['new'] },
          { n:6, title:'Season 3 teaser', reads:'–', time:'–', state:'locked', badges:[] },
          { n:7, title:'[Unannounced]', reads:'–', time:'–', state:'locked', badges:[] },
        ]
      }
    ]
  },

  's2': {
    id: 's2',
    title: "He proposed with my best friend's ring — and she giggled before he even knelt",
    cat: '💔 Heartbreak',
    status: 'ongoing',
    isContest: true,
    cover: 'https://i.postimg.cc/23WvkFLH/images-(2).jpg',
    synopsis: `Three years of devotion. One restaurant. One unguarded giggle from a best friend before the ring box was even open. In that single sound, a woman hears the entire length and shape of a betrayal she never saw coming. What follows is not a breakdown — it is a reckoning. Kemi walks out of the restaurant, into her flat, and opens a novel she has not touched in eighteen months. The book becomes her witness, her therapy, her revenge — and eventually, her greatest achievement. A story about what happens when you stop performing grief and start performing for yourself.`,
    writer: { id: 'w4', name: 'Kemi_A', handle: '@kemi_a', avatar: 'https://i.pravatar.cc/100?img=28', followers: '6.5k', isFollowed: true },
    stats: { reads: '312k', likes: '19.2k', comments: '3.1k', saves: '4.8k', shares: '9.4k' },
    seasons: 1,
    totalChapters: 3,
    currentProgress: { season: 1, chapter: 2, chapterTitle: 'The kitchen floor at midnight', percent: 40 },
    genres: ['💔 Heartbreak', '✨ Twist', '✍️ Redemption'],
    startDate: 'January 2025',
    lastUpdated: '1 week ago',
    completedDate: null,
    avgReadTime: '3 min/chapter',
    wordCount: '~12,000 words',
    hasTeams: false,
    teams: [],
    tips: [
      { from: 'Ada_Writes', amount: 100, note: 'The giggle heard round the world.', time: '2d' },
    ],
    polls: [
      {
        id: 'p3', season: 1,
        question: 'Who was more wrong — the boyfriend or Bisi?',
        options: [
          { text: '💍 The boyfriend — he planned it', votes: 8400 },
          { text: '😂 Bisi — the giggle sealed it', votes: 6200 },
          { text: '🤝 Both equally', votes: 4100 },
        ],
        voted: -1
      }
    ],
    predictions: [
      {
        id: 'pr2',
        question: 'What does the novel she writes become?',
        options: [
          { em: '🏆', text: 'A bestseller that exposes them', sub: '6.1k predict', votes: 6100, picked: false },
          { em: '💔', text: 'She never finishes it', sub: '1.2k predict', votes: 1200, picked: false },
          { em: '🎬', text: 'It gets adapted — they see themselves', sub: '8.4k predict', votes: 8400, picked: false },
          { em: '✨', text: 'Something better than revenge', sub: '4.9k predict', votes: 4900, picked: false },
        ]
      }
    ],
    debates: [
      {
        id: 'deb3',
        motion: 'Walking out of the restaurant without a word was the bravest thing she did.',
        forV: 11200, agV: 3400,
        userVote: null,
        comments: [
          { id: 'dc6', name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32', side: 'for', text: "Kemi didn't give them the satisfaction of a scene. She preserved her dignity in the most dignified way possible. ICON. ", time: '3h', likes: 892, liked: false },
          { id: 'dc7', name: 'Efe_O', avatar: 'https://i.pravatar.cc/100?img=22', side: 'against', text: 'She deserved to say more. Silence protected them from accountability.', time: '4h', likes: 144, liked: false },
        ]
      }
    ],
    seasonData: [
      {
        season: 1, title: 'The Giggle', status: 'ongoing',
        chapters: [
          { n:1, title:'The fairy lights and the ring box', reads:'98k', time:'3 min', state:'done', badges:['free'] },
          { n:2, title:'The kitchen floor at midnight', reads:'76k', time:'3 min', state:'current', badges:[] },
          { n:3, title:'The novel she opened at 11pm', reads:'–', time:'Coming soon', state:'locked', badges:['new'] },
        ]
      }
    ]
  },

  's3': {
    id: 's3',
    title: "My uncle claimed the inheritance using my late mother's stolen will",
    cat: '👑 Family',
    status: 'ongoing',
    isContest: false,
    cover: 'https://i.postimg.cc/cgLZJNmC/8.jpg',
    synopsis: `After her mother's burial in Onitsha, a young woman discovers that the will she has always known exists has been replaced — and her uncle has produced a different document, naming himself sole heir. What begins as a family dispute over land becomes a years-long legal and emotional battle to reclaim her mother's name, her inheritance, and the story of her own life. With a cast of aunts who choose silence, a lawyer who believes her, and a grandfather who knows more than he says, this is a series about the quiet violence of family corruption — and the loudness required to undo it.`,
    writer: { id: 'w1', name: 'Ada_Writes', handle: '@ada_writes', avatar: 'https://i.pravatar.cc/100?img=32', followers: '12.4k', isFollowed: false },
    stats: { reads: '138k', likes: '21k', comments: '2.8k', saves: '5.1k', shares: '11.2k' },
    seasons: 3,
    totalChapters: 21,
    currentProgress: { season: 3, chapter: 7, chapterTitle: 'The grandfather finally speaks', percent: 75 },
    genres: ['👑 Family', '⚖️ Justice', '🔥 Revenge'],
    startDate: 'October 2023',
    lastUpdated: '3 days ago',
    completedDate: null,
    avgReadTime: '4 min/chapter',
    wordCount: '~88,000 words',
    hasTeams: true,
    teams: [
      { id: 'a', icon: '⚖️', name: 'Team Justice', color: '#ff0050', count: 11200 },
      { id: 'b', icon: '🕊️', name: 'Team Forgive & Move', color: '#38bdf8', count: 2100 },
      { id: 'c', icon: '🔥', name: 'Team Burn It All', color: '#34d399', count: 4800 },
    ],
    polls: [
      {
        id: 'p4', season: 3,
        question: 'Will the grandfather testify in court in Season 3 finale?',
        options: [
          { text: '✅ Yes — he will speak', votes: 7800 },
          { text: '❌ No — fear keeps him silent', votes: 3200 },
          { text: '💀 He dies before he can', votes: 2100 },
        ],
        voted: -1
      }
    ],
    predictions: [
      {
        id: 'pr3',
        question: 'How does the inheritance story end?',
        options: [
          { em: '🏆', text: 'She wins in court completely', sub: '8.8k predict', votes: 8800, picked: false },
          { em: '🤝', text: 'Family compromises out of court', sub: '4.4k predict', votes: 4400, picked: false },
          { em: '💸', text: 'She loses but rebuilds elsewhere', sub: '2.1k predict', votes: 2100, picked: false },
          { em: '🔥', text: 'Uncle confesses — plot twist', sub: '5.6k predict', votes: 5600, picked: false },
        ]
      }
    ],
    debates: [
      {
        id: 'deb4',
        motion: 'The aunts who stayed silent are more guilty than the uncle who acted.',
        forV: 9800, agV: 6200,
        userVote: null,
        comments: [
          { id: 'dc8', name: 'Chiamaka_N', avatar: 'https://i.pravatar.cc/100?img=47', side: 'for', text: 'Silence is always a vote. They chose the uncle by not choosing the truth.', time: '1h', likes: 445, liked: false },
          { id: 'dc9', name: 'Dami_Cole', avatar: 'https://i.pravatar.cc/100?img=64', side: 'against', text: 'In many Nigerian families, women speaking out against male elders costs them everything. Fear is not the same as guilt.', time: '2h', likes: 312, liked: false },
        ]
      }
    ],
    seasonData: [
      {
        season: 1, title: 'The Burial and The Will', status: 'complete',
        chapters: [
          { n:1, title:'The burial — and the first lie', reads:'62k', time:'4 min', state:'done', badges:['free'] },
          { n:2, title:"What my aunts wouldn't say at the table", reads:'54k', time:'3 min', state:'done', badges:[] },
          { n:3, title:'The will my mother showed me once', reads:'51k', time:'4 min', state:'done', badges:[] },
          { n:4, title:'The lawyer who believed me', reads:'48k', time:'4 min', state:'done', badges:[] },
          { n:5, title:"What we found in uncle's house", reads:'56k', time:'5 min', state:'done', badges:[] },
          { n:6, title:'Season 1 finale — the filing', reads:'59k', time:'4 min', state:'done', badges:[] },
          { n:7, title:'A year of waiting', reads:'44k', time:'3 min', state:'done', badges:[] },
        ]
      },
      {
        season: 2, title: 'The Case Opens', status: 'complete',
        chapters: [
          { n:1, title:'First day in court', reads:'48k', time:'4 min', state:'done', badges:[] },
          { n:2, title:'The witness they produced', reads:'44k', time:'4 min', state:'done', badges:[] },
          { n:3, title:"My grandmother's deposition", reads:'51k', time:'5 min', state:'done', badges:[] },
          { n:4, title:'The adjournment that broke me', reads:'41k', time:'3 min', state:'done', badges:[] },
          { n:5, title:"My lawyer's secret", reads:'46k', time:'4 min', state:'done', badges:[] },
          { n:6, title:'Season 2 finale — the ruling', reads:'53k', time:'4 min', state:'done', badges:[] },
          { n:7, title:'The appeal they filed overnight', reads:'49k', time:'3 min', state:'done', badges:[] },
        ]
      },
      {
        season: 3, title: 'The Final Reckoning', status: 'ongoing',
        chapters: [
          { n:1, title:'Three years later — where we are', reads:'38k', time:'4 min', state:'done', badges:[] },
          { n:2, title:'The grandfather contacts me', reads:'35k', time:'3 min', state:'done', badges:[] },
          { n:3, title:'What the photograph proved', reads:'31k', time:'4 min', state:'done', badges:[] },
          { n:4, title:'The night before the final hearing', reads:'29k', time:'4 min', state:'done', badges:[] },
          { n:5, title:"My uncle's lawyer withdraws", reads:'26k', time:'3 min', state:'done', badges:[] },
          { n:6, title:"She called me by my mother's name", reads:'24k', time:'4 min', state:'done', badges:[] },
          { n:7, title:'The grandfather finally speaks', reads:'21k', time:'5 min', state:'current', badges:['new'] },
        ]
      }
    ]
  },
};

  /* ═══════════════════════════════════════════════════════════════
     AUTHOR FINANCE DATA
     Earnings, transactions, payment methods, withdrawals, disputes
     ═══════════════════════════════════════════════════════════════ */

  const AUTHOR_EARNINGS = {
    balance: 4280,
    pending: 1250,
    lifetime: 24800,
    thisMonth: 1840,
    lastMonth: 1620,
    currency: 'USD',
    byBook: [
      { id: 'b1', title: 'Season of Betrayal', earnings: 12400, reads: '820k', likes: '94k', chapters: 62, cover: COVERS[1] },
      { id: 'b2', title: 'Crowned in Sin', earnings: 8200, reads: '310k', likes: '41k', chapters: 48, cover: COVERS[2] },
      { id: 'b3', title: 'Until You Regret', earnings: 4200, reads: '150k', likes: '22k', chapters: 35, cover: COVERS[4] },
    ],
    monthlyHistory: [
      { month: 'Feb', amount: 1120 }, { month: 'Mar', amount: 1380 }, { month: 'Apr', amount: 1250 },
      { month: 'May', amount: 1540 }, { month: 'Jun', amount: 1620 }, { month: 'Jul', amount: 1840 },
    ],
  };

  const AUTHOR_TRANSACTIONS = [
    { id: 'TXN-5001', type: 'withdrawal', desc: 'Bank transfer to GTBank •••• 4821',           amount: -2140, book: null, date: '2026-07-27T20:15:00', status: 'completed' },
    { id: 'TXN-5002', type: 'withdrawal', desc: 'Bank transfer to GTBank •••• 4821',           amount: -1980, book: null, date: '2026-07-15T10:00:00', status: 'completed' },
    { id: 'TXN-5003', type: 'withdrawal', desc: 'PayPal transfer to luna.vale@paypal.com',    amount: -870,  book: null, date: '2026-06-30T09:00:00', status: 'completed' },
    { id: 'TXN-5004', type: 'withdrawal', desc: 'Bank transfer to GTBank •••• 4821',           amount: -1250, book: null, date: '2026-07-29T12:00:00', status: 'pending' },
  ];

  const AUTHOR_PAYMENT_METHODS = [
    { id: 'PM-01', type: 'bank', bankName: 'GTBank', accountName: 'Luna Vale', accountNumber: '02481794821', routingCode: '0580000124', isDefault: true,  verified: true,  icon: 'fa-building-columns' },
    { id: 'PM-02', type: 'paypal', email: 'luna.vale@paypal.com', accountName: 'Luna Vale', isDefault: false, verified: true, icon: 'fa-paypal' },
    { id: 'PM-03', type: 'mobile', provider: 'MTN Mobile Money', phoneNumber: '+234 812 345 6789', accountName: 'Luna Vale', isDefault: false, verified: false, icon: 'fa-mobile-screen' },
  ];

  const AUTHOR_WITHDRAWALS = [
    { id: 'WD-6001', amount: 2140, method: 'Bank Transfer', account: 'GTBank •••• 4821', requested: '2026-07-27T20:00:00', status: 'completed', processed: '2026-07-28T10:00:00' },
    { id: 'WD-6002', amount: 1980, method: 'Bank Transfer', account: 'GTBank •••• 4821', requested: '2026-07-15T10:00:00', status: 'completed', processed: '2026-07-16T08:30:00' },
    { id: 'WD-6003', amount: 870,  method: 'PayPal',        account: 'luna.vale@paypal.com', requested: '2026-06-30T09:00:00', status: 'completed', processed: '2026-07-01T14:00:00' },
    { id: 'WD-6004', amount: 1250, method: 'Bank Transfer', account: 'GTBank •••• 4821', requested: '2026-07-29T12:00:00', status: 'pending',   processed: null },
  ];

  const AUTHOR_DISPUTES = [
    { id: 'DSP-001', transactionId: 'TXN-5004', type: 'withdrawal', amount: 2140, reason: 'Withdrawal processed but funds not received in bank account after 5 business days.', status: 'open', filed: '2026-07-29T10:00:00', resolutionNote: '', adminReply: '' },
    { id: 'DSP-002', transactionId: 'TXN-5005', type: 'bonus',      amount: 200,  reason: 'Bonus amount does not match the announced Top Performer Bonus of $300.', status: 'investigating', filed: '2026-07-27T14:30:00', resolutionNote: '', adminReply: 'Reviewing bonus calculation with finance team.' },
  ];

  const WITHDRAWAL_MIN = 100;

  /* ── EXPOSE GLOBAL ── */
  global.DemoData = {
    COVERS,
    c,
    USERS,
    STORIES,
    COLLECTIONS,
    GENRES,
    S,
    HOME_CD,
    HOME_AD,
    HOME_HD,
    HERO_STORIES,
    CONTINUE_READING,
    CHAPTER_DROPS,
    TRENDING_GENRES,
    WRITERS_TO_FOLLOW,
    STATUSES,
    SERIES,
    SERIES_CATALOG,
    COMMENTS,
    ADS,
    EVENT,
    ANNOUNCEMENT,
    FULL_STORY,
    READER_TEAMS,
    READER_REACTIONS,
    LIBRARY,
    SAVED,
    HISTORY,
    AD_POOLS,
    AD_PLACEMENTS,
    NOTIFS,
    AUTHOR_EARNINGS,
    AUTHOR_TRANSACTIONS,
    AUTHOR_PAYMENT_METHODS,
    AUTHOR_WITHDRAWALS,
    AUTHOR_DISPUTES,
    WITHDRAWAL_MIN,
  };

})(window);
