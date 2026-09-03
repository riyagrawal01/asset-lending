'use strict';

const loanService = require('../services/loanService');
const { ROLES } = require('../models/User');

async function getLoans(req, res, next) {
  try {
    const filters = {};
    if (req.user.role === ROLES.MEMBER) {
      filters.borrowerId = req.user._id;
    }
    
    const loans = await loanService.getLoans(filters);
    res.json({ loans });
  } catch (err) {
    next(err);
  }
}

async function requestLoan(req, res, next) {
  try {
    const { itemId } = req.body;
    const loan = await loanService.requestLoan(itemId, req.user._id);
    res.status(201).json({ loan });
  } catch (err) {
    next(err);
  }
}

async function issueLoan(req, res, next) {
  try {
    const { itemId, borrowerId, loanId, dueDate, note } = req.body;
    
    let loan;
    if (loanId) {
      loan = await loanService.issueRequestedLoan(loanId, dueDate, req.user._id, note);
    } else {
      loan = await loanService.issueDirectLoan(itemId, borrowerId, dueDate, req.user._id, note);
    }
    
    res.status(200).json({ loan });
  } catch (err) {
    next(err);
  }
}

async function returnLoan(req, res, next) {
  try {
    const { note } = req.body;
    const loan = await loanService.returnLoan(req.params.id, req.user._id, note);
    res.json({ loan });
  } catch (err) {
    next(err);
  }
}

async function markLoanLost(req, res, next) {
  try {
    const { note } = req.body;
    const loan = await loanService.markLoanLost(req.params.id, req.user._id, note);
    res.json({ loan });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLoans,
  requestLoan,
  issueLoan,
  returnLoan,
  markLoanLost
};
