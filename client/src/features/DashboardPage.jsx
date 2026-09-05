import React, { useEffect, useState } from 'react';
import { getDashboard } from '../api/dashboardApi';

// ---------------------------------------------------------------------------
// Shared stat card used by all role variants
// ---------------------------------------------------------------------------

function StatCard({ label, value, highlight }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${highlight ? 'var(--color-danger)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-sm)',
      flex: '1 1 180px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      borderLeft: highlight ? '4px solid var(--color-danger)' : '1px solid var(--color-border)'
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: highlight ? 'var(--color-danger)' : 'var(--color-text)', lineHeight: '1' }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared donut chart for catalogue status
// ---------------------------------------------------------------------------

function CatalogueStatusChart({ statusData }) {
  const { available, issued, requested, lost, archived } = statusData || {};
  const total = (available || 0) + (issued || 0) + (requested || 0) + (lost || 0) + (archived || 0);

  const colors = {
    available: '#059669', // var(--color-success)
    issued:    '#0f766e', // var(--color-primary)
    requested: '#d97706', // var(--color-warning)
    lost:      '#e11d48', // var(--color-danger)
    archived:  '#9ca3af'  // neutral gray
  };

  if (total === 0) {
    return <div className="empty-state">No catalogue items.</div>;
  }

  let start = 0;
  const segments = [
    { label: 'Available', value: available || 0, color: colors.available },
    { label: 'Out / Issued', value: issued || 0, color: colors.issued },
    { label: 'Requested', value: requested || 0, color: colors.requested },
    { label: 'Lost', value: lost || 0, color: colors.lost },
    { label: 'Archived', value: archived || 0, color: colors.archived },
  ].filter(s => s.value > 0);

  const gradientStops = segments.map(seg => {
    const end = start + (seg.value / total) * 100;
    const stop = `${seg.color} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(', ');

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>Catalogue Breakdown</h2>
      
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', flex: 1 }}>
        <div style={{
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: `conic-gradient(${gradientStops})`,
          position: 'relative',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute',
            inset: '25px',
            background: 'var(--color-surface)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Total</span>
          </div>
        </div>

        <div style={{ minWidth: '150px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {segments.map(seg => (
              <li key={seg.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }}></span>
                  <span style={{ color: 'var(--color-text)' }}>{seg.label}</span>
                </div>
                <strong style={{ marginLeft: '1rem' }}>{seg.value}</strong>
              </li>
            ))}
          </ul>
        </div>
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
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-text)' }}>{user.name}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{user.email}</div>
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
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>
          {activeList.length > 0 ? 'Currently active' : 'No active loans or requests'}
        </h2>
        {activeList.length > 0 && (
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
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
      </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Catalogue Status Donut Chart */}
        <CatalogueStatusChart statusData={data.catalogueStatus} />

        {/* Loans by status */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>Loans by status</h2>
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {summary.loansByStatus.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No loans yet.</td></tr>
              ) : summary.loansByStatus.map(row => {
                const badgeClass = row.status === 'ISSUED' ? 'badge-issued' 
                                 : row.status === 'REQUESTED' ? 'badge-requested' 
                                 : row.status === 'RETURNED' ? 'badge-returned' 
                                 : 'badge-archived';
                return (
                  <tr key={row.status}>
                    <td><span className={`badge ${badgeClass}`}>{row.status}</span></td>
                    <td><strong>{row.count}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Weekly returns (last 8 weeks) */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>Returns per week (last 8 weeks)</h2>
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
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
        </div>
      </div>

      {/* Custodian breakdown */}
      <div style={{ marginTop: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>By librarian</h2>
        {byCustodian.length === 0 ? (
          <div className="empty-state" style={{ margin: 0 }}>No librarians found.</div>
        ) : (
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
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
      </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Catalogue Status Donut Chart */}
        <CatalogueStatusChart statusData={data.catalogueStatus} />

        {/* Loans by status */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>Loans by status</h2>
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {summary.loansByStatus.length === 0 ? (
                <tr><td colSpan={2} style={{ color: 'var(--color-text-muted)' }}>No loans yet.</td></tr>
              ) : summary.loansByStatus.map(row => {
                const badgeClass = row.status === 'ISSUED' ? 'badge-issued' 
                                 : row.status === 'REQUESTED' ? 'badge-requested' 
                                 : row.status === 'RETURNED' ? 'badge-returned' 
                                 : 'badge-archived';
                return (
                  <tr key={row.status}>
                    <td><span className={`badge ${badgeClass}`}>{row.status}</span></td>
                    <td><strong>{row.count}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Weekly returns */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>Returns per week (last 8 weeks)</h2>
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
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
        </div>
      </div>

      {/* Custodian breakdown */}
      <div style={{ marginTop: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--color-text-muted)' }}>By librarian</h2>
        {byCustodian.length === 0 ? (
          <div className="empty-state" style={{ margin: 0 }}>No librarians found.</div>
        ) : (
          <table className="item-table" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
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
      </div>
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
