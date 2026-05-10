const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const USERS_FILE = path.join(__dirname, "../data/users.json");
const SAVES_FILE = path.join(__dirname, "../data/saves.json");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
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

router.delete("/save/:username", requireAdmin, (req, res) => {
  const username = String(req.params.username || "").trim();

  const users = readJson(USERS_FILE, []);
  const saves = readJson(SAVES_FILE, {});

  const user = users.find(
    user => user.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  delete saves[user.id];
  writeJson(SAVES_FILE, saves);

  res.json({
    success: true,
    message: `Deleted cloud save for ${user.username}.`
  });
});

module.exports = router;