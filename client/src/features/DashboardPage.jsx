import React, { useEffect, useState } from 'react';
import { getDashboard } from '../api/dashboardApi';

// ---------------------------------------------------------------------------
// Shared stat card used by all role variants
// ---------------------------------------------------------------------------

function StatCard({ label, value, highlight }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${highlight ? '#fca5a5' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius)',
      padding: '1.25rem 1.5rem',
      boxShadow: 'var(--shadow-sm)',
      flex: '1 1 160px',
    }}>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: highlight ? 'var(--color-danger)' : 'var(--color-primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MEMBER dashboard — personal borrowing overview
// ---------------------------------------------------------------------------

function MemberDashboard({ user, data }) {
  const { counts, activeList } = data;

  const isOverdue = (loan) =>
    loan.status === 'ISSUED' && loan.dueDate && new Date(loan.dueDate) < new Date();

  return (
    <div className="catalogue-page">
      <div className="catalogue-header"><h1>My Dashboard</h1></div>

      {/* Profile card */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.name}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{user.email}</div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="role-badge" style={{ alignSelf: 'center' }}>{user.role}</span>
          {user.createdAt && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Borrowing stats */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <StatCard label="Currently borrowed"  value={counts.active}     />
        <StatCard label="Pending requests"    value={counts.requested}  />
        <StatCard label="Overdue"             value={counts.overdue}    highlight={counts.overdue > 0} />
        <StatCard label="Returned (lifetime)" value={counts.returned}   />
        <StatCard label="Total loans"         value={counts.total}      />
      </div>

      {/* Current loans / requests */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          {activeList.length > 0 ? 'Currently active' : 'No active loans or requests'}
        </h2>
        {activeList.length > 0 && (
          <table className="item-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {activeList.map(loan => {
                const overdue = isOverdue(loan);
                return (
                  <tr key={String(loan.id)}>
                    <td>
                      {loan.item?.title}{' '}
                      <span style={{ color: 'var(--color-text-muted)' }}>({loan.item?.code})</span>
                    </td>
                    <td>
                      <span className={`badge ${overdue ? 'badge-overdue' : loan.status === 'ISSUED' ? 'badge-issued' : 'badge-requested'}`}>
                        {overdue ? 'OVERDUE' : loan.status}
                      </span>
                    </td>
                    <td style={{ color: overdue ? 'var(--color-danger)' : undefined }}>
                      {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LIBRARIAN dashboard — existing org-wide view (unchanged)
// ---------------------------------------------------------------------------

function LibrarianDashboard({ data }) {
  const { summary, weeklyReturns, byCustodian } = data;

  return (
    <div className="catalogue-page">
      <div className="catalogue-header"><h1>Dashboard</h1></div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <StatCard label="Currently out"       value={summary.currentlyOut} />
        <StatCard label="Overdue"             value={summary.overdue} highlight={summary.overdue > 0} />
        <StatCard label="Returned this week"  value={summary.returnedThisWeek} />
        <StatCard label="Catalogue items"     value={summary.totalItems} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Loans by status */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Loans by status</h2>
          <table className="item-table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {summary.loansByStatus.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No loans yet.</td></tr>
              ) : summary.loansByStatus.map(row => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td><strong>{row.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Weekly returns (last 8 weeks) */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Returns per week (last 8 weeks)</h2>
          <table className="item-table">
            <thead><tr><th>Week of</th><th>Returned</th></tr></thead>
            <tbody>
              {weeklyReturns.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No returns recorded.</td></tr>
              ) : weeklyReturns.map(row => (
                <tr key={row.weekStart}>
                  <td>{new Date(row.weekStart).toLocaleDateString()}</td>
                  <td><strong>{row.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Custodian breakdown */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>By librarian</h2>
        {byCustodian.length === 0 ? (
          <div className="empty-state">No librarians found.</div>
        ) : (
          <table className="item-table">
            <thead>
              <tr>
                <th>Librarian</th>
                <th>Items managed</th>
                <th>Active loans</th>
                <th>Overdue loans</th>
              </tr>
            </thead>
            <tbody>
              {byCustodian.map(row => (
                <tr key={row.custodian.id}>
                  <td>
                    {row.custodian.name}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                      {row.custodian.email}
                    </span>
                  </td>
                  <td>{row.itemsManaged}</td>
                  <td>{row.activeLoans}</td>
                  <td style={{ color: row.overdueLoans > 0 ? 'var(--color-danger)' : undefined }}>
                    {row.overdueLoans}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN dashboard — existing org-wide view + user counts
// ---------------------------------------------------------------------------

function AdminDashboard({ data }) {
  const { summary, weeklyReturns, byCustodian, userCounts } = data;

  return (
    <div className="catalogue-page">
      <div className="catalogue-header"><h1>Dashboard</h1></div>

      {/* Summary cards — org stats */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <StatCard label="Currently out"       value={summary.currentlyOut} />
        <StatCard label="Overdue"             value={summary.overdue} highlight={summary.overdue > 0} />
        <StatCard label="Returned this week"  value={summary.returnedThisWeek} />
        <StatCard label="Catalogue items"     value={summary.totalItems} />
        {/* Admin-only user count cards */}
        <StatCard label="Members"             value={userCounts?.members ?? '—'} />
        <StatCard label="Librarians"          value={userCounts?.librarians ?? '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Loans by status */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Loans by status</h2>
          <table className="item-table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {summary.loansByStatus.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No loans yet.</td></tr>
              ) : summary.loansByStatus.map(row => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td><strong>{row.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Weekly returns */}
        <section>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Returns per week (last 8 weeks)</h2>
          <table className="item-table">
            <thead><tr><th>Week of</th><th>Returned</th></tr></thead>
            <tbody>
              {weeklyReturns.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No returns recorded.</td></tr>
              ) : weeklyReturns.map(row => (
                <tr key={row.weekStart}>
                  <td>{new Date(row.weekStart).toLocaleDateString()}</td>
                  <td><strong>{row.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* Custodian breakdown */}
      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>By librarian</h2>
        {byCustodian.length === 0 ? (
          <div className="empty-state">No librarians found.</div>
        ) : (
          <table className="item-table">
            <thead>
              <tr>
                <th>Librarian</th>
                <th>Items managed</th>
                <th>Active loans</th>
                <th>Overdue loans</th>
              </tr>
            </thead>
            <tbody>
              {byCustodian.map(row => (
                <tr key={row.custodian.id}>
                  <td>
                    {row.custodian.name}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                      {row.custodian.email}
                    </span>
                  </td>
                  <td>{row.itemsManaged}</td>
                  <td>{row.activeLoans}</td>
                  <td style={{ color: row.overdueLoans > 0 ? 'var(--color-danger)' : undefined }}>
                    {row.overdueLoans}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component — fetches data and delegates to the right role view
// ---------------------------------------------------------------------------

export default function DashboardPage({ user }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading dashboard…</p>;
  if (error)   return <div className="catalogue-page"><div className="error-banner">{error}</div></div>;
  if (!data)   return null;

  if (user.role === 'MEMBER')    return <MemberDashboard user={user} data={data} />;
  if (user.role === 'ADMIN')     return <AdminDashboard data={data} />;
  return <LibrarianDashboard data={data} />;
}
