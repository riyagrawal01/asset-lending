import React, { useState, useEffect } from 'react';
import { getUsers, updateUserRole } from '../api/adminApi';
import { PageStatCard, PageStatsRow } from './PageStats';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [confirmRoleChange, setConfirmRoleChange] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function initiateRoleChange(user, newRole) {
    if (user.role === newRole) return;
    setConfirmRoleChange({ user, newRole });
  }

  async function handleRoleChange() {
    if (!confirmRoleChange) return;
    const { user, newRole } = confirmRoleChange;
    setConfirmRoleChange(null);
    setActionError(null);
    setActionMessage(null);
    
    try {
      const res = await updateUserRole(user.id, newRole);
      setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
      if (newRole === 'MEMBER') {
        setActionMessage(`User ${user.name} role changed to MEMBER. Removed from ${res.custodiansRemoved} item custodianships.`);
      } else {
        setActionMessage(`User ${user.name} role changed to LIBRARIAN.`);
      }
    } catch (err) {
      setActionError(err.message);
      // reload to revert UI in case of failure
      loadUsers();
    }
  }

  const members = users.filter(u => u.role === 'MEMBER').length;
  const librarians = users.filter(u => u.role === 'LIBRARIAN').length;
  const admins = users.filter(u => u.role === 'ADMIN').length;

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Users</h1>
      </div>

      <PageStatsRow>
        <PageStatCard label="Total users" value={users.length} />
        <PageStatCard label="Members" value={members} />
        <PageStatCard label="Librarians" value={librarians} />
        <PageStatCard label="Admins" value={admins} />
      </PageStatsRow>

      {error && <div className="error-banner">{error}</div>}
      {actionError && <div className="error-banner">{actionError}</div>}
      {actionMessage && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {actionMessage}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', padding: '2rem 0' }}>Loading users...</p>
      ) : users.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <table className="item-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  {u.role === 'ADMIN' ? (
                    <span className="badge badge-active">ADMIN</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => initiateRoleChange(u, e.target.value)}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="LIBRARIAN">Librarian</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmRoleChange && (
        <div className="modal-overlay" onClick={() => setConfirmRoleChange(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirm Role Change</h2>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
              Are you sure you want to change the role of <strong>{confirmRoleChange.user.name}</strong> from <strong>{confirmRoleChange.user.role}</strong> to <strong>{confirmRoleChange.newRole}</strong>?
            </p>
            {confirmRoleChange.newRole === 'MEMBER' && confirmRoleChange.user.role === 'LIBRARIAN' && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.5rem', background: '#fee2e2', padding: '0.5rem', borderRadius: 'var(--radius)' }}>
                <strong>Warning:</strong> Changing a Librarian to a Member will remove them from all item custodianships.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmRoleChange(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRoleChange}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
