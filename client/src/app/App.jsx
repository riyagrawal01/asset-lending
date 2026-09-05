import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getMe, logout } from '../api/authApi';
import { getNotifCounts, markRequestsSeen, markAlertsSeen } from '../api/notifApi';
import LoginRegister from '../features/LoginRegister';
import CataloguePage from '../features/CataloguePage';
import LoansPage from '../features/LoansPage';
import DashboardPage from '../features/DashboardPage';
import AlertsPage from '../features/AlertsPage';
import AdminUsersPage from '../features/AdminUsersPage';
import AdminCustodiansPage from '../features/AdminCustodiansPage';
import './catalogue.css';

/**
 * App - root component.
 *
 * Views: catalogue | loans | requests | dashboard | alerts | admin_users | admin_custodians
 *
 * All roles land on 'dashboard' after login.
 * Librarians get notification dots next to Requests and Alerts nav items.
 */
export default function App() {
  const [user, setUser]               = useState(undefined); // undefined = loading, null = unauthenticated
  const [currentView, setCurrentView] = useState('dashboard');

  // Notification counts — only populated for LIBRARIAN role
  const [notifCounts, setNotifCounts] = useState({ newRequests: 0, newAlerts: 0 });
  const notifIntervalRef              = useRef(null);

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  useEffect(() => {
    getMe().then((loggedInUser) => {
      setUser(loggedInUser);
      if (loggedInUser) {
        setCurrentView('dashboard');
      }
    }).catch(() => setUser(null));
  }, []);

  // -------------------------------------------------------------------------
  // Notification polling — only for LIBRARIAN
  // -------------------------------------------------------------------------

  const fetchNotifCounts = useCallback(async () => {
    try {
      const counts = await getNotifCounts();
      setNotifCounts(counts);
    } catch {
      // Non-critical — silently ignore if the endpoint fails
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'LIBRARIAN') {
      setNotifCounts({ newRequests: 0, newAlerts: 0 });
      if (notifIntervalRef.current) {
        clearInterval(notifIntervalRef.current);
        notifIntervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on mount / role change, then every 30 seconds
    fetchNotifCounts();
    notifIntervalRef.current = setInterval(fetchNotifCounts, 30_000);

    return () => {
      clearInterval(notifIntervalRef.current);
      notifIntervalRef.current = null;
    };
  }, [user, fetchNotifCounts]);

  // -------------------------------------------------------------------------
  // Navigation handler — marks notifications seen when relevant page is viewed
  // -------------------------------------------------------------------------

  function navigateTo(view) {
    setCurrentView(view);

    if (user?.role === 'LIBRARIAN') {
      if (view === 'requests' && notifCounts.newRequests > 0) {
        markRequestsSeen().catch(() => {});
        setNotifCounts(prev => ({ ...prev, newRequests: 0 }));
      }
      if (view === 'alerts' && notifCounts.newAlerts > 0) {
        markAlertsSeen().catch(() => {});
        setNotifCounts(prev => ({ ...prev, newAlerts: 0 }));
      }
    }
  }

  function handleAuth(loggedInUser) {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  }

  function handleLogout() {
    logout();
    setUser(null);
    setNotifCounts({ newRequests: 0, newAlerts: 0 });
  }

  // -------------------------------------------------------------------------
  // Render guards
  // -------------------------------------------------------------------------

  if (user === undefined) {
    return <p style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</p>;
  }

  if (!user) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="app-header-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            Asset Lending
          </div>
        </header>
        <main className="app-main">
          <LoginRegister onAuth={handleAuth} />
        </main>
        <footer className="app-footer">
          &copy; {new Date().getFullYear()} Asset Lending Inc. All rights reserved.
        </footer>
      </div>
    );
  }

  const isLibrarian = user.role === 'LIBRARIAN';
  const isAdmin     = user.role === 'ADMIN';
  const canViewAll  = isLibrarian || isAdmin;

  // -------------------------------------------------------------------------
  // Nav button with optional notification dot
  // -------------------------------------------------------------------------

  function NavBtn({ view, label, dot }) {
    const active = currentView === view;
    return (
      <button
        onClick={() => navigateTo(view)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          padding: '0.5rem 0.25rem',
          margin: '0 0.5rem',
          fontSize: '0.9rem',
          fontWeight: 500,
          color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
          borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
          cursor: 'pointer',
          transition: 'color 0.2s, border-bottom-color 0.2s'
        }}
        onMouseOver={(e) => { if (!active) e.currentTarget.style.color = 'var(--color-text)'; }}
        onMouseOut={(e) => { if (!active) e.currentTarget.style.color = 'var(--color-text-muted)'; }}
      >
        {label}
        {dot && (
          <span
            aria-label="new"
            style={{
              position: 'absolute',
              top: '2px',
              right: '-8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-danger)',
              display: 'inline-block',
              boxShadow: '0 0 0 2px var(--color-surface)',
            }}
          />
        )}
      </button>
    );
  }

  return (
    <div className="app-container">
      {/* Header & Navigation */}
      <header className="app-header">
        <div className="app-header-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          Asset Lending
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <nav className="app-nav">
            <NavBtn view="dashboard" label="Dashboard" />
            <NavBtn view="catalogue" label="Catalogue" />
            {isLibrarian && <NavBtn view="requests"  label="Requests" dot={notifCounts.newRequests > 0} />}
            <NavBtn view="loans" label={canViewAll ? 'All Loans' : 'My Loans'} />
            {canViewAll && <NavBtn view="alerts" label="Alerts" dot={isLibrarian && notifCounts.newAlerts > 0} />}
            {isAdmin && <NavBtn view="admin_users" label="Users" />}
            {isAdmin && <NavBtn view="admin_custodians" label="Custodians" />}
          </nav>

          <div className="app-user-controls">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.name}</span>
              <span className="role-badge">{user.role}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {currentView === 'dashboard'  && <DashboardPage user={user} />}
        {currentView === 'catalogue'  && <CataloguePage user={user} />}
        {currentView === 'loans'      && <LoansPage user={user} filter="all" />}
        {currentView === 'requests'   && isLibrarian && <LoansPage user={user} filter="requests" />}
        {currentView === 'alerts'     && canViewAll  && <AlertsPage user={user} />}
        {currentView === 'admin_users'       && isAdmin && <AdminUsersPage />}
        {currentView === 'admin_custodians'  && isAdmin && <AdminCustodiansPage />}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        &copy; {new Date().getFullYear()} Asset Lending Inc. All rights reserved.
      </footer>
    </div>
  );
}
