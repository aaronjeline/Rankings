import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';

function VoteButton({ direction, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={direction === 1 ? 'Thumbs up' : 'Thumbs down'}
      style={{
        background: active ? (direction === 1 ? '#4f46e5' : '#dc2626') : '#f3f4f6',
        color: active ? '#fff' : '#555',
        border: 'none',
        borderRadius: '6px',
        width: '32px',
        height: '32px',
        cursor: 'pointer',
        fontSize: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {direction === 1 ? '👍' : '👎'}
    </button>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getUsers()
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function vote(u, direction) {
    const currentVote = u.my_vote ?? 0;
    const newVote = currentVote === direction ? 0 : direction;
    const scoreDelta = newVote - currentVote;

    const previousUsers = users;
    setUsers(prev => prev
      .map(item => item.username !== u.username ? item : {
        ...item,
        my_vote: newVote || null,
        vote_score: (item.vote_score ?? 0) + scoreDelta,
      })
      .sort((a, b) => (b.vote_score ?? 0) - (a.vote_score ?? 0) || a.username.localeCompare(b.username))
    );

    try {
      await api.voteUser(u.username, newVote);
    } catch (err) {
      setUsers(previousUsers);
      setError(err.message);
    }
  }

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
          <div
            key={u.username}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#fff',
              borderRadius: '10px',
              padding: '14px 20px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              gap: '12px',
            }}
          >
            <Link
              to={`/users/${u.username}`}
              style={{
                flex: 1,
                color: '#1a1a1a',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '1rem',
              }}
            >
              <span style={{ color: '#4f46e5' }}>@{u.username}</span>
              <span style={{ color: '#aaa', fontSize: '0.85rem', marginLeft: '10px' }}>
                View rankings →
              </span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {currentUser && currentUser !== u.username && (
                <VoteButton direction={1} active={u.my_vote === 1} onClick={() => vote(u, 1)} />
              )}
              <span style={{
                minWidth: '28px',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '0.95rem',
                color: (u.vote_score ?? 0) > 0 ? '#4f46e5' : (u.vote_score ?? 0) < 0 ? '#dc2626' : '#888',
              }}>
                {u.vote_score ?? 0}
              </span>
              {currentUser && currentUser !== u.username && (
                <VoteButton direction={-1} active={u.my_vote === -1} onClick={() => vote(u, -1)} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
