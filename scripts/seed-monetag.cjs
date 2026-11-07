/**
 * seed-monetag.cjs — seed your Monetag Zone 11966461 (In-Page Push) as an AdPlacement
 * and tie it to the Discover strip slot. Run once per environment:
 *   node scripts/seed-monetag.cjs --env=dev|staging|prod
 */
'use strict';
const { MONGODB_URI = 'mongodb://127.0.0.1:27017/dro' } = process.env;

async function main() {
  const args = process.argv.slice(2);
  const envIdx = args.findIndex(a => a.startsWith('--env='));
  const env = envIdx >= 0 ? args[envIdx].split('=')[1] : 'dev';
  const dbName = { dev: 'dro', staging: 'dro_staging', prod: 'dro_prod' }[env] || 'dro';
  
  console.log(`📍 Seeding Monetag placement into ${MONGODB_URI}/${dbName}`);
  
  const mongoose = require('mongoose');
  await mongoose.connect(MONGODB_URI);
  
  const { AdInventory, AdPlacement } = require('../src/models/platform.model');
  
  /* ── Create the In-Page Push inventory row (this is what the frontend will fetch) ── */
  const monetagCode = `<script type="text/javascript">
  //<![CDATA[
  (function(m,o,n,e,t,a,b){m[e]=m[e]||[];a=o.createElement(n);b=o.getElementsByTagName(n)[0];
  a.type='text/javascript';a.async=!0;a.src=t;a.charset='utf-8';a.id='_mn_tag_${Date.now()}';
  b.parentNode.insertBefore(a,b);window._mn_tag=a; m[e].push({zone:'11966461'});
  })(window,document,'script','//go.mediacarrier.com/','_monetag');
  //]]>
  </script>`;
  
  const inv = await AdInventory.findOneAndUpdate(
    { title: 'Monetag In-Page Push' },
    {
      format: 'embed',
      brand: 'Monetag',
      title: 'Monetag In-Page Push',
      code: monetagCode,
      pages: ['discover', 'feed'],
      slots: [], // any slot → auto-render
      active: true,
      startAt: new Date(),
      autoPaused: false,
    },
    { upsert: true, new: true }
  );
  console.log('✓ Inventory created/updated:', inv.id, '→', inv.title);
  
  /* ── Enable the Discover strip slot using this inventory ── */
  const placement = await AdPlacement.findOneAndUpdate(
    { page: 'discover' },
    {
      enabled: true,
      interval: 3,
      slots: {
        'strip': {
          enabled: true,
          formats: ['embed'],
          adIds: [inv.id], // use our Monetag inventory first
        }
      }
    },
    { upsert: true, new: true }
  );
  console.log('✓ Discovery placement enabled:', placement.id, 'slots:', Object.keys(placement.slots));
  
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => {
  console.error('FAIL', e.message);
  process.exit(1);
});
