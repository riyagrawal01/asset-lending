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
    getMe().then(setUser).catch(() => setUser(null));
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
    return <LoginRegister onAuth={handleAuth} />;
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
        className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => navigateTo(view)}
        style={{ position: 'relative' }}
      >
        {label}
        {dot && (
          <span
            aria-label="new"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-danger)',
              display: 'inline-block',
              border: '1.5px solid var(--color-surface)',
            }}
          />
        )}
      </button>
    );
  }

  return (
    <>
      {/* Navigation bar */}
      <div className="auth-bar">
        {/* Dashboard — visible to all roles */}
        <NavBtn view="dashboard" label="Dashboard" />

        <NavBtn view="catalogue" label="Catalogue" />

        {/* Requests — librarian only, with notification dot */}
        {isLibrarian && (
          <NavBtn
            view="requests"
            label="Requests"
            dot={notifCounts.newRequests > 0}
          />
        )}

        <NavBtn view="loans" label={canViewAll ? 'All Loans' : 'My Loans'} />

        {/* Alerts — librarian and admin; dot only for librarian */}
        {canViewAll && (
          <NavBtn
            view="alerts"
            label="Alerts"
            dot={isLibrarian && notifCounts.newAlerts > 0}
          />
        )}

        {isAdmin && <NavBtn view="admin_users"      label="Users"      />}
        {isAdmin && <NavBtn view="admin_custodians" label="Custodians" />}

        <div style={{ flex: 1 }} />
        <span className="user-info">{user.name}</span>
        <span className="role-badge">{user.role}</span>
        <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </div>

      {/* Pages */}
      {currentView === 'dashboard'  && <DashboardPage user={user} />}
      {currentView === 'catalogue'  && <CataloguePage user={user} />}
      {currentView === 'loans'      && <LoansPage user={user} filter="all" />}
      {currentView === 'requests'   && isLibrarian && <LoansPage user={user} filter="requests" />}
      {currentView === 'alerts'     && canViewAll  && <AlertsPage user={user} />}

      {currentView === 'admin_users'       && isAdmin && <AdminUsersPage />}
      {currentView === 'admin_custodians'  && isAdmin && <AdminCustodiansPage />}
    </>
  );
}
