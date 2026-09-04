'use strict';

const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { User, ROLES } = require('../models/User');
const { Item } = require('../models/Item');
const { ItemCustodian } = require('../models/ItemCustodian');
const { setupDB, teardownDB, clearDB } = require('./helpers');
const { hashPassword } = require('../services/authService');

let adminToken, librarianToken, memberToken;
let admin, librarian, member, item;

let originalStartSession;

beforeAll(async () => {
  await setupDB();
  originalStartSession = mongoose.startSession.bind(mongoose);
  jest.spyOn(mongoose, 'startSession').mockImplementation(async () => {
    const session = await originalStartSession();
    session.withTransaction = async (cb) => {
      try {
        await cb(session);
      } catch (err) {
        throw err;
      }
    };
    return session;
  });
});

afterAll(async () => {
  jest.restoreAllMocks();
  await teardownDB();
});

beforeEach(async () => {
  await clearDB();

  const pwd = await hashPassword('password123');

  admin = await User.create({ name: 'Admin', email: 'admin@test.com', passwordHash: pwd, role: ROLES.ADMIN });
  librarian = await User.create({ name: 'Lib', email: 'lib@test.com', passwordHash: pwd, role: ROLES.LIBRARIAN });
  member = await User.create({ name: 'Mem', email: 'mem@test.com', passwordHash: pwd, role: ROLES.MEMBER });
  item = await Item.create({ title: 'Camera', category: 'Electronics', code: 'CAM-01' });

  adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'password123' })).body.token;
  librarianToken = (await request(app).post('/api/auth/login').send({ email: 'lib@test.com', password: 'password123' })).body.token;
  memberToken = (await request(app).post('/api/auth/login').send({ email: 'mem@test.com', password: 'password123' })).body.token;
});

describe('Admin role tests', () => {
  it('should accept ADMIN as a valid role', async () => {
    expect(admin.role).toBe('ADMIN');
  });

  it('should deny non-admin users from admin endpoints', async () => {
    const resMem = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${memberToken}`);
    expect(resMem.status).toBe(403);
    const resLib = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${librarianToken}`);
    expect(resLib.status).toBe(403);
  });
});

describe('User Role Management', () => {
  it('Admin can change MEMBER -> LIBRARIAN', async () => {
    const res = await request(app).patch(`/api/admin/users/${member._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'LIBRARIAN' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('LIBRARIAN');
  });

  it('Admin can change LIBRARIAN -> MEMBER and cleans up custodianships', async () => {
    await ItemCustodian.create({ item: item._id, librarian: librarian._id });
    const res = await request(app).patch(`/api/admin/users/${librarian._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('MEMBER');
    expect(res.body.custodiansRemoved).toBe(1);

    const custodians = await ItemCustodian.find({});
    expect(custodians.length).toBe(0);
  });

  it('Downgrading a librarian removes ItemCustodian records but preserves catalogue items', async () => {
    await ItemCustodian.create({ item: item._id, librarian: librarian._id });

    await request(app).patch(`/api/admin/users/${librarian._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });

    // ItemCustodian gone
    const custodians = await ItemCustodian.find({ librarian: librarian._id });
    expect(custodians.length).toBe(0);

    // Item still exists and is unchanged
    const { Item: ItemModel } = require('../models/Item');
    const itemStillExists = await ItemModel.findById(item._id);
    expect(itemStillExists).not.toBeNull();
    expect(itemStillExists.title).toBe('Camera');
  });

  it('Admin cannot assign ADMIN through role-management', async () => {
    const res = await request(app).patch(`/api/admin/users/${member._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ADMIN' });
    expect(res.status).toBe(400);
  });

  it('Admin cannot change their own role', async () => {
    const res = await request(app).patch(`/api/admin/users/${admin._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    expect(res.status).toBe(400);
  });
});

describe('Item Custodian Management', () => {
  it('Admin can assign one or multiple custodians', async () => {
    const res = await request(app).put(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ librarianIds: [librarian._id] });
    
    expect(res.status).toBe(204);
    const custs = await ItemCustodian.find({ item: item._id });
    expect(custs.length).toBe(1);
    expect(custs[0].librarian.toString()).toBe(librarian._id.toString());
  });

  it('Admin can remove custodians and preserve others', async () => {
    const lib2 = await User.create({ name: 'Lib2', email: 'lib2@test.com', passwordHash: 'pwd', role: ROLES.LIBRARIAN });
    await ItemCustodian.create({ item: item._id, librarian: librarian._id });
    await ItemCustodian.create({ item: item._id, librarian: lib2._id });

    // Remove lib2, keep lib1
    const res = await request(app).put(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ librarianIds: [librarian._id] });
    
    expect(res.status).toBe(204);
    const custs = await ItemCustodian.find({ item: item._id });
    expect(custs.length).toBe(1);
    expect(custs[0].librarian.toString()).toBe(librarian._id.toString());
  });

  it('Admin can add and remove multiple custodians in one save', async () => {
    const lib2 = await User.create({ name: 'Lib2', email: 'lib2@test.com', passwordHash: 'pwd', role: ROLES.LIBRARIAN });
    const lib3 = await User.create({ name: 'Lib3', email: 'lib3@test.com', passwordHash: 'pwd', role: ROLES.LIBRARIAN });
    // Start: lib1 and lib2 are custodians
    await ItemCustodian.create({ item: item._id, librarian: librarian._id });
    await ItemCustodian.create({ item: item._id, librarian: lib2._id });

    // Save: lib2 removed, lib3 added — lib1 stays
    const res = await request(app).put(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ librarianIds: [librarian._id.toString(), lib3._id.toString()] });

    expect(res.status).toBe(204);
    const custs = await ItemCustodian.find({ item: item._id });
    const ids = custs.map(c => c.librarian.toString()).sort();
    expect(ids).toEqual([librarian._id.toString(), lib3._id.toString()].sort());
  });

  it('Admin can load librarians for an item with correct isCustodian state', async () => {
    // Assign librarian as custodian
    await ItemCustodian.create({ item: item._id, librarian: librarian._id });

    const res = await request(app).get(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('librarians');
    const libs = res.body.librarians;
    const assigned = libs.find(l => l.id.toString() === librarian._id.toString());
    expect(assigned).toBeDefined();
    expect(assigned.isCustodian).toBe(true);
    // Member should not appear in the list (only librarians)
    const memberEntry = libs.find(l => l.id.toString() === member._id.toString());
    expect(memberEntry).toBeUndefined();
  });

  it('Non-admin cannot modify custodians', async () => {
    const resMem = await request(app).put(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ librarianIds: [librarian._id] });
    expect(resMem.status).toBe(403);

    const resLib = await request(app).put(`/api/admin/items/${item._id}/custodians`)
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ librarianIds: [librarian._id] });
    expect(resLib.status).toBe(403);
  });

  it('Invalid item id returns 404', async () => {
    const res = await request(app).put(`/api/admin/items/${new mongoose.Types.ObjectId()}/custodians`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ librarianIds: [librarian._id] });
    expect(res.status).toBe(404);
  });
});

describe('Admin Read-Only Access', () => {
  it('Admin can access the same read-only Catalogue view as Librarian, including archived items', async () => {
    await Item.create({ title: 'Archived Item', category: 'Testing', code: 'TEST-01', archived: true });
    const res = await request(app).get('/api/items/archived').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some(i => i.archived)).toBe(true);
  });

  it('Admin can access loan search/filtering/pagination', async () => {
    const res = await request(app).get('/api/loans?status=REQUESTED').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('Admin can view loan history', async () => {
    const { Loan } = require('../models/Loan');
    const loan = await Loan.create({ item: item._id, borrower: member._id, createdBy: member._id, requestedAt: new Date() });
    const res = await request(app).get(`/api/loans/${loan._id}/history`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
  });

  it('Admin can view the Dashboard', async () => {
    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });

  it('Admin can view Alerts', async () => {
    const res = await request(app).get('/api/alerts').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('alerts');
  });

  it('Admin cannot perform catalogue modification actions', async () => {
    const resCreate = await request(app).post('/api/items').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Test', category: 'T', code: 'T' });
    expect(resCreate.status).toBe(403);
    const resUpdate = await request(app).patch(`/api/items/${item._id}`).set('Authorization', `Bearer ${adminToken}`).send({ title: 'Test 2' });
    expect(resUpdate.status).toBe(403);
    const resArchive = await request(app).post(`/api/items/${item._id}/archive`).set('Authorization', `Bearer ${adminToken}`);
    expect(resArchive.status).toBe(403);
  });

  it('Admin cannot issue, return, mark lost, or bulk-return loans, or dismiss alerts', async () => {
    const { Loan } = require('../models/Loan');
    const loan = await Loan.create({ item: item._id, borrower: member._id, createdBy: member._id, requestedAt: new Date() });
    
    expect((await request(app).post('/api/loans/issue').set('Authorization', `Bearer ${adminToken}`).send({ loanId: loan._id, dueDate: '2050-01-01' })).status).toBe(403);
    expect((await request(app).post(`/api/loans/${loan._id}/return`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).post(`/api/loans/${loan._id}/lost`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).post('/api/loans/bulk-return').set('Authorization', `Bearer ${adminToken}`).send({ loanIds: [loan._id] })).status).toBe(403);
    expect((await request(app).post(`/api/alerts/${loan._id}/dismiss`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
  });
});
