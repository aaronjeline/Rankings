import postgres from 'postgres';

export async function createStore(connectionString) {
  const sql = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

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
    CREATE INDEX IF NOT EXISTS idx_rankings_user_position ON rankings (user_id, position)
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

    async listUsers() {
      return sql`SELECT username, created_at FROM users ORDER BY username`;
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
      const positions = ids.map((_, i) => i);
      await sql`
        UPDATE rankings
        SET position = updates.position
        FROM unnest(${sql.array(ids)}::int[], ${sql.array(positions)}::int[]) AS updates(id, position)
        WHERE rankings.id = updates.id AND rankings.user_id = ${userId}
      `;
    },

    async getCommunityRankings() {
      return sql`
        SELECT r.text, r.user_id,
               COALESCE(MIN(r.position)::float8 / NULLIF(ul.list_length - 1, 0), 0) AS score
        FROM rankings r
        JOIN (
          SELECT user_id, MAX(position) + 1 AS list_length
          FROM rankings
          GROUP BY user_id
        ) ul ON r.user_id = ul.user_id
        GROUP BY r.text, r.user_id, ul.list_length
      `;
    },
  };
}
