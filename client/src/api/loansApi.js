/**
 * loansApi — client-side functions for loan endpoints.
 */

import { api } from './client';

// GET /api/loans
// Librarian: accepts query params { search, status, itemId, borrowerId, sort, order, page, limit }
// Member: no params needed (server scopes to own loans)
export async function getLoans(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const query = qs.toString() ? `?${qs}` : '';
  return api.get(`/loans${query}`);
}

export async function requestLoan(itemId) {
  const { loan } = await api.post('/loans/request', { itemId });
  return loan;
}

export async function issueLoan({ itemId, borrowerId, loanId, dueDate, note }) {
  const { loan } = await api.post('/loans/issue', { itemId, borrowerId, loanId, dueDate, note });
  return loan;
}

export async function returnLoan(loanId, note) {
  const { loan } = await api.post(`/loans/${loanId}/return`, { note });
  return loan;
}

export async function markLoanLost(loanId, note) {
  const { loan } = await api.post(`/loans/${loanId}/lost`, { note });
  return loan;
}

// POST /api/loans/bulk-return
export async function bulkReturn(loanIds) {
  return api.post('/loans/bulk-return', { loanIds });
}

// GET /api/loans/:id/history
export async function getLoanHistory(loanId) {
  const { events } = await api.get(`/loans/${loanId}/history`);
  return events;
}

// GET /api/alerts
export async function getAlerts() {
  const { alerts } = await api.get('/alerts');
  return alerts;
}

// POST /api/alerts/:loanId/dismiss
export async function dismissAlert(loanId) {
  return api.post(`/alerts/${loanId}/dismiss`);
}
