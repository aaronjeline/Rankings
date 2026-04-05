const BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  getUsers: () => request('GET', '/users'),
  getRankings: (username) => request('GET', `/rankings/${username}`),
  addItem: (text) => request('POST', '/rankings', { text }),
  deleteItem: (id) => request('DELETE', `/rankings/${id}`),
  reorder: (ids) => request('PUT', '/rankings/reorder', { ids }),
  getCompare: (username1, username2) => request('GET', `/compare/${encodeURIComponent(username1)}/${encodeURIComponent(username2)}`),
};
