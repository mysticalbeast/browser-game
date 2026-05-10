const express = require("express");
const fs = require("fs");
const path = require("path");

const authMiddleware = require("../middleware/auth");

const router = express.Router();

const SAVES_FILE = path.join(__dirname, "../data/saves.json");

const MAX_LEVEL = 2000;
const MAX_GOLD = 1_000_000_000_000;
const MAX_STARS = 1_000_000_000_000;
const MAX_SKILL_POINTS = 1000;
const MAX_MATERIAL_AMOUNT = 10_000_000;
const MAX_EQUIPMENT_ITEMS = 500;
const MAX_LOG_MESSAGES = 150;

function loadSaves() {
  if (!fs.existsSync(SAVES_FILE)) return {};

  try {
    return JSON.parse(fs.readFileSync(SAVES_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to read saves.json:", error);
    return {};
  }
}

function saveSaves(saves) {
  fs.writeFileSync(SAVES_FILE, JSON.stringify(saves, null, 2));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function sanitizeNumberMap(map, maxValue) {
  if (!isPlainObject(map)) return {};

  const sanitized = {};

  Object.entries(map).forEach(([key, value]) => {
    sanitized[key] = Math.floor(clampNumber(value, 0, maxValue, 0));
  });

  return sanitized;
}

function getAllowedSkillPointsForLevel(level) {
  let points = 0;

  for (let currentLevel = 2; currentLevel <= level; currentLevel++) {
    if (currentLevel <= 50) {
      points++;
    } else if (currentLevel % 3 === 0) {
      points++;
    }
  }

  return points;
}

function getSpentSkillPoints(skills) {
  if (!isPlainObject(skills)) return 0;

  return Object.values(skills).reduce((sum, value) => {
    return sum + Math.max(0, Math.floor(Number(value) || 0));
  }, 0);
}

function validateAndSanitizeSave(incomingSave, existingSave = null) {
  if (!isPlainObject(incomingSave)) {
    return {
      ok: false,
      message: "Invalid save format."
    };
  }

  const save = {
    ...incomingSave,
    monsters: []
  };

  save.level = Math.floor(clampNumber(save.level, 1, MAX_LEVEL, 1));
  save.exp = Math.floor(clampNumber(save.exp, 0, Number.MAX_SAFE_INTEGER, 0));
  save.gold = Math.floor(clampNumber(save.gold, 0, MAX_GOLD, 0));
  save.stars = Math.floor(clampNumber(save.stars, 0, MAX_STARS, 0));
  save.starsEarned = Math.floor(clampNumber(save.starsEarned, 0, MAX_STARS, 0));

  save.skillPoints = Math.floor(
    clampNumber(save.skillPoints, 0, MAX_SKILL_POINTS, 0)
  );

  const skills = isPlainObject(save.skills) ? save.skills : {};
  save.skills = sanitizeNumberMap(skills, 1000);

  const spentSkillPoints = getSpentSkillPoints(save.skills);

  const maxTotalSkillPoints = 100000;

  if (spentSkillPoints + save.skillPoints > maxTotalSkillPoints) {
    return {
      ok: false,
      message: "Save rejected: impossible skill point total."
    };
  }

  save.materials = sanitizeNumberMap(
    save.materials,
    MAX_MATERIAL_AMOUNT
  );

  save.salvageMaterials = sanitizeNumberMap(
    save.salvageMaterials,
    MAX_MATERIAL_AMOUNT
  );

  if (save.rebirth && isPlainObject(save.rebirth)) {
    save.rebirth.count = Math.floor(
      clampNumber(save.rebirth.count, 0, 1000, 0)
    );

    save.rebirth.coins = Math.floor(
      clampNumber(save.rebirth.coins, 0, 100000, 0)
    );
  }

  if (!Array.isArray(save.equipmentInventory)) {
    save.equipmentInventory = [];
  }

  if (save.equipmentInventory.length > MAX_EQUIPMENT_ITEMS) {
    return {
      ok: false,
      message: "Save rejected: too many equipment items."
    };
  }

  if (save.logMessages && Array.isArray(save.logMessages)) {
    save.logMessages = save.logMessages.slice(0, MAX_LOG_MESSAGES);
  } else {
    save.logMessages = [];
  }

  if (save.zoneId !== undefined) {
    save.zoneId = Math.floor(
      clampNumber(save.zoneId, 1, 99999, 1)
    );
  }

  save.lastSeenAt = Math.floor(
    clampNumber(save.lastSeenAt, 0, Date.now(), Date.now())
  );

  // =========================
  // DELTA VALIDATION
  // =========================

  if (false && existingSave) {
    const previousLevel = Number(existingSave.level || 1);
    const previousGold = Number(existingSave.gold || 0);
    const previousStars = Number(existingSave.stars || 0);
    const previousExp = Number(existingSave.exp || 0);

    const previousSaveTime = Number(existingSave.lastSeenAt || 0);
    const currentSaveTime = Number(save.lastSeenAt || Date.now());

    const elapsedMs = Math.max(
      1000,
      currentSaveTime - previousSaveTime
    );

    const elapsedMinutes = elapsedMs / 60000;

    // =========================
    // LEVEL DELTA
    // =========================

    const maxLevelGain =
      Math.max(25, elapsedMinutes * 5);

    if ((save.level - previousLevel) > maxLevelGain) {
      return {
        ok: false,
        message: "Save rejected: impossible level progression."
      };
    }

    // =========================
    // GOLD DELTA
    // =========================

    const maxGoldGain =
      Math.max(5_000_000, elapsedMinutes * 2_000_000);

    if ((save.gold - previousGold) > maxGoldGain) {
      return {
        ok: false,
        message: "Save rejected: impossible gold gain."
      };
    }

    // =========================
    // STAR DELTA
    // =========================

    const maxStarGain =
      Math.max(5000, elapsedMinutes * 500);

    if ((save.stars - previousStars) > maxStarGain) {
      return {
        ok: false,
        message: "Save rejected: impossible star gain."
      };
    }

    // =========================
    // EXP DELTA
    // =========================

    const maxExpGain =
      Math.max(5_000_000, elapsedMinutes * 2_000_000);

    if ((save.exp - previousExp) > maxExpGain) {
      return {
        ok: false,
        message: "Save rejected: impossible EXP gain."
      };
    }

    // =========================
    // MATERIAL DELTAS
    // =========================

    const previousMaterials =
      existingSave.materials || {};

    for (const [key, value] of Object.entries(save.materials || {})) {
      const oldValue =
        Number(previousMaterials[key] || 0);

      const delta = value - oldValue;

      const maxMaterialGain =
        Math.max(1000, elapsedMinutes * 250);

      if (delta > maxMaterialGain) {
        return {
          ok: false,
          message: `Save rejected: impossible material gain (${key}).`
        };
      }
    }

    // =========================
    // SKILL POINT DELTA
    // Disabled during backend migration.
    // Skill purchases and reward sources are still partly frontend-controlled.
    // =========================

    // =========================
    // REBIRTH COIN DELTA
    // =========================

    const previousRebirthCoins =
      Number(existingSave.rebirth?.coins || 0);

    const currentRebirthCoins =
      Number(save.rebirth?.coins || 0);

    const maxRebirthCoinGain =
      Math.max(50, elapsedMinutes * 10);

    if ((currentRebirthCoins - previousRebirthCoins) > maxRebirthCoinGain) {
      return {
        ok: false,
        message: "Save rejected: impossible rebirth coin gain."
      };
    }
  }

  return {
    ok: true,
    save
  };
}

router.get("/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;

  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own save."
    });
  }

  const saves = loadSaves();

  res.json({
    success: true,
    save: saves[userId] || null
  });
});

router.post("/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;

  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own save."
    });
  }

  const { save } = req.body;

  if (!save) {
    return res.status(400).json({
      success: false,
      message: "Save data required."
    });
  }

  const saves = loadSaves();
  const existingSave = saves[userId]?.save || null;

  const validation = validateAndSanitizeSave(save, existingSave);

  if (validation.ok && existingSave) {
    validation.save.skills = existingSave.skills || {};
    validation.save.skillPoints = Math.floor(Number(existingSave.skillPoints || 0));
    validation.save.unlockedNodes = Array.isArray(existingSave.unlockedNodes)
      ? existingSave.unlockedNodes
      : ["minotaur_category"];
  }

  if (!validation.ok) {
    return res.status(400).json({
      success: false,
      message: validation.message
    });
  }

  saves[userId] = {
    save: validation.save,
    updatedAt: Date.now()
  };

  saveSaves(saves);

  res.json({
    success: true,
    message: "Cloud save updated."
  });
});

module.exports = router;