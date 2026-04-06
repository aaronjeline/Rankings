import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>Leaderboard</h2>
      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '24px' }}>Ranked by list size.</p>
      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {!loading && users.length === 0 && (
        <p style={{ color: '#888' }}>No users yet. Be the first to sign up!</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {users.map((u, i) => (
          <Link
            key={u.username}
            to={`/users/${u.username}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: '#fff',
              borderRadius: '10px',
              padding: '14px 20px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              color: '#1a1a1a',
              textDecoration: 'none',
              fontSize: '1rem',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'}
          >
            <span style={{
              minWidth: '28px',
              fontWeight: 700,
              fontSize: '1rem',
              color: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#c4c4c4',
            }}>
              #{i + 1}
            </span>
            <span style={{ flex: 1, fontWeight: 500, color: '#4f46e5' }}>@{u.username}</span>
            <span style={{
              background: '#f3f4f6',
              borderRadius: '8px',
              padding: '3px 10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#374151',
              whiteSpace: 'nowrap',
            }}>
              {u.list_size} {u.list_size === 1 ? 'item' : 'items'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
