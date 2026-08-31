'use strict';

const mongoose = require('mongoose');
const { mongoUri, env } = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected [${env}]`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

module.exports = { connectDB };
