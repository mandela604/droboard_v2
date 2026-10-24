/* ═══════════════════════════════════════════════════════════════
   SPOTLIGHT BOARD — window.DroboardSpotlightBoard
   Top-three boards for the full-screen spotlight creative:
     type   'writers' | 'readers'
     period 'last_week' | 'last_month' | 'week' | 'month'

   Demo: seeded podium rosters (kept stable per period so the same ad
   looks the same on every device). Live swap: replace get() with

     GET /api/leaderboards/spotlight?type=writers&period=last_week
       → { label, lead, entries:[{ rank,name,handle,avatar,stats,blurb }] }
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PERIODS = [
    { id: 'last_week', label: 'Last week', phrase: 'last week' },
    { id: 'last_month', label: 'Last month', phrase: 'last month' },
    { id: 'week', label: 'This week', phrase: 'this week' },
    { id: 'month', label: 'This month', phrase: 'this month' },
  ];
  var TYPES = [
    { id: 'writers', label: 'Writers' },
    { id: 'readers', label: 'Readers' },
  ];

  function w(name, handle, avatar, reads, books, blurb) {
    return { name: name, handle: handle, avatar: avatar, blurb: blurb, stats: [
      { label: 'Reads', value: reads },
      { label: 'Books', value: books },
    ] };
  }
  function r(name, handle, avatar, points, chapters, blurb) {
    return { name: name, handle: handle, avatar: avatar, blurb: blurb, stats: [
      { label: 'Points', value: points },
      { label: 'Chapters', value: chapters },
    ] };
  }

  var WRITERS = {
    last_week: [
      w('Ada Writes', 'Ada_Writes', 'https://i.pravatar.cc/200?img=32', '1.4M', '3', 'Season of Betrayal · Betrayal series'),
      w('Ifeanyi Story', 'Ifeanyi_Story', 'https://i.pravatar.cc/200?img=53', '980k', '5', 'Claimed by the Alpha · updates Fridays'),
      w('Luna Grey', 'Luna_Grey', 'https://i.pravatar.cc/200?img=25', '862k', '4', 'His Sweet Revenge · new chapter Sunday'),
    ],
    last_month: [
      w('Chiamaka N', 'Chiamaka_N', 'https://i.pravatar.cc/200?img=47', '4.8M', '7', 'The Billionaire\'s Contract · 97 chapters'),
      w('Ada Writes', 'Ada_Writes', 'https://i.pravatar.cc/200?img=32', '4.2M', '3', '1M+ reads on Season of Betrayal'),
      w('Zara M', 'Zara_M', 'https://i.pravatar.cc/200?img=16', '3.7M', '6', 'Her Ruthless King · Mafia romance'),
    ],
    week: [
      w('Kemi A', 'Kemi_A', 'https://i.pravatar.cc/200?img=28', '412k', '2', 'The Softest Goodbye · completed'),
      w('Ada Writes', 'Ada_Writes', 'https://i.pravatar.cc/200?img=32', '398k', '3', 'Chapter 63 drops Friday'),
      w('Efe O', 'Efe_O', 'https://i.pravatar.cc/200?img=12', '356k', '4', 'The Quiet Twin · mystery'),
    ],
    month: [
      w('Ada Writes', 'Ada_Writes', 'https://i.pravatar.cc/200?img=32', '3.1M', '3', 'Betrayal series · 1.2M reads'),
      w('Ifeanyi Story', 'Ifeanyi_Story', 'https://i.pravatar.cc/200?img=53', '2.6M', '5', 'Werewolf romance · 5 books'),
      w('Chiamaka N', 'Chiamaka_N', 'https://i.pravatar.cc/200?img=47', '2.2M', '7', 'Billionaire contracts · campus drama'),
    ],
  };

  var READERS = {
    last_week: [
      r('Blessing O', 'Blessing_O', 'https://i.pravatar.cc/100?img=23', '2,840', '22', '7-day streak · romance binger'),
      r('Nneka Reads', 'Nneka_Reads', 'https://i.pravatar.cc/100?img=25', '2,410', '18', 'Top commenter · 10 discussions'),
      r('Chapter Chaser', 'ChapterChaser', 'https://i.pravatar.cc/100?img=12', '2,190', '25', '25 chapters last week'),
    ],
    last_month: [
      r('Amara Reads', 'Amara_Reads', 'https://i.pravatar.cc/100?img=45', '9,760', '84', '84 chapters · 6 books finished'),
      r('Blessing O', 'Blessing_O', 'https://i.pravatar.cc/100?img=23', '9,120', '76', 'Weekly top-3 all month'),
      r('Fatima Z', 'Fatima_Z', 'https://i.pravatar.cc/100?img=26', '8,640', '71', 'Fantasy + werewolf marathon'),
    ],
    week: [
      r('Blessing O', 'Blessing_O', 'https://i.pravatar.cc/100?img=23', '1,260', '9', 'Leading by 180 points'),
      r('Praise Unending', 'PraiseUnending', 'https://i.pravatar.cc/100?img=14', '1,080', '7', 'Reactions + comments'),
      r('Chapter Chaser', 'ChapterChaser', 'https://i.pravatar.cc/100?img=12', '940', '10', 'Already 10 chapters this week'),
    ],
    month: [
      r('Blessing O', 'Blessing_O', 'https://i.pravatar.cc/100?img=23', '5,220', '44', 'This month\'s pace-setter'),
      r('Nneka Reads', 'Nneka_Reads', 'https://i.pravatar.cc/100?img=25', '4,860', '39', 'Comment section regular'),
      r('Amara Reads', 'Amara_Reads', 'https://i.pravatar.cc/100?img=45', '4,510', '36', 'Two books finished'),
    ],
  };

  function periodOf(id) {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].id === id) return PERIODS[i];
    return PERIODS[0];
  }
  function typeOf(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return TYPES[0];
  }

  function get(opts) {
    opts = opts || {};
    var type = typeOf(opts.type || opts.boardType).id;
    var period = periodOf(opts.period).id;
    var typeLabel = typeOf(type).label.toLowerCase();
    var p = periodOf(period);
    var source = (type === 'writers' ? WRITERS : READERS)[period] || [];
    var entries = source.slice(0, 3).map(function (e, i) {
      return Object.assign({}, e, { rank: i + 1 });
    });
    return {
      type: type,
      period: period,
      label: 'Top ' + typeLabel + ' · ' + p.label,
      lead: opts.title || ('Meet the top 3 ' + typeLabel + ' of ' + p.phrase),
      sub: opts.sub || '',
      entries: entries,
    };
  }

  window.DroboardSpotlightBoard = {
    get: get,
    periods: PERIODS.slice(),
    types: TYPES.slice(),
    periodLabel: function (id) { return periodOf(id).label; },
    typeLabel: function (id) { return typeOf(id).label; },
  };
})();
