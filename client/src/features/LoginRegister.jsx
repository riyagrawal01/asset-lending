import React, { useState } from 'react';
import { login, register } from '../api/authApi';

/**
 * LoginRegister - handles both login and registration flows.
 *
 * Registration does not auto-login; the user fills in the login form after.
 *
 * Props:
 *   onAuth(user) - called after a successful login with the user object
 */
export default function LoginRegister({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login({ email: form.email, password: form.password });
        onAuth(user);
      } else {
        await register({ name: form.name, email: form.email, password: form.password });
        setRegistered(true);
        setMode('login');
        setForm((prev) => ({ ...prev, name: '' }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>

      {registered && mode === 'login' && (
        <div style={{ marginBottom: '1rem', color: 'var(--color-success)', fontSize: '0.875rem' }}>
          Account created. Please sign in.
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
              Minimum 8 characters. Must contain at least one uppercase letter, one lowercase letter, one number, and one special character.
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="auth-toggle">
        {mode === 'login' ? (
          <>No account?{' '}
            <button
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem' }}
              onClick={() => { setMode('register'); setError(null); setRegistered(false); }}
            >
              Register
            </button>
          </>
        ) : (
          <>Already have an account?{' '}
            <button
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem' }}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
