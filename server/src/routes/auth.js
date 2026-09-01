'use strict';

const { Router } = require('express');
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = Router();

// POST /api/auth/register — create a new MEMBER account
router.post('/register', register);

// POST /api/auth/login — authenticate and receive a JWT
router.post('/login', login);

// GET /api/auth/me — return current user (requires valid JWT)
router.get('/me', authenticate, me);

module.exports = router;
