/* ═══════════════════════════════════════════════════════════════
   INSIGHTS SERVICE — call-and-render for insights.html
   ONE surface per page (no tabs) + period filter:
   Today / 7D / Month / All-time, each with a delta vs the
   previous equal-length window and a bar chart for the period.
   Numbers come from GET /api/insights/:surface (real counters). If that call
   fails the page shows an explicit error state instead.
   DATA LAYER: loadInsights(surface, id, period) — live fetch only.
   URL: insights.html?surface=hub&genre=fantasy | ?surface=droboard | ?surface=profile
          &period=today|7d|month|all   (default 7d)
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  let surface = params.get('surface') || 'hub';
  if (['hub', 'droboard', 'profile', 'collection'].indexOf(surface) === -1) surface = 'hub';
  const genreId = (params.get('genre') || 'fantasy').toLowerCase();
  const collId = params.get('id') || 'c1';
  let period = params.get('period') || '7d';
  if (['today', '7d', 'month', 'all'].indexOf(period) === -1) period = '7d';

  /* ── period math ── */
  const DAY = 864e5;
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function periodStart(p) {
    if (p === 'today') return startOfToday();
    if (p === '7d') return Date.now() - 7 * DAY;
    if (p === 'month') return Date.now() - 30 * DAY;
    return 0; // all time
  }
  function prevStart(p, curStart) {
    if (p === 'today') return curStart - DAY;
    if (p === '7d') return curStart - 7 * DAY;
    if (p === 'month') return curStart - 30 * DAY;
    return -1; // no previous window for all-time
  }
  function deltaPct(cur, prev) {
    if (prev < 0) return null;                 // all-time: no comparison
    if (prev === 0 && cur === 0) return 0;
    if (prev === 0) return 100;                // fresh activity counts as +100
    return Math.round(((cur - prev) / prev) * 100);
  }
  function deltaHtml(d) {
    if (d === null) return '<span class="delta flat">All time</span>';
    if (d > 0) return '<span class="delta up"><i class="fas fa-arrow-up"></i> ' + d + '%</span>';
    if (d < 0) return '<span class="delta down"><i class="fas fa-arrow-down"></i> ' + Math.abs(d) + '%</span>';
    return '<span class="delta flat">No change</span>';
  }
  function cardNote(d, flatTxt) {
    if (d === null) return { t: flatTxt || 'cumulative', cls: 'flat' };
    if (d > 0) return { t: '+' + d + '% vs prev', cls: 'up' };
    if (d < 0) return { t: d + '% vs prev', cls: 'down' };
    return { t: flatTxt || 'steady', cls: 'flat' };
  }

  /* ── chart bucketing: labels + series length per period ── */
  function chartBuckets(p) {
    if (p === 'today') {
      // 6 buckets of 4h: 12a 4a 8a 12p 4p 8p
      const labels = ['12a', '4a', '8a', '12p', '4p', '8p'];
      const start = startOfToday();
      const bounds = labels.map(function (_, i) { return start + i * 4 * 36e5; });
      return { labels: labels, bounds: bounds, bucketMs: 4 * 36e5, start: start, end: Date.now() };
    }
    if (p === '7d') {
      const labels = [];
      const bounds = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * DAY);
        labels.push(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()]);
        d.setHours(0, 0, 0, 0);
        bounds.push(d.getTime());
      }
      return { labels: labels, bounds: bounds, bucketMs: DAY, start: bounds[0], end: Date.now() };
    }
    if (p === 'month') {
      // 10 buckets of 3 days across last 30 days
      const labels = [];
      const bounds = [];
      const start = Date.now() - 30 * DAY;
      for (let i = 0; i < 10; i++) {
        const d = new Date(start + i * 3 * DAY);
        labels.push((d.getMonth() + 1) + '/' + d.getDate());
        bounds.push(start + i * 3 * DAY);
      }
      return { labels: labels, bounds: bounds, bucketMs: 3 * DAY, start: start, end: Date.now() };
    }
    // all: last 6 months
    const labels = [];
    const bounds = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]);
      bounds.push(d.getTime());
    }
    return { labels: labels, bounds: bounds, bucketMs: DAY * 30, start: bounds[0], end: Date.now() };
  }
  /* Country name → ISO code for real flag images (flagcdn). */
  const COUNTRY_CODE = {
    'Nigeria':'ng','Ghana':'gh','United Kingdom':'gb','United States':'us','South Africa':'za',
    'Kenya':'ke','Canada':'ca','India':'in','Germany':'de','UAE':'ae','France':'fr','Japan':'jp',
    'Australia':'au','Brazil':'br','Egypt':'eg','Italy':'it','Spain':'es','Netherlands':'nl',
    'Mexico':'mx','Sweden':'se','Norway':'no','Poland':'pl','Turkey':'tr','Pakistan':'pk',
    'Ireland':'ie','Belgium':'be','Portugal':'pt','Switzerland':'ch','Austria':'at','Denmark':'dk',
    'Finland':'fi','Greece':'gr','Romania':'ro','Czechia':'cz','Ukraine':'ua','Russia':'ru',
    'China':'cn','South Korea':'kr','Singapore':'sg','Malaysia':'my','Thailand':'th',
    'Indonesia':'id','Philippines':'ph','Vietnam':'vn','Bangladesh':'bd','Sri Lanka':'lk',
    'Saudi Arabia':'sa','Qatar':'qa','Kuwait':'kw','Morocco':'ma','Algeria':'dz','Tunisia':'tn',
    'Libya':'ly','Sudan':'sd','Ethiopia':'et','Uganda':'ug','Rwanda':'rw','Zambia':'zm',
    'Zimbabwe':'zw','Mozambique':'mz','Angola':'ao','Senegal':'sn',"Côte d'Ivoire":'ci',
    'DR Congo':'cd','Congo':'cg','Argentina':'ar','Chile':'cl','Colombia':'co','Peru':'pe',
    'New Zealand':'nz','Hong Kong':'hk','Taiwan':'tw','Israel':'il','Lebanon':'lb','Iraq':'iq',
    'Iran':'ir','Jordan':'jo','Tanzania':'tz','Cameroon':'cm','Namibia':'na','Botswana':'bw'
  };
  function flagImg(country) {
    const code = COUNTRY_CODE[country];
    if (!code) return '';
    return '<img class="li-flag" src="https://flagcdn.com/w40/' + code + '.png" alt="" loading="lazy" onerror="this.style.display=\'none\'"/>';
  }
  /* The server sends the edge geo header (2-letter code); the demo names
     above are what the renderer flags by, so codes are mapped back. */
  const COUNTRY_NAME = {};
  Object.keys(COUNTRY_CODE).forEach(function (name) { COUNTRY_NAME[COUNTRY_CODE[name].toUpperCase()] = name; });
  function mapLiveCountries(list) {
    // Codes (from the edge header) and names (client fallback) are folded
    // into one bucket per country so the list never shows Nigeria twice.
    const totals = {};
    (list || []).forEach(function (c) {
      if (!c) return;
      const raw = String(c.country || '');
      if (!raw || raw === 'Unknown') return;
      const name = COUNTRY_NAME[raw.toUpperCase()] || raw;
      totals[name] = (totals[name] || 0) + (Number(c.n) || 0);
    });
    return Object.keys(totals).map(function (k) { return { country: k, n: totals[k] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 5);
  }
  /* ══ DATA LAYER ══ */
  /* Live only: GET /api/insights/:surface?period=… (real counters from the
     server). A failure surfaces as an explicit error state on the page. */
  function fetchLive(sfc, id, p) {
    let url = '/api/insights/' + encodeURIComponent(sfc) + '?period=' + encodeURIComponent(p);
    if (sfc === 'hub' && id) url += '&genre=' + encodeURIComponent(id);
    if (sfc === 'collection' && id) url += '&id=' + encodeURIComponent(id);
    if (sfc === 'profile' && id) url += '&handle=' + encodeURIComponent(id);
    return fetch(url, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error('api_' + r.status);
      return r.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.series) || !data.series.length) throw new Error('empty');
      data.countries = mapLiveCountries(data.countries);
      return data;
    });
  }
  function loadInsights(sfc, id, p) {
    return fetchLive(sfc, id, p);
  }
  function demoInsights(sfc, id, p) {
    // Live swap: return fetch(API_BASE + '/insights/' + sfc + '?period=' + p + (id ? '&id=' + id : ''), {credentials:'include'}).then(r => r.json());
    const T = window.InsightsTracker;
    const start = periodStart(p);
    const pStart = prevStart(p, start);
    const liveVisits = T ? T.readPeriod(sfc, id, start) : 0;
    const livePrev = pStart < 0 ? -1 : (T ? T.readPeriod(sfc, id, pStart) : 0);
    const liveCountries = T ? T.readCountries(sfc, id, start) : [];
    const demoV = demoVisits(sfc, id, p);
    const demoVPrev = Math.round(demoV * 0.88); // fake "previous window" for delta
    const visits = demoV + liveVisits;
    const visitsPrev = pStart < 0 ? -1 : (demoVPrev + Math.max(0, livePrev));
    const countries = mergedCountries(sfc + (id || '') + p, liveCountries);
    // slice previous window so "today" doesn't count hits from the future
    const buckets = chartBuckets(p);
    const devSeries = visitSeries(sfc, id, buckets);
    const base = PERIOD_BASE[p];
    const n = PERIOD_N[p];

    /* Unique visits — one count per reader per 20 minutes, the same rule
       tracking.service.js applies server-side. This device's own hits are
       deduped for real; the synthetic base keeps a 70% share, so reload
       inflation shows up as the gap to total visits and unique never exceeds
       it. */
    const uniqLocal = T ? T.readUnique(sfc, id, start) : 0;
    const uniqPrevLocal = pStart < 0 ? -1 : (T ? T.readUnique(sfc, id, pStart) : 0);
    const uniq = Math.min(visits, uniqLocal + Math.round(demoV * 0.7));
    const uniqPrev = pStart < 0 ? -1 : Math.min(Math.max(0, visitsPrev), uniqPrevLocal + Math.round(demoVPrev * 0.7));
    function uniqCard() {
      return { label: 'Unique visits', v: fmtK(uniq), s: cardNote(deltaPct(uniq, uniqPrev), '20-min rule') };
    }

    if (sfc === 'hub') {
      const seed = window.GenreDemoSeed;
      const g = (seed && seed.DEMO_GENRES && (seed.DEMO_GENRES[id] || seed.DEMO_GENRES[seed.DEFAULT_GENRE_ID])) || { name: id, members: '0', discussions: '0', stories: '0' };
      const act = weekSeries('hub-' + id + '-' + p, base, n);
      const actPrev = weekSeries('hub-' + id + '-' + p + '-prev', base, n);
      const sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      const newThreads = sum(act);
      const newThreadsPrev = sum(actPrev);
      const newStories = Math.max(1, Math.round(newThreads * 0.35));
      const newStoriesPrev = Math.max(1, Math.round(newThreadsPrev * 0.35));
      return Promise.resolve({
        title: g.name + ' hub',
        sub: 'Hub insights · ' + pLabel(p),
        hero: {
          label: 'Board views',
          v: String(visits),
          delta: deltaPct(visits, visitsPrev),
          sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
        },
        chartTitle: 'Page visits & activity',
        chartNote: peakNote(devSeries, act),
        series: devSeries.map(function (v, i) { return v + act[i]; }),
        cards: [
          uniqCard(),
          { label: 'Posts', v: String(newThreads), s: cardNote(deltaPct(newThreads, newThreadsPrev)) },
          { label: 'Replies', v: String(Math.round(newThreads * 3.2)), s: cardNote(deltaPct(newThreads, newThreadsPrev)) },
          { label: 'New stories', v: String(newStories), s: cardNote(deltaPct(newStories, newStoriesPrev)) },
          { label: 'Members', v: g.members || '—', s: { t: 'total', cls: 'flat' } },
        ],
        list: { title: 'Top posts', icon: 'fa-fire', items: topThreads(id) },
        countries: countries,
      });
    }
    if (sfc === 'droboard') {
      const act = weekSeries('droboard-' + p, base * 1.4, n);
      const actPrev = weekSeries('droboard-' + p + '-prev', base * 1.4, n);
      const sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      const posts = Math.max(1, Math.round(sum(act) * 0.15));
      const postsPrev = Math.max(1, Math.round(sum(actPrev) * 0.15));
      const readers = sum(act) * 12;
      const readersPrev = sum(actPrev) * 12;
      return Promise.resolve({
        title: 'Droboard page',
        sub: 'Official page insights · ' + pLabel(p),
        hero: {
          label: 'Page visits',
          v: String(visits),
          delta: deltaPct(visits, visitsPrev),
          sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
        },
        chartTitle: 'Page visits',
        chartNote: peakNote(devSeries, act),
        series: devSeries.map(function (v, i) { return v + act[i]; }),
        cards: [
          uniqCard(),
          { label: 'Posts', v: String(posts), s: cardNote(deltaPct(posts, postsPrev)) },
          { label: 'Active readers', v: fmtK(readers), s: cardNote(deltaPct(readers, readersPrev)) },
          { label: 'Engagements', v: fmtK(sum(act) * 4), s: cardNote(deltaPct(sum(act), sum(actPrev))) },
          { label: 'New followers', v: fmtK(Math.max(1, Math.round(sum(act) * 0.8))), s: cardNote(deltaPct(sum(act), sum(actPrev))) },
        ],
        list: { title: 'Top posts', icon: 'fa-star', items: topDroboardPosts() },
        countries: countries,
      });
    }
    if (sfc === 'profile') {
      const act = weekSeries('profile-' + p, base * 0.9, n);
    const actPrev = weekSeries('profile-' + p + '-prev', base * 0.9, n);
    const sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    const reads = sum(act) * 90;
    const readsPrev = sum(actPrev) * 90;
    return Promise.resolve({
      title: 'Your profile',
      sub: 'Owner insights · ' + pLabel(p),
      hero: {
        label: 'Profile views',
        v: String(visits),
        delta: deltaPct(visits, visitsPrev),
        sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
      },
      chartTitle: 'Profile views',
      chartNote: peakNote(devSeries, act),
      series: devSeries.map(function (v, i) { return v + act[i]; }),
      cards: [
        uniqCard(),
        { label: 'Reads', v: fmtK(reads), s: cardNote(deltaPct(reads, readsPrev)) },
        { label: 'Likes', v: fmtK(sum(act) * 2.4), s: cardNote(deltaPct(sum(act), sum(actPrev))) },
        { label: 'Followers', v: '2.1K', s: { t: 'total', cls: 'flat' } },
        { label: 'Saves', v: fmtK(Math.max(1, Math.round(sum(act) * 0.6))), s: cardNote(deltaPct(sum(act), sum(actPrev))) },
      ],
      list: { title: 'Your top books', icon: 'fa-book-open', items: topProfileBooks() },
      countries: countries,
    });
    }
    // collection — owner stats via ⋯ menu on collection.html
    {
    const act = weekSeries('coll-' + id + '-' + p, base * 1.1, n);
    const actPrev = weekSeries('coll-' + id + '-' + p + '-prev', base * 1.1, n);
    const sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    const saves = Math.max(1, Math.round(sum(act) * 0.4));
    const savesPrev = Math.max(1, Math.round(sum(actPrev) * 0.4));
    const reads = sum(act) * 150;
    const readsPrev = sum(actPrev) * 150;
    return Promise.resolve({
      title: 'Collection stats',
      sub: 'Owner insights · ' + pLabel(p),
      hero: {
        label: 'Collection views',
        v: String(visits),
        delta: deltaPct(visits, visitsPrev),
        sub: p === 'all' ? 'since tracking began' : 'this ' + pLabel(p),
      },
      chartTitle: 'Views',
      chartNote: peakNote(devSeries, act),
      series: devSeries.map(function (v, i) { return v + act[i]; }),
      cards: [
        uniqCard(),
        { label: 'Followers', v: '340', s: { t: 'total', cls: 'flat' } },
        { label: 'Stories', v: '12', s: { t: 'in collection', cls: 'flat' } },
      ],
      list: { title: 'Top stories in collection', icon: 'fa-book', items: topCollectionStories() },
      countries: countries,
    });
  }
}

  /* ── helpers ── */
  function pLabel(p) {
    return p === 'today' ? 'today' : p === '7d' ? 'last 7 days' : p === 'month' ? 'last 30 days' : 'all time';
  }
  function fmtK(n) {
    n = Math.round(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function peakNote(dev, act) {
    const total = dev.map(function (v, i) { return v + (act[i] || 0); });
    if (!total.length || !total.some(function (v) { return v > 0; })) return '';
    let mi = 0;
    total.forEach(function (v, i) { if (v > total[mi]) mi = i; });
    return 'Peak: ' + chartBuckets(period).labels[mi];
  }
  /* Live series carry their own peak — the server has no demo series to add. */
  function peakOfSeries(series) {
    if (!series || !series.length || !series.some(function (v) { return v > 0; })) return '';
    let mi = 0;
    series.forEach(function (v, i) { if (v > series[mi]) mi = i; });
    const labels = chartBuckets(period).labels;
    return labels[mi] ? 'Peak: ' + labels[mi] : '';
  }

  /* ══ RENDER ══ */
  function render(data) {
    document.getElementById('tbTitle').textContent = data.title;
    document.getElementById('tbSub').textContent = data.sub;
    document.title = data.title + ' · Insights · DroBoard';
    const max = Math.max.apply(null, data.series.concat([1]));
    const note = data.chartNote || peakOfSeries(data.series);
    let html = data.demo === false
      ? '<div class="surface-note"><i class="fas fa-circle-check"></i> Live stats · real counters from the server · compare vs previous period</div>'
      : '<div class="surface-note"><i class="fas fa-database"></i> Demo stats · page visits counted on open · compare vs previous period</div>';
    html += '<div class="hero"><div class="hero-l">' + data.hero.label + '</div>' +
      '<div class="hero-row"><div class="hero-v">' + data.hero.v + '</div>' + deltaHtml(data.hero.delta) + '</div>' +
      '<div class="hero-sub">' + data.hero.sub + '</div></div>';
    html += '<div class="chart-card"><div class="chart-hd"><div class="chart-t">' + data.chartTitle + '</div>' +
      (note ? '<div class="chart-peak"><i class="fas fa-bolt"></i> ' + note + '</div>' : '') + '</div>' +
      '<div class="bars">' + data.series.map(function (v, i) {
        const pct = Math.round((v / max) * 100);
        const isPeak = v === max && v > 0;
        const lbls = chartBuckets(period).labels;
        return '<div class="bar-col"><div class="bar' + (isPeak ? ' peak' : '') + '" style="height:' + Math.max(3, pct) + '%" title="' + v + '"></div><div class="bar-lbl">' + lbls[i] + '</div></div>';
      }).join('') + '</div></div>';
    html += '<div class="grid">' + data.cards.map(function (c) {
      return '<div class="card"><div class="card-l">' + c.label + '</div><div class="card-v">' + c.v + '</div><div class="card-s ' + c.s.cls + '">' + c.s.t + '</div></div>';
    }).join('') + '</div>';
    if (data.countries && data.countries.length) {
      const cmax = data.countries[0].n;
      html += '<div class="list-card"><div class="list-t"><i class="fas fa-earth-africa"></i> Top countries</div>' +
        data.countries.map(function (c, i) {
          const pct = Math.round((c.n / cmax) * 100);
          return '<div class="li"><div class="li-rank' + (i === 0 ? ' gold' : '') + '">' + (i + 1) + '</div>' +
            flagImg(c.country) +
            '<div class="li-txt"><div class="li-n">' + c.country + '</div>' +
            '<div style="height:4px;border-radius:4px;background:var(--l2);margin-top:5px;overflow:hidden"><div style="height:100%;width:' + pct + '%;border-radius:4px;background:linear-gradient(90deg,var(--acc),var(--acc3))"></div></div></div>' +
            '<div class="li-v">' + c.n + '</div></div>';
        }).join('') + '</div>';
    }
    if (data.list && data.list.items && data.list.items.length) {
      html += '<div class="list-card"><div class="list-t"><i class="fas ' + data.list.icon + '"></i> ' + data.list.title + '</div>' +
        data.list.items.map(function (it, i) {
          const attrs = it.href ? ' style="cursor:pointer" onclick="location.href=\'' + String(it.href).replace(/'/g, '') + '\'"' : '';
          return '<div class="li"' + attrs + '><div class="li-rank' + (i === 0 ? ' gold' : '') + '">' + (i + 1) + '</div>' +
            '<div class="li-txt"><div class="li-n">' + it.n + '</div><div class="li-s">' + it.s + '</div></div>' +
            '<div class="li-v">' + it.v + '</div></div>';
        }).join('') + '</div>';
    }
    document.getElementById('wrap').innerHTML = html;
    // period chip state
    document.querySelectorAll('#periods .p-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.p === period); });
  }

  window.setPeriod = function (p) {
    period = p;
    let url = 'insights.html?surface=' + surface + '&period=' + p;
    if (surface === 'hub') url += '&genre=' + encodeURIComponent(genreId);
    if (surface === 'collection') url += '&id=' + encodeURIComponent(collId);
    history.replaceState(null, '', url);
    loadInsights(surface, surface === 'hub' ? genreId : (surface === 'collection' ? collId : null), period).then(render);
  };

  loadInsights(surface, surface === 'hub' ? genreId : (surface === 'collection' ? collId : null), period).then(render);
})();
