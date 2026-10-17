/* insights-tracker.js — one-line page-visit counters, zero dependencies.
   Drop the script on any page, then call:
     InsightsTracker.hit('hub', genreId) | hit('droboard') | hit('profile', handle)
   Each hit stores {t: timestamp, c: country} so the stats page can
   filter Today / 7D / Month / All-time, compare vs the previous
   window, and rank Top countries (country guessed from timezone —
   live swap: read it from the request server-side).
   localStorage (this device) until the backend owns analytics —
   at cutover: POST /api/insights/hit and keep the read methods. */
(function () {
  'use strict';
  var KEY = 'dro_insights_hits';
  var MAX_TS = 600; // cap stored hits per key

  /* Timezone → country for the regions we care about; fallback is
     the tz city name so the list is never empty/unknown-only. */
  var TZ_COUNTRY = {
    'Africa/Lagos':'Nigeria','Africa/Accra':'Ghana','Africa/Abidjan':"Côte d'Ivoire",
    'Africa/Dakar':'Senegal','Africa/Nairobi':'Kenya','Africa/Kampala':'Uganda',
    'Africa/Kigali':'Rwanda','Africa/Addis_Ababa':'Ethiopia','Africa/Khartoum':'Sudan',
    'Africa/Johannesburg':'South Africa','Africa/Harare':'Zimbabwe','Africa/Lusaka':'Zambia',
    'Africa/Maputo':'Mozambique','Africa/Luanda':'Angola','Africa/Kinshasa':'DR Congo',
    'Africa/Brazzaville':'Congo','Africa/Tripoli':'Libya','Africa/Cairo':'Egypt',
    'Africa/Algiers':'Algeria','Africa/Tunis':'Tunisia','Africa/Casablanca':'Morocco',
    'Europe/London':'United Kingdom','Europe/Dublin':'Ireland','Europe/Paris':'France',
    'Europe/Berlin':'Germany','Europe/Madrid':'Spain','Europe/Rome':'Italy',
    'Europe/Lisbon':'Portugal','Europe/Amsterdam':'Netherlands','Europe/Brussels':'Belgium',
    'Europe/Zurich':'Switzerland','Europe/Vienna':'Austria','Europe/Stockholm':'Sweden',
    'Europe/Oslo':'Norway','Europe/Copenhagen':'Denmark','Europe/Helsinki':'Finland',
    'Europe/Warsaw':'Poland','Europe/Prague':'Czechia','Europe/Bucharest':'Romania',
    'Europe/Athens':'Greece','Europe/Istanbul':'Turkey','Europe/Kyiv':'Ukraine',
    'Europe/Moscow':'Russia','America/New_York':'United States','America/Chicago':'United States',
    'America/Denver':'United States','America/Los_Angeles':'United States',
    'America/Toronto':'Canada','America/Vancouver':'Canada','America/Mexico_City':'Mexico',
    'America/Bogota':'Colombia','America/Lima':'Peru','America/Santiago':'Chile',
    'America/Sao_Paulo':'Brazil','America/Argentina/Buenos_Aires':'Argentina',
    'Asia/Dubai':'UAE','Asia/Riyadh':'Saudi Arabia','Asia/Qatar':'Qatar','Asia/Kuwait':'Kuwait',
    'Asia/Karachi':'Pakistan','Asia/Kolkata':'India','Asia/Dhaka':'Bangladesh',
    'Asia/Bangkok':'Thailand','Asia/Jakarta':'Indonesia','Asia/Kuala_Lumpur':'Malaysia',
    'Asia/Singapore':'Singapore','Asia/Manila':'Philippines','Asia/Ho_Chi_Minh':'Vietnam',
    'Asia/Beijing':'China','Asia/Shanghai':'China','Asia/Hong_Kong':'Hong Kong',
    'Asia/Taipei':'Taiwan','Asia/Seoul':'South Korea','Asia/Tokyo':'Japan',
    'Australia/Sydney':'Australia','Australia/Melbourne':'Australia','Pacific/Auckland':'New Zealand'
  };
  var LANG_COUNTRY = {
    NG:'Nigeria', GH:'Ghana', KE:'Kenya', ZA:'South Africa', EG:'Egypt', GB:'United Kingdom',
    US:'United States', CA:'Canada', IN:'India', DE:'Germany', FR:'France', AE:'UAE',
    AU:'Australia', JP:'Japan', BR:'Brazil'
  };
  function detectCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
      var parts = tz.split('/');
      for (var i = 0; i < parts.length; i++) {
        var city = parts[i].replace(/_/g, ' ');
        if (TZ_COUNTRY['Africa/' + parts[i]]) return TZ_COUNTRY['Africa/' + parts[i]];
        if (TZ_COUNTRY['Europe/' + parts[i]]) return TZ_COUNTRY['Europe/' + parts[i]];
        if (TZ_COUNTRY['Asia/' + parts[i]]) return TZ_COUNTRY['Asia/' + parts[i]];
      }
      var lang = (navigator && navigator.language) || '';
      var m = lang.match(/-([A-Za-z]{2})$/);
      if (m && LANG_COUNTRY[m[1].toUpperCase()]) return LANG_COUNTRY[m[1].toUpperCase()];
      var last = parts.pop();
      if (last && last !== 'UTC') return last.replace(/_/g, ' ');
      return 'Nigeria'; // demo default so the list is never stuck on Unknown
    } catch (e) { return 'Nigeria'; }
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }
  function hitTime(x) { return typeof x === 'number' ? x : (x && x.t) || 0; }
  function hitCountry(x) { return (x && x.c) || 'Unknown'; }
  /* Legacy values were plain numbers, then bare timestamps —
     migrate to {t, c}; old Unknown hits get the current guess so
     the Top countries list isn't stuck on "Unknown". */
  function migrateRec(rec) {
    if (typeof rec === 'number' && rec > 0) {
      var ts = [];
      var now = Date.now();
      var span = 21 * 864e5;
      var c0 = detectCountry();
      for (var i = 0; i < rec && i < 40; i++) {
        ts.push({ t: now - Math.round((i + 1) * (span / (rec + 1))), c: c0 });
      }
      return { total: rec, ts: ts };
    }
    if (rec && typeof rec === 'object') {
      if (typeof rec.total !== 'number') rec.total = (rec.ts || []).length;
      if (!Array.isArray(rec.ts)) rec.ts = [];
      var c0b = detectCountry();
      rec.ts = rec.ts.map(function (x) {
        if (typeof x === 'number') return { t: x, c: c0b };
        if (x && (!x.c || x.c === 'Unknown')) x.c = c0b;
        return x;
      });
      return rec;
    }
    return { total: 0, ts: [] };
  }

  window.InsightsTracker = {
    hit: function (surface, id) {
      var all = load();
      var key = id ? surface + ':' + id : surface;
      var rec = migrateRec(all[key]);
      rec.total = (rec.total || 0) + 1;
      rec.ts.push({ t: Date.now(), c: detectCountry() });
      if (rec.ts.length > MAX_TS) rec.ts = rec.ts.slice(rec.ts.length - MAX_TS);
      all[key] = rec;
      save(all);
    },
    /* Totals map {key: n} — backward compatible. */
    read: function () {
      var raw = load();
      var out = {};
      Object.keys(raw).forEach(function (k) { out[k] = migrateRec(raw[k]).total; });
      return out;
    },
    /* Page opens inside [since, now]. since=0 → all time. */
    readPeriod: function (surface, id, since) {
      var all = load();
      var key = id ? surface + ':' + id : surface;
      var rec = migrateRec(all[key]);
      if (!since) return rec.total;
      var n = 0;
      for (var i = 0; i < rec.ts.length; i++) if (hitTime(rec.ts[i]) >= since) n++;
      return n;
    },
    /* Top countries by page opens in [since, now]. since=0 → all time. */
    readCountries: function (surface, id, since) {
      var all = load();
      var key = id ? surface + ':' + id : surface;
      var rec = migrateRec(all[key]);
      var counts = {};
      for (var i = 0; i < rec.ts.length; i++) {
        var x = rec.ts[i];
        if (since && hitTime(x) < since) continue;
        var c = hitCountry(x);
        counts[c] = (counts[c] || 0) + 1;
      }
      return Object.keys(counts).map(function (k) { return { country: k, n: counts[k] }; })
        .sort(function (a, b) { return b.n - a.n; })
        .slice(0, 5);
    }
  };
})();
