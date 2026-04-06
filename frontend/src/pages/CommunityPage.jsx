import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function CommunityPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCommunity()
      .then(data => setItems(data.items))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const rankColor = (i) => {
    if (i === 0) return '#f59e0b';
    if (i === 1) return '#9ca3af';
    if (i === 2) return '#b45309';
    return '#c4c4c4';
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>
        Community Rankings
      </h2>
      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '24px' }}>
        Items ranked by more than 3 people, sorted by average percentile rank.
        Updates every 5 minutes.
      </p>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && items.length === 0 && !error && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '40px',
          textAlign: 'center', color: '#888', boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
        }}>
          Not enough data yet — items need to appear on more than 3 lists.
        </div>
      )}

      {items.map((item, index) => (
        <div key={item.text} style={{
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
            color: rankColor(index),
          }}>
            #{index + 1}
          </span>
          <span style={{ flex: 1, fontSize: '1rem' }}>{item.text}</span>
          <span style={{
            fontSize: '0.8rem',
            color: '#888',
            whiteSpace: 'nowrap',
          }}>
            top {Math.round(item.avgScore * 100)}%
          </span>
          <span style={{
            background: '#ede9fe',
            color: '#4f46e5',
            borderRadius: '12px',
            padding: '2px 10px',
            fontSize: '0.78rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {item.peopleCount} people
          </span>
        </div>
      ))}
    </div>
  );
}
