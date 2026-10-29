'use strict';
/* Country from Cloudflare's edge header. The backend sits behind Cloudflare
   (server.js trusts one proxy), so CF-IPCountry is the authoritative answer
   and no IP ever needs to be stored or looked up. Cloudflare sends XX when it
   can't place the request and T1 for Tor — both are treated as unknown. */
function countryOf(req) {
  const h = String((req.headers && req.headers['cf-ipcountry']) || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(h)) return '';
  if (h === 'XX' || h === 'T1') return '';
  return h;
}

module.exports = { countryOf };
