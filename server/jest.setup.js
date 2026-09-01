// Jest setup file — runs before any test module is loaded.
// Sets required environment variables so config/env.js does not throw.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://placeholder/test'; // overridden by mongodb-memory-server
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
