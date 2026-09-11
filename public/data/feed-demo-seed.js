/**
 * data/genre-demo-seed.js — Demo seed only (window.GenreDemoSeed)
 * ─────────────────────────────────────────────────────────────
 * Pure data, zero logic. Organic hub content only.
 *
 * Ads are NOT here — ad-card.js + data/ad-data.js own ads.
 * Promo slider slides are story highlights for the genre (not ads).
 *
 * Delete this file (and its <script> tag) when going live.
 * Load before services/genre-data.js.
 */
(function (global) {
  'use strict';

  const COVERS = {
    c1: 'https://i.postimg.cc/vDn9YLx5/wife2.jpg',
    c2: 'https://i.postimg.cc/RqtfSQJJ/wife3.jpg',
    c3: 'https://i.postimg.cc/ftRZbhKx/3.jpg',
    c4: 'https://i.postimg.cc/DJwFzKgd/4.jpg',
    c5: 'https://i.postimg.cc/N9jY0w4m/5.jpg',
    c6: 'https://i.postimg.cc/WF1j4Pnh/6.jpg',
    c7: 'https://i.postimg.cc/xqmHfyNR/wolf2.jpg',
    c8: 'https://i.postimg.cc/fkdXzjS8/wolf.jpg',
    fantasy: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&h=400&fit=crop',
    media1: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=600&h=400&fit=crop',
    media2: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop',
    book1: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=120&h=160&fit=crop',
    book2: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=120&h=160&fit=crop',
  };

  const DEMO_GENRES = {
    fantasy: {
      id: 'fantasy',
      name: 'Fantasy',
      tagline: 'Where imagination becomes legend.',
      icon: 'fa-hat-wizard',
      cover: COVERS.fantasy,
      members: '45.7K',
      discussions: '3.2K',
      stories: '1.8K',
      blurb: 'Discuss tropes, argue theories, recommend stories, and keep the conversation inside Fantasy.',
    },
    romance: {
      id: 'romance',
      name: 'Romance',
      tagline: 'Hearts, heat, and happy endings.',
      icon: 'fa-heart',
      cover: COVERS.c1,
      members: '92.1K',
      discussions: '8.4K',
      stories: '4.2K',
      blurb: 'Slow burns, second chances, and the tropes we never get tired of — Romance only.',
    },
    werewolf: {
      id: 'werewolf',
      name: 'Werewolf',
      tagline: 'Packs, mates, and moonlit chaos.',
      icon: 'fa-moon',
      cover: COVERS.c7,
      members: '31.2K',
      discussions: '2.1K',
      stories: '980',
      blurb: 'Alpha dynamics, rejected mates, and pack politics — Werewolf discussion only.',
    },
  };

  const DEFAULT_GENRE_ID = 'fantasy';

  const DEMO_PINNED = {
    fantasy: {
      id: 'pinned-fantasy',
      pinned: true,
      title: 'Fantasy Hub rules — spoilers tagged, respect required',
      desc: 'This hub is for Fantasy only. Mark major spoilers. Argue the take, not the person. Report rule-breaks from the ⋯ menu.',
      likes: 128,
      comments: 36,
    },
    romance: {
      id: 'pinned-romance',
      pinned: true,
      title: 'Romance Hub rules',
      desc: 'Romance discussion only. Spoilers in tags. No shaming tropes. Credit writers when you quote.',
      likes: 210,
      comments: 54,
    },
    werewolf: {
      id: 'pinned-werewolf',
      pinned: true,
      title: 'Werewolf Hub rules',
      desc: 'Werewolf / shifter discussion only. Spoiler tags for mate-reveals. Keep pack discourse civil.',
      likes: 88,
      comments: 19,
    },
  };

  /* ═══════════════════════════════════════════════════════════════
     DISCUSSIONS — genre-scoped only
     tagClass: discussion | recommendation | theory | question | controversial
  ═══════════════════════════════════════════════════════════════ */
  const DEMO_DISCUSSIONS = {
    fantasy: [
      {
        id: 'fd1', hot: true, score: 98, name: 'LunaVale', avatar: 'https://i.pravatar.cc/100?img=47',
        badge: 'Top', time: '2h',
        title: "Who's your favorite morally gray Fantasy lead?",
        body: 'Anti-heroes, fallen kings, and villains you still root for — Fantasy only. Drop the character and the series.',
        tag: 'Discussion', tagClass: 'discussion',
        media: COVERS.media1,
        likes: 214, comments: 87, liked: false, controversy: 12,
        participants: ['https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=15', 'https://i.pravatar.cc/100?img=20'], extra: 42,
      },
      {
        id: 'fd2', hot: true, controversy: 86, score: 70, name: 'StarfallReader', avatar: 'https://i.pravatar.cc/100?img=12', time: '1h',
        title: 'Unpopular: most epic Fantasy finales are just longer epilogues',
        body: 'If the last 20% only ties bows and never raises stakes, is it really epic — or just long?',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 156, comments: 143, liked: false,
        participants: ['https://i.pravatar.cc/100?img=33', 'https://i.pravatar.cc/100?img=25', 'https://i.pravatar.cc/100?img=45'], extra: 51,
      },
      {
        id: 'fd3', score: 88, name: 'MythicInk', avatar: 'https://i.pravatar.cc/100?img=33',
        badge: 'Author', badgeClass: 'author', time: '4h',
        title: 'Theory: that Fantasy ending was already in chapter 3',
        body: 'Prophecy, mirror scene, last line — they connect. Spoiler-safe Fantasy theory thread. Bring evidence.',
        tag: 'Theory', tagClass: 'theory', isThread: true, replies: 24,
        likes: 389, comments: 142, liked: true, controversy: 28,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=5'], extra: 68,
      },
      {
        id: 'fd4', score: 55, controversy: 18, name: 'DragonBreath99', avatar: 'https://i.pravatar.cc/100?img=15', time: '6h',
        title: 'Best Fantasy world-building that earns the lore dumps?',
        body: 'Maps, magic systems, and cultures that feel lived-in — not a powerpoint. Modern series welcome.',
        tag: 'Discussion', tagClass: 'discussion',
        media: COVERS.media2,
        likes: 98, comments: 54, liked: false,
        participants: ['https://i.pravatar.cc/100?img=20', 'https://i.pravatar.cc/100?img=32'], extra: 19,
      },
      {
        id: 'fd5', score: 72, name: 'ElfQueen', avatar: 'https://i.pravatar.cc/100?img=45', time: '8h',
        title: 'Hidden gem: slow-burn political Fantasy done right',
        body: 'Dragons, court intrigue, patient character work. Fantasy recs only.',
        tag: 'Recommendation', tagClass: 'recommendation',
        story: { title: 'The Priory of the Orange Tree', writer: 'Samantha Shannon', cover: COVERS.book1 },
        likes: 267, comments: 41, liked: false, controversy: 6,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=33'], extra: 25,
      },
      {
        id: 'fd6', score: 40, controversy: 9, name: 'QuestGiver', avatar: 'https://i.pravatar.cc/100?img=20', time: '10h',
        title: 'Mid-series slog in epic Fantasy — how do you push through books 2–3?',
        body: 'Love the genre, but the middle often feels like filler. What’s worked for you?',
        tag: 'Question', tagClass: 'question',
        likes: 72, comments: 0, liked: false,
        participants: ['https://i.pravatar.cc/100?img=15'], extra: 12,
      },
      {
        id: 'fd7', controversy: 94, score: 60, hot: true, name: 'BladeTheory', avatar: 'https://i.pravatar.cc/100?img=5', time: '12h',
        title: 'Hot take: Fantasy chosen-one arcs are fine — lazy mentorship is the problem',
        body: 'The prophecy isn’t the issue. Mentors who withhold every answer until chapter 40 are.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 201, comments: 176, liked: false,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=33', 'https://i.pravatar.cc/100?img=12'], extra: 80,
      },
      {
        id: 'fd8', score: 64, name: 'RuneReader', avatar: 'https://i.pravatar.cc/100?img=25', time: '14h',
        title: 'Soft vs hard magic in Fantasy — which ages better on reread?',
        body: 'Hard systems feel clever once. Soft systems leave room for wonder. Where do you land?',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 133, comments: 61, liked: false, controversy: 22,
        participants: ['https://i.pravatar.cc/100?img=5', 'https://i.pravatar.cc/100?img=9'], extra: 28,
      },
      {
        id: 'fd9', score: 51, controversy: 71, name: 'MapNerd', avatar: 'https://i.pravatar.cc/100?img=53', time: '16h',
        title: 'Unpopular: most Fantasy maps are pure decoration',
        body: 'If travel times never matter and borders never shift, why print the map? Show one where geography drives plot.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 88, comments: 95, liked: false,
        participants: ['https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=20', 'https://i.pravatar.cc/100?img=33'], extra: 40,
      },
      {
        id: 'fd10', score: 77, name: 'MythicInk', avatar: 'https://i.pravatar.cc/100?img=33',
        badge: 'Author', badgeClass: 'author', time: '18h',
        title: 'Why I killed the Fantasy mentor in book 1',
        body: 'Not for shock — so the protagonist stops outsourcing judgment. Craft thread for Fantasy writers.',
        tag: 'Theory', tagClass: 'theory', isThread: true, replies: 31,
        likes: 412, comments: 98, liked: false, controversy: 15,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=5'], extra: 55,
      },
      {
        id: 'fd11', score: 45, name: 'ShelfWitch', avatar: 'https://i.pravatar.cc/100?img=9', time: '20h',
        title: 'Recommend standalone Fantasy under 400 pages',
        body: 'Between series. Prefer tight casts, low fill, and an ending that ends. Fantasy only.',
        tag: 'Recommendation', tagClass: 'recommendation',
        likes: 119, comments: 67, liked: false,
        participants: ['https://i.pravatar.cc/100?img=15', 'https://i.pravatar.cc/100?img=25', 'https://i.pravatar.cc/100?img=45'], extra: 33,
      },
      {
        id: 'fd12', score: 38, name: 'QuestGiver', avatar: 'https://i.pravatar.cc/100?img=20', time: '22h',
        title: 'How do you track Fantasy side characters across a trilogy?',
        body: 'Spreadsheet? Margin notes? Pure vibes? My reread is chaos.',
        tag: 'Question', tagClass: 'question',
        likes: 54, comments: 0, liked: false,
        participants: ['https://i.pravatar.cc/100?img=12'], extra: 8,
      },
      {
        id: 'fd13', score: 82, hot: true, name: 'LunaVale', avatar: 'https://i.pravatar.cc/100?img=47',
        badge: 'Top', time: '1d',
        title: 'Found family vs bloodline in Fantasy — which hits harder?',
        body: 'Crews, courts, and accidental households vs destiny bloodlines. Fantasy examples only.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 301, comments: 112, liked: true, controversy: 34,
        participants: ['https://i.pravatar.cc/100?img=5', 'https://i.pravatar.cc/100?img=9', 'https://i.pravatar.cc/100?img=32'], extra: 61,
      },
      {
        id: 'fd14', score: 59, name: 'ElfQueen', avatar: 'https://i.pravatar.cc/100?img=45', time: '1d',
        title: 'This portal Fantasy still holds up',
        body: 'Not nostalgia bait — the politics aged better than the magic. If you bounced as a teen, try again.',
        tag: 'Recommendation', tagClass: 'recommendation',
        story: { title: 'The Will of the Many', writer: 'James Islington', cover: COVERS.book2 },
        likes: 176, comments: 29, liked: false,
        participants: ['https://i.pravatar.cc/100?img=33'], extra: 14,
      },
      {
        id: 'fd15', score: 48, controversy: 55, name: 'BladeTheory', avatar: 'https://i.pravatar.cc/100?img=5', time: '1d',
        title: 'Dark Fantasy doesn’t need trauma porn to feel dark',
        body: 'Atmosphere, moral cost, irreversible choices > stacking atrocities. Fantasy craft take.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 224, comments: 130, liked: false,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=20'], extra: 47,
      },
      {
        id: 'fd16', score: 36, name: 'RuneReader', avatar: 'https://i.pravatar.cc/100?img=25', time: '2d',
        title: 'Anyone else DNF Fantasy when chapter 1 dumps 40 place names?',
        body: 'Immersion vs geography exam. How much front-loaded lore is too much in Fantasy?',
        tag: 'Question', tagClass: 'question',
        likes: 91, comments: 48, liked: false, controversy: 19,
        participants: ['https://i.pravatar.cc/100?img=15', 'https://i.pravatar.cc/100?img=53'], extra: 22,
      },
      {
        id: 'fd17', score: 69, name: 'StarfallReader', avatar: 'https://i.pravatar.cc/100?img=12', time: '2d',
        title: 'Theory: the “dead” Fantasy mentor is narrating book 3',
        body: 'Voice shifts, knowledge the MC shouldn’t have, one throwaway prologue line. Collecting Fantasy receipts.',
        tag: 'Theory', tagClass: 'theory', isThread: true, replies: 19,
        likes: 255, comments: 74, liked: false, controversy: 41,
        participants: ['https://i.pravatar.cc/100?img=33', 'https://i.pravatar.cc/100?img=5'], extra: 36,
      },
      {
        id: 'fd18', score: 42, name: 'MapNerd', avatar: 'https://i.pravatar.cc/100?img=53', time: '2d',
        title: 'Recommend military Fantasy that isn’t war crimes with magic',
        body: 'Tactics, logistics, character cost — Fantasy titles that respect the campaign.',
        tag: 'Recommendation', tagClass: 'recommendation',
        likes: 102, comments: 37, liked: false,
        participants: ['https://i.pravatar.cc/100?img=20'], extra: 15,
      },
      {
        id: 'fd19', score: 57, controversy: 48, name: 'ShelfWitch', avatar: 'https://i.pravatar.cc/100?img=9', time: '3d',
        title: 'Is cozy Fantasy still Fantasy if nothing threatens the world?',
        body: 'Low stakes, still speculative. Where’s the genre line? Not a dunk — taxonomy for this hub.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 148, comments: 89, liked: false,
        participants: ['https://i.pravatar.cc/100?img=45', 'https://i.pravatar.cc/100?img=25', 'https://i.pravatar.cc/100?img=12'], extra: 39,
      },
      {
        id: 'fd20', score: 73, hot: true, name: 'DragonBreath99', avatar: 'https://i.pravatar.cc/100?img=15', time: '3d',
        title: 'Best Fantasy opening line this decade?',
        body: 'Recent books only — not the classics. Paste the line and title. Spoiler-free.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 289, comments: 156, liked: false, controversy: 8,
        participants: ['https://i.pravatar.cc/100?img=47', 'https://i.pravatar.cc/100?img=33', 'https://i.pravatar.cc/100?img=5'], extra: 72,
      },
      {
        id: 'fd21', score: 33, name: 'QuestGiver', avatar: 'https://i.pravatar.cc/100?img=20', time: '4d',
        title: 'How should this Fantasy hub mark spoilers in long theory threads?',
        body: 'Tags, collapsed blocks, chapter numbers? Looking for a house style.',
        tag: 'Question', tagClass: 'question',
        likes: 41, comments: 0, liked: false,
        participants: ['https://i.pravatar.cc/100?img=9'], extra: 6,
      },
      {
        id: 'fd22', score: 61, name: 'MythicInk', avatar: 'https://i.pravatar.cc/100?img=33',
        badge: 'Author', badgeClass: 'author', time: '4d',
        title: 'Why I stopped writing Fantasy prophecies that “must” come true',
        body: 'Certainty kills tension. Ambiguous foreshadowing keeps readers arguing — perfect for this hub.',
        tag: 'Theory', tagClass: 'theory',
        likes: 198, comments: 52, liked: false, controversy: 27,
        participants: ['https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=47'], extra: 31,
      },
      {
        id: 'fd23', score: 44, name: 'RuneReader', avatar: 'https://i.pravatar.cc/100?img=25', time: '5d',
        title: 'Elf cultures in Fantasy that aren’t just “beautiful and distant”',
        body: 'Give me politics, work, and mess — not ethereal wallpaper. Recs and examples.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 97, comments: 43, liked: false,
        participants: ['https://i.pravatar.cc/100?img=45'], extra: 18,
      },
      {
        id: 'fd24', score: 52, controversy: 63, name: 'BladeTheory', avatar: 'https://i.pravatar.cc/100?img=5', time: '5d',
        title: 'Hot take: quest structure is still the best skeleton for epic Fantasy',
        body: 'Not every book needs to invent a new shape. A good road + rising cost still works.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 171, comments: 118, liked: false,
        participants: ['https://i.pravatar.cc/100?img=12', 'https://i.pravatar.cc/100?img=33', 'https://i.pravatar.cc/100?img=20'], extra: 45,
      },
    ],

    romance: [
      {
        id: 'rd1', hot: true, score: 90, name: 'Sofia_Reads', avatar: 'https://i.pravatar.cc/100?img=32', time: '3h',
        title: 'Slow burn vs instalove in Romance — which are you defending?',
        body: 'Both can work. Drop your best Romance example of each — this hub only.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 340, comments: 201, liked: false, controversy: 62,
        participants: ['https://i.pravatar.cc/100?img=48', 'https://i.pravatar.cc/100?img=9'], extra: 88,
      },
      {
        id: 'rd2', controversy: 80, score: 65, name: 'HeartOnPage', avatar: 'https://i.pravatar.cc/100?img=16', time: '5h',
        title: 'Hot take: third-act breakups in Romance are lazy more often than not',
        body: 'If a 5-minute talk would fix it, rewrite. Romance craft only.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 188, comments: 154, liked: false,
        participants: ['https://i.pravatar.cc/100?img=32', 'https://i.pravatar.cc/100?img=25'], extra: 50,
      },
      {
        id: 'rd3', score: 70, name: 'Ada_Writes', avatar: 'https://i.pravatar.cc/100?img=32',
        badge: 'Author', badgeClass: 'author', time: '8h',
        title: 'Recommend second-chance Romance with real growth on both sides',
        body: 'Not the same fight for 20 chapters. Romance recs only.',
        tag: 'Recommendation', tagClass: 'recommendation',
        story: { title: 'Season of Betrayal', writer: 'Ada_Writes', cover: COVERS.c1 },
        likes: 256, comments: 73, liked: false,
        participants: ['https://i.pravatar.cc/100?img=48'], extra: 29,
      },
      {
        id: 'rd4', score: 55, name: 'BookLover_99', avatar: 'https://i.pravatar.cc/100?img=20', time: '12h',
        title: 'Do enemies-to-lovers Romance arcs need a clear “why now” turn?',
        body: 'Chemistry isn’t enough for me without a shift in trust. Agree?',
        tag: 'Discussion', tagClass: 'discussion', controversy: 35,
        likes: 142, comments: 67, liked: false,
        participants: ['https://i.pravatar.cc/100?img=16', 'https://i.pravatar.cc/100?img=32'], extra: 24,
      },
      {
        id: 'rd5', score: 48, name: 'Sarah_Odum', avatar: 'https://i.pravatar.cc/100?img=48',
        badge: 'Author', badgeClass: 'author', time: '1d',
        title: 'How do you write billionaire Romance without the power gap feeling gross?',
        body: 'Agency, consent, and cost. Romance writers — what’s your checklist?',
        tag: 'Theory', tagClass: 'theory', isThread: true, replies: 22,
        likes: 198, comments: 81, liked: false,
        participants: ['https://i.pravatar.cc/100?img=32'], extra: 30,
      },
      {
        id: 'rd6', score: 40, name: 'HeartOnPage', avatar: 'https://i.pravatar.cc/100?img=16', time: '2d',
        title: 'Best closed-door Romance you’ve read this year?',
        body: 'Heat can be emotional. Drop titles — Romance hub only.',
        tag: 'Recommendation', tagClass: 'recommendation',
        likes: 121, comments: 55, liked: false,
        participants: ['https://i.pravatar.cc/100?img=9'], extra: 18,
      },
    ],

    werewolf: [
      {
        id: 'wd1', hot: true, score: 85, controversy: 70, name: 'PackReader', avatar: 'https://i.pravatar.cc/100?img=15', time: '2h',
        title: 'Rejected-mate Werewolf arcs — earned growth or overdone?',
        body: 'When it’s about growth, I’m in. When it’s pure humiliation, I’m out. Werewolf only.',
        tag: 'Discussion', tagClass: 'discussion',
        likes: 210, comments: 140, liked: false,
        participants: ['https://i.pravatar.cc/100?img=5', 'https://i.pravatar.cc/100?img=9'], extra: 44,
      },
      {
        id: 'wd2', score: 58, name: 'Luna_Grey', avatar: 'https://i.pravatar.cc/100?img=5',
        badge: 'Author', badgeClass: 'author', time: '7h',
        title: 'Why pack hierarchy is harder to write than readers think',
        body: 'Power isn’t just growling — logistics, loyalty, who eats last. Werewolf craft thread.',
        tag: 'Theory', tagClass: 'theory', isThread: true, replies: 16,
        likes: 167, comments: 58, liked: false,
        participants: ['https://i.pravatar.cc/100?img=15'], extra: 20,
      },
      {
        id: 'wd3', score: 62, controversy: 55, name: 'AlphaAdjacent', avatar: 'https://i.pravatar.cc/100?img=53', time: '11h',
        title: 'Hot take: fated mates undercut choice in Werewolf romance',
        body: 'Unless the story interrogates the bond, it’s destiny fanfic. Change my mind — Werewolf hub.',
        tag: 'Controversial', tagClass: 'controversial',
        likes: 134, comments: 99, liked: false,
        participants: ['https://i.pravatar.cc/100?img=5', 'https://i.pravatar.cc/100?img=15'], extra: 36,
      },
      {
        id: 'wd4', score: 50, name: 'PackReader', avatar: 'https://i.pravatar.cc/100?img=15', time: '1d',
        title: 'Recommend Werewolf series with real pack politics',
        body: 'Not just the couple in a cabin — councils, rival packs, consequences.',
        tag: 'Recommendation', tagClass: 'recommendation',
        story: { title: 'Werewolf King, Human Queen', writer: 'Luna_Grey', cover: COVERS.c7 },
        likes: 98, comments: 41, liked: false,
        participants: ['https://i.pravatar.cc/100?img=5'], extra: 14,
      },
      {
        id: 'wd5', score: 37, name: 'MoonShift', avatar: 'https://i.pravatar.cc/100?img=9', time: '2d',
        title: 'How do you handle full-moon logistics without it getting silly?',
        body: 'Work schedules, secrecy, city packs. Werewolf writers — tips?',
        tag: 'Question', tagClass: 'question',
        likes: 64, comments: 0, liked: false,
        participants: ['https://i.pravatar.cc/100?img=15'], extra: 9,
      },
    ],
  };

  /* Story highlights for top promo-slider (genre picks — not ad inventory) */
  const DEMO_PROMO_SLIDES = {
    fantasy: [
      { id: 'fp1', title: 'The Priory path', author: 'ShelfWitch', cta: 'Read', img: COVERS.book1, eyebrow: 'Fantasy picks' },
      { id: 'fp2', title: 'Will of the Many', author: 'MapNerd', cta: 'Open', img: COVERS.book2, eyebrow: 'Fantasy picks' },
      { id: 'fp3', title: 'Season of Betrayal', author: 'Ada_Writes', cta: 'Read', img: COVERS.c1, eyebrow: 'Fantasy picks' },
    ],
    romance: [
      { id: 'rp1', title: 'Season of Betrayal', author: 'Ada_Writes', cta: 'Read', img: COVERS.c1, eyebrow: 'Romance picks' },
      { id: 'rp2', title: 'The Billionaire Never Forgets', author: 'Sarah_Odum', cta: 'Read', img: COVERS.c3, eyebrow: 'Romance picks' },
    ],
    werewolf: [
      { id: 'wp1', title: 'Werewolf King, Human Queen', author: 'Luna_Grey', cta: 'Read', img: COVERS.c7, eyebrow: 'Werewolf picks' },
      { id: 'wp2', title: 'Fangs & Fortune', author: 'Ese_Uyi', cta: 'Open', img: COVERS.c8, eyebrow: 'Werewolf picks' },
    ],
  };

  const DEMO_MEMBERS = {
    fantasy: [
      { name: 'LunaVale', handle: 'LunaVale', av: 'https://i.pravatar.cc/100?img=47', role: 'Top contributor', posts: 128 },
      { name: 'MythicInk', handle: 'MythicInk', av: 'https://i.pravatar.cc/100?img=33', role: 'Author', posts: 64 },
      { name: 'StarfallReader', handle: 'StarfallReader', av: 'https://i.pravatar.cc/100?img=12', role: 'Member', posts: 41 },
      { name: 'ElfQueen', handle: 'ElfQueen', av: 'https://i.pravatar.cc/100?img=45', role: 'Member', posts: 29 },
      { name: 'BladeTheory', handle: 'BladeTheory', av: 'https://i.pravatar.cc/100?img=5', role: 'Member', posts: 37 },
    ],
    romance: [
      { name: 'Sofia_Reads', handle: 'Sofia_Reads', av: 'https://i.pravatar.cc/100?img=32', role: 'Top contributor', posts: 210 },
      { name: 'Ada_Writes', handle: 'Ada_Writes', av: 'https://i.pravatar.cc/100?img=32', role: 'Author', posts: 88 },
      { name: 'Sarah_Odum', handle: 'Sarah_Odum', av: 'https://i.pravatar.cc/100?img=48', role: 'Author', posts: 72 },
    ],
    werewolf: [
      { name: 'PackReader', handle: 'PackReader', av: 'https://i.pravatar.cc/100?img=15', role: 'Top contributor', posts: 54 },
      { name: 'Luna_Grey', handle: 'Luna_Grey', av: 'https://i.pravatar.cc/100?img=5', role: 'Author', posts: 40 },
      { name: 'AlphaAdjacent', handle: 'AlphaAdjacent', av: 'https://i.pravatar.cc/100?img=53', role: 'Member', posts: 22 },
    ],
  };

  const DEMO_STORIES = {
    fantasy: [
      { id: 's1', title: 'The Priory of the Orange Tree', author: 'Samantha Shannon', cover: COVERS.book1, reads: '1.1M', rating: '4.8' },
      { id: 's2', title: 'The Will of the Many', author: 'James Islington', cover: COVERS.book2, reads: '640k', rating: '4.7' },
      { id: 's3', title: 'Season of Betrayal', author: 'Ada_Writes', cover: COVERS.c1, reads: '820k', rating: '4.9' },
    ],
    romance: [
      { id: 's4', title: 'Season of Betrayal', author: 'Ada_Writes', cover: COVERS.c1, reads: '820k', rating: '4.9' },
      { id: 's5', title: 'The Billionaire Never Forgets', author: 'Sarah_Odum', cover: COVERS.c3, reads: '1.4M', rating: '4.8' },
      { id: 's6', title: 'Contract of Hearts', author: 'Sarah_Odum', cover: COVERS.c5, reads: '620k', rating: '4.6' },
    ],
    werewolf: [
      { id: 's7', title: 'Werewolf King, Human Queen', author: 'Luna_Grey', cover: COVERS.c7, reads: '410k', rating: '4.7' },
      { id: 's8', title: 'Fangs & Fortune', author: 'Ese_Uyi', cover: COVERS.c8, reads: '190k', rating: '4.5' },
    ],
  };

  global.GenreDemoSeed = {
    COVERS,
    DEFAULT_GENRE_ID,
    DEMO_GENRES,
    DEMO_PINNED,
    DEMO_DISCUSSIONS,
    DEMO_PROMO_SLIDES,
    DEMO_MEMBERS,
    DEMO_STORIES,
  };
})(window);
