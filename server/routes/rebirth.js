const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const DEFAULT_MATERIALS = {
  greenEssence: 0,
  blueEssence: 0,
  yellowEssence: 0,
  redEssence: 0,
  whetstones: 0
};

const DEFAULT_SALVAGE_MATERIALS = {
  commonMaterial: 0,
  uncommonMaterial: 0,
  rareMaterial: 0,
  legendaryMaterial: 0
};

const DEFAULT_SKILLS = {};
const DEFAULT_EQUIPMENT = {};

const REBIRTH_SHOP = [
  { key: "keepMaterials", cost: 1, max: 10 },
  { key: "keepGear", cost: 3, max: 1 },
  { key: "autoTravel", cost: 4, max: 1 },
  { key: "autoWeapons", cost: 5, max: 1 },
  { key: "autoSkills", cost: 6, max: 1 },
  { key: "potionLimit", cost: 3, max: 11 },
  { key: "autoSalvage", cost: 6, max: 1 },
  { key: "autoSell", cost: 6, max: 1 },
  { key: "rebirthTokens", cost: 4, max: 10 },
  { key: "maxMonsters", cost: 8, max: 10 },
  { key: "necromancer", cost: 15, max: 1 }
];

function calculateRebirthRewardForLevel(level) {
  return Math.floor(Math.pow(Number(level || 1) / 50, 1.15));
}

function getLevelCap(save) {
  return 300 + Number(save?.rebirth?.count || 0) * 50;
}

function getRebirthUpgradeCost(save, upgrade) {
  const level = Number(save?.rebirthUpgrades?.[upgrade.key] || 0);
  return Math.floor(upgrade.cost * Math.pow(1.5, level));
}

function ensureRebirthData(save) {
  if (!save.rebirth || typeof save.rebirth !== "object") {
    save.rebirth = {
      count: 0,
      coins: 0
    };
  }

  if (!save.rebirthUpgrades || typeof save.rebirthUpgrades !== "object") {
    save.rebirthUpgrades = {};
  }
}

router.post("/perform", authMiddleware, async (req, res) => {
  try {
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRebirthData(save);

    const cap = getLevelCap(save);
    const level = Number(save.level || 1);

    if (level < cap) {
      return res.status(400).json({
        success: false,
        message: `You need to reach level ${cap} to rebirth.`
      });
    }

    const reward = calculateRebirthRewardForLevel(level);

    if (reward <= 0) {
      return res.status(400).json({
        success: false,
        message: "No rebirth reward available."
      });
    }

    const shouldKeepGear = Number(save.rebirthUpgrades.keepGear || 0) > 0;
    const rebirthTokenBonus = Number(save.rebirthUpgrades.rebirthTokens || 0);

    const keepMaterialPercent = Math.min(
      50,
      Number(save.rebirthUpgrades.keepMaterials || 0) * 5
    );

    const keptMaterials = {};
    const keptSalvageMaterials = {};

    if (keepMaterialPercent > 0) {
      Object.entries(save.materials || {}).forEach(([key, value]) => {
        keptMaterials[key] = Math.floor(
          Number(value || 0) * keepMaterialPercent / 100
        );
      });

      Object.entries(save.salvageMaterials || {}).forEach(([key, value]) => {
        keptSalvageMaterials[key] = Math.floor(
          Number(value || 0) * keepMaterialPercent / 100
        );
      });
    }

    if (!shouldKeepGear) {
      save.equipment = { ...DEFAULT_EQUIPMENT };
      save.equipmentInventory = [];
    }

    save.rebirth.coins = Math.floor(Number(save.rebirth.coins || 0) + reward);
    save.rebirth.count = Math.floor(Number(save.rebirth.count || 0) + 1);

    save.level = 1;
    save.exp = 0;
    save.gold = 0;

    save.zoneId = 1;
    save.visitedZones = [1];

    save.skillPoints = 0;
    save.skills = { ...DEFAULT_SKILLS };
    save.unlockedNodes = ["minotaur_category"];

    save.ownedWeapons = ["Sword"];
    save.equippedWeapon = "Sword";

    save.monsters = [];

    save.materials = {
      ...DEFAULT_MATERIALS,
      ...keptMaterials
    };

    save.salvageMaterials = {
      ...DEFAULT_SALVAGE_MATERIALS,
      ...keptSalvageMaterials
    };

    if (rebirthTokenBonus > 0) {
      if (!save.rewards || typeof save.rewards !== "object") {
        save.rewards = {};
      }

      save.rewards.slotCoins = Math.floor(
        Number(save.rewards.slotCoins || 0) + rebirthTokenBonus
      );
    }

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      reward,
      save
    });
  } catch (error) {
    console.error("Rebirth failed:", error);

    res.status(500).json({
      success: false,
      message: "Rebirth failed."
    });
  }
});

router.post("/upgrade", authMiddleware, async (req, res) => {
  try {
    const key = String(req.body?.key || "");
    const upgrade = REBIRTH_SHOP.find(item => item.key === key);

    if (!upgrade) {
      return res.status(400).json({
        success: false,
        message: "Unknown rebirth upgrade."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRebirthData(save);

    const owned = Math.floor(Number(save.rebirthUpgrades[key] || 0));
    const max = upgrade.max || 1;

    if (owned >= max) {
      return res.status(400).json({
        success: false,
        message: "Upgrade is already maxed."
      });
    }

    const cost = getRebirthUpgradeCost(save, upgrade);

    if (Number(save.rebirth.coins || 0) < cost) {
      return res.status(400).json({
        success: false,
        message: `Not enough rebirth coins. Need ${cost}.`
      });
    }

    save.rebirth.coins = Math.floor(Number(save.rebirth.coins || 0) - cost);
    save.rebirthUpgrades[key] = owned + 1;
    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      rebirth: save.rebirth,
      rebirthUpgrades: save.rebirthUpgrades,
      save
    });
  } catch (error) {
    console.error("Rebirth upgrade failed:", error);

    res.status(500).json({
      success: false,
      message: "Rebirth upgrade failed."
    });
  }
});

module.exports = router;