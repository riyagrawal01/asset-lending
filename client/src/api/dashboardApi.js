// dashboardApi — client-side functions for the dashboard endpoint.

import { api } from './client';

export async function getDashboard() {
  return api.get('/dashboard');
}
