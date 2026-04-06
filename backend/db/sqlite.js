import Database from 'better-sqlite3';

export function createStore(dbPath = 'rankings.db') {
  const db = new Database(dbPath);

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

    CREATE INDEX IF NOT EXISTS idx_rankings_user_position ON rankings (user_id, position);
  `);

  const stmts = {
    insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    listUsers: db.prepare(`
      SELECT u.username, u.created_at, COUNT(r.id) AS list_size
      FROM users u
      LEFT JOIN rankings r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY list_size DESC, u.username
    `),
    getRankingsByUserId: db.prepare(
      'SELECT id, text, position FROM rankings WHERE user_id = ? ORDER BY position'
    ),
    getMaxPosition: db.prepare(
      'SELECT COALESCE(MAX(position), -1) AS m FROM rankings WHERE user_id = ?'
    ),
    insertRankingItem: db.prepare(
      'INSERT INTO rankings (user_id, text, position) VALUES (?, ?, ?)'
    ),
    getRankingItem: db.prepare(
      'SELECT * FROM rankings WHERE id = ? AND user_id = ?'
    ),
    deleteItem: db.prepare('DELETE FROM rankings WHERE id = ? AND user_id = ?'),
    getOwnedItemIds: db.prepare(
      'SELECT id FROM rankings WHERE user_id = ? ORDER BY position'
    ),
    updatePosition: db.prepare('UPDATE rankings SET position = ? WHERE id = ? AND user_id = ?'),
  };

  return {
    createUser(username, passwordHash) {
      const result = stmts.insertUser.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    },

    getUserByUsername(username) {
      return stmts.getUserByUsername.get(username) ?? null;
    },

    listUsers() {
      return stmts.listUsers.all();
    },

    getRankingsByUserId(userId) {
      return stmts.getRankingsByUserId.all(userId);
    },

    addRankingItem(userId, text) {
      const { m } = stmts.getMaxPosition.get(userId);
      const position = m + 1;
      const result = stmts.insertRankingItem.run(userId, text, position);
      return { id: result.lastInsertRowid, text, position };
    },

    getRankingItem(id, userId) {
      return stmts.getRankingItem.get(id, userId) ?? null;
    },

    deleteItem(id, userId) {
      stmts.deleteItem.run(id, userId);
      const remaining = stmts.getOwnedItemIds.all(userId);
      db.transaction(() => {
        remaining.forEach((row, i) => stmts.updatePosition.run(i, row.id, userId));
      })();
    },

    getOwnedItemIds(userId) {
      return stmts.getOwnedItemIds.all(userId).map(r => r.id);
    },

    reorderItems(userId, ids) {
      db.transaction(() => {
        ids.forEach((id, i) => stmts.updatePosition.run(i, id, userId));
      })();
    },

    getCommunityRankings() {
      return db.prepare(`
        SELECT r.text, r.user_id,
               COALESCE(MIN(r.position) * 1.0 / NULLIF(ul.list_length - 1, 0), 0) AS score
        FROM rankings r
        JOIN (
          SELECT user_id, MAX(position) + 1 AS list_length
          FROM rankings
          GROUP BY user_id
        ) ul ON r.user_id = ul.user_id
        GROUP BY r.text, r.user_id, ul.list_length
      `).all();
    },
  };
}
