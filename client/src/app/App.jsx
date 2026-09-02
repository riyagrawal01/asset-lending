import React, { useEffect, useState } from 'react';
import { getMe, logout } from '../api/authApi';
import LoginRegister from '../features/LoginRegister';
import CataloguePage from '../features/CataloguePage';
import './catalogue.css';


export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated

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
      <div className="auth-bar">
        <span className="user-info">{user.name}</span>
        <span className="role-badge">{user.role}</span>
        <button className="btn btn-secondary" onClick={handleLogout}>Sign out</button>
      </div>
      <CataloguePage user={user} />
    </>
  );
}
