import { api } from './client';


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
