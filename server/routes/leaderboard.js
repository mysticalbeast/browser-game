const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../database");

const router = express.Router();

const USERS_FILE = path.join(__dirname, "../data/users.json");

const LEADERBOARD_CACHE_MS = 10000;

let cachedLeaderboard = [];
let cachedAt = 0;

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
  if (save.zoneId) return `Zone ${save.zoneId}`;
  return "Unknown";
}

function getResearchMilestones(save) {
  if (typeof save.researchMilestones === "number") {
    return save.researchMilestones;
  }

  if (!save.monsterResearch || typeof save.monsterResearch !== "object") {
    return 0;
  }

  return Object.values(save.monsterResearch).reduce((total, monster) => {
    if (!Array.isArray(monster.unlocked)) return total;
    return total + monster.unlocked.length;
  }, 0);
}

async function buildLeaderboard() {
  const users = readJson(USERS_FILE, []);

  const usersById = new Map(
    users.map(user => [String(user.id), user])
  );

  const result = await db.query(`
    SELECT
      user_id,
      save_data,
      updated_at
    FROM player_saves
    ORDER BY updated_at DESC
    LIMIT 500
  `);

  cachedLeaderboard = result.rows
    .map(row => {
      const userId = String(row.user_id);
      const save = row.save_data || {};
      const user = usersById.get(userId);

      return {
        userId,
        username: user?.username || save.username || "Unknown",
        level: Number(save.level || 1),
        exp: Number(save.exp || 0),
        gold: Number(save.gold || 0),
        rebirths: Number(save.rebirth?.count || save.rebirths || 0),
        highestZone: getHighestZoneName(save),
        monstersKilled: Number(save.stats?.monstersKilled || 0),
        bossesKilled: Number(save.stats?.bossesKilled || 0),
        researchMilestones: getResearchMilestones(save),
        starsCollected: Number(
          save.stars ||
          save.starsEarned ||
          save.stats?.starsCollected ||
          0
        ),
        updatedAt: Number(row.updated_at || 0)
      };
    })
    .sort((a, b) => {
      if (b.rebirths !== a.rebirths) return b.rebirths - a.rebirths;
      if (b.level !== a.level) return b.level - a.level;
      return b.exp - a.exp;
    })
    .slice(0, 100);

  cachedAt = Date.now();

  return cachedLeaderboard;
}

router.get("/", async (req, res) => {
  const now = Date.now();

  try {
    if (!cachedLeaderboard.length || now - cachedAt > LEADERBOARD_CACHE_MS) {
      await buildLeaderboard();
    }

    res.json({
      success: true,
      cached: true,
      source: "postgres",
      cachedAt,
      leaderboard: cachedLeaderboard
    });
  } catch (error) {
    console.error("Failed to build leaderboard:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load leaderboard."
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    await buildLeaderboard();

    res.json({
      success: true,
      source: "postgres",
      message: "Leaderboard cache refreshed.",
      cachedAt,
      leaderboard: cachedLeaderboard
    });
  } catch (error) {
    console.error("Failed to refresh leaderboard:", error);

    res.status(500).json({
      success: false,
      message: "Failed to refresh leaderboard."
    });
  }
});

module.exports = router;