const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const SAVES_FILE = path.join(__dirname, "../data/saves.json");
const USERS_FILE = path.join(__dirname, "../data/users.json");

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${file}:`, error);
    return fallback;
  }
}

function getHighestZoneName(save) {
  if (save.currentZoneName) return save.currentZoneName;
  if (save.zoneName) return save.zoneName;
  if (save.currentZone) return `Zone ${save.currentZone}`;
  return "Unknown";
}

router.get("/", (req, res) => {
  const saves = readJson(SAVES_FILE, {});
  const users = readJson(USERS_FILE, []);

  const usersById = new Map(
    users.map(user => [String(user.id), user])
  );

  const leaderboard = Object.entries(saves)
    .map(([userId, entry]) => {
      const save = entry?.save || {};
      const user = usersById.get(String(userId));

      return {
        userId,
        username: user?.username || "Unknown",
        level: Number(save.level || 1),
        exp: Number(save.exp || 0),
        gold: Number(save.gold || 0),
        rebirths: Number(save.rebirths || 0),
        highestZone: getHighestZoneName(save),
        monstersKilled: Number(save.stats?.monstersKilled || 0),
        bossesKilled: Number(save.stats?.bossesKilled || 0),
        updatedAt: entry?.updatedAt || 0
      };
    })
    .sort((a, b) => {
      if (b.rebirths !== a.rebirths) return b.rebirths - a.rebirths;
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    })
    .slice(0, 100);

  res.json({
    success: true,
    leaderboard
  });
});

module.exports = router;