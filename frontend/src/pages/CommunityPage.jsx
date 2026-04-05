import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Maps stdDev to a color: green (consensus) → yellow → red (polarizing)
function varianceColor(stdDev) {
  if (stdDev < 1.5) return '#22c55e';   // green — strong consensus
  if (stdDev < 3.0) return '#f59e0b';   // amber — mixed opinions
  return '#ef4444';                      // red — highly polarizing
}

function varianceLabel(stdDev) {
  if (stdDev < 1.5) return 'consensus';
  if (stdDev < 3.0) return 'mixed';
  return 'polarizing';
}

// A compact bar showing position 1–10, with a dot at mean and a band ±1σ
function StatsBar({ avgRank, stdDev }) {
  const BAR_W = 90;
  const MAX_RANK = 10;
  const clamp = (v) => Math.max(0, Math.min(1, v));

  const meanFrac = clamp((avgRank - 1) / (MAX_RANK - 1));
  const loFrac   = clamp((avgRank - stdDev - 1) / (MAX_RANK - 1));
  const hiFrac   = clamp((avgRank + stdDev - 1) / (MAX_RANK - 1));

  const dotX  = meanFrac * BAR_W;
  const bandX = loFrac * BAR_W;
  const bandW = Math.max(2, (hiFrac - loFrac) * BAR_W);
  const color = varianceColor(stdDev);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
          avg #{avgRank}
        </span>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          color: color,
          background: color + '1a',
          borderRadius: '8px',
          padding: '1px 6px',
          whiteSpace: 'nowrap',
        }}>
          {varianceLabel(stdDev)}
        </span>
      </div>
      {/* Range bar */}
      <div style={{ position: 'relative', width: BAR_W, height: 8 }}>
        {/* Track */}
        <div style={{
          position: 'absolute', top: 3, left: 0,
          width: BAR_W, height: 2,
          background: '#e5e7eb', borderRadius: 2,
        }} />
        {/* Variance band */}
        <div style={{
          position: 'absolute', top: 2, left: bandX,
          width: bandW, height: 4,
          background: color, opacity: 0.35, borderRadius: 2,
        }} />
        {/* Mean dot */}
        <div style={{
          position: 'absolute', top: 0, left: dotX - 4,
          width: 8, height: 8,
          background: color, borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: `0 0 0 1px ${color}`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: BAR_W }}>
        <span style={{ fontSize: '0.58rem', color: '#bbb' }}>#1</span>
        <span style={{ fontSize: '0.58rem', color: '#bbb' }}>#{MAX_RANK}</span>
      </div>
    </div>
  );
}

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
        Items ranked by more than 3 people, sorted by average rank.
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
          <StatsBar avgRank={item.avgRank} stdDev={item.stdDev ?? 0} />
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
