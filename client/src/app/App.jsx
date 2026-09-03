import React, { useEffect, useState } from 'react';
import { getMe, logout } from '../api/authApi';
import LoginRegister from '../features/LoginRegister';
import CataloguePage from '../features/CataloguePage';
import LoansPage from '../features/LoansPage';
import DashboardPage from '../features/DashboardPage';
import AlertsPage from '../features/AlertsPage';
import './catalogue.css';

/**
 * App - root component.
 *
 * Views: catalogue | loans | requests | dashboard | alerts
 */
export default function App() {
  const [user, setUser]             = useState(undefined); // undefined = loading, null = unauthenticated
  const [currentView, setCurrentView] = useState('catalogue');

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, []);

  function handleAuth(loggedInUser) {
    setUser(loggedInUser);
    setCurrentView('catalogue');
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (user === undefined) {
    return <p style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  if (!user) {
    return <LoginRegister onAuth={handleAuth} />;
  }

  const isLibrarian = user.role === 'LIBRARIAN';

  function NavBtn({ view, label }) {
    const active = currentView === view;
    return (
      <button
        className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setCurrentView(view)}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      {/* Navigation bar */}
      <div className="auth-bar">
        <NavBtn view="catalogue" label="Catalogue" />
        {isLibrarian && <NavBtn view="requests"  label="Requests" />}
        <NavBtn view="loans" label={isLibrarian ? 'All Loans' : 'My Loans'} />
        {isLibrarian && <NavBtn view="dashboard" label="Dashboard" />}
        {isLibrarian && <NavBtn view="alerts"    label="Alerts" />}

        <div style={{ flex: 1 }} />
        <span className="user-info">{user.name}</span>
        <span className="role-badge">{user.role}</span>
        <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </div>

      {/* Pages */}
      {currentView === 'catalogue'  && <CataloguePage user={user} />}
      {currentView === 'loans'      && <LoansPage user={user} filter="all" />}
      {currentView === 'requests'   && <LoansPage user={user} filter="requests" />}
      {currentView === 'dashboard'  && isLibrarian && <DashboardPage />}
      {currentView === 'alerts'     && isLibrarian && <AlertsPage />}
    </>
  );
}
