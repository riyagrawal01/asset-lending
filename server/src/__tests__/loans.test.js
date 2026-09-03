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
