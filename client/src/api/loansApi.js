import { api } from './client';

export async function getLoans() {
  const { loans } = await api.get('/loans');
  return loans;
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
