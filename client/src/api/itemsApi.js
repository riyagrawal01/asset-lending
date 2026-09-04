import { api, BASE_URL } from './client';
import { getToken } from '../utils/token';


// Fetch the active (non-archived) catalogue.

export async function listItems() {
  const { items } = await api.get('/items');
  return items;
}

 // Fetch all items including archived (librarian only).
export async function listAllItems() {
  const { items } = await api.get('/items/archived');
  return items;
}

// Fetch a single item by id.
export async function getItem(id) {
  const { item } = await api.get(`/items/${id}`);
  return item;
}


// Create a new catalogue item (librarian only).
export async function createItem(data) {
  const { item } = await api.post('/items', data);
  return item;
}

// Update an existing item (librarian only).
export async function updateItem(id, changes) {
  const { item } = await api.patch(`/items/${id}`, changes);
  return item;
}

//Archive an item (librarian only).
export async function archiveItem(id) {
  const { item } = await api.post(`/items/${id}/archive`);
  return item;
}

//Restore an archived item (librarian only).
export async function restoreItem(id) {
  const { item } = await api.post(`/items/${id}/restore`);
  return item;
}

// POST /api/items/import — CSV catalogue import (librarian only).
// csvText should be the raw CSV string.
export async function importCSV(csvText) {
  const token = getToken();

  const response = await fetch(`${BASE_URL}/items/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: csvText,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `Import failed (${response.status})`;
    const err = new Error(message);
    err.code = data?.error?.code || 'REQUEST_ERROR';
    throw err;
  }
  return data;
}

// GET /api/items/export/on-loan — triggers browser download.
export async function exportOnLoan() {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/items/export/on-loan`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'on-loan.csv';
  a.click();
  URL.revokeObjectURL(url);
}

