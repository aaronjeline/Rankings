import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MyRankings from './pages/MyRankings.jsx';
import UsersPage from './pages/UsersPage.jsx';
import UserRankings from './pages/UserRankings.jsx';
import IntersectionPage from './pages/IntersectionPage.jsx';

export const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav style={{
      background: '#4f46e5',
      color: '#fff',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      height: '56px',
    }}>
      <Link to="/" style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', textDecoration: 'none' }}>
        Rankings
      </Link>
      <div style={{ flex: 1 }} />
      {user ? (
        <>
          <Link to="/me" style={{ color: '#e0e7ff', textDecoration: 'none' }}>My List</Link>
          <Link to="/users" style={{ color: '#e0e7ff', textDecoration: 'none' }}>Browse</Link>
          <span style={{ color: '#c7d2fe', fontSize: '0.9rem' }}>{user}</span>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid #818cf8',
              color: '#e0e7ff',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '0.9rem',
            }}
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ color: '#e0e7ff', textDecoration: 'none' }}>Log in</Link>
          <Link to="/register" style={{
            background: '#fff',
            color: '#4f46e5',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}>Sign up</Link>
        </>
      )}
    </nav>
  );
}

function HomePage() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4f46e5', marginBottom: '16px' }}>Rankings</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '32px' }}>
        Create and share your personal ranked lists. Add anything—rank it how you like.
      </p>
      {user ? (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to="/me" style={{
            background: '#4f46e5', color: '#fff', borderRadius: '8px',
            padding: '12px 24px', fontWeight: 600, textDecoration: 'none',
          }}>My Rankings</Link>
          <Link to="/users" style={{
            background: '#fff', color: '#4f46e5', border: '2px solid #4f46e5',
            borderRadius: '8px', padding: '12px 24px', fontWeight: 600, textDecoration: 'none',
          }}>Browse Lists</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link to="/register" style={{
            background: '#4f46e5', color: '#fff', borderRadius: '8px',
            padding: '12px 24px', fontWeight: 600, textDecoration: 'none',
          }}>Get Started</Link>
          <Link to="/users" style={{
            background: '#fff', color: '#4f46e5', border: '2px solid #4f46e5',
            borderRadius: '8px', padding: '12px 24px', fontWeight: 600, textDecoration: 'none',
          }}>Browse Lists</Link>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem('username'));

  function login(token, username) {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    setUser(username);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={user ? <Navigate to="/me" /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/me" /> : <RegisterPage />} />
          <Route path="/me" element={user ? <MyRankings /> : <Navigate to="/login" />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:username" element={<UserRankings />} />
          <Route path="/users/:username/compare" element={<IntersectionPage />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
