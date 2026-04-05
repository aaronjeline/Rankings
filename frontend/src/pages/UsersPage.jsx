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
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '24px' }}>Browse Rankings</h2>
      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {!loading && users.length === 0 && (
        <p style={{ color: '#888' }}>No users yet. Be the first to sign up!</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {users.map(u => (
          <Link
            key={u.username}
            to={`/users/${u.username}`}
            style={{
              display: 'block',
              background: '#fff',
              borderRadius: '10px',
              padding: '16px 20px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              color: '#1a1a1a',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '1rem',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.15)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'}
          >
            <span style={{ color: '#4f46e5' }}>@{u.username}</span>
            <span style={{ color: '#aaa', fontSize: '0.85rem', marginLeft: '10px' }}>
              View rankings →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
