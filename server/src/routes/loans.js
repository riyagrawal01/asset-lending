'use strict';

const { Router } = require('express');
const loanController = require('../controllers/loanController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// GET /api/loans - view loans (member sees own, librarian sees all)
router.get('/', loanController.getLoans);

router.post('/request', requireRole('MEMBER'), loanController.requestLoan);

// POST /api/loans/issue - issue a loan (librarian only)
// Body can have { loanId, dueDate, note } OR { itemId, borrowerId, dueDate, note }
router.post('/issue', requireRole('LIBRARIAN'), loanController.issueLoan);

// POST /api/loans/:id/return - return an issued loan (librarian only)
router.post('/:id/return', requireRole('LIBRARIAN'), loanController.returnLoan);

// POST /api/loans/:id/lost - mark an issued loan lost (librarian only)
router.post('/:id/lost', requireRole('LIBRARIAN'), loanController.markLoanLost);

module.exports = router;
