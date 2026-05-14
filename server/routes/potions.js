const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const BASE_MAX_POTION_TIME_MS = 60 * 60 * 1000;

const POTIONS = [
  {
    key: "wealth",
    activeKey: "wealthUntil",
    durationMs: 5 * 60 * 1000,
    costs: {
      greenEssence: 25,
      blueEssence: 10,
      yellowEssence: 3
    }
  },
  {
    key: "wisdom",
    activeKey: "wisdomUntil",
    durationMs: 5 * 60 * 1000,
    costs: {
      greenEssence: 10,
      blueEssence: 15,
      yellowEssence: 4
    }
  },
  {
    key: "swiftness",
    activeKey: "swiftnessUntil",
    durationMs: 5 * 60 * 1000,
    costs: {
      greenEssence: 15,
      blueEssence: 15,
      yellowEssence: 10
    }
  }
];

function getMaxPotionTimeMs(save) {
  const bonusLevels =
    Number(save.rebirthUpgrades?.potionLimit || 0);

  return (
    BASE_MAX_POTION_TIME_MS +
    bonusLevels * 60 * 60 * 1000
  );
}

router.post("/craft", authMiddleware, async (req, res) => {
  try {
    const potionKey = String(req.body?.potionKey || "");

    const potion = POTIONS.find(
      p => p.key === potionKey
    );

    if (!potion) {
      return res.status(400).json({
        success: false,
        message: "Invalid potion."
      });
    }

    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    if (!save.materials) {
      save.materials = {};
    }

    if (!save.potions) {
      save.potions = {};
    }

    for (const [key, amount] of Object.entries(potion.costs)) {
      if (Number(save.materials[key] || 0) < amount) {
        return res.status(400).json({
          success: false,
          message: "Not enough materials."
        });
      }
    }

    const now = Date.now();

    const currentUntil =
      Number(save.potions[potion.activeKey] || 0);

    const currentRemaining = Math.max(
      0,
      currentUntil - now
    );

    if (
      currentRemaining >=
      getMaxPotionTimeMs(save)
    ) {
      return res.status(400).json({
        success: false,
        message: "Potion time limit reached."
      });
    }

    for (const [key, amount] of Object.entries(potion.costs)) {
      save.materials[key] =
        Math.floor(
          Number(save.materials[key] || 0) - amount
        );
    }

    const addedDuration = Math.min(
      potion.durationMs,
      getMaxPotionTimeMs(save) - currentRemaining
    );

    save.potions[potion.activeKey] =
      Math.max(now, currentUntil) +
      addedDuration;

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      potionKey,
      addedDuration,
      save
    });
  } catch (error) {
    console.error("Potion craft failed:", error);

    res.status(500).json({
      success: false,
      message: "Potion craft failed."
    });
  }
});

module.exports = router;