'use strict';

/**
 * Authentication and authorization middleware.
 *
 * authenticate  — verifies the JWT and attaches req.user
 * requireRole   — factory that returns a middleware restricting access to given roles
 */

const { verifyToken, getUserById } = require('../services/authService');

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * On success, attaches the full user document to req.user and calls next().
 * On failure, responds with 401 — never calls next(err) so that downstream
 * error handlers do not accidentally leak details.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or has expired.' },
    });
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
    });
  }

  req.user = user;
  next();
}

/**
 * Role-based authorization middleware factory.
 *
 * Usage:
 *   router.post('/something', authenticate, requireRole('LIBRARIAN'), controller)
 *
 * @param {...string} roles — one or more allowed roles
 */
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      // Defensive: authenticate should always run first.
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
        },
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
