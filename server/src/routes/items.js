'use strict';

const { Router } = require('express');
const itemController = require('../controllers/itemController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = Router();


router.get('/', authenticate, itemController.listItems);

router.get('/archived', authenticate, requireRole('LIBRARIAN'), itemController.listArchivedItems);

router.post('/', authenticate, requireRole('LIBRARIAN'), itemController.createItem);

router.get('/:id', authenticate, itemController.getItem);

router.patch('/:id', authenticate, requireRole('LIBRARIAN'), itemController.updateItem);

router.post('/:id/archive', authenticate, requireRole('LIBRARIAN'), itemController.archiveItem);

router.post('/:id/restore', authenticate, requireRole('LIBRARIAN'), itemController.restoreItem);

module.exports = router;
