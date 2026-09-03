'use strict';

const { Router } = require('express');
const loanController = require('../controllers/loanController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// GET /api/loans — librarian: search/filter/paginate all; member: own loans
router.get('/', loanController.getLoans);

// POST /api/loans/request — member requests an item
router.post('/request', requireRole('MEMBER'), loanController.requestLoan);

// POST /api/loans/issue — librarian issues a loan
router.post('/issue', requireRole('LIBRARIAN'), loanController.issueLoan);

// POST /api/loans/bulk-return — librarian bulk-returns a list of loans
router.post('/bulk-return', requireRole('LIBRARIAN'), loanController.bulkReturn);

// POST /api/loans/:id/return — return a single loan
router.post('/:id/return', requireRole('LIBRARIAN'), loanController.returnLoan);

// POST /api/loans/:id/lost — mark a single loan lost
router.post('/:id/lost', requireRole('LIBRARIAN'), loanController.markLoanLost);

// GET /api/loans/:id/history — loan event timeline (member: own only)
router.get('/:id/history', loanController.getLoanHistory);

module.exports = router;
