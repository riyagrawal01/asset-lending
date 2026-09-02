'use strict';

/**
 * M04 catalogue tests.
 *
 * Covers:
 *  - librarian can create an item
 *  - member cannot create, edit, archive, restore items (403)
 *  - unauthenticated requests are rejected (401)
 *  - librarian can edit an item
 *  - librarian can archive an item
 *  - librarian can restore an archived item
 *  - archived items are excluded from the default GET /api/items
 *  - GET /api/items/archived includes all items
 *  - duplicate item codes are rejected with 409
 *  - non-existent item returns 404
 *  - get single item by id
 */

const request = require('supertest');
const app = require('../app');
const { User, ROLES } = require('../models/User');
const { setupDB, teardownDB, clearDB } = require('./helpers');

beforeAll(async () => { await setupDB(); });
afterAll(async () => { await teardownDB(); });
beforeEach(async () => { await clearDB(); });

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const { hashPassword } = require('../services/authService');

async function createLibrarian() {
  return User.create({
    name: 'Lib User',
    email: 'lib@example.com',
    passwordHash: await hashPassword('password123'),
    role: ROLES.LIBRARIAN,
  });
}

async function createMember() {
  return User.create({
    name: 'Member User',
    email: 'member@example.com',
    passwordHash: await hashPassword('password123'),
    role: ROLES.MEMBER,
  });
}

async function loginAs(email) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  return res.body.token;
}

const VALID_ITEM = { title: 'DSLR Camera', category: 'Photography', code: 'CAM-001' };

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

describe('POST /api/items', () => {
  it('librarian can create an item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    expect(res.status).toBe(201);
    expect(res.body.item.title).toBe('DSLR Camera');
    expect(res.body.item.code).toBe('CAM-001');
    expect(res.body.item.archived).toBe(false);
  });

  it('member cannot create an item (403)', async () => {
    await createMember();
    const token = await loginAs('member@example.com');

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('unauthenticated request is rejected (401)', async () => {
    const res = await request(app).post('/api/items').send(VALID_ITEM);
    expect(res.status).toBe(401);
  });

  it('rejects duplicate item code with 409', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ITEM, title: 'Another Camera' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_CODE');
  });

  it('normalises code to uppercase on creation', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_ITEM, code: 'cam-001' });

    expect(res.status).toBe(201);
    expect(res.body.item.code).toBe('CAM-001');
  });

  it('rejects missing title with 400', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'Photography', code: 'CAM-001' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

describe('GET /api/items', () => {
  it('returns active items for an authenticated user', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].code).toBe('CAM-001');
  });

  it('excludes archived items from the default list', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('member can view the active catalogue', async () => {
    await createLibrarian();
    const libToken = await loginAs('lib@example.com');
    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${libToken}`)
      .send(VALID_ITEM);

    await createMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('unauthenticated request is rejected (401)', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/items/archived', () => {
  it('librarian sees all items including archived', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tripod', category: 'Photography', code: 'TRP-001' });

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/items/archived')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2); // both active and archived
  });

  it('member cannot access the archived list (403)', async () => {
    await createMember();
    const token = await loginAs('member@example.com');

    const res = await request(app)
      .get('/api/items/archived')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/items/:id', () => {
  it('returns a single item by id', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .get(`/api/items/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.item.code).toBe('CAM-001');
  });

  it('returns 404 for a non-existent item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .get(`/api/items/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ITEM_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

describe('PATCH /api/items/:id', () => {
  it('librarian can edit an item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .patch(`/api/items/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated Camera Title' });

    expect(res.status).toBe(200);
    expect(res.body.item.title).toBe('Updated Camera Title');
    expect(res.body.item.code).toBe('CAM-001'); // unchanged
  });

  it('member cannot edit an item (403)', async () => {
    await createLibrarian();
    const libToken = await loginAs('lib@example.com');
    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${libToken}`)
      .send(VALID_ITEM);

    await createMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .patch(`/api/items/${created.body.item.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });

  it('rejects duplicate code on edit with 409', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const a = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tripod', category: 'Photography', code: 'TRP-001' });

    const res = await request(app)
      .patch(`/api/items/${a.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TRP-001' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_CODE');
  });

  it('returns 404 for a non-existent item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .patch(`/api/items/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

describe('POST /api/items/:id/archive', () => {
  it('librarian can archive an item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.item.archived).toBe(true);
  });

  it('member cannot archive an item (403)', async () => {
    await createLibrarian();
    const libToken = await loginAs('lib@example.com');
    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${libToken}`)
      .send(VALID_ITEM);

    await createMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 409 when archiving an already-archived item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ARCHIVED');
  });

  it('returns 404 for a non-existent item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';

    const res = await request(app)
      .post(`/api/items/${fakeId}/archive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

describe('POST /api/items/:id/restore', () => {
  it('librarian can restore an archived item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.item.archived).toBe(false);
  });

  it('member cannot restore an item (403)', async () => {
    await createLibrarian();
    const libToken = await loginAs('lib@example.com');
    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${libToken}`)
      .send(VALID_ITEM);

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${libToken}`);

    await createMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/restore`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 409 when restoring a non-archived item', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    const res = await request(app)
      .post(`/api/items/${created.body.item.id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_ARCHIVED');
  });

  it('restored item appears in the default active list', async () => {
    await createLibrarian();
    const token = await loginAs('lib@example.com');

    const created = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_ITEM);

    await request(app)
      .post(`/api/items/${created.body.item.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    await request(app)
      .post(`/api/items/${created.body.item.id}/restore`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].archived).toBe(false);
  });
});
