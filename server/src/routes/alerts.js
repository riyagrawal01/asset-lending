'use strict';

const { Router } = require('express');
const loanController = require('../controllers/loanController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

router.use(authenticate);
router.use(requireRole('LIBRARIAN'));

// GET /api/alerts — active overdue alerts (librarian only)
router.get('/', loanController.getAlerts);

// POST /api/alerts/:loanId/dismiss — dismiss a specific loan's alert
router.post('/:loanId/dismiss', loanController.dismissAlert);

module.exports = router;
