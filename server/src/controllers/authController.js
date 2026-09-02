'use strict';

/**
 * Auth controller - thin. Delegates all logic to authService.
 *
 * POST /api/auth/register   create a MEMBER account
 * POST /api/auth/login      authenticate and return a JWT
 * GET  /api/auth/me         return the current user (requires authenticate middleware)
 */

const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const user = await authService.register({ name, email, password });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json(result); // { token, user }
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  // req.user is populated by the authenticate middleware.
  const u = req.user;
  res.status(200).json({
    user: {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    },
  });
}

module.exports = { register, login, me };
