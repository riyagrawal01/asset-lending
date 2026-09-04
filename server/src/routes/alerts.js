'use strict';

const { Router } = require('express');
const loanController = require('../controllers/loanController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);

// GET /api/alerts — active overdue alerts (librarian and admin)
router.get('/', requireRole('LIBRARIAN', 'ADMIN'), loanController.getAlerts);

// POST /api/alerts/:loanId/dismiss — dismiss a specific loan's alert (librarian only)
router.post('/:loanId/dismiss', requireRole('LIBRARIAN'), loanController.dismissAlert);

module.exports = router;
