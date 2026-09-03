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

module.exports = {
  requestLoan,
  issueDirectLoan,
  issueRequestedLoan,
  returnLoan,
  markLoanLost,
  getLoans
};
