import { api } from './client';
import { setToken, removeToken } from '../utils/token';


export async function register({ name, email, password }) {
  const { user } = await api.post('/auth/register', { name, email, password });
  return user;
}


export async function login({ email, password }) {
  const { token, user } = await api.post('/auth/login', { email, password });
  setToken(token);
  return user;
}

/**
 * Fetch the currently authenticated user.
 * Returns null if unauthenticated (401) or if the server is unreachable.
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
