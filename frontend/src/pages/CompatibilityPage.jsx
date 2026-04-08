import React, { useEffect, useState, useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';

export default function CompatibilityPage() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCompatibility()
      .then(data => setUsers(data.users))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return <Navigate to="/login" />;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>Compatibility</h2>
      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '24px' }}>
        Users who share 3+ items with you, ranked by average percentile difference.
      </p>
      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {!loading && !error && users.length === 0 && (
        <p style={{ color: '#888' }}>No compatible users found yet. Add more items to your list!</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {users.map((u, i) => (
          <Link
            key={u.username}
            to={`/users/${u.username}/compare`}
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
              {Math.round(u.avgPercentileDiff * 100)}% avg diff
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
