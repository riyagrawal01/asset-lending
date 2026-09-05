'use strict';

/**
 * M08 Notification tests.
 *
 * Tests the /api/notif endpoints that back the librarian notification dots:
 *   - GET  /api/notif              — counts of unseen requests / alerts
 *   - POST /api/notif/requests/seen — marks requests as viewed
 *   - POST /api/notif/alerts/seen   — marks alerts as viewed
 *
 * The "seen" state is persisted on the User document so it survives refreshes.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeLibrarian(email = 'lib@example.com') {
  return User.create({
    name: 'Lib User',
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.LIBRARIAN,
  });
}

async function makeMember(email = 'member@example.com') {
  return User.create({
    name: 'Member User',
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.MEMBER,
  });
}

async function makeAdmin(email = 'admin@example.com') {
  return User.create({
    name: 'Admin User',
    email,
    passwordHash: await hashPassword('password123'),
    role: ROLES.ADMIN,
  });
}

async function makeItem(code = 'NTF-001') {
  return Item.create({ title: `Item ${code}`, category: 'Equipment', code });
}

async function loginAs(email) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });
  return res.body.token;
}

// Creates a REQUESTED loan directly in the DB
async function createRequestedLoan(itemId, memberId) {
  const loan = await Loan.create({
    item: itemId,
    borrower: memberId,
    createdBy: memberId,
    status: LOAN_STATUSES.REQUESTED,
    requestedAt: new Date(),
    alertDismissed: false,
  });
  await LoanEvent.create({ loan: loan._id, type: EVENT_TYPES.REQUESTED, actor: memberId });
  return loan;
}

// Creates an issued overdue loan directly in the DB
async function createOverdueLoan(itemId, memberId, libId) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 2);
  const loan = await Loan.create({
    item: itemId,
    borrower: memberId,
    createdBy: libId,
    status: LOAN_STATUSES.ISSUED,
    requestedAt: new Date(),
    dueDate: pastDate,
    alertDismissed: false,
  });
  await LoanEvent.create({ loan: loan._id, type: EVENT_TYPES.ISSUED, actor: libId });
  return loan;
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

describe('M08 Notifications — access control', () => {
  it('GET /api/notif requires authentication', async () => {
    const res = await request(app).get('/api/notif');
    expect(res.status).toBe(401);
  });

  it('GET /api/notif returns 403 for MEMBER', async () => {
    await makeMember();
    const token = await loginAs('member@example.com');
    const res = await request(app).get('/api/notif').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/notif returns 403 for ADMIN', async () => {
    await makeAdmin();
    const token = await loginAs('admin@example.com');
    const res = await request(app).get('/api/notif').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/notif/requests/seen returns 403 for MEMBER', async () => {
    await makeMember();
    const token = await loginAs('member@example.com');
    const res = await request(app)
      .post('/api/notif/requests/seen')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/notif/alerts/seen returns 403 for ADMIN', async () => {
    await makeAdmin();
    const token = await loginAs('admin@example.com');
    const res = await request(app)
      .post('/api/notif/alerts/seen')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Notification counts — newRequests
// ---------------------------------------------------------------------------

describe('M08 Notifications — pending request indicator', () => {
  it('newRequests is 0 when there are no pending requests', async () => {
    await makeLibrarian();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.newRequests).toBe(0);
    expect(res.body.newAlerts).toBe(0);
  });

  it('newRequests is 1 after a member creates a request', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-R01');
    await createRequestedLoan(item._id, member._id);

    const res = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.newRequests).toBe(1);
  });

  it('POST /api/notif/requests/seen clears the newRequests count', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-R02');
    await createRequestedLoan(item._id, member._id);

    // Before marking seen
    const before = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);
    expect(before.body.newRequests).toBe(1);

    // Mark as seen
    const seenRes = await request(app)
      .post('/api/notif/requests/seen')
      .set('Authorization', `Bearer ${libToken}`);
    expect(seenRes.status).toBe(204);

    // After marking seen — the existing request no longer counts as new
    const after = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);
    expect(after.body.newRequests).toBe(0);
  });

  it('new request AFTER seen timestamp still triggers notification dot', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    // First request — create it before marking seen
    const item1 = await makeItem('NTF-R03');
    await createRequestedLoan(item1._id, member._id);

    // Mark seen (this sets notifRequestsSeenAt = now)
    await request(app)
      .post('/api/notif/requests/seen')
      .set('Authorization', `Bearer ${libToken}`);

    // Wait 1ms to ensure second request has a strictly later createdAt
    await new Promise((r) => setTimeout(r, 10));

    // Second request — created AFTER the seen timestamp
    // Must go through the API endpoint so createdAt is set by the server
    const memberToken = await loginAs('member@example.com');
    const item2 = await makeItem('NTF-R04');
    await request(app)
      .post('/api/loans/request')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ itemId: item2._id });

    const res = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.body.newRequests).toBe(1);
  });

  it('notification seen state persists — count is still 0 after re-fetching', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-R05');
    await createRequestedLoan(item._id, member._id);

    // Mark seen
    await request(app)
      .post('/api/notif/requests/seen')
      .set('Authorization', `Bearer ${libToken}`);

    // Simulate page refresh — fetch again, should still be 0
    const res1 = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);
    const res2 = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);

    expect(res1.body.newRequests).toBe(0);
    expect(res2.body.newRequests).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Notification counts — newAlerts
// ---------------------------------------------------------------------------

describe('M08 Notifications — alert indicator', () => {
  it('newAlerts is 0 when there are no overdue loans', async () => {
    await makeLibrarian();
    const libToken = await loginAs('lib@example.com');

    const res = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.newAlerts).toBe(0);
  });

  it('newAlerts is 1 after an overdue undismissed loan is present', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-A01');
    await createOverdueLoan(item._id, member._id, lib._id);

    const res = await request(app)
      .get('/api/notif')
      .set('Authorization', `Bearer ${libToken}`);

    expect(res.status).toBe(200);
    expect(res.body.newAlerts).toBe(1);
  });

  it('POST /api/notif/alerts/seen clears the newAlerts count', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-A02');
    await createOverdueLoan(item._id, member._id, lib._id);

    // Before marking seen
    const before = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);
    expect(before.body.newAlerts).toBe(1);

    // Mark alerts as seen
    const seenRes = await request(app)
      .post('/api/notif/alerts/seen')
      .set('Authorization', `Bearer ${libToken}`);
    expect(seenRes.status).toBe(204);

    // After — old overdue loan no longer counts as a new alert
    const after = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);
    expect(after.body.newAlerts).toBe(0);
  });

  it('alert notification seen state persists across multiple fetches', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-A03');
    await createOverdueLoan(item._id, member._id, lib._id);

    // Mark seen
    await request(app)
      .post('/api/notif/alerts/seen')
      .set('Authorization', `Bearer ${libToken}`);

    // Simulate page refresh — should remain 0
    const res1 = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);
    const res2 = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);

    expect(res1.body.newAlerts).toBe(0);
    expect(res2.body.newAlerts).toBe(0);
  });

  it('dismissed alert does not count as a new alert', async () => {
    const lib = await makeLibrarian();
    const member = await makeMember();
    const libToken = await loginAs('lib@example.com');

    const item = await makeItem('NTF-A04');
    const loan = await createOverdueLoan(item._id, member._id, lib._id);

    // Dismiss the alert via the existing dismiss endpoint
    await request(app)
      .post(`/api/alerts/${loan._id}/dismiss`)
      .set('Authorization', `Bearer ${libToken}`);

    const res = await request(app).get('/api/notif').set('Authorization', `Bearer ${libToken}`);
    expect(res.body.newAlerts).toBe(0);
  });
});
