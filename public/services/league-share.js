/* ═══════════════════════════════════════════════════════════════
   LEAGUE SHARE CARD — window.DroboardLeagueShare
   ───────────────────────────────────────────────────────────────
   The weekly league-finish notification carries the reader's final
   rank and points. That row is where sharing belongs — the leaderboard
   page stays a plain board. This helper turns the notification into a
   branded card image and opens the shared share sheet.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DroboardLeagueShare) return;

  function esc(s) { return String(s == null ? '' : s); }
  function readMeta(n) {
    const metrics = (n && Array.isArray(n.metrics)) ? n.metrics : [];
    const get = (label) => {
      const m = metrics.find(x => String(x.label || '').toLowerCase() === label);
      return m ? String(m.value || '') : '';
    };
    const rank = (n && n.rank != null) ? String(n.rank)
      : (get('rank') || '#–').replace(/^#/, '');
    const points = get('points') || '0';
    const season = (n && n.desc && n.desc.match(/Season\s+([A-Za-z0-9-]+)/i) || [])[1] || '';
    return { rank: String(rank), points: String(points), season: String(season) };
  }

  function who() {
    try {
      if (window.AuthSession && AuthSession.getStoredUser) {
        const u = AuthSession.getStoredUser() || {};
        return u.username || u.handle || u.fullName || u.name || 'Reader';
      }
    } catch (e) {}
    try {
      const u = JSON.parse(localStorage.getItem('droboard_user') || '{}') || {};
      return u.username || u.handle || u.fullName || u.name || 'Reader';
    } catch (e) {}
    return 'Reader';
  }

  /* Draw a portrait card locally: no upload needed, and the data URL works
     anywhere the share modal takes an image (preview, copy, status). */
  function card(n) {
    const m = readMeta(n);
    try {
      const W = 600, H = 900;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      if (!x) return '';

      const round = (rx, ry, w, h, r) => {
        const rr = Math.min(r, w / 2, h / 2);
        x.beginPath();
        x.moveTo(rx + rr, ry);
        x.arcTo(rx + w, ry, rx + w, ry + h, rr);
        x.arcTo(rx + w, ry + h, rx, ry + h, rr);
        x.arcTo(rx, ry + h, rx, ry, rr);
        x.arcTo(rx, ry, rx + w, ry, rr);
        x.closePath();
      };
      // Shrink the font until the text fits — long handles and big ranks must
      // never overflow the card or collide with the rows around them.
      const fit = (text, max, size, weight) => {
        let s = size;
        x.font = weight + ' ' + s + 'px system-ui, -apple-system, Segoe UI, sans-serif';
        while (x.measureText(text).width > max && s > 18) {
          s -= 2;
          x.font = weight + ' ' + s + 'px system-ui, -apple-system, Segoe UI, sans-serif';
        }
        return s;
      };
      const center = (text, y, max, size, weight, color) => {
        fit(text, max, size, weight);
        x.fillStyle = color; x.textAlign = 'center';
        x.fillText(text, W / 2, y);
      };

      // Backdrop
      const g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#160a16'); g.addColorStop(.5, '#2b0e26'); g.addColorStop(1, '#3a1a0b');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      const glow = x.createRadialGradient(W / 2, 300, 30, W / 2, 300, 420);
      glow.addColorStop(0, 'rgba(255,45,85,.30)'); glow.addColorStop(1, 'rgba(255,45,85,0)');
      x.fillStyle = glow; x.fillRect(0, 0, W, H);
      // Inner frame
      x.strokeStyle = 'rgba(255,215,120,.28)'; x.lineWidth = 2;
      round(26, 26, W - 52, H - 52, 34); x.stroke();

      // Brand pill
      x.fillStyle = 'rgba(255,255,255,.07)'; round(W / 2 - 175, 64, 350, 46, 23); x.fill();
      center('DROBOARD  ·  READER LEAGUE', 94, 320, 19, '700', '#ff9dbb');

      // Medal
      x.fillStyle = '#f7c948'; x.beginPath(); x.arc(W / 2, 196, 52, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(W / 2 - 14, 180, 16, 0, Math.PI * 2); x.fill();
      x.font = '44px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#7a4a05'; x.fillText('🏆', W / 2, 198);
      x.textBaseline = 'alphabetic';

      // Rank
      center('#' + m.rank, 360, 470, 168, '900', '#ffffff');
      center('WEEKLY FINISH', 404, 400, 25, '700', '#ffc2d3');

      // Divider
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(110, 442); x.lineTo(W - 110, 442); x.stroke();

      // Name
      center(who().slice(0, 24), 508, 470, 40, '800', '#ffffff');

      // Points card
      x.fillStyle = 'rgba(247,201,72,.12)';
      x.strokeStyle = 'rgba(247,201,72,.45)';
      round(W / 2 - 190, 542, 380, 122, 26); x.fill(); x.stroke();
      center(m.points + ' pts', 622, 330, 52, '900', '#f7c948');

      // Season chip
      if (m.season) {
        x.fillStyle = 'rgba(255,255,255,.08)';
        round(W / 2 - 120, 690, 240, 44, 22); x.fill();
        center('Season ' + m.season, 719, 210, 19, '700', '#d9b9c8');
      }

      // Footer
      x.fillStyle = '#ff2d55'; x.beginPath(); x.arc(105, 815, 8, 0, Math.PI * 2); x.fill();
      center('Read. React. Climb.', 823, 400, 23, '800', '#ffffff');
      center(location.hostname.replace(/^www\./, '') || 'Droboard', 858, 300, 16, '600', 'rgba(255,255,255,.45)');
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function open(n) {
    const m = readMeta(n);
    const data = {
      title: '🏆 I finished #' + m.rank + ' on the Droboard Reader League!',
      sub: m.points + ' pts · ' + (m.season ? 'Week ' + m.season + ' · ' : '') + 'beat my rank',
      img: card(n),
      kind: 'league',
      link: '/Pages/leaderboard.html',
    };
    if (window.DroboardShare) return window.DroboardShare.open(data);
    if (typeof window.openShareModal !== 'function') return false;
    openShareModal(Object.assign(data, { url: location.origin + data.link }));
    return true;
  }

  window.DroboardLeagueShare = { card: card, open: open, readMeta: readMeta };
})();
