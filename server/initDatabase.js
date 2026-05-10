const db = require("./database");

async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_saves (
      user_id TEXT PRIMARY KEY,
      save_data JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS combat_sessions (
      token TEXT PRIMARY KEY,
      session_data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
  `);

  console.log("PostgreSQL tables initialized.");
}

module.exports = initDatabase;