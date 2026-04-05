import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { AuthContext } from '../App.jsx';

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(username, password);
      login(data.token, data.username);
      navigate('/me');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: '0 16px' }}>
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.5rem', fontWeight: 700 }}>Log in</h2>
        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
            color: '#dc2626', fontSize: '0.9rem',
          }}>{error}</div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '0.9rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
          No account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '1rem',
  outline: 'none',
};

const btnStyle = {
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '11px',
  fontSize: '1rem',
  fontWeight: 600,
  marginTop: '4px',
};
