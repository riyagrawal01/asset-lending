import React, { useEffect, useState, useCallback } from 'react';
import { getAlerts, dismissAlert } from '../api/loansApi';

import { PageStatCard, PageStatsRow } from './PageStats';

export default function AlertsPage({ user }) {
  const isLibrarian = user.role === 'LIBRARIAN';
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [dismissing, setDismissing] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function handleDismiss(loanId) {
    setDismissing(loanId);
    try {
      await dismissAlert(loanId);
      setAlerts(prev => prev.filter(a => a.id !== loanId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissing(null);
    }
  }

  function daysOverdue(dueDate) {
    const diff = Date.now() - new Date(dueDate).getTime();
    return Math.floor(diff / 86400000);
  }

  const unseenAlerts = alerts.filter(a => !a.seen).length;

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Overdue Alerts</h1>
        <button className="btn btn-secondary" onClick={fetchAlerts}>Refresh</button>
      </div>

      <PageStatsRow>
        <PageStatCard label="Total alerts" value={alerts.length} />
        <PageStatCard label="Unseen" value={unseenAlerts} highlight={unseenAlerts > 0} />
      </PageStatsRow>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="empty-state">No active overdue alerts. 🎉</div>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Borrower</th>
              <th>Due Date</th>
              <th>Days Overdue</th>
              {isLibrarian && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {alerts.map(alert => (
              <tr key={alert.id}>
                <td>
                  {alert.item?.title}{' '}
                  <span style={{ color: 'var(--color-text-muted)' }}>({alert.item?.code})</span>
                </td>
                <td>{alert.borrower?.name ?? '—'}</td>
                <td style={{ color: 'var(--color-danger)' }}>
                  {alert.dueDate ? new Date(alert.dueDate).toLocaleDateString() : '—'}
                </td>
                <td style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                  {daysOverdue(alert.dueDate)} days
                </td>
                {isLibrarian && (
                  <td>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDismiss(alert.id)}
                      disabled={dismissing === alert.id}
                    >
                      {dismissing === alert.id ? 'Dismissing…' : 'Dismiss'}
                    </button>
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
