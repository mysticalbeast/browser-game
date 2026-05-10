const db = require("./database");

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