const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../database");

const router = express.Router();

const USERS_FILE = path.join(__dirname, "../data/users.json");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

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

router.delete("/save/:username", requireAdmin, async (req, res) => {
  const username = String(req.params.username || "").trim();

  try {
    const users = readJson(USERS_FILE, []);

    const user = users.find(
      user => user.username.toLowerCase() === username.toLowerCase()
    );

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
      [String(user.id)]
    );

    res.json({
      success: true,
      message: `Deleted PostgreSQL cloud save for ${user.username}.`
    });
  } catch (error) {
    console.error("Admin delete save failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete cloud save."
    });
  }
});

module.exports = router;