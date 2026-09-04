'use strict';

const { Router } = require('express');
const itemController = require('../controllers/itemController');
const { authenticate, requireRole } = require('../middleware/auth');
const express = require('express');

const router = Router();

// GET /api/items — active catalogue (all authenticated users)
router.get('/', authenticate, itemController.listItems);

// GET /api/items/archived — all items including archived (librarian only)
router.get('/archived', authenticate, requireRole('LIBRARIAN', 'ADMIN'), itemController.listArchivedItems);

// POST /api/items/import — CSV catalogue import (librarian only)
// Uses express.text() to receive the CSV body as a plain string.
router.post(
  '/import',
  authenticate,
  requireRole('LIBRARIAN'),
  express.text({ type: 'text/csv', limit: '2mb' }),
  itemController.importCSV
);

// GET /api/items/export/on-loan — CSV export of currently-issued loans (librarian only)
router.get('/export/on-loan', authenticate, requireRole('LIBRARIAN'), itemController.exportOnLoan);

// Generic item routes — must come AFTER all static paths to avoid /:id capturing them.
router.post('/', authenticate, requireRole('LIBRARIAN'), itemController.createItem);

router.get('/:id', authenticate, itemController.getItem);

router.patch('/:id', authenticate, requireRole('LIBRARIAN'), itemController.updateItem);

router.post('/:id/archive', authenticate, requireRole('LIBRARIAN'), itemController.archiveItem);

router.post('/:id/restore', authenticate, requireRole('LIBRARIAN'), itemController.restoreItem);

module.exports = router;
