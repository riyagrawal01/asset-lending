// notifApi — client-side functions for the librarian notification endpoints.

import { api } from './client';

/** Returns { newRequests: number, newAlerts: number } for the authenticated librarian. */
export async function getNotifCounts() {
  return api.get('/notif');
}

/** Marks pending-requests page as viewed (clears the Requests dot). */
export async function markRequestsSeen() {
  return api.post('/notif/requests/seen');
}

/** Marks alerts page as viewed (clears the Alerts dot). */
export async function markAlertsSeen() {
  return api.post('/notif/alerts/seen');
}
