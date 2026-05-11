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
  1: { gold: [2, 5], exp: [4, 8], levelReq: 1 },
  2: { gold: [6, 12], exp: [10, 18], levelReq: 5 },
  3: { gold: [12, 22], exp: [18, 32], levelReq: 10 },
  4: { gold: [25, 45], exp: [40, 70], levelReq: 18 },
  5: { gold: [45, 80], exp: [75, 120], levelReq: 26 },
  6: { gold: [75, 130], exp: [120, 190], levelReq: 36 },
  7: { gold: [100, 170], exp: [165, 260], levelReq: 48 },
  8: { gold: [135, 230], exp: [220, 340], levelReq: 60 },
  9: { gold: [190, 320], exp: [310, 480], levelReq: 75 },
  10: { gold: [270, 450], exp: [430, 680], levelReq: 90 },
  11: { gold: [380, 620], exp: [600, 920], levelReq: 110 },
  12: { gold: [520, 850], exp: [820, 1250], levelReq: 130 },
  13: { gold: [690, 1120], exp: [1100, 1650], levelReq: 155 },
  14: { gold: [900, 1450], exp: [1450, 2150], levelReq: 180 },
  15: { gold: [1180, 1900], exp: [1850, 2800], levelReq: 210 },
  16: { gold: [1550, 2500], exp: [2400, 3600], levelReq: 240 },
  17: { gold: [2050, 3300], exp: [3100, 4600], levelReq: 275 },
  18: { gold: [2700, 4300], exp: [4000, 6000], levelReq: 310 },
  19: { gold: [3500, 5600], exp: [5200, 7800], levelReq: 350 },
  20: { gold: [4500, 7200], exp: [6800, 10000], levelReq: 390 },
  21: { gold: [5900, 9300], exp: [8600, 12800], levelReq: 435 },
  22: { gold: [7600, 12000], exp: [11000, 16500], levelReq: 480 },
  23: { gold: [9700, 15300], exp: [14000, 21000], levelReq: 530 },
  24: { gold: [12500, 19500], exp: [18000, 27000], levelReq: 580 },
  25: { gold: [16000, 25000], exp: [23000, 34500], levelReq: 635 },
  26: { gold: [20500, 32000], exp: [29500, 44000], levelReq: 690 },
  27: { gold: [26500, 41000], exp: [38000, 57000], levelReq: 750 },
  28: { gold: [34000, 53000], exp: [49000, 73000], levelReq: 810 },
  29: { gold: [44000, 68000], exp: [63000, 94000], levelReq: 875 },
  30: { gold: [57000, 88000], exp: [82000, 123000], levelReq: 940 }
};

function getFishingRewardZone(save) {
  const currentZoneId = Number(save.zoneId || 1);
  const currentZone = ZONE_REWARDS[currentZoneId];

  if (currentZone) {
    return currentZone;
  }

  return Object.values(ZONE_REWARDS)
    .filter(zone => Number(save.level || 1) >= zone.levelReq)
    .sort((a, b) => b.levelReq - a.levelReq)[0] || ZONE_REWARDS[1];
}

function getFishingGoldRewardPerFish(save) {
  const level = Number(save?.fishing?.shopUpgrades?.goldenFish || 0);
  if (level <= 0) return 0;

  const zone = getFishingRewardZone(save);
  const averageGold = (zone.gold[0] + zone.gold[1]) / 2;

  return Math.floor(averageGold * (level * 0.01));
}

function getFishingExpRewardPerFish(save) {
  const level = Number(save?.fishing?.shopUpgrades?.powerfulFish || 0);
  if (level <= 0) return 0;

  const zone = getFishingRewardZone(save);
  const averageExp = (zone.exp[0] + zone.exp[1]) / 2;

  return Math.floor(averageExp * (level * 0.01));
}

router.post("/shop-reward", authMiddleware, async (req, res) => {
  try {
    const fishCaught = Math.max(
      0,
      Math.min(1000, Math.floor(Number(req.body?.fishCaught || 0)))
    );

    if (fishCaught <= 0) {
      return res.json({
        success: true,
        reward: {
          gold: 0,
          exp: 0
        }
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    if (!save.fishing || typeof save.fishing !== "object") {
      save.fishing = {};
    }

    if (!save.fishing.shopUpgrades || typeof save.fishing.shopUpgrades !== "object") {
      save.fishing.shopUpgrades = {};
    }

    const goldGain = getFishingGoldRewardPerFish(save) * fishCaught;
    const expGain = getFishingExpRewardPerFish(save) * fishCaught;

    save.gold = Math.floor(Number(save.gold || 0) + goldGain);

    if (!save.stats || typeof save.stats !== "object") {
      save.stats = {};
    }

    save.stats.goldEarned = Math.floor(
      Number(save.stats.goldEarned || 0) + goldGain
    );

    save.stats.expEarned = Math.floor(
      Number(save.stats.expEarned || 0) + expGain
    );

    applyBackendExpGain(save, expGain);

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      reward: {
        gold: goldGain,
        exp: expGain,
        level: save.level,
        currentExp: save.exp,
        skillPoints: save.skillPoints
      }
    });
  } catch (error) {
    console.error("Fishing shop reward failed:", error);

    res.status(500).json({
      success: false,
      message: "Fishing shop reward failed."
    });
  }
});

module.exports = router;