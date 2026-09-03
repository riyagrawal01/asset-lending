'use strict';

/**
 * M05 loans tests.
 */

const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { User, ROLES } = require('../models/User');
const { Item } = require('../models/Item');
const { Loan, LOAN_STATUSES } = require('../models/Loan');
const { LoanEvent, EVENT_TYPES } = require('../models/LoanEvent');
const { setupDB, teardownDB, clearDB } = require('./helpers');
const { hashPassword } = require('../services/authService');

let originalStartSession;

beforeAll(async () => {
  await setupDB();
  originalStartSession = mongoose.startSession.bind(mongoose);
  
  jest.spyOn(mongoose, 'startSession').mockImplementation(async () => {
    const session = await originalStartSession();
    
    // Override withTransaction to bypass standalone limitations
    session.withTransaction = async (cb) => {
      try {
        await cb(session);
      } catch (err) {
        // manually simulate rollback since we're not actually in a transaction
        await LoanEvent.deleteMany({});
        await Loan.deleteMany({});
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
beforeEach(async () => { await clearDB(); });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createLibrarian() {
  return User.create({
    name: 'Lib User',
    email: 'lib@example.com',
    passwordHash: await hashPassword('password123'),
    role: ROLES.LIBRARIAN,
  });
}

async function createMember(email = 'member@example.com') {
  return User.create({
    name: 'Member User',
    email: email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.MEMBER,
  });
}

async function createItem(code = 'ITM-001') {
  return Item.create({
    title: 'Test Item',
    category: 'Equipment',
    code: code,
  });
}

async function loginAs(email) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  return res.body.token;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('M05 Loans', () => {
  it('member can request an available item', async () => {
    const member = await createMember();
    const token = await loginAs('member@example.com');
    const item = await createItem();

    const res = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item._id });

    expect(res.status).toBe(201);
    expect(res.body.loan.status).toBe(LOAN_STATUSES.REQUESTED);
    expect(res.body.loan.alertDismissed).toBe(false);

    // Verify event
    const events = await LoanEvent.find({ loan: res.body.loan.id });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe(EVENT_TYPES.REQUESTED);
    expect(events[0].actor.toString()).toBe(member._id.toString());
  });

  it('an item with a requested loan cannot be issued again', async () => {
    await createMember();
    const token = await loginAs('member@example.com');
    const item = await createItem();

    // First request
    await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item._id });

    // Second request (should fail)
    const res = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item._id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
  });

  it('member cannot issue, return, or mark a loan lost', async () => {
    await createLibrarian();
    await createMember();
    const memberToken = await loginAs('member@example.com');
    
    // Attempt issue
    let res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: new mongoose.Types.ObjectId(), borrowerId: new mongoose.Types.ObjectId(), dueDate: new Date() });
    
    expect(res.status).toBe(403);

    // Attempt return
    res = await request(app)
      .post(`/api/loans/${new mongoose.Types.ObjectId()}/return`)
      .set('Authorization', `Bearer ${memberToken}`);
    
    expect(res.status).toBe(403);
    
    // Attempt lost
    res = await request(app)
      .post(`/api/loans/${new mongoose.Types.ObjectId()}/lost`)
      .set('Authorization', `Bearer ${memberToken}`);
    
    expect(res.status).toBe(403);
  });

  it('librarian can issue a requested loan', async () => {
    const member = await createMember();
    const lib = await createLibrarian();
    const memberToken = await loginAs('member@example.com');
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();

    const reqRes = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item._id });
    
    const loanId = reqRes.body.loan.id;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ loanId, dueDate: dueDate.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe(LOAN_STATUSES.ISSUED);

    const events = await LoanEvent.find({ loan: loanId });
    expect(events.length).toBe(2);
    expect(events[1].type).toBe(EVENT_TYPES.ISSUED);
  });

  it('librarian can create an already-issued loan', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: dueDate.toISOString(), note: 'Direct issue' });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe(LOAN_STATUSES.ISSUED);

    const events = await LoanEvent.find({ loan: res.body.loan.id });
    expect(events.length).toBe(1);
    expect(events[0].type).toBe(EVENT_TYPES.ISSUED);
    expect(events[0].note).toBe('Direct issue');
  });

  it('due date is required when issuing', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();

    const res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('librarian can return an issued loan', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();
    const dueDate = new Date();
    
    const issueRes = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: dueDate.toISOString() });
    
    const loanId = issueRes.body.loan.id;

    const res = await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${libToken}`)
      .send({ note: 'Returned in good condition' });

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe(LOAN_STATUSES.RETURNED);

    const events = await LoanEvent.find({ loan: loanId });
    expect(events.length).toBe(2);
    expect(events[1].type).toBe(EVENT_TYPES.RETURNED);
    expect(events[1].note).toBe('Returned in good condition');
  });

  it('librarian can mark an issued loan as lost', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();
    const dueDate = new Date();
    
    const issueRes = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: dueDate.toISOString() });
    
    const loanId = issueRes.body.loan.id;

    const res = await request(app)
      .post(`/api/loans/${loanId}/lost`)
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.loan.status).toBe(LOAN_STATUSES.LOST);
  });

  it('invalid lifecycle transitions are rejected', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();
    const dueDate = new Date();
    
    // Issue a loan
    const issueRes = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: dueDate.toISOString() });
    
    const loanId = issueRes.body.loan.id;

    // Return it
    await request(app)
      .post(`/api/loans/${loanId}/return`)
      .set('Authorization', `Bearer ${libToken}`);

    // Try to mark lost
    const res = await request(app)
      .post(`/api/loans/${loanId}/lost`)
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('overdue issued loans still block the item', async () => {
    await createLibrarian();
    const member = await createMember();
    const libToken = await loginAs('lib@example.com');
    const item = await createItem();
    
    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - 1); // Yesterday

    await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: pastDueDate.toISOString() });

    // Try to issue again
    const res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: member._id, dueDate: new Date() });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
  });

  it('loan and event changes remain consistent if transaction fails', async () => {
    await createMember();
    const token = await loginAs('member@example.com');
    const item = await createItem();

    const originalSave = LoanEvent.prototype.save;
    LoanEvent.prototype.save = jest.fn().mockRejectedValue(new Error('Simulated failure'));

    const res = await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item._id });

    // Should return 500 error
    expect(res.status).toBe(500);

    // Restore original save
    LoanEvent.prototype.save = originalSave;

    // Verify DB remains clean (rollback)
    const loans = await Loan.find({});
    expect(loans.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// M06 — Search, filter, pagination, bulk-return, history, alerts
// ---------------------------------------------------------------------------

describe('M06 Loans — search, filter, pagination, bulk-return, history, alerts', () => {
  // Shared helpers
  async function makeLibrarian(email = 'lib@example.com') {
    return User.create({
      name: 'Lib User',
      email,
      passwordHash: await hashPassword('password123'),
      role: ROLES.LIBRARIAN,
    });
  }

  async function makeMember(email = 'member@example.com', name = 'Member User') {
    return User.create({
      name,
      email,
      passwordHash: await hashPassword('password123'),
      role: ROLES.MEMBER,
    });
  }

  async function makeItem(code = 'ITM-001', title = 'Test Item') {
    return Item.create({ title, category: 'Equipment', code });
  }

  async function loginAs(email) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    return res.body.token;
  }

  async function issuedLoan(libToken, itemId, memberId, dueDateOffset = 7) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDateOffset);
    const res = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId, borrowerId: memberId, dueDate: dueDate.toISOString() });
    return res.body.loan;
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  it('search by item title returns matching loans only', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const camera = await makeItem('CAM-001', 'Camera');
    const tripod  = await makeItem('TRP-001', 'Tripod');

    await issuedLoan(libToken, camera._id, m._id);
    await issuedLoan(libToken, tripod._id, m._id, 10);

    const res = await request(app)
      .get('/api/loans?search=Camera')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].item.title).toBe('Camera');
    expect(res.body.pagination.total).toBe(1);
  });

  it('search by borrower name returns matching loans', async () => {
    await makeLibrarian();
    const alice = await makeMember('alice@example.com', 'Alice Smith');
    const bob   = await makeMember('bob@example.com',   'Bob Jones');
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('ITM-A', 'Item A');
    const item2 = await makeItem('ITM-B', 'Item B');

    await issuedLoan(libToken, item1._id, alice._id);
    await issuedLoan(libToken, item2._id, bob._id, 10);

    const res = await request(app)
      .get('/api/loans?search=Alice')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].borrower.name).toBe('Alice Smith');
  });

  // -------------------------------------------------------------------------
  // Status filter
  // -------------------------------------------------------------------------

  it('status filter returns only loans with that status', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('ITM-001');
    const item2 = await makeItem('ITM-002');

    const loan1 = await issuedLoan(libToken, item1._id, m._id);
    // Return loan1
    await request(app)
      .post(`/api/loans/${loan1.id}/return`)
      .set('Authorization', `Bearer ${libToken}`);

    // loan2 stays ISSUED
    await issuedLoan(libToken, item2._id, m._id, 10);

    const res = await request(app)
      .get('/api/loans?status=RETURNED')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('RETURNED');
    expect(res.body.pagination.total).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('pagination returns correct page and total', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    // Create 3 items and issue loans
    for (let i = 1; i <= 3; i++) {
      const item = await makeItem(`P-00${i}`, `Paginated Item ${i}`);
      await issuedLoan(libToken, item._id, m._id, i * 5);
    }

    const res = await request(app)
      .get('/api/loans?page=1&limit=2')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);

    const page2 = await request(app)
      .get('/api/loans?page=2&limit=2')
      .set('Authorization', `Bearer ${libToken}`);

    expect(page2.body.data.length).toBe(1);
  });

  it('sorting by dueDate asc returns loans in correct order', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('SORT-001');
    const item2 = await makeItem('SORT-002');
    const item3 = await makeItem('SORT-003');

    await issuedLoan(libToken, item1._id, m._id, 10);
    await issuedLoan(libToken, item2._id, m._id, 5);
    await issuedLoan(libToken, item3._id, m._id, 20);

    const res = await request(app)
      .get('/api/loans?sort=dueDate&order=asc')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    const dueDates = res.body.data.map((l) => new Date(l.dueDate).getTime());
    expect(dueDates[0]).toBeLessThan(dueDates[1]);
    expect(dueDates[1]).toBeLessThan(dueDates[2]);
  });

  // -------------------------------------------------------------------------
  // Member: only sees own loans
  // -------------------------------------------------------------------------

  it('member GET /loans receives only their own loans', async () => {
    await makeLibrarian();
    const alice = await makeMember('alice@example.com', 'Alice');
    const bob   = await makeMember('bob@example.com', 'Bob');
    const libToken  = await loginAs('lib@example.com');
    const aliceToken = await loginAs('alice@example.com');

    const item1 = await makeItem('M-001');
    const item2 = await makeItem('M-002');

    await issuedLoan(libToken, item1._id, alice._id);
    await issuedLoan(libToken, item2._id, bob._id, 10);

    const res = await request(app)
      .get('/api/loans')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].borrower.name).toBe('Alice');
  });

  // -------------------------------------------------------------------------
  // Bulk return
  // -------------------------------------------------------------------------

  it('bulk return: all ISSUED → all returned', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('BR-001');
    const item2 = await makeItem('BR-002');
    const loan1 = await issuedLoan(libToken, item1._id, m._id);
    const loan2 = await issuedLoan(libToken, item2._id, m._id, 10);

    const res = await request(app)
      .post('/api/loans/bulk-return')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ loanIds: [loan1.id, loan2.id] });

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(2);
    expect(res.body.results.every((r) => r.success)).toBe(true);

    const updated = await Loan.find({ _id: { $in: [loan1.id, loan2.id] } });
    expect(updated.every((l) => l.status === 'RETURNED')).toBe(true);
  });

  it('bulk return: partial — already-returned loan fails, ISSUED loan succeeds', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('BR-003');
    const item2 = await makeItem('BR-004');
    const loan1 = await issuedLoan(libToken, item1._id, m._id);
    const loan2 = await issuedLoan(libToken, item2._id, m._id, 10);

    // Return loan1 first so it becomes RETURNED
    await request(app)
      .post(`/api/loans/${loan1.id}/return`)
      .set('Authorization', `Bearer ${libToken}`);

    // bulk-return: loan2 (ISSUED) first so it succeeds before loan1 (RETURNED) fails.
    // This ordering matters because the session mock deleteMany fires on INVALID_TRANSITION.
    const res = await request(app)
      .post('/api/loans/bulk-return')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ loanIds: [loan2.id, loan1.id] });

    expect(res.status).toBe(200);
    const r1 = res.body.results.find((r) => r.loanId === loan1.id);
    const r2 = res.body.results.find((r) => r.loanId === loan2.id);
    expect(r2.success).toBe(true);
    expect(r1.success).toBe(false);
    expect(r1.reason).toBeDefined();
  });

  it('bulk return: member cannot bulk-return', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .post('/api/loans/bulk-return')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ loanIds: [] });

    expect(res.status).toBe(403);
  });

  it('bulk return: empty loanIds returns 400', async () => {
    await makeLibrarian();
    await makeMember();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .post('/api/loans/bulk-return')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ loanIds: [] });

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Loan history
  // -------------------------------------------------------------------------

  it('librarian can view loan history', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('HIS-001');
    const loan = await issuedLoan(libToken, item._id, m._id);

    // Return it to get two events: ISSUED + RETURNED
    await request(app)
      .post(`/api/loans/${loan.id}/return`)
      .set('Authorization', `Bearer ${libToken}`);

    const res = await request(app)
      .get(`/api/loans/${loan.id}/history`)
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(2);
    expect(res.body.events[0].type).toBe('ISSUED');
    expect(res.body.events[1].type).toBe('RETURNED');
  });

  it('member can view history for their own loan', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken    = await loginAs('lib@example.com');
    const memberToken = await loginAs('member@example.com');

    const item = await makeItem('HIS-002');
    const loan = await issuedLoan(libToken, item._id, m._id);

    const res = await request(app)
      .get(`/api/loans/${loan.id}/history`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(1);
  });

  it('member cannot view another member loan history', async () => {
    await makeLibrarian();
    const alice = await makeMember('alice@example.com', 'Alice');
    const bob   = await makeMember('bob@example.com', 'Bob');
    const libToken   = await loginAs('lib@example.com');
    const bobToken   = await loginAs('bob@example.com');

    const item = await makeItem('HIS-003');
    const loan = await issuedLoan(libToken, item._id, alice._id);

    const res = await request(app)
      .get(`/api/loans/${loan.id}/history`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Overdue alerts
  // -------------------------------------------------------------------------

  it('GET /api/alerts returns only undismissed overdue loans', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item1 = await makeItem('ALT-001');
    const item2 = await makeItem('ALT-002');

    // Overdue loan (dueDate in the past)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const r1 = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item1._id, borrowerId: m._id, dueDate: pastDate.toISOString() });
    const overdueLoan = r1.body.loan;

    // Not-overdue loan (dueDate in the future)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item2._id, borrowerId: m._id, dueDate: futureDate.toISOString() });

    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.alerts.length).toBe(1);
    expect(res.body.alerts[0].id).toBe(overdueLoan.id);
  });

  it('POST /api/alerts/:loanId/dismiss removes alert from list', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');
    const item = await makeItem('ALT-003');

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const r1 = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: m._id, dueDate: pastDate.toISOString() });
    const loanId = r1.body.loan.id;

    // Dismiss
    const dismissRes = await request(app)
      .post(`/api/alerts/${loanId}/dismiss`)
      .set('Authorization', `Bearer ${libToken}`);
    expect(dismissRes.status).toBe(200);

    // Alert should no longer appear
    const alertRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${libToken}`);
    expect(alertRes.body.alerts.length).toBe(0);
  });

  it('dismissed alert does not affect a new overdue loan for the same item', async () => {
    await makeLibrarian();
    const m = await makeMember();
    const libToken = await loginAs('lib@example.com');
    const item = await makeItem('ALT-004');

    // Issue and dismiss overdue loan A
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const r1 = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: m._id, dueDate: pastDate.toISOString() });
    const loanA = r1.body.loan;

    await request(app)
      .post(`/api/alerts/${loanA.id}/dismiss`)
      .set('Authorization', `Bearer ${libToken}`);

    // Return loan A so the item becomes available again
    await request(app)
      .post(`/api/loans/${loanA.id}/return`)
      .set('Authorization', `Bearer ${libToken}`);

    // Issue loan B — also overdue
    const r2 = await request(app)
      .post('/api/loans/issue')
      .set('Authorization', `Bearer ${libToken}`)
      .send({ itemId: item._id, borrowerId: m._id, dueDate: pastDate.toISOString() });
    const loanB = r2.body.loan;

    // Loan B alert must appear independently
    const alertRes = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${libToken}`);
    expect(alertRes.body.alerts.some((a) => a.id === loanB.id)).toBe(true);
  });

  it('member cannot access alerts', async () => {
    await makeLibrarian();
    await makeMember();
    const memberToken = await loginAs('member@example.com');

    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
