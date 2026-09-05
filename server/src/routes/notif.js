'use strict';

const { Router } = require('express');
const notifController = require('../controllers/notifController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();

// All notif routes require authentication and LIBRARIAN role.
// Notification dots are specifically a LIBRARIAN feature.
router.use(authenticate, requireRole('LIBRARIAN'));

// GET  /api/notif              — return { newRequests, newAlerts } counts
router.get('/', notifController.getNotifCounts);

// POST /api/notif/requests/seen — mark pending-requests page as viewed
router.post('/requests/seen', notifController.markRequestsSeen);

// POST /api/notif/alerts/seen   — mark alerts page as viewed
router.post('/alerts/seen', notifController.markAlertsSeen);

module.exports = router;
