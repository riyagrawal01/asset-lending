'use strict';

/**
 * M02 model tests.
 *
 * These tests exercise schema-level validation (required fields, enum values,
 * uniqueness constraints) without connecting to a real database.
 * Mongoose validation runs synchronously on the document before any DB call,
 * so we can call doc.validateSync() or doc.validate() directly.
 */

const mongoose = require('mongoose');
const { User, ROLES }                            = require('../models/User');
const { Item }                                   = require('../models/Item');
const { Loan, LOAN_STATUSES, VALID_TRANSITIONS } = require('../models/Loan');
const { LoanEvent, EVENT_TYPES }                 = require('../models/LoanEvent');
const { ItemCustodian }                          = require('../models/ItemCustodian');

const id = () => new mongoose.Types.ObjectId();

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

describe('User model', () => {
  it('exports ROLES with LIBRARIAN and MEMBER', () => {
    expect(ROLES.LIBRARIAN).toBe('LIBRARIAN');
    expect(ROLES.MEMBER).toBe('MEMBER');
  });

  it('requires name, email, passwordHash, role', () => {
    const doc = new User({});
    const err = doc.validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.passwordHash).toBeDefined();
    expect(err.errors.role).toBeDefined();
  });

  it('rejects an invalid role', () => {
    const doc = new User({ name: 'A', email: 'a@a.com', passwordHash: 'x', role: 'ADMIN' });
    const err = doc.validateSync();
    expect(err.errors.role).toBeDefined();
  });

  it('accepts valid roles', () => {
    for (const role of Object.values(ROLES)) {
      const doc = new User({ name: 'A', email: 'a@a.com', passwordHash: 'x', role });
      expect(doc.validateSync()).toBeUndefined();
    }
  });

  it('lowercases email', () => {
    const doc = new User({ name: 'A', email: 'A@Example.COM', passwordHash: 'x', role: ROLES.MEMBER });
    expect(doc.email).toBe('a@example.com');
  });

  it('excludes passwordHash from results by default (select:false)', () => {
    const path = User.schema.path('passwordHash');
    expect(path.options.select).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

describe('Item model', () => {
  it('requires title, category, code', () => {
    const doc = new Item({});
    const err = doc.validateSync();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.code).toBeDefined();
  });

  it('defaults archived to false', () => {
    const doc = new Item({ title: 'T', category: 'C', code: 'X1' });
    expect(doc.archived).toBe(false);
  });

  it('uppercases code', () => {
    const doc = new Item({ title: 'T', category: 'C', code: 'cam-001' });
    expect(doc.code).toBe('CAM-001');
  });
});

// ---------------------------------------------------------------------------
// Loan
// ---------------------------------------------------------------------------

describe('Loan model', () => {
  it('exports all four persisted statuses', () => {
    expect(Object.keys(LOAN_STATUSES)).toEqual(['REQUESTED', 'ISSUED', 'RETURNED', 'LOST']);
  });

  it('does not include OVERDUE as a persisted status', () => {
    expect(LOAN_STATUSES.OVERDUE).toBeUndefined();
  });

  it('exports VALID_TRANSITIONS', () => {
    expect(VALID_TRANSITIONS.REQUESTED).toEqual(['ISSUED']);
    expect(VALID_TRANSITIONS.ISSUED).toEqual(['RETURNED', 'LOST']);
    expect(VALID_TRANSITIONS.RETURNED).toEqual([]);
    expect(VALID_TRANSITIONS.LOST).toEqual([]);
  });

  it('requires item, borrower, createdBy, requestedAt', () => {
    const doc = new Loan({});
    const err = doc.validateSync();
    expect(err.errors.item).toBeDefined();
    expect(err.errors.borrower).toBeDefined();
    expect(err.errors.createdBy).toBeDefined();
    expect(err.errors.requestedAt).toBeDefined();
  });

  it('defaults status to REQUESTED', () => {
    const doc = new Loan({ item: id(), borrower: id(), createdBy: id(), requestedAt: new Date() });
    expect(doc.status).toBe('REQUESTED');
  });

  it('rejects an invalid status', () => {
    const doc = new Loan({ item: id(), borrower: id(), createdBy: id(), requestedAt: new Date(), status: 'OVERDUE' });
    const err = doc.validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('defaults alertDismissed to false', () => {
    const doc = new Loan({ item: id(), borrower: id(), createdBy: id(), requestedAt: new Date() });
    expect(doc.alertDismissed).toBe(false);
  });

  it('defaults dueDate to null', () => {
    const doc = new Loan({ item: id(), borrower: id(), createdBy: id(), requestedAt: new Date() });
    expect(doc.dueDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LoanEvent
// ---------------------------------------------------------------------------

describe('LoanEvent model', () => {
  it('exports all four event types', () => {
    expect(Object.keys(EVENT_TYPES)).toEqual(['REQUESTED', 'ISSUED', 'RETURNED', 'LOST']);
  });

  it('requires loan, type, actor', () => {
    const doc = new LoanEvent({});
    const err = doc.validateSync();
    expect(err.errors.loan).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.actor).toBeDefined();
  });

  it('rejects an invalid event type', () => {
    const doc = new LoanEvent({ loan: id(), type: 'CANCELLED', actor: id() });
    const err = doc.validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('defaults timestamp to now', () => {
    const before = Date.now();
    const doc = new LoanEvent({ loan: id(), type: 'REQUESTED', actor: id() });
    const after = Date.now();
    expect(doc.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(doc.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('has no updatedAt path (immutable events)', () => {
    // updatedAt would be present if timestamps:{updatedAt:true}
    const path = LoanEvent.schema.path('updatedAt');
    expect(path).toBeUndefined();
  });

  it('defaults note to null', () => {
    const doc = new LoanEvent({ loan: id(), type: 'ISSUED', actor: id() });
    expect(doc.note).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ItemCustodian
// ---------------------------------------------------------------------------

describe('ItemCustodian model', () => {
  it('requires item and librarian', () => {
    const doc = new ItemCustodian({});
    const err = doc.validateSync();
    expect(err.errors.item).toBeDefined();
    expect(err.errors.librarian).toBeDefined();
  });

  it('accepts a valid item+librarian pair', () => {
    const doc = new ItemCustodian({ item: id(), librarian: id() });
    expect(doc.validateSync()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Index declarations (inspected from schema, not the live DB)
// ---------------------------------------------------------------------------

describe('Index declarations', () => {
  function indexKeys(model) {
    // schema.indexes() returns [[fields, options], ...]
    return model.schema.indexes().map(([fields]) => Object.keys(fields).join('+'));
  }

  it('User has email index', () => {
    expect(indexKeys(User)).toContain('email');
  });

  it('Item has code index', () => {
    expect(indexKeys(Item)).toContain('code');
  });

  it('Loan has item+status index', () => {
    expect(indexKeys(Loan)).toContain('item+status');
  });

  it('Loan has borrower+status index', () => {
    expect(indexKeys(Loan)).toContain('borrower+status');
  });

  it('Loan has status+dueDate index', () => {
    expect(indexKeys(Loan)).toContain('status+dueDate');
  });

  it('LoanEvent has loan+timestamp index', () => {
    expect(indexKeys(LoanEvent)).toContain('loan+timestamp');
  });

  it('ItemCustodian has item+librarian index (unique)', () => {
    const idx = ItemCustodian.schema.indexes();
    const found = idx.find(([fields, opts]) =>
      Object.keys(fields).join('+') === 'item+librarian' && opts.unique
    );
    expect(found).toBeDefined();
  });

  it('ItemCustodian compound index covers item lookups via leading key', () => {
    // The compound { item: 1, librarian: 1 } index supports item-only queries
    // because item is the leading field. A separate { item: 1 } index is redundant.
    const idx = ItemCustodian.schema.indexes();
    const leading = idx.find(([fields]) => Object.keys(fields)[0] === 'item');
    expect(leading).toBeDefined();
  });

  it('ItemCustodian has librarian index', () => {
    expect(indexKeys(ItemCustodian)).toContain('librarian');
  });
});

