'use strict';

const dashboardService = require('../services/dashboardService');
const { ROLES } = require('../models/User');

/**
 * GET /api/dashboard
 *
 * - MEMBER  → personal borrowing stats (own loans only, no org-wide data)
 * - LIBRARIAN → full org dashboard (summary, weekly returns, by-custodian)
 * - ADMIN   → full org dashboard + userCounts (total users, librarian count)
 */
async function getDashboard(req, res, next) {
  try {
    if (req.user.role === ROLES.MEMBER) {
      const data = await dashboardService.getMemberDashboard(req.user._id);
      return res.json(data);
    }

    const data = await dashboardService.getDashboard();

    if (req.user.role === ROLES.ADMIN) {
      // ADMIN sees everything including userCounts
      return res.json(data);
    }

    // LIBRARIAN: strip userCounts — those are ADMIN-only
    const { userCounts: _omit, ...librarianData } = data;
    return res.json(librarianData);
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
