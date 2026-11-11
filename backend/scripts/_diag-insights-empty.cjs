'use strict';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
process.env.MFA_SECRET_KEY = 'c'.repeat(48);
const { MongoMemoryServer } = require('mongodb-memory-server');
(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 120000 } });
  process.env.MONGO_URI = mongod.getUri('empty_insights');
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const sa = require('../src/services/superadmin.service');
  try {
    const out = await sa.insightsOverview();
    console.log('OK', JSON.stringify({ users: out.users.length, ex: out.ex.length, genres: (out.genreColors ? Object.keys(out.genreColors).length : null) }));
  } catch (e) {
    console.log('FAIL', e && e.message);
    console.log(e && e.stack);
  }
  await mongoose.disconnect();
  await mongod.stop();
})();
