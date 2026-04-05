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

    CREATE TABLE IF NOT EXISTS user_votes (
      voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
      PRIMARY KEY (voter_id, target_id)
    );
  `);

  const stmts = {
    insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
    getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    listUsers: db.prepare(`
      SELECT u.username, u.created_at,
        COALESCE(SUM(v.vote), 0) AS vote_score,
        MAX(CASE WHEN v.voter_id = ? THEN v.vote END) AS my_vote
      FROM users u
      LEFT JOIN user_votes v ON v.target_id = u.id
      GROUP BY u.id, u.username, u.created_at
      ORDER BY vote_score DESC, u.username ASC
    `),
    upsertVote: db.prepare(`
      INSERT INTO user_votes (voter_id, target_id, vote)
      VALUES (?, ?, ?)
      ON CONFLICT (voter_id, target_id) DO UPDATE SET vote = excluded.vote
    `),
    removeVote: db.prepare('DELETE FROM user_votes WHERE voter_id = ? AND target_id = ?'),
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

    listUsers(userId = 0) {
      return stmts.listUsers.all(userId);
    },

    upsertVote(voterId, targetId, vote) {
      stmts.upsertVote.run(voterId, targetId, vote);
    },

    removeVote(voterId, targetId) {
      stmts.removeVote.run(voterId, targetId);
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

    getAllRankings() {
      return db.prepare('SELECT text, position, user_id FROM rankings').all();
    },
  };
}
