import React, { useState, useEffect } from 'react';
import { getUsers, updateUserRole } from '../api/adminApi';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

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

  async function handleRoleChange(user, newRole) {
    if (user.role === newRole) return;
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

  return (
    <div className="catalogue-page">
      <div className="catalogue-header">
        <h1>Manage Users</h1>
      </div>

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
                      onChange={e => handleRoleChange(u, e.target.value)}
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
    </div>
  );
}
