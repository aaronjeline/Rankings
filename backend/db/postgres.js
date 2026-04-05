import postgres from 'postgres';

export async function createStore(connectionString) {
  const sql = postgres(connectionString);

  // Initialize schema
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    BIGINT DEFAULT EXTRACT(EPOCH FROM now())::BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rankings (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text       TEXT NOT NULL,
      position   INTEGER NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM now())::BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_votes (
      voter_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vote      INTEGER NOT NULL CHECK (vote IN (1, -1)),
      PRIMARY KEY (voter_id, target_id)
    )
  `;

  return {
    async createUser(username, passwordHash) {
      const rows = await sql`
        INSERT INTO users (username, password_hash)
        VALUES (${username}, ${passwordHash})
        RETURNING id, username
      `;
      return rows[0];
    },

    async getUserByUsername(username) {
      const rows = await sql`
        SELECT id, username, password_hash FROM users WHERE username = ${username}
      `;
      return rows[0] ?? null;
    },

    async listUsers(userId = 0) {
      return sql`
        SELECT u.username, u.created_at,
          COALESCE(SUM(v.vote), 0) AS vote_score,
          MAX(CASE WHEN v.voter_id = ${userId} THEN v.vote END) AS my_vote
        FROM users u
        LEFT JOIN user_votes v ON v.target_id = u.id
        GROUP BY u.id, u.username, u.created_at
        ORDER BY vote_score DESC, u.username ASC
      `;
    },

    async upsertVote(voterId, targetId, vote) {
      await sql`
        INSERT INTO user_votes (voter_id, target_id, vote)
        VALUES (${voterId}, ${targetId}, ${vote})
        ON CONFLICT (voter_id, target_id) DO UPDATE SET vote = EXCLUDED.vote
      `;
    },

    async removeVote(voterId, targetId) {
      await sql`DELETE FROM user_votes WHERE voter_id = ${voterId} AND target_id = ${targetId}`;
    },

    async getRankingsByUserId(userId) {
      return sql`
        SELECT id, text, position FROM rankings
        WHERE user_id = ${userId} ORDER BY position
      `;
    },

    async addRankingItem(userId, text) {
      const [{ m }] = await sql`
        SELECT COALESCE(MAX(position), -1) AS m FROM rankings WHERE user_id = ${userId}
      `;
      const position = Number(m) + 1;
      const rows = await sql`
        INSERT INTO rankings (user_id, text, position)
        VALUES (${userId}, ${text}, ${position})
        RETURNING id, text, position
      `;
      return rows[0];
    },

    async getRankingItem(id, userId) {
      const rows = await sql`
        SELECT id, text, position, user_id FROM rankings
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return rows[0] ?? null;
    },

    async deleteItem(id, userId) {
      await sql.begin(async sql => {
        await sql`DELETE FROM rankings WHERE id = ${id} AND user_id = ${userId}`;
        const remaining = await sql`
          SELECT id FROM rankings WHERE user_id = ${userId} ORDER BY position
        `;
        for (let i = 0; i < remaining.length; i++) {
          await sql`UPDATE rankings SET position = ${i} WHERE id = ${remaining[i].id}`;
        }
      });
    },

    async getOwnedItemIds(userId) {
      const rows = await sql`
        SELECT id FROM rankings WHERE user_id = ${userId} ORDER BY position
      `;
      return rows.map(r => r.id);
    },

    async reorderItems(userId, ids) {
      await sql.begin(async sql => {
        for (let i = 0; i < ids.length; i++) {
          await sql`UPDATE rankings SET position = ${i} WHERE id = ${ids[i]} AND user_id = ${userId}`;
        }
      });
    },

    async getAllRankings() {
      return sql`SELECT text, position, user_id FROM rankings`;
    },
  };
}
