'use strict';
const mongoose = require('mongoose');
const env = require('./env');

async function connect() {
  mongoose.set('strictQuery', true);
  mongoose.plugin(require('../models/ids').plugin);
  await mongoose.connect(env.mongoUri);
  return mongoose.connection;
}

module.exports = { connect };
