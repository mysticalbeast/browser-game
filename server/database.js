const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};