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
  `);

  const stmts = {
    insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    listUsers: db.prepare('SELECT username, created_at FROM users ORDER BY username'),
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
    deleteItem: db.prepare('DELETE FROM rankings WHERE id = ?'),
    getOwnedItemIds: db.prepare(
      'SELECT id FROM rankings WHERE user_id = ? ORDER BY position'
    ),
    updatePosition: db.prepare('UPDATE rankings SET position = ? WHERE id = ?'),
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
      stmts.deleteItem.run(id);
      const remaining = stmts.getOwnedItemIds.all(userId);
      db.transaction(() => {
        remaining.forEach((row, i) => stmts.updatePosition.run(i, row.id));
      })();
    },

    getOwnedItemIds(userId) {
      return stmts.getOwnedItemIds.all(userId).map(r => r.id);
    },

    reorderItems(userId, ids) {
      db.transaction(() => {
        ids.forEach((id, i) => stmts.updatePosition.run(i, id));
      })();
    },
  };
}
