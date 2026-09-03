'use strict';

const loanService = require('../services/loanService');
const { ROLES } = require('../models/User');

// GET /api/loans
// Librarian: server-side search/filter/paginate over all loans.
// Member: simple list of their own loans (no pagination UI needed for members).
async function getLoans(req, res, next) {
  try {
    if (req.user.role === ROLES.LIBRARIAN) {
      const { search, status, itemId, borrowerId, sort, order, page, limit } = req.query;
      const result = await loanService.searchLoans({
        search, status, itemId, borrowerId, sort, order, page, limit,
      });
      res.json(result);
    } else {
      // Member: own loans only, no pagination
      const loans = await loanService.getLoans({ borrowerId: req.user._id });
      res.json({ data: loans, pagination: null });
    }
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

// POST /api/loans/bulk-return  (librarian only)
async function bulkReturn(req, res, next) {
  try {
    const { loanIds } = req.body;
    if (!Array.isArray(loanIds) || loanIds.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'loanIds must be a non-empty array.' },
      });
    }
    const result = await loanService.bulkReturn(loanIds, req.user._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/loans/:id/history  (authenticated; member sees own only)
async function getLoanHistory(req, res, next) {
  try {
    const events = await loanService.getLoanHistory(req.params.id, req.user);
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

// GET /api/alerts  (librarian only)
async function getAlerts(req, res, next) {
  try {
    const alerts = await loanService.getAlerts();
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
}

// POST /api/alerts/:loanId/dismiss  (librarian only)
async function dismissAlert(req, res, next) {
  try {
    const loan = await loanService.dismissAlert(req.params.loanId, req.user._id);
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
  markLoanLost,
  bulkReturn,
  getLoanHistory,
  getAlerts,
  dismissAlert,
};
