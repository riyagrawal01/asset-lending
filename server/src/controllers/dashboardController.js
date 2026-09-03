'use strict';

const dashboardService = require('../services/dashboardService');

async function getDashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboard();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
