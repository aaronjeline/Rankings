import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createStore } from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, '../frontend/dist');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const store = await createStore(process.env.DATABASE_URL || process.env.DB_PATH || 'rankings.db');

// In-memory cache for community rankings
const communityCache = { data: null, expiresAt: 0 };
const COMMUNITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateCommunityCache() {
  communityCache.expiresAt = 0;
}

const normalize = (text) => {
  let s = text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '');
  s = s.replace(/^(the|an|a)/, '');
  s = s.replace(/es$/, '').replace(/s$/, '');
  return s;
};

app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(distPath));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: isProd ? 'strict' : 'lax',
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Auth routes ---

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 alphanumeric characters or underscores' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await store.createUser(username, hash);
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('jwt', token, COOKIE_OPTIONS);
    res.json({ username });
  } catch (err) {
    if (err.message?.includes('UNIQUE') || err.message?.includes('duplicate')) {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await store.getUserByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('jwt', token, COOKIE_OPTIONS);
  res.json({ username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('jwt', { httpOnly: true, sameSite: isProd ? 'strict' : 'lax', secure: isProd });
  res.json({ ok: true });
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
  invalidateCommunityCache();
  res.json(item);
});

app.delete('/api/rankings/:id', requireAuth, async (req, res) => {
  const item = await store.getRankingItem(Number(req.params.id), req.user.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  await store.deleteItem(item.id, req.user.id);
  invalidateCommunityCache();
  res.json({ ok: true });
});

app.put('/api/rankings/reorder', requireAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  if (ids.length > 1000) return res.status(400).json({ error: 'Too many ids' });

  const owned = new Set(await store.getOwnedItemIds(req.user.id));
  if (!ids.every(id => owned.has(id))) {
    return res.status(403).json({ error: 'Cannot reorder items you do not own' });
  }

  await store.reorderItems(req.user.id, ids);
  invalidateCommunityCache();
  res.json({ ok: true });
});

// --- Community route ---

app.get('/api/community', async (req, res) => {
  const now = Date.now();
  if (communityCache.data && now < communityCache.expiresAt) {
    return res.json(communityCache.data);
  }

  const all = await store.getAllRankings();

  const groups = new Map();
  for (const row of all) {
    const key = normalize(row.text);
    if (!groups.has(key)) {
      groups.set(key, { canonicalText: row.text, users: new Map() });
    }
    const g = groups.get(key);
    // Keep only the first occurrence per user (lowest position = highest rank)
    if (!g.users.has(row.user_id)) {
      g.users.set(row.user_id, row.position);
    }
  }

  const items = [];
  for (const g of groups.values()) {
    if (g.users.size > 3) {
      const positions = [...g.users.values()];
      const mean = positions.reduce((sum, p) => sum + p, 0) / positions.length;
      const variance = positions.reduce((sum, p) => sum + (p - mean) ** 2, 0) / positions.length;
      const stdDev = Math.sqrt(variance);
      const avgRank = mean + 1;
      items.push({
        text: g.canonicalText,
        peopleCount: g.users.size,
        avgRank: Math.round(avgRank * 10) / 10,
        stdDev: Math.round(stdDev * 10) / 10,
      });
    }
  }

  items.sort((a, b) => a.avgRank - b.avgRank);

  const result = { items };
  communityCache.data = result;
  communityCache.expiresAt = now + COMMUNITY_CACHE_TTL;

  res.json(result);
});

// --- Compare routes ---

app.get('/api/compare/:username1/:username2', async (req, res) => {
  const { username1, username2 } = req.params;

  const [user1, user2] = await Promise.all([
    store.getUserByUsername(username1),
    store.getUserByUsername(username2),
  ]);
  if (!user1) return res.status(404).json({ error: `User '${username1}' not found` });
  if (!user2) return res.status(404).json({ error: `User '${username2}' not found` });

  const [list1, list2] = await Promise.all([
    store.getRankingsByUserId(user1.id),
    store.getRankingsByUserId(user2.id),
  ]);


  // Build a normalized-text → {position, originalText} map for each list
  const map2 = new Map();
  for (const item of list2) {
    const key = normalize(item.text);
    if (!map2.has(key)) map2.set(key, { position: item.position, text: item.text });
  }

  // Find common items and compute intersection score (sum of 0-based positions)
  const intersection = [];
  for (const item of list1) {
    const key = normalize(item.text);
    if (map2.has(key)) {
      const match = map2.get(key);
      intersection.push({
        text: item.text,
        rank1: item.position + 1,   // 1-based
        rank2: match.position + 1,  // 1-based
        score: item.position + match.position,
      });
    }
  }

  intersection.sort((a, b) => a.score - b.score || a.rank1 - b.rank1);

  res.json({
    user1: username1,
    user2: username2,
    list1Size: list1.length,
    list2Size: list2.length,
    items: intersection.map(({ text, rank1, rank2 }, i) => ({
      text,
      intersectionRank: i + 1,
      rank1,
      rank2,
    })),
  });
});

// React Router catch-all — must come after all API routes
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Rankings API running on http://localhost:${PORT}`);
});
