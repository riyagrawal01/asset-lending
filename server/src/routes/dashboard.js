'use strict';

const { Router } = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// GET /api/dashboard — librarian and admin
router.get('/', authenticate, requireRole('LIBRARIAN', 'ADMIN'), dashboardController.getDashboard);

module.exports = router;
