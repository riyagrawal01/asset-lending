import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getLoans, issueLoan, returnLoan, markLoanLost, bulkReturn, getLoanHistory } from '../api/loansApi';

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
  if (isOverdue)              cls += 'badge-overdue';
  else if (status === 'ISSUED')    cls += 'badge-issued';
  else if (status === 'REQUESTED') cls += 'badge-requested';
  else if (status === 'RETURNED')  cls += 'badge-returned';
  else                             cls += 'badge-archived'; // LOST
  return <span className={cls}>{label}</span>;
}

const STATUS_OPTIONS = ['', 'REQUESTED', 'ISSUED', 'RETURNED', 'LOST'];

export default function LoansPage({ user, filter }) {
  const isLibrarian = user.role === 'LIBRARIAN';
  const isAdmin = user.role === 'ADMIN';
  const canViewAll = isLibrarian || isAdmin;

  // Data state
  const [result, setResult]           = useState({ data: [], pagination: null });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Search / filter / pagination (librarian/admin only)
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('');
  const [sort, setSort]               = useState('requestedAt');
  const [order, setOrder]             = useState('desc');
  const [page, setPage]               = useState(1);
  const LIMIT = 20;

  // Client-side search for members (filters the already-fetched own-loans list)
  const [memberSearch, setMemberSearch] = useState('');

  // Debounce search input
  const debounceRef = useRef(null);

  // Issue-in-row state
  const [issuingId, setIssuingId]     = useState(null);
  const [issueDate, setIssueDate]     = useState(defaultDueDateString());
  const [issuing, setIssuing]         = useState(false);

  // Bulk return
  const [selected, setSelected]       = useState(new Set());
  const [bulking, setBulking]         = useState(false);
  const [bulkResult, setBulkResult]   = useState(null);

  // History drawer
  const [historyLoanId, setHistoryLoanId] = useState(null);
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const fetchLoans = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLoans(params);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Build query params and fetch whenever filters change.
  const runQuery = useCallback((overrides = {}) => {
    let params = {};
    if (canViewAll) {
      if (filter === 'requests') {
        params = { status: 'REQUESTED', sort, order, page, limit: LIMIT, ...overrides };
      } else {
        params = {
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          sort,
          order,
          page,
          limit: LIMIT,
          ...overrides,
        };
      }
    }
    fetchLoans(params);
  }, [canViewAll, filter, search, statusFilter, sort, order, page, fetchLoans]);

  useEffect(() => { runQuery(); }, [runQuery]);

  // Debounce the search text changes — avoids a request per keystroke.
  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runQuery({ search: val, page: 1 }), 400);
  }

  // -------------------------------------------------------------------------
  // Loan actions
  // -------------------------------------------------------------------------

  function openIssueForm(loanId) {
    setIssuingId(loanId);
    setIssueDate(defaultDueDateString());
  }

  async function handleIssueConfirm(loanId) {
    if (!issueDate) return;
    setIssuing(true);
    try {
      await issueLoan({ loanId, dueDate: new Date(issueDate).toISOString() });
      setIssuingId(null);
      runQuery();
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
      runQuery();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLost(loanId) {
    if (!window.confirm('Mark this item as lost?')) return;
    try {
      await markLoanLost(loanId);
      runQuery();
    } catch (err) {
      setError(err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Bulk return
  // -------------------------------------------------------------------------

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const issuedIds = displayedLoans.filter(l => l.status === 'ISSUED').map(l => l.id);
    if (issuedIds.every(id => selected.has(id)) && issuedIds.length > 0) {
      setSelected(prev => {
        const next = new Set(prev);
        issuedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        issuedIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  async function handleBulkReturn() {
    if (selected.size === 0) return;
    if (!window.confirm(`Return ${selected.size} loan(s)?`)) return;
    setBulking(true);
    setBulkResult(null);
    try {
      const res = await bulkReturn([...selected]);
      
      // Enhance results with item info so they are readable in the UI
      const enrichedResults = res.results.map(r => {
        const loan = result.data.find(l => l.id === r.loanId);
        return {
          ...r,
          itemTitle: loan?.item?.title || 'Unknown Item',
          itemCode: loan?.item?.code || 'Unknown Code'
        };
      });

      setBulkResult(enrichedResults);
      setSelected(new Set());
      runQuery();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulking(false);
    }
  }

  // -------------------------------------------------------------------------
  // Loan history
  // -------------------------------------------------------------------------

  async function toggleHistory(loanId) {
    if (historyLoanId === loanId) {
      setHistoryLoanId(null);
      return;
    }
    setHistoryLoanId(loanId);
    setHistoryLoading(true);
    try {
      const events = await getLoanHistory(loanId);
      setHistory(events);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Derive display rows
  // -------------------------------------------------------------------------

  // Members get a client-side text filter applied on top of their full list.
  const baseLoans = result.data;

  const filteredLoans = (!canViewAll && memberSearch.trim())
    ? (() => {
        const q = memberSearch.trim().toLowerCase();
        return baseLoans.filter(l =>
          l.item?.title?.toLowerCase().includes(q) ||
          l.item?.code?.toLowerCase().includes(q) ||
          l.status?.toLowerCase().includes(q)
        );
      })()
    : baseLoans;

  // Client-side pagination for members
  const isClientPaginated = !canViewAll;
  const rawDisplayedLoans = isClientPaginated
    ? filteredLoans.slice((page - 1) * LIMIT, page * LIMIT)
    : filteredLoans;
    
  const selectedDisplayed = rawDisplayedLoans.filter(l => selected.has(l.id));
  const unselectedDisplayed = rawDisplayedLoans.filter(l => !selected.has(l.id));
  const displayedLoans = [...selectedDisplayed, ...unselectedDisplayed];

  const totalItems = isClientPaginated ? filteredLoans.length : (result.pagination?.total || 0);
  const totalPages = isClientPaginated ? Math.ceil(filteredLoans.length / LIMIT) : (result.pagination?.totalPages || 1);

  const pageTitle  = filter === 'requests'
    ? 'Loan Requests'
    : (canViewAll ? 'All Loans' : 'My Loans');

  const issuedOnPage = displayedLoans.filter(l => l.status === 'ISSUED');
  const allIssuedSelected = issuedOnPage.length > 0 && issuedOnPage.every(l => selected.has(l.id));

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>{pageTitle}</h1>

        {/* Bulk return button — only relevant on the All Loans view */}
        {isLibrarian && filter !== 'requests' && selected.size > 0 && (
          <button
            className="btn btn-success"
            onClick={handleBulkReturn}
            disabled={bulking}
          >
            {bulking ? 'Returning…' : `Return selected (${selected.size})`}
          </button>
        )}
      </div>
      
      {canViewAll && filter !== 'requests' && (
        <div className="catalogue-toolbar" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search item or borrower…"
            value={search}
            onChange={handleSearchChange}
            style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem', minWidth: '200px' }}
          />
          <select
            value={statusFilter}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            style={{ padding: '0.35rem 0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
          <select
            value={`${sort}:${order}`}
            onChange={e => {
              const [s, o] = e.target.value.split(':');
              setSort(s); setOrder(o); setPage(1);
            }}
            style={{ padding: '0.35rem 0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
          >
            <option value="requestedAt:desc">Newest first</option>
            <option value="requestedAt:asc">Oldest first</option>
            <option value="dueDate:asc">Due soonest</option>
            <option value="dueDate:desc">Due latest</option>
          </select>
        </div>
      )}

      {/* Search bar for members — client-side filter over their own loans */}
      {!canViewAll && (
        <div className="catalogue-toolbar" style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search by item title, code or status…"
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem', minWidth: '240px' }}
          />
          {memberSearch && (
            <button
              className="btn btn-secondary"
              onClick={() => setMemberSearch('')}
              style={{ fontSize: '0.8rem' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {/* Bulk return result summary */}
      {bulkResult && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem' }}>Bulk return complete</strong>
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>{bulkResult.filter(r => r.success).length} succeeded</span>,{' '}
            <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>{bulkResult.filter(r => !r.success).length} failed</span>.
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {bulkResult.map(r => (
              <li key={r.loanId} style={{ padding: '0.3rem 0', borderBottom: '1px solid var(--color-border-light)' }}>
                <strong>{r.itemTitle}</strong> <span style={{ color: 'var(--color-text-muted)' }}>({r.itemCode})</span> —{' '}
                {r.success ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>Success</span>
                ) : (
                  <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>Failed: {r.reason}</span>
                )}
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setBulkResult(null)}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading…</p>
      ) : displayedLoans.length === 0 ? (
        <div className="empty-state">No loans found.</div>
      ) : (
        <>
          <table className="item-table">
            <thead>
              <tr>
                {isLibrarian && filter !== 'requests' && (
                  <th style={{ width: '2rem' }}>
                    <input
                      type="checkbox"
                      title="Select all issued loans"
                      checked={allIssuedSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th>Item</th>
                {canViewAll && <th>Borrower</th>}
                <th>Status</th>
                <th>Requested</th>
                <th>Due Date</th>
                {isLibrarian && <th>Actions</th>}
                <th>History</th>
              </tr>
            </thead>
            <tbody>
              {displayedLoans.map(loan => (
                <React.Fragment key={loan.id}>
                  <tr>
                    {isLibrarian && filter !== 'requests' && (
                      <td>
                        {loan.status === 'ISSUED' && (
                          <input
                            type="checkbox"
                            checked={selected.has(loan.id)}
                            onChange={() => toggleSelect(loan.id)}
                          />
                        )}
                      </td>
                    )}
                    <td>
                      {loan.item?.title}{' '}
                      <span style={{ color: 'var(--color-text-muted)' }}>({loan.item?.code})</span>
                    </td>
                    {canViewAll && <td>{loan.borrower?.name ?? '—'}</td>}
                    <td><StatusBadge status={loan.status} dueDate={loan.dueDate} /></td>
                    <td>{new Date(loan.requestedAt).toLocaleDateString()}</td>
                    <td>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '—'}</td>

                    {isLibrarian && (
                      <td>
                        {loan.status === 'REQUESTED' && (
                          issuingId === loan.id ? (
                            <div className="issue-form">
                              <input
                                type="date"
                                value={issueDate}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={e => setIssueDate(e.target.value)}
                              />
                              <button className="btn btn-primary" onClick={() => handleIssueConfirm(loan.id)} disabled={issuing || !issueDate}>
                                {issuing ? 'Issuing…' : 'Confirm'}
                              </button>
                              <button className="btn btn-secondary" onClick={() => setIssuingId(null)} disabled={issuing}>Cancel</button>
                            </div>
                          ) : (
                            <div className="actions">
                              <button className="btn btn-primary" onClick={() => openIssueForm(loan.id)}>Issue</button>
                            </div>
                          )
                        )}
                        {loan.status === 'ISSUED' && (
                          <div className="actions">
                            <button className="btn btn-success" onClick={() => handleReturn(loan.id)}>Return</button>
                            <button className="btn btn-danger"  onClick={() => handleLost(loan.id)}>Lost</button>
                          </div>
                        )}
                        {(loan.status === 'RETURNED' || loan.status === 'LOST') && (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                    )}

                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => toggleHistory(loan.id)}
                      >
                        {historyLoanId === loan.id ? 'Hide' : 'History'}
                      </button>
                    </td>
                  </tr>

                  {/* Inline history drawer */}
                  {historyLoanId === loan.id && (
                    <tr>
                      <td colSpan={canViewAll ? (isLibrarian ? (filter !== 'requests' ? 8 : 7) : 6) : 5}
                          style={{ background: '#f8fafc', padding: '0.75rem 1.5rem' }}>
                        {historyLoading ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>Loading history…</span>
                        ) : history.length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>No events yet.</span>
                        ) : (
                          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', paddingBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Event</th>
                                <th style={{ textAlign: 'left', paddingBottom: '0.3rem', color: 'var(--color-text-muted)' }}>By</th>
                                <th style={{ textAlign: 'left', paddingBottom: '0.3rem', color: 'var(--color-text-muted)' }}>When</th>
                                <th style={{ textAlign: 'left', paddingBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map(ev => (
                                <tr key={ev.id}>
                                  <td style={{ paddingRight: '1rem' }}><strong>{ev.type}</strong></td>
                                  <td style={{ paddingRight: '1rem' }}>{ev.actor?.name ?? '—'}</td>
                                  <td style={{ paddingRight: '1rem' }}>{new Date(ev.timestamp).toLocaleString()}</td>
                                  <td>{ev.note ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Pagination controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >← Prev</button>
            <span>
              Page {page} of {totalPages || 1}
              {' '}·{' '}
              {totalItems} loan{totalItems !== 1 ? 's' : ''} total
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= (totalPages || 1)}
            >Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
