'use strict';

const mongoose = require('mongoose');
const { Loan, LOAN_STATUSES, VALID_TRANSITIONS } = require('../models/Loan');
const { LoanEvent, EVENT_TYPES } = require('../models/LoanEvent');
const { Item } = require('../models/Item');
const { User, ROLES } = require('../models/User');

function appError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function toLoanDTO(doc) {
  return {
    id: doc._id,
    item: doc.item,
    borrower: doc.borrower,
    createdBy: doc.createdBy,
    status: doc.status,
    requestedAt: doc.requestedAt,
    dueDate: doc.dueDate,
    alertDismissed: doc.alertDismissed,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function checkItemAvailability(itemId) {
  const item = await Item.findById(itemId);
  if (!item) {
    throw appError('Item not found.', 404, 'ITEM_NOT_FOUND');
  }
  
  const openLoan = await Loan.findOne({
    item: itemId,
    status: { $in: [LOAN_STATUSES.REQUESTED, LOAN_STATUSES.ISSUED] }
  });
  
  if (openLoan) {
    throw appError('Item is currently unavailable.', 409, 'ITEM_UNAVAILABLE');
  }
  return item;
}

function handleDuplicateKeyError(err) {
  if (err.code === 11000) {
    throw appError('Item is currently unavailable.', 409, 'ITEM_UNAVAILABLE');
  }
  throw err;
}

async function executeWithFallback(executeOp) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await executeOp({ session });
    });
  } catch (err) {
    if (
      err.code === 20 || 
      (err.message && err.message.includes('Transaction numbers are only allowed'))
    ) {
      console.warn('MongoDB standalone detected. Executing without transaction.');
      await executeOp({});
    } else {
      throw err;
    }
  } finally {
    session.endSession();
  }
}

// ---------------------------------------------------------------------------
// M05 — Loan lifecycle
// ---------------------------------------------------------------------------

async function requestLoan(itemId, borrowerId) {
  await checkItemAvailability(itemId);

  let result;
  await executeWithFallback(async (opts) => {
    const loan = new Loan({
      item: itemId,
      borrower: borrowerId,
      createdBy: borrowerId,
      status: LOAN_STATUSES.REQUESTED,
      requestedAt: new Date(),
      alertDismissed: false
    });
    
    await loan.save(opts);
    
    const event = new LoanEvent({
      loan: loan._id,
      type: EVENT_TYPES.REQUESTED,
      actor: borrowerId
    });
    
    await event.save(opts);
    result = toLoanDTO(loan);
  }).catch(handleDuplicateKeyError);
  
  return result;
}

async function issueDirectLoan(itemId, borrowerId, dueDate, actorId, note) {
  if (!dueDate) {
    throw appError('Due date is required when issuing a loan.', 400, 'VALIDATION_ERROR');
  }

  await checkItemAvailability(itemId);

  let result;
  await executeWithFallback(async (opts) => {
    const requestedAt = new Date();
    const loan = new Loan({
      item: itemId,
      borrower: borrowerId,
      createdBy: actorId,
      status: LOAN_STATUSES.ISSUED,
      requestedAt: requestedAt,
      dueDate: dueDate,
      alertDismissed: false
    });
    
    await loan.save(opts);
    
    const event = new LoanEvent({
      loan: loan._id,
      type: EVENT_TYPES.ISSUED,
      actor: actorId,
      note: note
    });
    
    await event.save(opts);
    result = toLoanDTO(loan);
  }).catch(handleDuplicateKeyError);
  
  return result;
}

async function issueRequestedLoan(loanId, dueDate, actorId, note) {
  if (!dueDate) {
    throw appError('Due date is required when issuing a loan.', 400, 'VALIDATION_ERROR');
  }

  let result;
  await executeWithFallback(async (opts) => {
    const loan = await Loan.findById(loanId, null, opts);
    if (!loan) {
      throw appError('Loan not found.', 404, 'LOAN_NOT_FOUND');
    }
    
    if (!VALID_TRANSITIONS[loan.status].includes(LOAN_STATUSES.ISSUED)) {
      throw appError(`Cannot transition loan from ${loan.status} to ${LOAN_STATUSES.ISSUED}.`, 409, 'INVALID_TRANSITION');
    }
    
    loan.status = LOAN_STATUSES.ISSUED;
    loan.dueDate = dueDate;
    await loan.save(opts);
    
    const event = new LoanEvent({
      loan: loan._id,
      type: EVENT_TYPES.ISSUED,
      actor: actorId,
      note: note
    });
    
    await event.save(opts);
    result = toLoanDTO(loan);
  }).catch(handleDuplicateKeyError);
  
  return result;
}

async function returnLoan(loanId, actorId, note) {
  let result;
  await executeWithFallback(async (opts) => {
    const loan = await Loan.findById(loanId, null, opts);
    if (!loan) {
      throw appError('Loan not found.', 404, 'LOAN_NOT_FOUND');
    }
    
    if (!VALID_TRANSITIONS[loan.status].includes(LOAN_STATUSES.RETURNED)) {
      throw appError(`Cannot transition loan from ${loan.status} to ${LOAN_STATUSES.RETURNED}.`, 409, 'INVALID_TRANSITION');
    }
    
    loan.status = LOAN_STATUSES.RETURNED;
    await loan.save(opts);
    
    const event = new LoanEvent({
      loan: loan._id,
      type: EVENT_TYPES.RETURNED,
      actor: actorId,
      note: note
    });
    
    await event.save(opts);
    result = toLoanDTO(loan);
  });
  
  return result;
}

async function markLoanLost(loanId, actorId, note) {
  let result;
  await executeWithFallback(async (opts) => {
    const loan = await Loan.findById(loanId, null, opts);
    if (!loan) {
      throw appError('Loan not found.', 404, 'LOAN_NOT_FOUND');
    }
    
    if (!VALID_TRANSITIONS[loan.status].includes(LOAN_STATUSES.LOST)) {
      throw appError(`Cannot transition loan from ${loan.status} to ${LOAN_STATUSES.LOST}.`, 409, 'INVALID_TRANSITION');
    }
    
    loan.status = LOAN_STATUSES.LOST;
    await loan.save(opts);
    
    const event = new LoanEvent({
      loan: loan._id,
      type: EVENT_TYPES.LOST,
      actor: actorId,
      note: note
    });
    
    await event.save(opts);
    result = toLoanDTO(loan);
  });
  
  return result;
}

// ---------------------------------------------------------------------------
// M06 — Search / filter / paginate
//
// The query is built in stages so that all filtering happens in the database:
//
//  1. If a text search is provided, find matching Item IDs and User IDs first,
//     then restrict the loan query to those IDs. This avoids downloading all
//     loans to filter in JavaScript.
//  2. Build the Loan filter from the resolved IDs plus any explicit filters
//     (status, itemId, borrowerId).
//  3. Run a countDocuments() and a find() with skip/limit in parallel so that
//     the total is accurate even when paginating.
//  4. Populate item and borrower fields.
// ---------------------------------------------------------------------------

async function searchLoans({
  search = '',
  status,
  itemId,
  borrowerId,
  sort = 'requestedAt',
  order = 'desc',
  page = 1,
  limit = 20,
} = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Step 1 — resolve search term against items and users.
  const filter = {};

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const [matchingItems, matchingUsers] = await Promise.all([
      Item.find({ title: regex }, '_id').lean(),
      User.find({ name: regex }, '_id').lean(),
    ]);
    const itemIds = matchingItems.map((i) => i._id);
    const userIds = matchingUsers.map((u) => u._id);

    // A loan matches if its item OR its borrower matches the search term.
    filter.$or = [
      { item: { $in: itemIds } },
      { borrower: { $in: userIds } },
    ];
  }

  // Step 2 — explicit field filters (override search when both provided).
  if (status) filter.status = status;
  if (itemId) filter.item = itemId;
  if (borrowerId) filter.borrower = borrowerId;

  // Step 3 — sort direction.
  const SORTABLE = new Set(['requestedAt', 'dueDate', 'status', 'createdAt', 'updatedAt']);
  const sortField = SORTABLE.has(sort) ? sort : 'requestedAt';
  const sortDir = order === 'asc' ? 1 : -1;

  // Step 4 — count + fetch in parallel.
  //
  // Special case: when sorting by dueDate, a plain Mongoose .sort({ dueDate: 1 })
  // puts null/missing dueDate documents FIRST (MongoDB null < any date).
  // The requirement is that loans with no dueDate must always appear AFTER loans
  // that have one, regardless of sort direction.
  //
  // To achieve this we switch to an aggregation pipeline that adds a sentinel
  // field (_dueSortKey) equal to the max possible Date for null-dueDate loans,
  // ensuring they always sort to the end.
  const MAX_DATE = new Date(8640000000000000); // JS max date

  let fetchPromise;
  if (sortField === 'dueDate') {
    fetchPromise = Loan.aggregate([
      { $match: filter },
      {
        $addFields: {
          _dueSortKey: {
            $cond: {
              if: { $ifNull: ['$dueDate', false] },
              then: '$dueDate',
              else: MAX_DATE,
            },
          },
        },
      },
      { $sort: { _dueSortKey: sortDir, _id: 1 } },
      { $skip: skip },
      { $limit: limitNum },
      // Populate item and borrower via $lookup
      {
        $lookup: {
          from: 'items',
          localField: 'item',
          foreignField: '_id',
          as: '_itemDoc',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'borrower',
          foreignField: '_id',
          as: '_borrowerDoc',
        },
      },
      {
        $addFields: {
          item: {
            $let: {
              vars: { i: { $arrayElemAt: ['$_itemDoc', 0] } },
              in: { _id: '$$i._id', title: '$$i.title', code: '$$i.code', category: '$$i.category' },
            },
          },
          borrower: {
            $let: {
              vars: { u: { $arrayElemAt: ['$_borrowerDoc', 0] } },
              in: { _id: '$$u._id', name: '$$u.name', email: '$$u.email' },
            },
          },
        },
      },
      { $project: { _itemDoc: 0, _borrowerDoc: 0, _dueSortKey: 0 } },
    ]);
  } else {
    fetchPromise = Loan.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limitNum)
      .populate('item', 'title code category')
      .populate('borrower', 'name email')
      .lean();
  }

  const [total, docs] = await Promise.all([
    Loan.countDocuments(filter),
    fetchPromise,
  ]);

  const data = docs.map((doc) => ({
    id: doc._id,
    item: doc.item,
    borrower: doc.borrower,
    createdBy: doc.createdBy,
    status: doc.status,
    requestedAt: doc.requestedAt,
    dueDate: doc.dueDate,
    alertDismissed: doc.alertDismissed,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

// ---------------------------------------------------------------------------
// M06 — Simple un-paginated loan list for members (own loans only).
//        The existing M05 endpoint only supported this use-case. Kept for
//        backward compatibility; the controller chooses which function to call.
// ---------------------------------------------------------------------------

async function getLoans(filters) {
  const query = {};
  if (filters.borrowerId) query.borrower = filters.borrowerId;
  
  const loans = await Loan.find(query)
    .populate('item', 'title code category')
    .populate('borrower', 'name email')
    .sort({ requestedAt: -1 });
    
  return loans.map(doc => {
    const dto = toLoanDTO(doc);
    dto.item = doc.item;
    dto.borrower = doc.borrower;
    return dto;
  });
}

// ---------------------------------------------------------------------------
// M06 — Bulk return
//
// Processes each loan independently. One failure does not stop the others.
// Each successful return still goes through the existing returnLoan() logic
// so that normal lifecycle validation and LoanEvent creation occur.
// ---------------------------------------------------------------------------

async function bulkReturn(loanIds, actorId) {
  const results = [];

  for (const loanId of loanIds) {
    try {
      await returnLoan(loanId, actorId);
      results.push({ loanId, success: true });
    } catch (err) {
      results.push({ loanId, success: false, reason: err.message });
    }
  }

  return { results };
}

// ---------------------------------------------------------------------------
// M06 — Loan history
//
// Returns the LoanEvent timeline for a single loan in chronological order.
// Members may only view history for their own loans.
// ---------------------------------------------------------------------------

async function getLoanHistory(loanId, requestingUser) {
  const loan = await Loan.findById(loanId);
  if (!loan) {
    throw appError('Loan not found.', 404, 'LOAN_NOT_FOUND');
  }

  // Members may only see their own loan history.
  if (
    requestingUser.role === ROLES.MEMBER &&
    loan.borrower.toString() !== requestingUser._id.toString()
  ) {
    throw appError('Access denied.', 403, 'FORBIDDEN');
  }

  const events = await LoanEvent.find({ loan: loanId })
    .sort({ timestamp: 1 })
    .populate('actor', 'name email role');

  return events.map((e) => ({
    id: e._id,
    type: e.type,
    actor: e.actor,
    timestamp: e.timestamp,
    note: e.note,
  }));
}

// ---------------------------------------------------------------------------
// M06 — Overdue alerts
//
// An active alert is a loan where:
//   status === ISSUED  AND  dueDate < now  AND  alertDismissed !== true
// ---------------------------------------------------------------------------

async function getAlerts() {
  const now = new Date();
  const loans = await Loan.find({
    status: LOAN_STATUSES.ISSUED,
    dueDate: { $lt: now },
    alertDismissed: { $ne: true },
  })
    .populate('item', 'title code category')
    .populate('borrower', 'name email')
    .sort({ dueDate: 1 }) // most overdue first
    .lean();

  return loans.map((doc) => ({
    id: doc._id,
    item: doc.item,
    borrower: doc.borrower,
    status: doc.status,
    dueDate: doc.dueDate,
    requestedAt: doc.requestedAt,
    alertDismissed: doc.alertDismissed,
  }));
}

async function dismissAlert(loanId, actorId) {
  const loan = await Loan.findById(loanId);
  if (!loan) {
    throw appError('Loan not found.', 404, 'LOAN_NOT_FOUND');
  }
  if (loan.status !== LOAN_STATUSES.ISSUED) {
    throw appError('Only issued loans can have alerts dismissed.', 409, 'INVALID_OPERATION');
  }

  loan.alertDismissed = true;
  await loan.save();

  return toLoanDTO(loan);
}

module.exports = {
  // M05
  requestLoan,
  issueDirectLoan,
  issueRequestedLoan,
  returnLoan,
  markLoanLost,
  getLoans,
  // M06
  searchLoans,
  bulkReturn,
  getLoanHistory,
  getAlerts,
  dismissAlert,
};
