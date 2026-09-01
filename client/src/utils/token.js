/**
 * Token storage — thin wrapper around localStorage.
 *
 * Centralising token access here means:
 *  - the storage key is defined in one place
 *  - switching storage strategies (e.g. memory, sessionStorage) only requires
 *    changes here, not across the whole codebase
 */

const TOKEN_KEY = 'asset_lending_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}
