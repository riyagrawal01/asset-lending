import React, { useEffect, useState, useCallback } from 'react';
import { getLoans, issueLoan, returnLoan, markLoanLost } from '../api/loansApi';

// Default due date = today + 7 days, formatted for <input type="date">
function defaultDueDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ status, dueDate }) {
  const isOverdue = status === 'ISSUED' && dueDate && new Date(dueDate) < new Date();
  const label = isOverdue ? 'OVERDUE' : status;
  let cls = 'badge ';
  if (isOverdue)         cls += 'badge-overdue';
  else if (status === 'ISSUED')    cls += 'badge-issued';
  else if (status === 'REQUESTED') cls += 'badge-requested';
  else if (status === 'RETURNED')  cls += 'badge-returned';
  else                             cls += 'badge-archived'; // LOST
  return <span className={cls}>{label}</span>;
}

export default function LoansPage({ user, filter }) {
  const isLibrarian = user.role === 'LIBRARIAN';

  const [loans, setLoans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  // Which loan row is showing the inline issue form
  const [issuingId, setIssuingId]     = useState(null);
  const [issueDate, setIssueDate]     = useState(defaultDueDateString());
  const [issuing, setIssuing]         = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoans();
      setLoans(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  function openIssueForm(loanId) {
    setIssuingId(loanId);
    setIssueDate(defaultDueDateString());
  }

  function cancelIssueForm() {
    setIssuingId(null);
  }

  async function handleIssueConfirm(loanId) {
    if (!issueDate) {
      setError('Please select a due date.');
      return;
    }
    setIssuing(true);
    try {
      await issueLoan({ loanId, dueDate: new Date(issueDate).toISOString() });
      setIssuingId(null);
      await fetchLoans();
    } catch (err) {
      setError(err.message);
    } finally {
      setIssuing(false);
    }
  }

  async function handleReturn(loanId) {
    if (!window.confirm('Mark this loan as returned?')) return;
    try {
      await returnLoan(loanId);
      fetchLoans();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLost(loanId) {
    if (!window.confirm('Mark this item as lost?')) return;
    try {
      await markLoanLost(loanId);
      fetchLoans();
    } catch (err) {
      setError(err.message);
    }
  }

  // Requests view: only REQUESTED loans; All Loans view: everything
  const displayedLoans = filter === 'requests'
    ? loans.filter(l => l.status === 'REQUESTED')
    : loans;

  const pageTitle = filter === 'requests'
    ? 'Loan Requests'
    : isLibrarian ? 'All Loans' : 'My Loans';

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>{pageTitle}</h1>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading…</p>
      ) : displayedLoans.length === 0 ? (
        <div className="empty-state">No loans found.</div>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>Item</th>
              {isLibrarian && <th>Borrower</th>}
              <th>Status</th>
              <th>Requested</th>
              <th>Due Date</th>
              {isLibrarian && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayedLoans.map(loan => (
              <tr key={loan.id}>
                <td>{loan.item?.title} <span style={{ color: 'var(--color-text-muted)' }}>({loan.item?.code})</span></td>
                {isLibrarian && <td>{loan.borrower?.name ?? '—'}</td>}
                <td>
                  <StatusBadge status={loan.status} dueDate={loan.dueDate} />
                </td>
                <td>{new Date(loan.requestedAt).toLocaleDateString()}</td>
                <td>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '—'}</td>

                {isLibrarian && (
                  <td>
                    {/* REQUESTED — show Issue button or inline date picker */}
                    {loan.status === 'REQUESTED' && (
                      issuingId === loan.id ? (
                        <div className="issue-form">
                          <input
                            type="date"
                            value={issueDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={e => setIssueDate(e.target.value)}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => handleIssueConfirm(loan.id)}
                            disabled={issuing || !issueDate}
                          >
                            {issuing ? 'Issuing…' : 'Confirm'}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={cancelIssueForm}
                            disabled={issuing}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => openIssueForm(loan.id)}
                          >
                            Issue
                          </button>
                        </div>
                      )
                    )}

                    {/* ISSUED — Return / Lost */}
                    {loan.status === 'ISSUED' && (
                      <div className="actions">
                        <button className="btn btn-success" onClick={() => handleReturn(loan.id)}>Return</button>
                        <button className="btn btn-danger"  onClick={() => handleLost(loan.id)}>Lost</button>
                      </div>
                    )}

                    {/* Terminal states — no actions */}
                    {(loan.status === 'RETURNED' || loan.status === 'LOST') && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
