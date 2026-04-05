import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'rankings-dev-secret-change-in-prod';

// Database setup
const db = new Database(process.env.DB_PATH || 'rankings.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Auth routes ---

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 alphanumeric characters or underscores' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// --- Users routes ---

app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT username, created_at FROM users ORDER BY username').all();
  res.json(users);
});

// --- Rankings routes ---

// Get any user's rankings (public)
app.get('/api/rankings/:username', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const items = db.prepare(
    'SELECT id, text, position FROM rankings WHERE user_id = ? ORDER BY position'
  ).all(user.id);
  res.json(items);
});

// Add item to current user's rankings
app.post('/api/rankings', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return res.status(400).json({ error: 'Text cannot be empty' });
  if (trimmed.length > 100) return res.status(400).json({ error: 'Text must be 100 characters or fewer' });

  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as m FROM rankings WHERE user_id = ?'
  ).get(req.user.id);
  const position = maxPos.m + 1;

  const result = db.prepare(
    'INSERT INTO rankings (user_id, text, position) VALUES (?, ?, ?)'
  ).run(req.user.id, trimmed, position);

  res.json({ id: result.lastInsertRowid, text: trimmed, position });
});

// Delete an item
app.delete('/api/rankings/:id', requireAuth, (req, res) => {
  const item = db.prepare(
    'SELECT * FROM rankings WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('DELETE FROM rankings WHERE id = ?').run(item.id);

  // Re-number positions to keep them contiguous
  const remaining = db.prepare(
    'SELECT id FROM rankings WHERE user_id = ? ORDER BY position'
  ).all(req.user.id);
  const update = db.prepare('UPDATE rankings SET position = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    remaining.forEach((row, i) => update.run(i, row.id));
  });
  reorder();

  res.json({ ok: true });
});

// Reorder — accepts full ordered array of ids
app.put('/api/rankings/reorder', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

  // Verify ownership of all ids
  const owned = db.prepare(
    `SELECT id FROM rankings WHERE user_id = ?`
  ).all(req.user.id).map(r => r.id);

  const ownedSet = new Set(owned);
  if (!ids.every(id => ownedSet.has(id))) {
    return res.status(403).json({ error: 'Cannot reorder items you do not own' });
  }

  const update = db.prepare('UPDATE rankings SET position = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    ids.forEach((id, i) => update.run(i, id));
  });
  reorder();

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Rankings API running on http://localhost:${PORT}`);
});
