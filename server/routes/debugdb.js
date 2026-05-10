const express = require("express");
const db = require("../database");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        user_id,
        updated_at
      FROM player_saves
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      rows: result.rows
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;