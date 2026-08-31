'use strict';

const mongoose = require('mongoose');

/**
 * Returns a consistent error response body.
 * Stack traces and internal details are never sent to clients.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;

  // Log server errors; skip expected client errors to keep logs clean
  if (status >= 500) {
    console.error(err);
  }

  // Mongoose validation errors -> 400
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  // Mongoose cast errors (bad ObjectId) -> 400
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'The provided identifier is not valid.',
      },
    });
  }

  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status < 500 ? err.message : 'An unexpected error occurred.',
    },
  });
}

module.exports = errorHandler;
