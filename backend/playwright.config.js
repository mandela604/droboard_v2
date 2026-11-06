'use strict';
// Reader-surface end-to-end runs. Nothing here starts an app: the specs drive
// the same dev server pair you use by hand (dev:memory on :4000 + Live Server on
// :5502) and say so when either is missing.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 10000 },
  // One browser context at a time — the seeded database is shared and the
  // taste picker writes to the same localStorage key.
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 430, height: 900 },
    trace: 'off',
  },
});
