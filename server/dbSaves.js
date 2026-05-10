const db = require("./database");

async function loadPlayerSave(userId) {
  const result = await db.query(
    `
    SELECT save_data
    FROM player_saves
    WHERE user_id = $1
    `,
    [String(userId)]
  );

  return result.rows[0]?.save_data || null;
}

async function savePlayerSave(userId, saveData) {
  await db.query(
    `
    INSERT INTO player_saves (
      user_id,
      save_data,
      updated_at
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id)
    DO UPDATE SET
      save_data = EXCLUDED.save_data,
      updated_at = EXCLUDED.updated_at
    `,
    [
      String(userId),
      JSON.stringify(saveData),
      Date.now()
    ]
  );
}

module.exports = {
  loadPlayerSave,
  savePlayerSave
};