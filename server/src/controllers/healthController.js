'use strict';

const mongoose = require('mongoose');

/**
 * GET /api/health
 * Returns server and database status.
 * Does not require authentication.
 */
async function healthCheck(req, res) {
  const dbState = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  res.status(200).json({
    status: 'ok',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { healthCheck };
