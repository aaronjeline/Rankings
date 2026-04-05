import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function UserRankings() {
  const { username } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getRankings(username)
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link to="/users" style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>
          ← Browse
        </Link>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700 }}>
          <span style={{ color: '#4f46e5' }}>@{username}</span>'s Rankings
        </h2>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && items.length === 0 && !error && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '40px',
          textAlign: 'center', color: '#888', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}>
          {username} hasn't added anything yet.
        </div>
      )}

      {items.map((item, index) => (
        <div key={item.id} style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          gap: '14px',
        }}>
          <span style={{
            minWidth: '32px',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: index === 0 ? '#f59e0b' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : '#c4c4c4',
          }}>
            #{index + 1}
          </span>
          <span style={{ flex: 1, fontSize: '1rem' }}>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
