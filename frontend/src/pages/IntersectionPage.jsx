import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';

function medalColor(rank) {
  if (rank === 1) return '#f59e0b';
  if (rank === 2) return '#9ca3af';
  if (rank === 3) return '#b45309';
  return '#c4c4c4';
}

function RankBadge({ rank, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '44px',
      fontSize: '0.7rem',
      color: '#888',
      gap: '2px',
    }}>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: medalColor(rank) }}>
        #{rank}
      </span>
      <span>{label}</span>
    </span>
  );
}

export default function IntersectionPage() {
  const { username } = useParams();
  const { user: me } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    api.getCompare(me, username)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [me, username]);

  if (!me) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <p style={{ color: '#555', marginBottom: '16px' }}>
          You need to be logged in to compare lists.
        </p>
        <Link to="/login" style={{
          background: '#4f46e5', color: '#fff', borderRadius: '8px',
          padding: '10px 20px', fontWeight: 600, textDecoration: 'none',
        }}>Log in</Link>
      </div>
    );
  }

  if (me === username) {
    return <Navigate to={`/users/${username}`} replace />;
  }

  return (
    <div style={{ maxWidth: 660, margin: '40px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Link to={`/users/${username}`} style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>
          ← @{username}'s list
        </Link>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>
          <span style={{ color: '#4f46e5' }}>@{me}</span>
          <span style={{ color: '#aaa', margin: '0 8px' }}>∩</span>
          <span style={{ color: '#4f46e5' }}>@{username}</span>
        </h2>
        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
          Ranked intersection — items you both have, ordered by combined rank
        </p>
      </div>

      {loading && <p style={{ color: '#888' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {data && (
        <>
          {/* Stats bar */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}>
            <StatPill label="In common" value={data.items.length} accent />
            <StatPill label={`@${me}'s list`} value={`${data.items.length} / ${data.list1Size}`} />
            <StatPill label={`@${username}'s list`} value={`${data.items.length} / ${data.list2Size}`} />
          </div>

          {data.items.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '12px', padding: '40px',
              textAlign: 'center', color: '#888',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            }}>
              No items in common yet.
            </div>
          ) : (
            <div>
              {/* Column header */}
              <div className="intersection-col-header" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px 8px',
                gap: '14px',
                fontSize: '0.75rem',
                color: '#aaa',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <span style={{ minWidth: '32px' }}>Rank</span>
                <span style={{ flex: 1 }}>Item</span>
                <span style={{ minWidth: '44px', textAlign: 'center' }}>You</span>
                <span style={{ minWidth: '44px', textAlign: 'center' }}>Them</span>
              </div>

              {data.items.map((item) => (
                <div key={item.intersectionRank} className="intersection-row" style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#fff',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  marginBottom: '8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  gap: '14px',
                }}>
                  {/* Intersection rank */}
                  <span style={{
                    minWidth: '32px',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    color: medalColor(item.intersectionRank),
                  }}>
                    #{item.intersectionRank}
                  </span>

                  {/* Item text */}
                  <span style={{ flex: 1, fontSize: '1rem' }}>{item.text}</span>

                  {/* Rank badges grouped for mobile */}
                  <div className="intersection-rank-group" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <RankBadge rank={item.rank1} label="you" />
                    <span style={{ color: '#e5e7eb', fontSize: '1.2rem' }}>|</span>
                    <RankBadge rank={item.rank2} label="them" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{
      background: accent ? '#ede9fe' : '#f3f4f6',
      borderRadius: '8px',
      padding: '8px 14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minWidth: '80px',
    }}>
      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: accent ? '#4f46e5' : '#374151' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.75rem', color: '#888' }}>{label}</span>
    </div>
  );
}
