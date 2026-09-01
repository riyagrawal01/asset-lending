//Centralized API client.

import { getToken } from '../utils/token';

const BASE_URL = '/api';


async function request(path, options = {}) {
  const { body, ...rest } = options;

  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    const err = new Error(message);
    err.code = data?.error?.code || 'REQUEST_ERROR';
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (path, opts) => request(path, { method: 'GET', ...opts }),
  post: (path, body, opts) => request(path, { method: 'POST', body, ...opts }),
  patch: (path, body, opts) => request(path, { method: 'PATCH', body, ...opts }),
  put: (path, body, opts) => request(path, { method: 'PUT', body, ...opts }),
  delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),
};
