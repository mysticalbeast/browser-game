const db = require("./database");

async function saveCombatSession(token, sessionData) {
  await db.query(
    `
    INSERT INTO combat_sessions (
      token,
      session_data,
      created_at
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (token)
    DO UPDATE SET
      session_data = EXCLUDED.session_data,
      created_at = EXCLUDED.created_at
    `,
    [
      String(token),
      JSON.stringify(sessionData),
      Number(sessionData.createdAt || Date.now())
    ]
  );
}

async function loadCombatSession(token) {
  const result = await db.query(
    `
    SELECT session_data
    FROM combat_sessions
    WHERE token = $1
    LIMIT 1
    `,
    [String(token || "")]
  );

  return result.rows[0]?.session_data || null;
}

async function deleteCombatSession(token) {
  await db.query(
    `
    DELETE FROM combat_sessions
    WHERE token = $1
    `,
    [String(token || "")]
  );
}

async function markCombatSessionUsed(token, sessionData) {
  sessionData.used = true;

  await saveCombatSession(token, sessionData);
}

async function cleanupExpiredCombatSessions(maxAgeMs = 10 * 60 * 1000) {
  const oldestAllowed = Date.now() - maxAgeMs;

  await db.query(
    `
    DELETE FROM combat_sessions
    WHERE created_at < $1
    `,
    [oldestAllowed]
  );
}

module.exports = {
  saveCombatSession,
  loadCombatSession,
  deleteCombatSession,
  markCombatSessionUsed,
  cleanupExpiredCombatSessions
};