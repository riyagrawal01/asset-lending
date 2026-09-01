/**
 * authApi — client-side functions for authentication endpoints.
 *
 * All token storage decisions stay in utils/token.js.
 * These functions only make the HTTP calls and return results.
 */

import { api } from './client';
import { setToken, removeToken } from '../utils/token';

/**
 * Register a new MEMBER account.
 * Returns the created user object.
 * Does NOT log in automatically — caller must call login() separately.
 */
export async function register({ name, email, password }) {
  const { user } = await api.post('/auth/register', { name, email, password });
  return user;
}

/**
 * Log in with email + password.
 * Stores the JWT in localStorage and returns the user object.
 */
export async function login({ email, password }) {
  const { token, user } = await api.post('/auth/login', { email, password });
  setToken(token);
  return user;
}

/**
 * Fetch the currently authenticated user.
 * Returns null if unauthenticated.
 */
export async function getMe() {
  try {
    const { user } = await api.get('/auth/me');
    return user;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

/**
 * Log out by removing the stored token.
 * No server call required (stateless JWT).
 */
export function logout() {
  removeToken();
}
