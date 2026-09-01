'use strict';

/**
 * authService — all authentication business logic.
 *
 * Responsibilities:
 *  - hash passwords with bcrypt
 *  - compare a plaintext password against a stored hash
 *  - sign JWT tokens
 *  - verify JWT tokens
 *  - register a new user (always as MEMBER)
 *  - authenticate a user by email + password and return a token
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, ROLES } = require('../models/User');
const { jwtSecret } = require('../config/env');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '3d';

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

async function comparePassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  // Throws JsonWebTokenError / TokenExpiredError on failure.
  return jwt.verify(token, jwtSecret);
}

// ---------------------------------------------------------------------------
// Domain operations
// ---------------------------------------------------------------------------

/**
 * Register a new MEMBER account.
 *
 * Registrations always create a MEMBER.
 * Users cannot self-assign the LIBRARIAN role.
 *
 * Returns the created user (without passwordHash).
 * Throws with status 409 if email is already taken.
 */
async function register({ name, email, password }) {
  // Validate inputs before touching the database.
  if (!name || typeof name !== 'string' || !name.trim()) {
    const err = new Error('Name is required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!email || typeof email !== 'string' || !email.trim()) {
    const err = new Error('Email is required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('Password must be at least 8 characters.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.status = 409;
    err.code = 'EMAIL_TAKEN';
    throw err;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: ROLES.MEMBER, // Always MEMBER — never user-supplied.
  });

  // Return a safe user object (no hash).
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/**
 * Authenticate a user by email + password.
 *
 * Returns { token, user } on success.
 * Throws with status 401 on bad credentials.
 * Uses the same error message regardless of whether email or password is wrong
 * to avoid leaking which part was incorrect (credential enumeration defence).
 */
async function login({ email, password }) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Explicitly select passwordHash — it has select:false on the schema.
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  const INVALID_MSG = 'Invalid email or password.';

  if (!user) {
    const err = new Error(INVALID_MSG);
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const match = await comparePassword(password, user.passwordHash);
  if (!match) {
    const err = new Error(INVALID_MSG);
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const payload = { sub: user._id.toString(), role: user.role };
  const token = signToken(payload);

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Load a user from the database by id extracted from a verified JWT payload.
 * Returns null if the user no longer exists.
 */
async function getUserById(id) {
  return User.findById(id);
}

module.exports = {
  register,
  login,
  verifyToken,
  getUserById,
  // Exported for testing only:
  hashPassword,
  comparePassword,
};
