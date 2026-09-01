'use strict';

/**
 * Shared test helpers: in-memory MongoDB lifecycle.
 *
 * Call setupDB() in beforeAll, teardownDB() in afterAll,
 * and clearDB() in beforeEach to start each test with an empty database.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function setupDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

async function teardownDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { setupDB, teardownDB, clearDB };
