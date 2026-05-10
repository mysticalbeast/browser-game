const express = require("express");
const db = require("../database");

const router = express.Router();

function requireAdmin(req, res, next) {
  const adminSecret = req.headers["x-admin-secret"];

  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({
      success: false,
      message: "ADMIN_SECRET is not configured."
    });
  }

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({
      success: false,
      message: "Invalid admin secret."
    });
  }

  next();
}

const db = require("../database");

router.delete("/save/:username", requireAdmin, async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();

    const userResult = await db.query(
      `
      SELECT id, username
      FROM users
      WHERE username_lower = $1
      LIMIT 1
      `,
      [username.toLowerCase()]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    await db.query(
      `
      DELETE FROM player_saves
      WHERE user_id = $1
      `,
      [user.id]
    );

    res.json({
      success: true,
      message: `Deleted cloud save for ${user.username}.`
    });
  } catch (error) {
    console.error("Admin delete save failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete save."
    });
  }
});

module.exports = router;