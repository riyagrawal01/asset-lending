'use strict';

/**
 * M06 Dashboard tests.
 *
 * mongodb-memory-server is standalone, so aggregation operators that require
 * a replica set are avoided. We use operators that work on standalone
 * ($facet, $lookup, $group, $count, $match, $addFields, $dateSubtract,
 * $dateTrunc, $dayOfWeek — all supported on standalone).
 */

const request = require('supertest');
const app = require('../app');
const { User, ROLES } = require('../models/User');
const { Item } = require('../models/Item');
const { Loan, LOAN_STATUSES } = require('../models/Loan');
const { LoanEvent, EVENT_TYPES } = require('../models/LoanEvent');
const { ItemCustodian } = require('../models/ItemCustodian');
const { setupDB, teardownDB, clearDB } = require('./helpers');
const { hashPassword } = require('../services/authService');

beforeAll(async () => { await setupDB(); });
afterAll(async () => { await teardownDB(); });
beforeEach(async () => { await clearDB(); });

async function makeLib(email = 'lib@example.com', name = 'Lib User') {
  return User.create({
    name,
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

async function makeItem(code, title = 'Item', archived = false) {
  return Item.create({ title, category: 'Cat', code, archived });
}

async function loginAs(email) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  return res.body.token;
}

async function createIssuedLoan(itemId, borrowerId, libId, dueDateOffset = 7) {
  const due = new Date();
  due.setDate(due.getDate() + dueDateOffset);
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

async function createReturnedLoan(itemId, borrowerId, libId, returnedAt) {
  const loan = await Loan.create({
    item: itemId,
    borrower: borrowerId,
    createdBy: libId,
    status: LOAN_STATUSES.RETURNED,
    requestedAt: new Date(returnedAt.getTime() - 86400000),
    dueDate: returnedAt,
    alertDismissed: false,
    updatedAt: returnedAt,
  });
  // Force updatedAt (Mongoose timestamps may not respect this on create)
  await Loan.updateOne({ _id: loan._id }, { $set: { updatedAt: returnedAt } });
  await LoanEvent.create({ loan: loan._id, type: EVENT_TYPES.RETURNED, actor: libId });
  return loan;
}

describe('M06 Dashboard', () => {
  it('GET /api/dashboard is librarian-only (403 for member)', async () => {
    await makeLib();
    await makeMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/dashboard requires authentication', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('summary.currentlyOut reflects issued loans count', async () => {
    const lib = await makeLib();
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const i1 = await makeItem('D-001');
    const i2 = await makeItem('D-002');

    await createIssuedLoan(i1._id, m._id, lib._id);
    await createIssuedLoan(i2._id, m._id, lib._id, 10);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.currentlyOut).toBe(2);
  });

  it('summary.overdue counts only issued loans past due date', async () => {
    const lib = await makeLib();
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const i1 = await makeItem('OD-001');
    const i2 = await makeItem('OD-002');

    // Overdue loan (negative offset = past due)
    await createIssuedLoan(i1._id, m._id, lib._id, -2);
    // Not overdue
    await createIssuedLoan(i2._id, m._id, lib._id, 7);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.overdue).toBe(1);
  });

  it('summary.totalItems counts only non-archived items', async () => {
    const lib = await makeLib();
    const libToken = await loginAs('lib@example.com');

    await makeItem('TI-001', 'Active 1');
    await makeItem('TI-002', 'Active 2');
    await makeItem('TI-003', 'Archived', true);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalItems).toBe(2);
  });

  it('loansByStatus groups loans correctly', async () => {
    const lib = await makeLib();
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const i1 = await makeItem('LS-001');
    const i2 = await makeItem('LS-002');

    await createIssuedLoan(i1._id, m._id, lib._id);
    await createReturnedLoan(i2._id, m._id, lib._id, new Date());

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    const byStatus = res.body.summary.loansByStatus;
    const issued   = byStatus.find((s) => s.status === 'ISSUED');
    const returned = byStatus.find((s) => s.status === 'RETURNED');
    expect(issued?.count).toBe(1);
    expect(returned?.count).toBe(1);
  });

  it('weeklyReturns is an array', async () => {
    const lib = await makeLib();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeklyReturns)).toBe(true);
  });

  it('byCustodian lists all librarians even without custodian assignments', async () => {
    await makeLib('lib@example.com', 'Alice Lib');
    await makeMember();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.byCustodian)).toBe(true);
    // Librarian should appear even without any ItemCustodian records
    const row = res.body.byCustodian.find((r) => r.custodian.name === 'Alice Lib');
    expect(row).toBeDefined();
    expect(row.itemsManaged).toBe(0);   // no custodian assignments
    expect(row.activeLoans).toBe(0);
  });

  it('byCustodian shows itemsManaged when custodian assigned', async () => {
    const lib = await makeLib('lib@example.com', 'Alice Lib');
    const m   = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('CUS-001');
    await ItemCustodian.create({ item: item._id, librarian: lib._id });
    await createIssuedLoan(item._id, m._id, lib._id);

    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    const row = res.body.byCustodian.find((r) => r.custodian.name === 'Alice Lib');
    expect(row).toBeDefined();
    expect(row.itemsManaged).toBe(1);
    expect(row.activeLoans).toBe(1);
  });
});
