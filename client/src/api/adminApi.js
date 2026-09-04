import { api } from './client';

export async function getUsers() {
  const data = await api.get('/admin/users');
  return data.users;
}

export async function updateUserRole(userId, role) {
  return await api.patch(`/admin/users/${userId}/role`, { role });
}

export async function getCustodians(itemId) {
  const data = await api.get(`/admin/items/${itemId}/custodians`);
  return data.librarians;
}

export async function setCustodians(itemId, librarianIds) {
  await api.put(`/admin/items/${itemId}/custodians`, { librarianIds });
}
