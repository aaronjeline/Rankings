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
const communityCache = { data: null, dirty: true };

function invalidateCommunityCache() {
  communityCache.dirty = true;
}

async function recomputeCommunityCache() {
  const all = await store.getCommunityRankings();
  const groups = new Map();
  for (const row of all) {
    const key = normalize(row.text);
    if (!groups.has(key)) {
      groups.set(key, { canonicalText: row.text, users: new Map() });
    }
    const g = groups.get(key);
    if (!g.users.has(row.user_id)) {
      g.users.set(row.user_id, parseFloat(row.score));
    }
  }
  const items = [];
  for (const g of groups.values()) {
    if (g.users.size > 3) {
      const scores = [...g.users.values()];
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      items.push({
        text: g.canonicalText,
        peopleCount: g.users.size,
        avgScore: Math.round(avgScore * 1000) / 1000,
      });
    }
  }
  items.sort((a, b) => a.avgScore - b.avgScore);
  communityCache.data = { items };
  communityCache.dirty = false;
}

setInterval(async () => {
  if (communityCache.dirty) await recomputeCommunityCache();
}, 60 * 1000);

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

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (ms > 500) console.log(`SLOW ${req.method} ${req.path} ${ms}ms [${res.statusCode}]`);
  });
  next();
});

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
  if (!communityCache.data) await recomputeCommunityCache();
  res.json(communityCache.data);
});

// --- Suggestions route ---

app.get('/api/suggestions', requireAuth, async (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 5, 20);
  const myItems = await store.getRankingsByUserId(req.user.id);
  const myNormalized = new Set(myItems.map(i => normalize(i.text)));

  const users = await store.listUsers();
  const otherUsernames = users.map(u => u.username).filter(name => name !== req.user.username);

  const candidates = [];
  for (const username of otherUsernames) {
    const u = await store.getUserByUsername(username);
    const items = await store.getRankingsByUserId(u.id);
    for (const item of items) {
      if (!myNormalized.has(normalize(item.text))) {
        candidates.push(item.text);
      }
    }
  }

  // Deduplicate by normalized text
  const seen = new Set();
  const unique = [];
  for (const text of candidates) {
    const key = normalize(text);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(text);
    }
  }

  // Shuffle and return up to `count`
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  res.json({ suggestions: unique.slice(0, count) });
});

// --- Compatibility route ---

app.get('/api/compatibility', requireAuth, async (req, res) => {
  const myItems = await store.getRankingsByUserId(req.user.id);
  const myListSize = myItems.length;

  if (myListSize === 0) return res.json({ users: [] });

  // Map normalized text -> percentile (0=top, 1=bottom) for current user
  const myMap = new Map();
  for (const item of myItems) {
    const key = normalize(item.text);
    if (!myMap.has(key)) {
      myMap.set(key, myListSize > 1 ? item.position / (myListSize - 1) : 0);
    }
  }

  const users = await store.listUsers();
  const results = [];

  for (const u of users) {
    if (u.username === req.user.username) continue;

    const other = await store.getUserByUsername(u.username);
    const items = await store.getRankingsByUserId(other.id);
    const listSize = items.length;

    const diffs = [];
    for (const item of items) {
      const key = normalize(item.text);
      if (myMap.has(key)) {
        const theirPct = listSize > 1 ? item.position / (listSize - 1) : 0;
        diffs.push(Math.abs(myMap.get(key) - theirPct));
      }
    }

    if (diffs.length >= 3) {
      const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
      results.push({
        username: u.username,
        sharedCount: diffs.length,
        avgPercentileDiff: Math.round(avgDiff * 1000) / 1000,
      });
    }
  }

  results.sort((a, b) => a.avgPercentileDiff - b.avgPercentileDiff);
  res.json({ users: results });
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
