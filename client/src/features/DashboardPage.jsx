import React, { useEffect, useState } from 'react';
import { getDashboard } from '../api/dashboardApi';

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

export default function DashboardPage() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading dashboard…</p>;
  if (error)   return <div className="catalogue-page"><div className="error-banner">{error}</div></div>;
  if (!data)   return null;

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
