// Selects the DB adapter based on environment.
// If DATABASE_URL is set, use Postgres; otherwise fall back to SQLite.
const mod = await import(process.env.DATABASE_URL ? './postgres.js' : './sqlite.js');
export const createStore = mod.createStore;
