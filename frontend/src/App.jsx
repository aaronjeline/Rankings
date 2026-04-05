import React, { createContext, useContext, useState } from 'react';
import { api } from './api.js';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MyRankings from './pages/MyRankings.jsx';
import UsersPage from './pages/UsersPage.jsx';
import UserRankings from './pages/UserRankings.jsx';
import IntersectionPage from './pages/IntersectionPage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';

export const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">Rankings</Link>
      <div className="nav-spacer" />
      <div className="nav-links">
        {user ? (
          <>
            <Link to="/me">My List</Link>
            <Link to="/users">Browse</Link>
            <Link to="/community">Community</Link>
            <span className="nav-username">{user}</span>
            <button onClick={logout} className="nav-btn">Log out</button>
          </>
        ) : (
          <>
            <Link to="/community">Community</Link>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="nav-signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function HomePage() {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#4f46e5', marginBottom: '16px' }}>Rankings</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '32px' }}>
        Rank everything. Find out who agrees.
      </p>
      {user ? (
        <div className="home-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
        <div className="home-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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

  function login(username) {
    localStorage.setItem('username', username);
    setUser(username);
  }

  async function logout() {
    await api.logout().catch(() => {});
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
          <Route path="/community" element={<CommunityPage />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
