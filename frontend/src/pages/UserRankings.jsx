import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';
import { HelpMeAddWizard } from './MyRankings.jsx';

export default function UserRankings() {
  const { username } = useParams();
  const { user: me } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wizardText, setWizardText] = useState(null);
  const [myItems, setMyItems] = useState([]);
  const [addingItem, setAddingItem] = useState(null); // id of item being added
  const [addSuccess, setAddSuccess] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getRankings(username)
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  async function handleAddToMyList(item) {
    setAddingItem(item.id);
    try {
      const mine = await api.getRankings(me);
      setMyItems(mine);
      setWizardText(item.text);
    } finally {
      setAddingItem(null);
    }
  }

  async function handleWizardComplete(position) {
    const text = wizardText;
    setWizardText(null);
    try {
      const item = await api.addItem(text);
      const newItems = [...myItems];
      newItems.splice(position, 0, item);
      await api.reorder(newItems.map(i => i.id));
      setAddSuccess(`Added "${text}" to your list!`);
      setTimeout(() => setAddSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <Link to="/users" style={{ color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>
          ← Browse
        </Link>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, flex: 1 }}>
          <span style={{ color: '#4f46e5' }}>@{username}</span>'s Rankings
        </h2>
        {me && me !== username && (
          <Link to={`/users/${username}/compare`} style={{
            background: '#ede9fe',
            color: '#4f46e5',
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '0.9rem',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Compare with me
          </Link>
        )}
      </div>

      {addSuccess && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '16px', color: '#16a34a', fontSize: '0.9rem',
        }}>
          {addSuccess}
        </div>
      )}

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
          {me && me !== username && (
            <button
              onClick={() => handleAddToMyList(item)}
              disabled={addingItem === item.id}
              title="Add to my list"
              style={{
                background: 'none',
                border: '1px solid #c7d2fe',
                borderRadius: '6px',
                color: '#4f46e5',
                width: '28px',
                height: '28px',
                cursor: addingItem === item.id ? 'wait' : 'pointer',
                fontSize: '1.1rem',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: addingItem === item.id ? 0.4 : 0.6,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = '#4f46e5'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
            >
              +
            </button>
          )}
        </div>
      ))}

      {wizardText !== null && (
        <HelpMeAddWizard
          items={myItems}
          onComplete={handleWizardComplete}
          onCancel={() => setWizardText(null)}
        />
      )}
    </div>
  );
}
