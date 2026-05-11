const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const {
  applyBackendExpGain
} = require("../backendProgression");

const router = express.Router();

const ZONE_REWARDS = {
  1: { id: 1, gold: [2, 5], exp: [4, 8] },
  2: { id: 2, gold: [6, 12], exp: [10, 18] },
  3: { id: 3, gold: [12, 22], exp: [18, 32] },
  4: { id: 4, gold: [25, 45], exp: [40, 70] },
  5: { id: 5, gold: [45, 80], exp: [75, 120] },
  6: { id: 6, gold: [75, 130], exp: [120, 190] },
  7: { id: 7, gold: [100, 170], exp: [165, 260] },
  8: { id: 8, gold: [135, 230], exp: [220, 340] },
  9: { id: 9, gold: [190, 320], exp: [310, 480] },
  10: { id: 10, gold: [270, 450], exp: [430, 680] },
  11: { id: 11, gold: [380, 620], exp: [600, 920] },
  12: { id: 12, gold: [520, 850], exp: [820, 1250] },
  13: { id: 13, gold: [690, 1120], exp: [1100, 1650] },
  14: { id: 14, gold: [900, 1450], exp: [1450, 2150] },
  15: { id: 15, gold: [1180, 1900], exp: [1850, 2800] },
  16: { id: 16, gold: [1550, 2500], exp: [2400, 3600] },
  17: { id: 17, gold: [2050, 3300], exp: [3100, 4600] },
  18: { id: 18, gold: [2700, 4300], exp: [4000, 6000] },
  19: { id: 19, gold: [3500, 5600], exp: [5200, 7800] },
  20: { id: 20, gold: [4500, 7200], exp: [6800, 10000] },
  21: { id: 21, gold: [5900, 9300], exp: [8600, 12800] },
  22: { id: 22, gold: [7600, 12000], exp: [11000, 16500] },
  23: { id: 23, gold: [9700, 15300], exp: [14000, 21000] },
  24: { id: 24, gold: [12500, 19500], exp: [18000, 27000] },
  25: { id: 25, gold: [16000, 25000], exp: [23000, 34500] },
  26: { id: 26, gold: [20500, 32000], exp: [29500, 44000] },
  27: { id: 27, gold: [26500, 41000], exp: [38000, 57000] },
  28: { id: 28, gold: [34000, 53000], exp: [49000, 73000] },
  29: { id: 29, gold: [44000, 68000], exp: [63000, 94000] },
  30: { id: 30, gold: [57000, 88000], exp: [82000, 123000] }
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== "object") {
    parent[key] = {};
  }

  return parent[key];
}

function getRewardZone(save) {
  const zoneId = Math.max(
    1,
    Math.min(30, Math.floor(Number(save.highestZone || save.zoneId || 1)))
  );

  return ZONE_REWARDS[zoneId] || ZONE_REWARDS[1];
}

function getOfflineKillsPerMinute(save) {
  const rawRate = Number(save?.offlineRate?.killsPerMinute || 7);

  return Math.max(1, Math.min(60, rawRate));
}

function calculateOfflineSummary(save) {
  const now = Date.now();
  const previousSeen = Number(save.lastSeenAt || now);

  const elapsedMs = Math.max(0, now - previousSeen);

  const maxOfflineMs = 8 * 60 * 60 * 1000;
  const minOfflineMs = 120 * 1000;

  const cappedMs = Math.min(elapsedMs, maxOfflineMs);

  if (cappedMs < minOfflineMs) {
    return null;
  }

  const minutes = cappedMs / 60000;
  const zone = getRewardZone(save);

  const activeKillsPerMinute = getOfflineKillsPerMinute(save);
  const offlineEfficiency = 0.75;

  const kills = Math.floor(minutes * activeKillsPerMinute * offlineEfficiency);

  if (kills <= 0) {
    return null;
  }

  let totalGold = 0;
  let totalExp = 0;
  let equipmentDrops = 0;
  let whetstones = 0;

  const essenceGains = {
    greenEssence: 0,
    blueEssence: 0,
    yellowEssence: 0,
    redEssence: 0
  };

  const salvageGains = {
    commonMaterial: 0,
    uncommonMaterial: 0,
    rareMaterial: 0,
    legendaryMaterial: 0
  };

  for (let i = 0; i < kills; i++) {
    totalGold += rand(zone.gold[0], zone.gold[1]);
    totalExp += rand(zone.exp[0], zone.exp[1]);

    if (Math.random() < 0.25) essenceGains.greenEssence++;
    if (Math.random() < 0.15) essenceGains.blueEssence++;
    if (Math.random() < 0.10) essenceGains.yellowEssence++;
    if (Math.random() < 0.05) essenceGains.redEssence++;

    if (Math.random() < 0.005) {
      equipmentDrops++;

      const rarityRoll = Math.random();

      if (rarityRoll < 0.6) salvageGains.commonMaterial++;
      else if (rarityRoll < 0.85) salvageGains.uncommonMaterial++;
      else if (rarityRoll < 0.97) salvageGains.rareMaterial++;
      else salvageGains.legendaryMaterial++;
    }

    const whetChance = (0.005 + zone.id * 0.0005) / 25;

    if (Math.random() < whetChance) {
      whetstones++;
    }
  }

  return {
    minutes,
    kills,
    activeKillsPerMinute,
    offlineEfficiency,
    totalGold,
    totalExp,
    equipmentDrops,
    whetstones,
    essenceGains,
    salvageGains
  };
}

function applyOfflineSummary(save, summary) {
  save.gold = Math.floor(Number(save.gold || 0) + summary.totalGold);

  const stats = ensureObject(save, "stats");

  stats.goldEarned = Math.floor(
    Number(stats.goldEarned || 0) + summary.totalGold
  );

  stats.expEarned = Math.floor(
    Number(stats.expEarned || 0) + summary.totalExp
  );

  stats.offlineKills = Math.floor(
    Number(stats.offlineKills || 0) + summary.kills
  );

  const materials = ensureObject(save, "materials");

  Object.entries(summary.essenceGains || {}).forEach(([key, amount]) => {
    materials[key] = Math.floor(Number(materials[key] || 0) + Number(amount || 0));
  });

  materials.whetstones = Math.floor(
    Number(materials.whetstones || 0) + Number(summary.whetstones || 0)
  );

  const salvageMaterials = ensureObject(save, "salvageMaterials");

  Object.entries(summary.salvageGains || {}).forEach(([key, amount]) => {
    salvageMaterials[key] = Math.floor(
      Number(salvageMaterials[key] || 0) + Number(amount || 0)
    );
  });

  const startLevel = Number(save.level || 1);

  applyBackendExpGain(save, summary.totalExp);

  summary.gainedLevels = Math.max(0, Number(save.level || 1) - startLevel);
}

router.post("/claim", authMiddleware, async (req, res) => {
  try {
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    const summary = calculateOfflineSummary(save);

    save.lastSeenAt = Date.now();

    if (!summary) {
      await savePlayerSave(req.user.id, save);

      return res.json({
        success: true,
        claimed: false,
        message: "No offline rewards available.",
        summary: null,
        save: {
          level: save.level,
          exp: save.exp,
          gold: save.gold,
          skillPoints: save.skillPoints,
          materials: save.materials,
          salvageMaterials: save.salvageMaterials,
          stats: save.stats
        }
      });
    }

    applyOfflineSummary(save, summary);

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      claimed: true,
      summary,
      save: {
        level: save.level,
        exp: save.exp,
        gold: save.gold,
        skillPoints: save.skillPoints,
        materials: save.materials,
        salvageMaterials: save.salvageMaterials,
        stats: save.stats
      }
    });
  } catch (error) {
    console.error("Offline claim failed:", error);

    res.status(500).json({
      success: false,
      message: "Offline claim failed."
    });
  }
});

module.exports = router;