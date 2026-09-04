'use strict';

const { Router } = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middleware/auth');
const { ROLES } = require('../models/User');

const router = Router();

// All routes require ADMIN role
router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/users', adminController.getUsers);
router.patch('/users/:id/role', adminController.updateUserRole);

router.get('/items/:id/custodians', adminController.getCustodians);
router.put('/items/:id/custodians', adminController.setCustodians);

module.exports = router;
