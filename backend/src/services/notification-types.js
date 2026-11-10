'use strict';
// Server mirror of the frontend notification catalog (public/services/notification-
// store.js TYPES). The renderer splits rows into four cards by `kind`, filters by
// `cat` + `audience` and bumps a push only for push-eligible types, so the backend
// has to know the same table. When a type is added on the client, add it here too.
//   cat: which filter chip it lands under
//   kind: which card the renderer picks (row | milestone | digest | achievement)
//   audience: reader | author | both — drives the reader/author role tabs
//   push: push-eligible
const TYPES = {
  trending_enter: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true },
  top_ten: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true },
  editor_pick: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true },
  featured: { cat: 'highlights', kind: 'milestone', audience: 'author', push: true },
  league_finish: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true },
  reading_streak: { cat: 'highlights', kind: 'milestone', audience: 'both', push: false },

  achievement: { cat: 'achievements', kind: 'achievement', audience: 'both', push: true },

  status_24h: { cat: 'stats', kind: 'digest', audience: 'both', push: false },
  weekly_stats: { cat: 'stats', kind: 'digest', audience: 'author', push: false },
  weekly_earnings: { cat: 'stats', kind: 'digest', audience: 'author', push: false },
  reader_weekly: { cat: 'stats', kind: 'digest', audience: 'both', push: false },
  poll_closed: { cat: 'stats', kind: 'digest', audience: 'both', push: false },

  new_chapter: { cat: 'stories', kind: 'row', audience: 'reader', push: true },
  chapter_live: { cat: 'stories', kind: 'row', audience: 'author', push: true },
  schedule_failed: { cat: 'stories', kind: 'row', audience: 'author', push: true },

  like: { cat: 'activity', kind: 'row', audience: 'both', push: false },
  comment: { cat: 'activity', kind: 'row', audience: 'both', push: false },
  reply: { cat: 'activity', kind: 'row', audience: 'both', push: true },
  mention: { cat: 'activity', kind: 'row', audience: 'both', push: true },
  follow: { cat: 'activity', kind: 'row', audience: 'both', push: false },
  share: { cat: 'activity', kind: 'row', audience: 'both', push: false },
  save: { cat: 'activity', kind: 'row', audience: 'author', push: false },
  repost: { cat: 'activity', kind: 'row', audience: 'both', push: false },
  debate_reply: { cat: 'activity', kind: 'row', audience: 'both', push: true },

  // 1:1 chat. Coalesced per conversation: one unread row whose count climbs,
  // never one notification per message.
  direct_message: { cat: 'messages', kind: 'row', audience: 'both', push: true },

  debate_verdict: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true },
  prediction_settled: { cat: 'highlights', kind: 'milestone', audience: 'both', push: true },

  tip: { cat: 'revenue', kind: 'row', audience: 'author', push: true },
  payout: { cat: 'revenue', kind: 'row', audience: 'author', push: true },
  coins: { cat: 'revenue', kind: 'row', audience: 'reader', push: false },

  review_result: { cat: 'system', kind: 'row', audience: 'author', push: true },
  book_change_result: { cat: 'system', kind: 'row', audience: 'author', push: true },
  contract_update: { cat: 'system', kind: 'row', audience: 'author', push: true },
  completion_result: { cat: 'system', kind: 'row', audience: 'author', push: true },
  book_flagged: { cat: 'system', kind: 'row', audience: 'author', push: true },
  verification: { cat: 'system', kind: 'row', audience: 'author', push: true },
  security: { cat: 'system', kind: 'row', audience: 'both', push: true },
  announcement: { cat: 'system', kind: 'row', audience: 'both', push: false },
};

// Per-category icon the renderer tints an avatar with when the row has no actor
// avatar (see CATS in notification-store.js).
const CATS = {
  highlights: { icon: 'fa-trophy', bg: '#fff4e0', color: '#b7690a' },
  achievements: { icon: 'fa-award', bg: '#fdeee0', color: '#9a6508' },
  stats: { icon: 'fa-chart-line', bg: '#e7f0fe', color: '#1d5fd6' },
  activity: { icon: 'fa-heart', bg: '#ffe9ef', color: '#ff2d55' },
  messages: { icon: 'fa-comment-dots', bg: '#e8f1ff', color: '#2563eb' },
  stories: { icon: 'fa-book-open', bg: '#efe9ff', color: '#7c5cff' },
  revenue: { icon: 'fa-dollar-sign', bg: '#e9fbf0', color: '#158a48' },
  system: { icon: 'fa-shield-halved', bg: '#f1f1f4', color: '#5c5c66' },
};

// The rich fields the renderer reads off a row beyond the stored columns. These
// ride in the notification's `payload` so a milestone/digest renders identically
// to the demo card.
const PAYLOAD_KEYS = [
  'metrics', 'chips', 'icon', 'badge', 'medal', 'cover', 'avatar', 'rank', 'rankNote',
  'iconName', 'tier', 'tierClass', 'color', 'count', 'linkLabel', 'time', 'typeLabel', 'key',
];

// Default action label for a row's link chip. The renderer only draws the chip
// when the label exists, so a server-raised row (a chapter drop, a comment)
// would otherwise land without the "Read now" / "Reply" affordance. An
// explicit linkLabel in the payload always wins.
const LINK_LABELS = {
  new_chapter: 'Read now',
  chapter_live: 'Read it',
  schedule_failed: 'Fix schedule',
  like: 'View',
  comment: 'Reply',
  reply: 'View thread',
  mention: 'See mention',
  follow: 'See followers',
  share: 'View post',
  save: 'See saves',
  repost: 'View post',
  debate_reply: 'Answer them',
  debate_verdict: 'Open debate',
  poll_closed: 'See results',
  prediction_settled: 'Open prediction',
  direct_message: 'Reply',
  tip: 'View tip',
  payout: 'Transaction history',
  coins: 'Open wallet',
  trending_enter: 'See trending board',
  top_ten: 'See trending board',
  editor_pick: 'Open shelf',
  featured: 'See placement',
  league_finish: 'Open leaderboard',
  reading_streak: 'Keep it going',
  achievement: 'See my profile',
  status_24h: 'See who viewed',
  weekly_stats: 'Full breakdown',
  weekly_earnings: 'Go to earnings',
  reader_weekly: 'Open leaderboard',
  review_result: 'Read result',
  book_change_result: 'Track requests',
  contract_update: 'Track application',
  completion_result: 'See completion',
  book_flagged: 'Review book',
  verification: 'View verification',
  security: 'Account security',
  announcement: 'Read more',
};

module.exports = { TYPES, CATS, PAYLOAD_KEYS, LINK_LABELS };
