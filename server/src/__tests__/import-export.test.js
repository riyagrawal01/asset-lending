'use strict';

/**
 * M06 — CSV import and export tests.
 */

const request = require('supertest');
const app = require('../app');
const { User, ROLES } = require('../models/User');
const { Item } = require('../models/Item');
const { Loan, LOAN_STATUSES } = require('../models/Loan');
const { LoanEvent, EVENT_TYPES } = require('../models/LoanEvent');
const { setupDB, teardownDB, clearDB } = require('./helpers');
const { hashPassword } = require('../services/authService');

beforeAll(async () => { await setupDB(); });
afterAll(async () => { await teardownDB(); });
beforeEach(async () => { await clearDB(); });

async function makeLib(email = 'lib@example.com') {
  return User.create({
    name: 'Lib User',
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.LIBRARIAN,
  });
}

async function makeMember(email = 'member@example.com') {
  return User.create({
    name: 'Member',
    email,
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

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

describe('M06 CSV Import', () => {
  it('valid CSV imports all rows', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    const csv = [
      'title,category,code',
      'Camera,Electronics,CAM-001',
      'Tripod,Equipment,TRP-001',
    ].join('\n');

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(0);
    expect(res.body.errors).toHaveLength(0);

    const items = await Item.find({});
    expect(items.length).toBe(2);
  });

  it('partial import: duplicate code row fails, valid row succeeds', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    // Pre-create an item with CAM-001
    await Item.create({ title: 'Existing Camera', category: 'Electronics', code: 'CAM-001' });

    const csv = [
      'title,category,code',
      'Camera,Electronics,CAM-001',   // duplicate — should fail
      'Tripod,Equipment,TRP-001',     // valid — should succeed
    ].join('\n');

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.imported).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors[0].row).toBe(1);

    // Tripod should have been imported
    const tripod = await Item.findOne({ code: 'TRP-001' });
    expect(tripod).toBeTruthy();
  });

  it('import reports correct row numbers for failures', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    const csv = [
      'title,category,code',
      'Valid Item,Equipment,VAL-001',
      ',Equipment,MISSING-TITLE',   // row 2 — missing title
      'Another,Equip,VAL-002',
    ].join('\n');

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.body.total).toBe(3);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors[0].row).toBe(2);
  });

  it('import supports any column order', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    // code, category, title — different order
    const csv = [
      'code,category,title',
      'ORD-001,Equipment,Reordered Item',
    ].join('\n');

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.body.imported).toBe(1);
    const item = await Item.findOne({ code: 'ORD-001' });
    expect(item.title).toBe('Reordered Item');
  });

  it('member cannot import', async () => {
    await makeLib();
    await makeMember();
    const memberToken = await loginAs('member@example.com');

    const csv = 'title,category,code\nCamera,Electronics,CAM-001';
    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(403);
  });

  it('import with missing required header returns 400', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    const csv = 'title,category\nCamera,Electronics'; // missing code column

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('empty CSV body returns 400', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .post('/api/items/import')
      .set('Authorization', `Bearer ${libToken}`)
      .set('Content-Type', 'text/csv')
      .send('');

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

describe('M06 CSV Export', () => {
  async function createIssuedLoan(itemId, borrowerId, libId, dueDays = 7) {
    const due = new Date();
    due.setDate(due.getDate() + dueDays);
    const loan = await Loan.create({
      item: itemId,
      borrower: borrowerId,
      createdBy: libId,
      status: LOAN_STATUSES.ISSUED,
      requestedAt: new Date(),
      dueDate: due,
      alertDismissed: false,
    });
    await LoanEvent.create({ loan: loan._id, type: EVENT_TYPES.ISSUED, actor: libId });
    return loan;
  }

  it('export returns CSV with only ISSUED loans', async () => {
    const lib = await makeLib();
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await Item.create({ title: 'Camera', category: 'Electronics', code: 'EX-001' });
    const item2 = await Item.create({ title: 'Tripod',  category: 'Equipment',   code: 'EX-002' });

    await createIssuedLoan(item1._id, m._id, lib._id);
    // Create a RETURNED loan — should NOT appear in export
    await Loan.create({
      item: item2._id,
      borrower: m._id,
      createdBy: lib._id,
      status: LOAN_STATUSES.RETURNED,
      requestedAt: new Date(),
      dueDate: new Date(),
      alertDismissed: false,
    });

    const res = await request(app)
      .get('/api/items/export/on-loan')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/on-loan\.csv/);

    const lines = res.text.split(/\r?\n/).filter((l) => l.trim());
    // Header + 1 data row (only the ISSUED loan)
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('itemCode');
    expect(lines[1]).toContain('EX-001');
  });

  it('export CSV includes required fields', async () => {
    const lib = await makeLib();
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await Item.create({ title: 'Lens', category: 'Optics', code: 'LNS-001' });
    await createIssuedLoan(item._id, m._id, lib._id, 14);

    const res = await request(app)
      .get('/api/items/export/on-loan')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.text).toContain('LNS-001');  // item code
    expect(res.text).toContain('Lens');     // item title
    expect(res.text).toContain('Member');   // borrower name
  });

  it('export with no ISSUED loans returns only header', async () => {
    await makeLib();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .get('/api/items/export/on-loan')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    const lines = res.text.split(/\r?\n/).filter((l) => l.trim());
    expect(lines.length).toBe(1); // header only
  });

  it('member cannot export', async () => {
    await makeLib();
    await makeMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .get('/api/items/export/on-loan')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });
});
