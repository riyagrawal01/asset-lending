'use strict';

const notifService = require('../services/notifService');

// GET /api/notif — return unseen notification counts for the authenticated librarian
async function getNotifCounts(req, res, next) {
  try {
    const counts = await notifService.getNotifCounts(req.user._id);
    res.json(counts);
  } catch (err) {
    next(err);
  }
}

// POST /api/notif/requests/seen — mark pending requests as viewed
async function markRequestsSeen(req, res, next) {
  try {
    await notifService.markRequestsSeen(req.user._id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /api/notif/alerts/seen — mark alerts as viewed
async function markAlertsSeen(req, res, next) {
  try {
    await notifService.markAlertsSeen(req.user._id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { getNotifCounts, markRequestsSeen, markAlertsSeen };
