const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const MAX_LEVEL = 2000;
const MAX_GOLD = 1_000_000_000_000;
const MAX_STARS = 1_000_000_000_000;
const MAX_SKILL_POINTS = 1000;
const MAX_MATERIAL_AMOUNT = 10_000_000;
const MAX_EQUIPMENT_ITEMS = 500;
const MAX_LOG_MESSAGES = 150;

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

function getSpentSkillPoints(skills) {
  if (!isPlainObject(skills)) return 0;

  return Object.values(skills).reduce((sum, value) => {
    return sum + Math.max(0, Math.floor(Number(value) || 0));
  }, 0);
}

function sanitizePersistentSave(save) {
  const cleaned = { ...save };

  delete cleaned.monsters;
  delete cleaned.projectiles;
  delete cleaned.floatingTexts;
  delete cleaned.damageNumbers;
  delete cleaned.notifications;
  delete cleaned.combatToken;
  delete cleaned.spawnRequestInProgress;
  delete cleaned.lastSpawnRequestAt;
  delete cleaned.isAwayForOffline;
  delete cleaned.offlineGainProcessing;

  delete cleaned.activeMonster;
  delete cleaned.currentMonster;
  delete cleaned.pendingReward;
  delete cleaned.pendingLoot;
  delete cleaned.pendingCloudSave;

  delete cleaned.skeletons;
  delete cleaned.arrows;
  delete cleaned.fireballs;
  delete cleaned.effects;
  delete cleaned.vfx;
  delete cleaned.animations;

  return cleaned;
}

function validateAndSanitizeSave(incomingSave) {
  if (!isPlainObject(incomingSave)) {
    return {
      ok: false,
      message: "Invalid save format."
    };
  }

  const save = sanitizePersistentSave({
    ...incomingSave,
    monsters: []
  });

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

  return {
    ok: true,
    save
  };
}

router.get("/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;

  if (String(req.user.id) !== String(userId)) {
    return res.status(403).json({
      success: false,
      message: "You can only access your own save."
    });
  }

  try {
    const dbSave = await loadPlayerSave(userId);

    res.json({
      success: true,
      save: dbSave
        ? {
            save: dbSave,
            updatedAt: Number(dbSave.updatedAt || Date.now()),
            source: "postgres"
          }
        : null
    });
  } catch (error) {
    console.error("Failed to load save:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load save."
    });
  }
});

router.post("/:userId", authMiddleware, async (req, res) => {
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

  try {
    const existingSave = await loadPlayerSave(userId);
    const persistentSave = sanitizePersistentSave(save);
    const validation = validateAndSanitizeSave(persistentSave);

    if (!validation.ok) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const finalSave = sanitizePersistentSave(validation.save);

    if (existingSave) {
		
	        // Backend-owned equipment
      finalSave.equipment = existingSave.equipment || {};

      // Backend-owned depot
      finalSave.depot = existingSave.depot || {
        tabs: []
      };

      // Backend-owned salvage materials
      finalSave.salvageMaterials =
        existingSave.salvageMaterials || {
          commonMaterial: 0,
          uncommonMaterial: 0,
          rareMaterial: 0,
          legendaryMaterial: 0
        };

      // Backend-owned materials
      finalSave.materials = existingSave.materials || {};
      // Backend-owned skills
      finalSave.skills = existingSave.skills || {};

      finalSave.skillPoints = Math.floor(
        Number(existingSave.skillPoints || 0)
      );

      finalSave.unlockedNodes = Array.isArray(existingSave.unlockedNodes)
        ? existingSave.unlockedNodes
        : ["minotaur_category"];

      // Backend-owned rebirth
      finalSave.rebirth = existingSave.rebirth || {
        count: 0,
        coins: 0
      };

      finalSave.rebirthUpgrades =
        existingSave.rebirthUpgrades || {};

      // Backend-owned stats
      finalSave.stats = existingSave.stats || {};

      // Backend-owned highest zone
      finalSave.highestZone = Math.max(
        Number(existingSave.highestZone || 1),
        Number(finalSave.highestZone || 1)
      );

      // Backend-owned progression
      finalSave.level = Math.floor(
        Number(existingSave.level || 1)
      );

      finalSave.exp = Math.floor(
        Number(existingSave.exp || 0)
      );
    }

    finalSave.lastSeenAt = Date.now();

    await savePlayerSave(userId, finalSave);

    res.json({
      success: true,
      message: "Cloud save updated."
    });
  } catch (error) {
    console.error("Failed to save cloud save:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save cloud save."
    });
  }
});

module.exports = router;