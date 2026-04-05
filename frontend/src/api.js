const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  getUsers: () => request('GET', '/users'),
  getRankings: (username) => request('GET', `/rankings/${username}`),
  addItem: (text) => request('POST', '/rankings', { text }),
  deleteItem: (id) => request('DELETE', `/rankings/${id}`),
  reorder: (ids) => request('PUT', '/rankings/reorder', { ids }),
};
