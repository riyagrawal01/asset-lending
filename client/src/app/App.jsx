import React, { useEffect, useState } from 'react';
import { getMe, logout } from '../api/authApi';
import LoginRegister from '../features/LoginRegister';
import CataloguePage from '../features/CataloguePage';
import LoansPage from '../features/LoansPage';
import './catalogue.css';

/**
 * App - root component.
 */
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated
  const [currentView, setCurrentView] = useState('catalogue'); // 'catalogue' | 'loans'

  // Check for an existing session on mount.
  // Any error (network down, expired token, 401) resolves to null = show login.
  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  function handleAuth(loggedInUser) {
    setUser(loggedInUser);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (user === undefined) {
    return (
      <p style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</p>
    );
  }

  if (!user) {
    return <LoginRegister onAuth={handleAuth} />;
  }

  return (
    <>
      <div className="auth-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={() => setCurrentView('catalogue')}>Catalogue</button>
        {user.role === 'LIBRARIAN' && (
          <button className="btn btn-secondary" onClick={() => setCurrentView('requests')}>Requests</button>
        )}
        <button className="btn btn-secondary" onClick={() => setCurrentView('loans')}>
          {user.role === 'LIBRARIAN' ? 'All Loans' : 'My Loans'}
        </button>
        <div style={{ flex: 1 }}></div>
        <span className="user-info">{user.name}</span>
        <span className="role-badge">{user.role}</span>
        <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </div>
      
      {currentView === 'catalogue' && <CataloguePage user={user} />}
      {currentView === 'loans' && <LoansPage user={user} filter="all" />}
      {currentView === 'requests' && <LoansPage user={user} filter="requests" />}
    </>
  );
}
