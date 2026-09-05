'use strict';

const { Router } = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

const router = Router();

// GET /api/dashboard — all authenticated roles.
// The controller returns role-appropriate data:
//   MEMBER    → personal borrowing stats (own data only)
//   LIBRARIAN → org-wide summary (no user counts)
//   ADMIN     → org-wide summary + userCounts
router.get('/', authenticate, dashboardController.getDashboard);

module.exports = router;
