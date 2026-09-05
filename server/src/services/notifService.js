'use strict';

/**
 * notifService — Librarian notification dot state.
 *
 * A notification is "new" if a relevant document was created/became active
 * AFTER the librarian's stored `notifRequestsSeenAt` / `notifAlertsSeenAt`
 * timestamp. null means "never viewed" — treat as epoch (all items are new).
 *
 * Marking seen records the current timestamp. Next fetch compares against it.
 */

const { Loan, LOAN_STATUSES } = require('../models/Loan');
const { User } = require('../models/User');

const EPOCH = new Date(0); // 1970-01-01T00:00:00Z

/**
 * Returns notification counts for a single LIBRARIAN user.
 *
 * @param {string|ObjectId} userId
 * @returns {{ newRequests: number, newAlerts: number }}
 */
async function getNotifCounts(userId) {
  const user = await User.findById(userId).select('notifRequestsSeenAt notifAlertsSeenAt').lean();
  if (!user) return { newRequests: 0, newAlerts: 0 };

  const requestsSince = user.notifRequestsSeenAt ?? EPOCH;
  const alertsSince   = user.notifAlertsSeenAt   ?? EPOCH;
  const now = new Date();

  const [newRequests, newAlerts] = await Promise.all([
    // Pending requests created after the librarian last viewed Requests
    Loan.countDocuments({
      status: LOAN_STATUSES.REQUESTED,
      createdAt: { $gt: requestsSince },
    }),

    // Active overdue-alert loans that became overdue (or were updated) after
    // the librarian last viewed Alerts AND haven't been dismissed
    Loan.countDocuments({
      status: LOAN_STATUSES.ISSUED,
      dueDate: { $lt: now },
      alertDismissed: { $ne: true },
      updatedAt: { $gt: alertsSince },
    }),
  ]);

  return { newRequests, newAlerts };
}

/**
 * Records that the librarian has now viewed Requests.
 * Subsequent calls to getNotifCounts will not count older requests as new.
 */
async function markRequestsSeen(userId) {
  await User.findByIdAndUpdate(userId, { notifRequestsSeenAt: new Date() });
}

/**
 * Records that the librarian has now viewed Alerts.
 * Subsequent calls to getNotifCounts will not count older alerts as new.
 */
async function markAlertsSeen(userId) {
  await User.findByIdAndUpdate(userId, { notifAlertsSeenAt: new Date() });
}

module.exports = { getNotifCounts, markRequestsSeen, markAlertsSeen };
