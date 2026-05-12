const express = require("express");
const authMiddleware = require("../middleware/auth");

const {
  applyBackendExpGain
} = require("../backendProgression");

const {
  loadPlayerSave,
  savePlayerSave
} = require("../dbSaves");

const router = express.Router();

const SLOT_COIN_INTERVAL_MS = 10 * 1000;

const SLOT_REWARD_POOL = [
  { key: "goldSmall", type: "gold", amount: 500, weight: 100 },
  { key: "goldBig", type: "gold", amount: 2500, weight: 35 },
  { key: "expSmall", type: "exp", amount: 300, weight: 90 },
  { key: "expBig", type: "exp", amount: 1500, weight: 30 },

  { key: "greenEssence", type: "material", materialKey: "greenEssence", amount: 50, weight: 75 },
  { key: "blueEssence", type: "material", materialKey: "blueEssence", amount: 35, weight: 55 },
  { key: "yellowEssence", type: "material", materialKey: "yellowEssence", amount: 20, weight: 35 },
  { key: "redEssence", type: "material", materialKey: "redEssence", amount: 10, weight: 18 },
  { key: "whetstones", type: "material", materialKey: "whetstones", amount: 5, weight: 15 },

  { key: "fish", type: "fish", amount: 250, weight: 45 },
  { key: "stars", type: "stars", amount: 150, weight: 35 },
  { key: "slotCoin", type: "slotCoin", amount: 1, weight: 22 },
  { key: "skillPoint", type: "skillPoint", amount: 1, weight: 8 },
  { key: "skinShard", type: "skinShard", amount: 25, weight: 18 },
  { key: "jackpot", type: "jackpot", weight: 4 }
];

function pickWeightedSlotReward() {
  const total = SLOT_REWARD_POOL.reduce(
    (sum, reward) => sum + reward.weight,
    0
  );

  let roll = Math.random() * total;

  for (const reward of SLOT_REWARD_POOL) {
    roll -= reward.weight;

    if (roll <= 0) {
      return { ...reward };
    }
  }

  return { ...SLOT_REWARD_POOL[0] };
}

function ensureRewards(save) {
  if (!save.rewards || typeof save.rewards !== "object") {
    save.rewards = {};
  }

  if (!Array.isArray(save.rewards.slotOptions)) {
    save.rewards.slotOptions = [];
  }

  save.rewards.slotCoins = Math.floor(Number(save.rewards.slotCoins || 0));

  if (!save.rewards.lastCoinAt) {
    save.rewards.lastCoinAt = Date.now();
  }
}

function ensureRewardContainers(save) {
  if (!save.materials || typeof save.materials !== "object") {
    save.materials = {};
  }

  if (!save.stats || typeof save.stats !== "object") {
    save.stats = {};
  }

  if (!save.skins || typeof save.skins !== "object") {
    save.skins = {};
  }

  if (!save.fishing || typeof save.fishing !== "object") {
    save.fishing = {};
  }
}

function updateRewardCoins(save) {
  ensureRewards(save);

  const now = Date.now();
  const elapsed = now - Number(save.rewards.lastCoinAt || now);
  const coinsToAdd = Math.floor(elapsed / SLOT_COIN_INTERVAL_MS);

  if (coinsToAdd > 0) {
    save.rewards.slotCoins += coinsToAdd;
    save.rewards.lastCoinAt += coinsToAdd * SLOT_COIN_INTERVAL_MS;
  }
}

function addGold(save, amount) {
  const gained = Math.max(0, Math.floor(Number(amount || 0)));

  save.gold = Math.floor(Number(save.gold || 0) + gained);

  save.stats.goldEarned = Math.floor(
    Number(save.stats.goldEarned || 0) + gained
  );

  return gained;
}

function addExp(save, amount) {
  const gained = Math.max(0, Math.floor(Number(amount || 0)));

  applyBackendExpGain(save, gained);

  save.stats.expEarned = Math.floor(
    Number(save.stats.expEarned || 0) + gained
  );

  return gained;
}

router.post("/spin", authMiddleware, async (req, res) => {
  try {
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRewards(save);
    updateRewardCoins(save);

    if (save.rewards.slotCoins <= 0) {
      return res.status(400).json({
        success: false,
        message: "No Silver Tokens."
      });
    }

    if (save.rewards.slotOptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Claim current rewards first."
      });
    }

    save.rewards.slotCoins--;

    save.rewards.slotOptions = [
      pickWeightedSlotReward(),
      pickWeightedSlotReward(),
      pickWeightedSlotReward()
    ];

    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      rewards: save.rewards
    });
  } catch (error) {
    console.error("Reward spin failed:", error);

    res.status(500).json({
      success: false,
      message: "Reward spin failed."
    });
  }
});

router.post("/claim", authMiddleware, async (req, res) => {
  try {
    const index = Math.floor(Number(req.body?.index));
    const save = await loadPlayerSave(req.user.id);

    if (!save) {
      return res.status(400).json({
        success: false,
        message: "No cloud save found."
      });
    }

    ensureRewards(save);
    ensureRewardContainers(save);

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= save.rewards.slotOptions.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward."
      });
    }

    const reward = save.rewards.slotOptions[index];

    if (!reward) {
      return res.status(400).json({
        success: false,
        message: "Invalid reward."
      });
    }

    const level = Math.max(1, Number(save.level || 1));

    if (reward.type === "gold") {
      addGold(save, reward.amount * level);
    }

    if (reward.type === "exp") {
      addExp(save, reward.amount * level);
    }

    if (reward.type === "material") {
      save.materials[reward.materialKey] = Math.floor(
        Number(save.materials[reward.materialKey] || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "fish") {
      save.fishing.fish = Math.floor(
        Number(save.fishing.fish || 0) +
        Number(reward.amount || 0)
      );

      save.fishing.caughtFish = Math.floor(
        Number(save.fishing.caughtFish || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "stars") {
      save.stars = Math.floor(
        Number(save.stars || 0) +
        Number(reward.amount || 0)
      );

      save.starsEarned = Math.floor(
        Number(save.starsEarned || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "slotCoin") {
      save.rewards.slotCoins = Math.floor(
        Number(save.rewards.slotCoins || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "skillPoint") {
      save.skillPoints = Math.floor(
        Number(save.skillPoints || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "skinShard") {
      save.skins.shards = Math.floor(
        Number(save.skins.shards || 0) +
        Number(reward.amount || 0)
      );
    }

    if (reward.type === "jackpot") {
      const goldAmount = Math.floor(10000 * level);
      const expAmount = Math.floor(5000 * level);

      addGold(save, goldAmount);
      addExp(save, expAmount);

      save.skillPoints = Math.floor(
        Number(save.skillPoints || 0) + 2
      );

      save.materials.redEssence = Math.floor(
        Number(save.materials.redEssence || 0) + 10
      );

      save.skins.shards = Math.floor(
        Number(save.skins.shards || 0) + 100
      );
    }

    save.rewards.slotOptions.splice(index, 1);
    save.lastSeenAt = Date.now();

    await savePlayerSave(req.user.id, save);

    res.json({
      success: true,
      reward,
      save
    });
  } catch (error) {
    console.error("Reward claim failed:", error);

    res.status(500).json({
      success: false,
      message: "Reward claim failed."
    });
  }
});

module.exports = router;