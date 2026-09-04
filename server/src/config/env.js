'use strict';

require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const port = parseInt(process.env.PORT, 10) || 5000;
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET;

if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

const clientOrigin = process.env.CLIENT_ORIGIN;

module.exports = {
  env,
  port,
  mongoUri,
  jwtSecret,
  clientOrigin,
};
