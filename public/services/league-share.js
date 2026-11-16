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
      const c = document.createElement('canvas');
      c.width = 540; c.height = 675;
      const x = c.getContext('2d');
      if (!x) return '';
      const g = x.createLinearGradient(0, 0, 540, 675);
      g.addColorStop(0, '#1b0b16'); g.addColorStop(.55, '#2a0d1f'); g.addColorStop(1, '#3a1a08');
      x.fillStyle = g; x.fillRect(0, 0, 540, 675);
      const gl = x.createRadialGradient(270, 250, 20, 270, 250, 320);
      gl.addColorStop(0, 'rgba(255,45,85,.28)'); gl.addColorStop(1, 'rgba(255,45,85,0)');
      x.fillStyle = gl; x.fillRect(0, 0, 540, 675);
      x.textAlign = 'center';
      x.fillStyle = '#ff8fab'; x.font = '700 20px system-ui';
      x.fillText('DROBOARD  ·  READER LEAGUE', 270, 66);
      x.fillStyle = '#f59e0b'; x.font = '900 34px system-ui';
      x.fillText('🏆', 270, 132);
      x.fillStyle = '#fff'; x.font = '900 150px system-ui';
      x.fillText('#' + m.rank, 270, 285);
      x.fillStyle = '#ffc2d3'; x.font = '700 26px system-ui';
      x.fillText('WEEKLY FINISH', 270, 330);
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(90, 365); x.lineTo(450, 365); x.stroke();
      x.fillStyle = '#fff'; x.font = '800 38px system-ui';
      x.fillText(who().slice(0, 22), 270, 425);
      x.fillStyle = '#f59e0b'; x.font = '900 56px system-ui';
      x.fillText(m.points + ' pts', 270, 495);
      x.fillStyle = '#c9a9b8'; x.font = '600 20px system-ui';
      x.fillText(m.season ? 'Season ' + m.season : 'Reader League', 270, 540);
      x.fillStyle = '#fff'; x.font = '800 24px system-ui';
      x.fillText('Read. React. Climb.', 270, 620);
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  function open(n) {
    if (typeof window.openShareModal !== 'function') return false;
    const m = readMeta(n);
    const url = location.origin + '/Pages/leaderboard.html';
    openShareModal({
      title: '🏆 I finished #' + m.rank + ' on the Droboard Reader League!',
      sub: m.points + ' pts · ' + (m.season ? 'Week ' + m.season + ' · ' : '') + 'beat my rank',
      img: card(n),
      url: url,
    });
    return true;
  }

  window.DroboardLeagueShare = { card: card, open: open, readMeta: readMeta };
})();
