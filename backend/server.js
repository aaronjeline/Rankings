import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createStore } from './db/sqlite.js';
// To switch databases, replace the line above with your new implementation,
// e.g.: import { createStore } from './db/postgres.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'rankings-dev-secret-change-in-prod';

const store = createStore(process.env.DB_PATH || 'rankings.db');

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

app.post('/api/auth/register', async (req, res) => {
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
    const user = await store.createUser(username, hash);
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await store.getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// --- Users routes ---

app.get('/api/users', async (req, res) => {
  const users = await store.listUsers();
  res.json(users);
});

// --- Rankings routes ---

app.get('/api/rankings/:username', async (req, res) => {
  const user = await store.getUserByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const items = await store.getRankingsByUserId(user.id);
  res.json(items);
});

app.post('/api/rankings', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' });
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) return res.status(400).json({ error: 'Text cannot be empty' });
  if (trimmed.length > 100) return res.status(400).json({ error: 'Text must be 100 characters or fewer' });

  const item = await store.addRankingItem(req.user.id, trimmed);
  res.json(item);
});

app.delete('/api/rankings/:id', requireAuth, async (req, res) => {
  const item = await store.getRankingItem(Number(req.params.id), req.user.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  await store.deleteItem(item.id, req.user.id);
  res.json({ ok: true });
});

app.put('/api/rankings/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

  const owned = new Set(await store.getOwnedItemIds(req.user.id));
  if (!ids.every(id => owned.has(id))) {
    return res.status(403).json({ error: 'Cannot reorder items you do not own' });
  }

  await store.reorderItems(req.user.id, ids);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Rankings API running on http://localhost:${PORT}`);
});
